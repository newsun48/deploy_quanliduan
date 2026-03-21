package com.projectmanagement.core_system.service;

import com.projectmanagement.core_system.enums.ProjectStatus;
import com.projectmanagement.core_system.enums.TaskStatus;
import com.projectmanagement.core_system.enums.Priority;
import com.projectmanagement.core_system.model.Project;
import com.projectmanagement.core_system.model.Task;
import com.projectmanagement.core_system.model.User;
import com.projectmanagement.core_system.model.Department;
import com.projectmanagement.core_system.repository.ProjectRepository;
import com.projectmanagement.core_system.repository.TaskRepository;
import com.projectmanagement.core_system.repository.UserRepository;
import com.projectmanagement.core_system.repository.DepartmentRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.HashMap;
import java.util.stream.Collectors;

@Service
public class TaskService {

    @Autowired
    private TaskRepository taskRepository;

    @Autowired
    private ProjectRepository projectRepository;

    @Autowired
    private DepartmentRepository departmentRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private NotificationService notificationService;

    // 1. Tạo Task mới
    public Task createTask(Task task, String projectId, String assigneeId) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new RuntimeException("Dự án không tồn tại!"));

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

        task.setProject(project);
        task.setAssignee(assignee);
        task.setStatus(TaskStatus.TO_DO);
        task.setCompletionPercentage(0);

        Task savedTask = taskRepository.save(task);

        // Thông báo cho nhân viên: Người giao là Manager của phòng ban chứa dự án
        User manager = project.getDepartment() != null ? project.getDepartment().getManager() : null;
        String message = "Bạn được giao công việc mới: " + savedTask.getTitle() + " từ dự án: " + project.getName();
        notificationService.createNotification(assignee, manager != null ? manager : assignee, savedTask, message, "TASK_ASSIGNED");

        return savedTask;
    }

    // 2. Cập nhật trạng thái và tiến độ
    public Task updateStatus(String taskId, TaskStatus newStatus, int percent, String submissionLink) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new RuntimeException("Task không tồn tại!"));

        if (task.getProject().getStatus() == ProjectStatus.CLOSED) {
            throw new RuntimeException("KHÔNG THỂ CẬP NHẬT: Dự án này đã bị đóng!");
        }

        task.setStatus(newStatus);
        task.setCompletionPercentage(percent);
        task.setSubmissionLink(submissionLink);
        
        Task savedTask = taskRepository.save(task);

        // Thông báo cho quản lý nếu cần
        User manager = task.getProject().getDepartment() != null ? task.getProject().getDepartment().getManager() : null;
        if (manager != null && !manager.getId().equals(task.getAssignee().getId())) {
            String message = task.getAssignee().getFullName() + " đã cập nhật tiến độ công việc '" + task.getTitle() + "' thành " + percent + "%.";
            notificationService.createNotification(manager, task.getAssignee(), savedTask, message, "TASK_UPDATED");
        }

        return savedTask;
    }

    // 3. Lấy task theo dự án
    public List<Task> getTasksByProject(String projectId) {
        return taskRepository.findByProject_Id(projectId);
    }

    // 4. Lấy task của cá nhân
    public List<Task> getMyTasks(String userId) {
        return taskRepository.findByAssignee_Id(userId);
    }

    // 5. Thống kê Toàn diện cho Dashboard
    public Map<String, Object> getTaskStatistics() {
        List<Task> allTasks = taskRepository.findAll();
        List<Project> allProjects = projectRepository.findAll();
        List<User> allUsers = userRepository.findAll();
        List<Department> allDepts = departmentRepository.findAll();

        // 5.1. Thống kê Trạng thái
        long todoCount = allTasks.stream().filter(t -> t.getStatus() == TaskStatus.TO_DO).count();
        long inProgressCount = allTasks.stream().filter(t -> t.getStatus() == TaskStatus.IN_PROGRESS).count();
        long doneCount = allTasks.stream().filter(t -> t.getStatus() == TaskStatus.DONE).count();

        // 5.2. Thống kê Độ ưu tiên
        long highPriority = allTasks.stream().filter(t -> t.getPriority() == Priority.HIGH).count();
        long mediumPriority = allTasks.stream().filter(t -> t.getPriority() == Priority.MEDIUM).count();
        long lowPriority = allTasks.stream().filter(t -> t.getPriority() == Priority.LOW).count();

        // 5.3. Thống kê theo Dự án
        Map<String, Long> byProject = allTasks.stream()
                .filter(t -> t.getProject() != null)
                .collect(Collectors.groupingBy(t -> t.getProject().getName(), Collectors.counting()));

        // 5.4. Thống kê theo Người thực hiện
        Map<String, Long> byAssignee = allTasks.stream()
                .filter(t -> t.getAssignee() != null)
                .collect(Collectors.groupingBy(t -> t.getAssignee().getFullName(), Collectors.counting()));

        // 5.5. Thống kê Trạng thái Dự án
        long openProjects = allProjects.stream().filter(p -> p.getStatus() == ProjectStatus.OPEN).count();
        long closedProjects = allProjects.stream().filter(p -> p.getStatus() == ProjectStatus.CLOSED).count();
        long draftProjects = allProjects.stream().filter(p -> p.getStatus() == ProjectStatus.DRAFT).count();

        // 5.6. Phân bổ nhân sự theo Phòng ban
        Map<String, Long> userDept = allUsers.stream()
                .filter(u -> u.getDepartment() != null)
                .collect(Collectors.groupingBy(u -> u.getDepartment().getName(), Collectors.counting()));

        // Tổng hợp JSON trả về cho Frontend
        Map<String, Object> results = new HashMap<>();
        results.put("totalTasks", allTasks.size());
        results.put("totalProjects", allProjects.size());
        results.put("totalUsers", allUsers.size());
        results.put("totalDepts", allDepts.size());
        
        results.put("byStatus", Map.of(
            "TO_DO", todoCount,
            "IN_PROGRESS", inProgressCount,
            "DONE", doneCount
        ));
        
        results.put("byPriority", Map.of(
            "HIGH", highPriority,
            "MEDIUM", mediumPriority,
            "LOW", lowPriority
        ));
        
        results.put("byProject", byProject);
        results.put("byAssignee", byAssignee);
        results.put("projectStatus", Map.of(
            "OPEN", openProjects,
            "CLOSED", closedProjects,
            "DRAFT", draftProjects
        ));
        results.put("userDept", userDept);

        return results;
    }
}