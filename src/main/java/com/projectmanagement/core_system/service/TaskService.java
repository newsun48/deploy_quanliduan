package com.projectmanagement.core_system.service;

import com.projectmanagement.core_system.enums.ProjectStatus;
import com.projectmanagement.core_system.enums.TaskStatus;
import com.projectmanagement.core_system.model.Project;
import com.projectmanagement.core_system.model.Task;
import com.projectmanagement.core_system.model.User;
import com.projectmanagement.core_system.repository.ProjectRepository;
import com.projectmanagement.core_system.repository.TaskRepository;
import com.projectmanagement.core_system.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
public class TaskService {

    @Autowired
    private TaskRepository taskRepository;

    @Autowired
    private ProjectRepository projectRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private NotificationService notificationService;

    // 1. Tạo Task
    public Task createTask(Task task, String projectId, String assigneeId) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new RuntimeException("Dự án không tồn tại!"));

        // 🔥 Check: Nếu dự án đã đóng thì không cho tạo task
        if (project.getStatus() == ProjectStatus.CLOSED) {
            throw new RuntimeException("Dự án đã đóng, không thể giao việc mới!");
        }

        User assignee = userRepository.findById(assigneeId)
                .orElseThrow(() -> new RuntimeException("Người được gán không tồn tại!"));

        boolean isMember = project.getMembers().stream()
                .anyMatch(member -> member.getId().equals(assigneeId));
        
        if (!isMember) {
            throw new RuntimeException("LỖI: Người này chưa tham gia dự án!");
        }

        if (task.getDeadline() != null && project.getDeadline() != null) {
            if (task.getDeadline().isAfter(project.getDeadline())) {
                throw new RuntimeException("LỖI: Deadline Task vượt quá Deadline dự án!");
            }
        }

        // Để MongoDB tự tạo ID
        task.setProject(project);
        task.setAssignee(assignee);
        task.setStatus(TaskStatus.TO_DO);
        task.setCompletionPercentage(0);

        Task savedTask = taskRepository.save(task);

        // 🔥 TẠO THÔNG BÁO cho người được gán công việc
        // Lấy manager (người tạo task) - lấy từ department nếu có
        User sender = assignee;  // Mặc định sender là người được gán (có thể thay đổi sau)
        String message = "Bạn được giao công việc mới: " + savedTask.getTitle() + " từ dự án: " + project.getName();
        notificationService.createNotification(assignee, sender, savedTask, message, "TASK_ASSIGNED");

        return savedTask;
    }

    // 2. Update Status & Tiến độ
    public Task updateStatus(String taskId, TaskStatus newStatus, int percent, String submissionLink) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new RuntimeException("Task không tồn tại!"));

        // 🔥 LOGIC MỚI: Chặn update nếu dự án đã ĐÓNG
        if (task.getProject().getStatus() == ProjectStatus.CLOSED) {
            throw new RuntimeException("KHÔNG THỂ CẬP NHẬT: Dự án này đã bị đóng!");
        }

        task.setStatus(newStatus);
        task.setCompletionPercentage(percent);
        if (submissionLink != null && !submissionLink.trim().isEmpty()) {
            task.setSubmissionLink(submissionLink);
        }
        
        Task savedTask = taskRepository.save(task);

        // 🔥 Bắn thông báo: Báo cáo tiến độ cho Quản lý dự án
        User manager = task.getProject().getDepartment() != null ? task.getProject().getDepartment().getManager() : null;
        if (manager != null && !manager.getId().equals(task.getAssignee().getId())) {
            String message = task.getAssignee().getFullName() + " đã cập nhật tiến độ công việc '" + task.getTitle() + "' thành " + percent + "%.";
            notificationService.createNotification(manager, task.getAssignee(), savedTask, message, "TASK_UPDATED");
        }

        return savedTask;
    }

    // 3. 🔥 SỬA LẠI: Tìm Task theo Object Project (Fix lỗi không hiện task)
    public List<Task> getTasksByProject(String projectId) {
        Project p = new Project();
        p.setId(projectId);
        return taskRepository.findByProject(p);
    }

    // 4. 🔥 SỬA LẠI: Tìm Task theo Object User
    public List<Task> getMyTasks(String userId) {
        User u = new User();
        u.setId(userId);
        return taskRepository.findByAssignee(u);
    }

    // 5. Thống kê Task
    public Map<String, Object> getTaskStatistics() {
        List<Task> allTasks = taskRepository.findAll();
        
        // Đếm theo status
        long todoCount = allTasks.stream().filter(t -> t.getStatus() == TaskStatus.TO_DO).count();
        long inProgressCount = allTasks.stream().filter(t -> t.getStatus() == TaskStatus.IN_PROGRESS).count();
        long doneCount = allTasks.stream().filter(t -> t.getStatus() == TaskStatus.DONE).count();
        
        // Đếm theo priority
        long highPriority = allTasks.stream().filter(t -> t.getPriority() == com.projectmanagement.core_system.enums.Priority.HIGH).count();
        long mediumPriority = allTasks.stream().filter(t -> t.getPriority() == com.projectmanagement.core_system.enums.Priority.MEDIUM).count();
        long lowPriority = allTasks.stream().filter(t -> t.getPriority() == com.projectmanagement.core_system.enums.Priority.LOW).count();
        
        // Đếm theo project
        Map<String, Long> byProject = allTasks.stream()
            .collect(java.util.stream.Collectors.groupingBy(
                t -> t.getProject() != null ? t.getProject().getName() : "Không có dự án",
                java.util.stream.Collectors.counting()
            ));
        
        // Đếm theo người giao
        Map<String, Long> byAssignee = allTasks.stream()
            .filter(t -> t.getAssignee() != null)
            .collect(java.util.stream.Collectors.groupingBy(
                t -> t.getAssignee().getFullName(),
                java.util.stream.Collectors.counting()
            ));
        
        return Map.of(
            "total", allTasks.size(),
            "byStatus", Map.of(
                "TO_DO", todoCount,
                "IN_PROGRESS", inProgressCount,
                "DONE", doneCount
            ),
            "byPriority", Map.of(
                "HIGH", highPriority,
                "MEDIUM", mediumPriority,
                "LOW", lowPriority
            ),
            "byProject", byProject,
            "byAssignee", byAssignee
        );
    }
}