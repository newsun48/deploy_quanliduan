package com.projectmanagement.core_system.service;

import com.projectmanagement.core_system.model.ProjectMessage;
import com.projectmanagement.core_system.model.Project;
import com.projectmanagement.core_system.model.User;
import com.projectmanagement.core_system.repository.ProjectMessageRepository;
import com.projectmanagement.core_system.repository.ProjectRepository;
import com.projectmanagement.core_system.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import java.util.logging.Logger;

@Service
public class ProjectMessageService {

    @Autowired
    private ProjectMessageRepository projectMessageRepository;

    @Autowired
    private ProjectRepository projectRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    private static final Logger logger = Logger.getLogger(ProjectMessageService.class.getName());
    private static final long MAX_EDIT_DELETE_MINUTES = 60; // 1 giờ

    // ==================== GROUP CHAT ====================

    // Lấy tin nhắn group chat (có kiểm tra quyền truy cập)
    public List<ProjectMessage> getMessagesByProjectIdWithAccess(String projectId, String userId) {
        User currentUser = getAuthenticatedUser();
        if (!currentUser.getId().equals(userId)) {
            throw new RuntimeException("Bạn không có quyền xem chat dự án này!");
        }

        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new RuntimeException("Dự án không tồn tại!"));

        if (!canUserAccessProjectChat(currentUser.getId(), project)) {
            throw new RuntimeException("Bạn không có quyền xem chat dự án này!");
        }

