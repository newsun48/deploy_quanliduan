package com.projectmanagement.core_system.service;

import com.projectmanagement.core_system.model.ProjectMessage;
import com.projectmanagement.core_system.model.Project;
import com.projectmanagement.core_system.model.User;
import com.projectmanagement.core_system.repository.ProjectMessageRepository;
import com.projectmanagement.core_system.repository.ProjectRepository;
import com.projectmanagement.core_system.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.time.LocalDateTime;
import java.util.List;
import java.util.logging.Logger;

@Service
public class ProjectMessageService {

    @Autowired
    private ProjectMessageRepository projectMessageRepository;

    @Autowired
    private ProjectRepository projectRepository;

    @Autowired
    private UserRepository userRepository;

    private static final Logger logger = Logger.getLogger(ProjectMessageService.class.getName());

    // 1. Get all messages by Project ID
    public List<ProjectMessage> getMessagesByProjectId(String projectId) {
        return projectMessageRepository.findByProjectIdOrderByCreatedAtAsc(projectId);
    }

    // 1b. Get all messages by Project ID with access control
    public List<ProjectMessage> getMessagesByProjectIdWithAccess(String projectId, String userId) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new RuntimeException("Dự án không tồn tại!"));

        // Kiểm tra quyền truy cập trước khi lấy messages
        if (!canUserAccessProjectChat(userId, project)) {
            throw new RuntimeException("Bạn không có quyền xem chat dự án này!");
        }

        return projectMessageRepository.findByProjectIdOrderByCreatedAtAsc(projectId);
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

        // 3. MANAGER role
        User user = userRepository.findById(userId).orElse(null);
        if (user != null && user.getRole() != null && "MANAGER".equals(user.getRole().name())) {
            logger.info("✅ MANAGER ROLE");
            return true;
        }

        logger.warning("❌ DENIED: " + userId);
        return false;
    }

    // 2. Send message
    public ProjectMessage sendMessage(String projectId, String userId, String content) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new RuntimeException("Dự án không tồn tại!"));

        User sender = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("Người dùng không tồn tại!"));

        // Permission with auto-fix
        if (!canUserAccessProjectChat(userId, project)) {
            // Auto-add dept manager
            if (project.getDepartment() != null && project.getDepartment().getManager() != null 
                && project.getDepartment().getManager().getId().equals(userId)) {
                if (!project.getMembers().stream().anyMatch(m -> m.getId().equals(userId))) {
                    project.getMembers().add(sender);
                    projectRepository.save(project);
                    logger.info("✅ AUTO-ADD MANAGER " + userId + " to project");
                }
            } else {
                throw new RuntimeException("Không có quyền chat dự án này! (Cần là thành viên/trưởng phòng)");
            }
        }

        if (content == null || content.trim().isEmpty()) {
            throw new RuntimeException("Nội dung trống!");
        }

        ProjectMessage message = new ProjectMessage();
        message.setContent(content);
        message.setSender(sender);
        message.setProject(project);
        message.setCreatedAt(LocalDateTime.now());
        message.setUpdatedAt(LocalDateTime.now());

        return projectMessageRepository.save(message);
    }

    // 3. Update
    public ProjectMessage updateMessage(String messageId, String newContent) {
        ProjectMessage message = projectMessageRepository.findById(messageId)
                .orElseThrow(() -> new RuntimeException("Tin nhắn không tồn tại!"));

        if (newContent == null || newContent.trim().isEmpty()) {
            throw new RuntimeException("Nội dung trống!");
        }

        message.setContent(newContent);
        message.setUpdatedAt(LocalDateTime.now());
        return projectMessageRepository.save(message);
    }

    // 4. Delete
    public void deleteMessage(String messageId) {
        if (!projectMessageRepository.existsById(messageId)) {
            throw new RuntimeException("Tin nhắn không tồn tại!");
        }
        projectMessageRepository.deleteById(messageId);
    }
}
