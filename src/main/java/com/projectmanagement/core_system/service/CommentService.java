package com.projectmanagement.core_system.service;

import com.projectmanagement.core_system.model.Comment;
import com.projectmanagement.core_system.model.Project;
import com.projectmanagement.core_system.model.Task;
import com.projectmanagement.core_system.model.User;
import com.projectmanagement.core_system.repository.CommentRepository;
import com.projectmanagement.core_system.repository.ProjectRepository;
import com.projectmanagement.core_system.repository.TaskRepository;
import com.projectmanagement.core_system.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.time.LocalDateTime;
import java.util.List;

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

    // 1. Get all comments by Task ID
    public List<Comment> getCommentsByTaskId(String taskId) {
        return commentRepository.findByTaskIdOrderByCreatedAtAsc(taskId);
    }

    // 1b. 🆕 Get all comments by Project ID (từ tasks của project)
    public List<Comment> getCommentsByProjectId(String projectId) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new RuntimeException("Dự án không tồn tại!"));

        // Lấy tất cả tasks của project
        List<Task> tasks = taskRepository.findByProject(project);
        
        // Lấy tất cả comments của các tasks đó (kèm project info)
        return tasks.stream()
                .flatMap(task -> getCommentsByTaskId(task.getId()).stream())
                .sorted((c1, c2) -> c1.getCreatedAt().compareTo(c2.getCreatedAt()))
                .toList();
    }

    // 2. Add new comment
    public Comment addComment(String taskId, String userId, String content) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new RuntimeException("Task không tồn tại!"));

        User author = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("Người dùng không tồn tại!"));

        if (content == null || content.trim().isEmpty()) {
            throw new RuntimeException("Nội dung bình luận không được trống!");
        }

        Comment comment = new Comment();
        comment.setContent(content);
        comment.setAuthor(author);
        comment.setTask(task);
        comment.setCreatedAt(LocalDateTime.now());
        comment.setUpdatedAt(LocalDateTime.now());

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

        return savedComment;
    }

    // 3. Update comment
    public Comment updateComment(String commentId, String newContent) {
        Comment comment = commentRepository.findById(commentId)
                .orElseThrow(() -> new RuntimeException("Bình luận không tồn tại!"));

        if (newContent == null || newContent.trim().isEmpty()) {
            throw new RuntimeException("Nội dung bình luận không được trống!");
        }

        comment.setContent(newContent);
        comment.setUpdatedAt(LocalDateTime.now());
        return commentRepository.save(comment);
    }

    // 4. Delete comment
    public void deleteComment(String commentId) {
        if (!commentRepository.existsById(commentId)) {
            throw new RuntimeException("Bình luận không tồn tại!");
        }
        commentRepository.deleteById(commentId);
    }
}