        return projectMessageRepository.findByProjectIdOrderByCreatedAtAsc(projectId);
    }

    // ==================== PRIVATE CHAT ====================

    // Lấy tin nhắn private giữa 2 user
    public List<ProjectMessage> getPrivateMessages(String userId1, String userId2) {
        User currentUser = getAuthenticatedUser();

        if (!currentUser.getId().equals(userId1) && !currentUser.getId().equals(userId2)) {
            throw new RuntimeException("Bạn không có quyền xem tin nhắn riêng tư này!");
        }

        User user1 = findUserById(userId1, "Người dùng không tồn tại!");
        User user2 = findUserById(userId2, "Người dùng không tồn tại!");
        ensureSameDepartment(user1, user2);

        return projectMessageRepository.findByReceiverIsNotNullOrderByCreatedAtAsc()
                .stream()
                .filter(message -> message.getSender() != null && message.getReceiver() != null)
                .filter(message -> isPrivateConversationMatch(message, userId1, userId2))
                .collect(Collectors.toList());
    }

    // ==================== SEND MESSAGE (Chung cho cả 2) ====================

    public ProjectMessage sendMessage(Map<String, String> payload) {
        String senderId = payload.get("senderId");
        String projectId = payload.get("projectId");
        String receiverId = payload.get("receiverId");
        String content = payload.get("content");
        String messageType = payload.getOrDefault("messageType", "TEXT");
        String fileUrl = payload.get("fileUrl");
        String replyToId = payload.get("replyToId");

        User authenticatedUser = getAuthenticatedUser();
        if (senderId != null && !senderId.isBlank() && !authenticatedUser.getId().equals(senderId)) {
            throw new RuntimeException("Bạn không có quyền gửi tin nhắn dưới danh nghĩa người dùng khác!");
        }
        senderId = authenticatedUser.getId();

        // Build message
        ProjectMessage message = new ProjectMessage();
        message.setContent(content);
        message.setMessageType(messageType);
        message.setFileUrl(fileUrl);
        message.setSender(authenticatedUser);
        message.setCreatedAt(LocalDateTime.now());
        message.setUpdatedAt(LocalDateTime.now());

        // Reply
        if (replyToId != null && !replyToId.isEmpty()) {
            ProjectMessage replyTo = projectMessageRepository.findById(replyToId).orElse(null);
            message.setReplyTo(replyTo);
        }

        // Xác định Group Chat hay Private Chat
        boolean isPrivateChat = (receiverId != null && !receiverId.isEmpty());

        if (isPrivateChat) {
            // === PRIVATE CHAT ===
            User receiver = findUserById(receiverId, "Người nhận không tồn tại!");
            ensureSameDepartment(authenticatedUser, receiver);

            message.setReceiver(receiver);
            message.setProject(null); // Private chat không thuộc project

            ProjectMessage saved = projectMessageRepository.save(message);
            logger.info("✅ Private message saved: " + saved.getId());

            // Broadcast qua WebSocket tới cả sender và receiver
            messagingTemplate.convertAndSendToUser(receiver.getEmail(), "/queue/messages", saved);
            messagingTemplate.convertAndSendToUser(authenticatedUser.getEmail(), "/queue/messages", saved);

            return saved;
        } else {
            // === GROUP CHAT ===
            if (projectId == null || projectId.isEmpty()) {
                throw new RuntimeException("projectId không được trống cho group chat!");
            }

            Project project = projectRepository.findById(projectId)
                    .orElseThrow(() -> new RuntimeException("Dự án không tồn tại!"));

            // Kiểm tra quyền truy cập
            if (!canUserAccessProjectChat(authenticatedUser.getId(), project)) {
                throw new RuntimeException("Không có quyền chat dự án này!");
            }

            message.setProject(project);
            message.setReceiver(null);

            ProjectMessage saved = projectMessageRepository.save(message);
            logger.info("✅ Group message saved: " + saved.getId() + " to project: " + projectId);

            // Broadcast qua WebSocket tới topic project
            messagingTemplate.convertAndSend("/topic/project/" + projectId, saved);

            return saved;
        }
    }

    // ==================== UPDATE MESSAGE (1-hour check) ====================

    public ProjectMessage updateMessage(String messageId, String newContent) {
        ProjectMessage message = projectMessageRepository.findById(messageId)
                .orElseThrow(() -> new RuntimeException("Tin nhắn không tồn tại!"));

        // Kiểm tra quyền sở hữu (chỉ chính chủ mới được sửa)
        String currentUserEmail = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication().getName();
        if (message.getSender() == null || !message.getSender().getEmail().equals(currentUserEmail)) {
            logger.warning("❌ Access Denied: User " + currentUserEmail + " tried to edit message " + messageId + " owned by " + (message.getSender() != null ? message.getSender().getEmail() : "null"));
            throw new RuntimeException("Bạn không có quyền sửa tin nhắn của người khác!");
        }

        // Kiểm tra thời gian 1 giờ
        Duration duration = Duration.between(message.getCreatedAt(), LocalDateTime.now());
        if (duration.toMinutes() > MAX_EDIT_DELETE_MINUTES) {
            throw new RuntimeException("Không thể sửa tin nhắn sau 1 giờ!");
        }

        if (newContent == null || newContent.trim().isEmpty()) {
            throw new RuntimeException("Nội dung trống!");
        }

        message.setContent(newContent);
        message.setEdited(true);
        message.setUpdatedAt(LocalDateTime.now());
        ProjectMessage saved = projectMessageRepository.save(message);

        // Broadcast update qua WebSocket
        broadcastMessageUpdate(saved);

        return saved;
    }

    // ==================== DELETE MESSAGE (Soft Delete + 1-hour check) ====================

    public ProjectMessage deleteMessage(String messageId) {
        ProjectMessage message = projectMessageRepository.findById(messageId)
                .orElseThrow(() -> new RuntimeException("Tin nhắn không tồn tại!"));

        // Kiểm tra quyền sở hữu (chỉ chính chủ mới được thu hồi)
        String currentUserEmail = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication().getName();
        if (message.getSender() == null || !message.getSender().getEmail().equals(currentUserEmail)) {
            logger.warning("❌ Access Denied: User " + currentUserEmail + " tried to delete message " + messageId + " owned by " + (message.getSender() != null ? message.getSender().getEmail() : "null"));
            throw new RuntimeException("Bạn không có quyền thu hồi tin nhắn của người khác!");
        }

        // Kiểm tra thời gian 1 giờ
        Duration duration = Duration.between(message.getCreatedAt(), LocalDateTime.now());
        if (duration.toMinutes() > MAX_EDIT_DELETE_MINUTES) {
            throw new RuntimeException("Không thể thu hồi tin nhắn sau 1 giờ!");
        }

        // Soft delete: giữ lại record nhưng ẩn nội dung
        message.setDeleted(true);
        message.setContent("Tin nhắn đã bị thu hồi");
        message.setUpdatedAt(LocalDateTime.now());
        ProjectMessage saved = projectMessageRepository.save(message);

        // Broadcast delete qua WebSocket
        broadcastMessageUpdate(saved);

        return saved;
    }

    // ==================== HELPER METHODS ====================

    private void broadcastMessageUpdate(ProjectMessage message) {
        if (message.getProject() != null) {
            // Group chat
            messagingTemplate.convertAndSend(
                    "/topic/project/" + message.getProject().getId(), message);
        } else if (message.getReceiver() != null && message.getSender() != null) {
            // Private chat
            messagingTemplate.convertAndSendToUser(
                    message.getReceiver().getEmail(), "/queue/messages", message);
            messagingTemplate.convertAndSendToUser(
                    message.getSender().getEmail(), "/queue/messages", message);
        }
    }

    private boolean canUserAccessProjectChat(String userId, Project project) {
        logger.info("🔍 Check access - user: " + userId + ", project: " + project.getId());

        // 1. Member
        boolean isMember = project.getMembers().stream()
                .anyMatch(member -> member.getId().equals(userId));
        if (isMember) {
            logger.info("✅ MEMBER");
            return true;
        }

        // 2. Dept manager
        if (project.getDepartment() != null && project.getDepartment().getManager() != null) {
            boolean isDeptManager = project.getDepartment().getManager().getId().equals(userId);
            if (isDeptManager) {
                logger.info("✅ DEPT MANAGER");
                return true;
            }
        }

        // 3. Project manager
        if (project.getManager() != null && project.getManager().getId().equals(userId)) {
            logger.info("✅ PROJECT MANAGER");
            return true;
        }

        logger.warning("❌ DENIED: " + userId);
        return false;
    }

    private User getAuthenticatedUser() {
        org.springframework.security.core.Authentication authentication =
                org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();

        if (authentication == null || authentication.getName() == null || authentication.getName().isBlank()) {
            throw new RuntimeException("Thiếu thông tin xác thực người dùng!");
        }

        String currentUserEmail = authentication.getName();
        return userRepository.findByEmailIgnoreCase(currentUserEmail)
                .orElseThrow(() -> new RuntimeException("Người dùng không tồn tại!"));
    }

    private User findUserById(String userId, String notFoundMessage) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException(notFoundMessage));
    }

    private void ensureSameDepartment(User firstUser, User secondUser) {
        if (firstUser.getDepartment() == null || secondUser.getDepartment() == null) {
            throw new RuntimeException("Chỉ có thể nhắn tin riêng với người cùng phòng ban!");
        }

        String firstDepartmentId = firstUser.getDepartment().getId();
        String secondDepartmentId = secondUser.getDepartment().getId();

        if (firstDepartmentId == null || secondDepartmentId == null || !firstDepartmentId.equals(secondDepartmentId)) {
            throw new RuntimeException("Chỉ có thể nhắn tin riêng với người cùng phòng ban!");
        }
    }

    private boolean isPrivateConversationMatch(ProjectMessage message, String userId1, String userId2) {
        String senderId = message.getSender().getId();
        String receiverId = message.getReceiver().getId();

        return (userId1.equals(senderId) && userId2.equals(receiverId))
                || (userId2.equals(senderId) && userId1.equals(receiverId));
    }
}

