package com.projectmanagement.core_system.service;

import com.projectmanagement.core_system.enums.ERole;
import com.projectmanagement.core_system.model.AttachmentInfo;
import com.projectmanagement.core_system.model.Comment;
import com.projectmanagement.core_system.model.Project;
import com.projectmanagement.core_system.model.Task;
import com.projectmanagement.core_system.model.User;
import com.projectmanagement.core_system.repository.CommentRepository;
import com.projectmanagement.core_system.repository.ProjectRepository;
import com.projectmanagement.core_system.repository.TaskRepository;
import com.projectmanagement.core_system.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class CommentService {

    @Autowired
    private CommentRepository commentRepository;

    @Autowired
    private TaskRepository taskRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ProjectRepository projectRepository;

    @Autowired
    private NotificationService notificationService;

    @Autowired
    private TaskActivityService taskActivityService;

    @Autowired
    private UserActivityService userActivityService;

    // 1. Get all comments by Task ID
    public List<Comment> getCommentsByTaskId(String taskId, String actorEmail) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new RuntimeException("Task không tồn tại!"));
        User actor = requireActiveUser(actorEmail);
        ensureCanAccessTask(actor, task);
        return commentRepository.findByTaskIdOrderByCreatedAtAsc(taskId);
    }

    // 1b. 🆕 Get all comments by Project ID (từ tasks của project)
    public List<Comment> getCommentsByProjectId(String projectId, String actorEmail) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new RuntimeException("Dự án không tồn tại!"));
        User actor = requireActiveUser(actorEmail);
        ensureCanAccessProject(actor, project);

        // Lấy tất cả tasks của project
        List<Task> tasks = taskRepository.findByProject(project);
        
        // Lấy tất cả comments của các tasks đó (kèm project info)
        return tasks.stream()
                .flatMap(task -> commentRepository.findByTaskIdOrderByCreatedAtAsc(task.getId()).stream())
                .sorted((c1, c2) -> c1.getCreatedAt().compareTo(c2.getCreatedAt()))
                .toList();
    }

    // 2. Add new comment
    public Comment addComment(String taskId, String userId, String actorEmail, String content, List<AttachmentInfo> attachments) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new RuntimeException("Task không tồn tại!"));
        User author = requireActiveUser(actorEmail);
        ensureCanAccessTask(author, task);

        if (StringUtils.hasText(userId) && !author.getId().equals(userId)) {
            throw new AccessDeniedException("Bạn không có quyền bình luận dưới danh nghĩa người dùng khác!");
        }

        if ((content == null || content.trim().isEmpty()) && (attachments == null || attachments.isEmpty())) {
            throw new RuntimeException("Bình luận phải có nội dung hoặc file đính kèm!");
        }

        Comment comment = new Comment();
        comment.setContent(content != null ? content.trim() : "");
        comment.setAuthor(author);
        comment.setTask(task);
        comment.setCreatedAt(LocalDateTime.now());
        comment.setUpdatedAt(LocalDateTime.now());
        comment.setAttachments(buildCommentAttachments(author, attachments));

        Comment savedComment = commentRepository.save(comment);

        // 🔥 Bắn thông báo Comment
        User assignee = task.getAssignee();
        User manager = task.getProject().getDepartment() != null ? task.getProject().getDepartment().getManager() : null;

        String message = author.getFullName() + " đã bình luận về công việc: '" + task.getTitle() + "'";

        // 1. Nếu người comment là Manager -> Báo cho Assignee
        if (manager != null && author.getId().equals(manager.getId()) && assignee != null && !assignee.getId().equals(author.getId())) {
            notificationService.createNotification(assignee, author, task, message, "COMMENT_ADDED");
        } 
        // 2. Nếu người comment là Assignee -> Báo cho Manager
        else if (assignee != null && author.getId().equals(assignee.getId()) && manager != null && !manager.getId().equals(author.getId())) {
            notificationService.createNotification(manager, author, task, message, "COMMENT_ADDED");
        }
        // 3. Người khác (Admin?) comment -> Báo cho cả 2
        else {
            if (assignee != null && !assignee.getId().equals(author.getId())) {
                notificationService.createNotification(assignee, author, task, message, "COMMENT_ADDED");
            }
            if (manager != null && !manager.getId().equals(author.getId()) && (assignee == null || !manager.getId().equals(assignee.getId()))) {
                notificationService.createNotification(manager, author, task, message, "COMMENT_ADDED");
            }
        }

        taskActivityService.record(task, author, "COMMENT_ADDED",
                author.getFullName() + " đã thêm bình luận",
                Map.of(
                        "commentId", savedComment.getId(),
                        "attachmentCount", savedComment.getAttachments().size()
                ));
        userActivityService.record(author, author, "COMMENT_ADDED",
                author.getFullName() + " đã bình luận trong task '" + task.getTitle() + "'",
                Map.of("commentId", savedComment.getId(), "taskId", task.getId()));

        return savedComment;
    }

    // 3. Update comment
    public Comment updateComment(String commentId, String actorEmail, String newContent) {
        Comment comment = commentRepository.findById(commentId)
                .orElseThrow(() -> new RuntimeException("Bình luận không tồn tại!"));
        User actor = requireActiveUser(actorEmail);
        ensureCanModifyComment(actor, comment);

        if (newContent == null || newContent.trim().isEmpty()) {
            throw new RuntimeException("Nội dung bình luận không được trống!");
        }

        comment.setContent(newContent);
        comment.setUpdatedAt(LocalDateTime.now());
        Comment savedComment = commentRepository.save(comment);
        taskActivityService.record(comment.getTask(), actor, "COMMENT_UPDATED",
                actor.getFullName() + " đã chỉnh sửa bình luận",
                Map.of("commentId", savedComment.getId()));
        userActivityService.record(actor, comment.getAuthor(), "COMMENT_UPDATED",
                actor.getFullName() + " đã chỉnh sửa bình luận trong task '" + comment.getTask().getTitle() + "'",
                Map.of("commentId", savedComment.getId(), "taskId", comment.getTask().getId()));
        return savedComment;
    }

    // 4. Delete comment
    public void deleteComment(String commentId, String actorEmail) {
        Comment comment = commentRepository.findById(commentId)
                .orElseThrow(() -> new RuntimeException("Bình luận không tồn tại!"));
        User actor = requireActiveUser(actorEmail);
        ensureCanModifyComment(actor, comment);
        commentRepository.deleteById(commentId);
        taskActivityService.record(comment.getTask(), actor, "COMMENT_DELETED",
                actor.getFullName() + " đã xóa bình luận",
                Map.of("commentId", commentId));
        userActivityService.record(actor, comment.getAuthor(), "COMMENT_DELETED",
                actor.getFullName() + " đã xóa bình luận trong task '" + comment.getTask().getTitle() + "'",
                Map.of("commentId", commentId, "taskId", comment.getTask().getId()));
    }

    private User requireActiveUser(String email) {
        if (!StringUtils.hasText(email)) {
            throw new AccessDeniedException("Thiếu thông tin người dùng thực hiện!");
        }

        User actor = userRepository.findByEmailIgnoreCase(email.trim().toLowerCase())
                .orElseThrow(() -> new AccessDeniedException("Người dùng thực hiện không tồn tại!"));

        if (!actor.isActive()) {
            throw new AccessDeniedException("Tài khoản của bạn đang bị khóa!");
        }

        return actor;
    }

    private void ensureCanAccessTask(User actor, Task task) {
        if (actor.getRole() == ERole.ADMIN) {
            return;
        }

        if (task.getAssignee() != null && StringUtils.hasText(task.getAssignee().getId()) && task.getAssignee().getId().equals(actor.getId())) {
            return;
        }

        Project project = task.getProject();
        ensureCanAccessProject(actor, project);
    }

    private void ensureCanAccessProject(User actor, Project project) {
        if (actor.getRole() == ERole.ADMIN) {
            return;
        }

        if (project == null) {
            throw new AccessDeniedException("Dự án không hợp lệ!");
        }

        if (project.getDepartment() != null && project.getDepartment().getManager() != null && StringUtils.hasText(project.getDepartment().getManager().getId()) && project.getDepartment().getManager().getId().equals(actor.getId())) {
            return;
        }

        if (project.getMembers() != null && project.getMembers().stream()
                .filter(member -> member != null && StringUtils.hasText(member.getId()))
                .anyMatch(member -> member.getId().equals(actor.getId()))) {
            return;
        }

        throw new AccessDeniedException("Bạn không có quyền truy cập bình luận của dự án này!");
    }

    private void ensureCanModifyComment(User actor, Comment comment) {
        if (comment.getAuthor() != null && StringUtils.hasText(comment.getAuthor().getId()) && comment.getAuthor().getId().equals(actor.getId())) {
            return;
        }

        if (actor.getRole() == ERole.ADMIN) {
            return;
        }

        Task task = comment.getTask();
        if (task != null && task.getProject() != null && task.getProject().getDepartment() != null && task.getProject().getDepartment().getManager() != null
                && StringUtils.hasText(task.getProject().getDepartment().getManager().getId())
                && task.getProject().getDepartment().getManager().getId().equals(actor.getId())) {
            return;
        }

        throw new AccessDeniedException("Bạn không có quyền chỉnh sửa hoặc xóa bình luận này!");
    }

    private List<AttachmentInfo> buildCommentAttachments(User author, List<AttachmentInfo> attachments) {
        List<AttachmentInfo> normalizedAttachments = new ArrayList<>();
        if (attachments == null) {
            return normalizedAttachments;
        }

        for (AttachmentInfo item : attachments) {
            if (item == null || item.getUrl() == null || item.getUrl().isBlank()) {
                continue;
            }

            AttachmentInfo attachment = new AttachmentInfo();
            attachment.setId(UUID.randomUUID().toString());
            attachment.setUrl(item.getUrl());
            attachment.setOriginalName(item.getOriginalName());
            attachment.setSize(item.getSize());
            attachment.setUploadedById(author.getId());
            attachment.setUploadedByName(author.getFullName());
            attachment.setUploadedAt(System.currentTimeMillis());
            normalizedAttachments.add(attachment);
        }

        return normalizedAttachments;
    }
}
