package com.projectmanagement.core_system.service;

import com.projectmanagement.core_system.enums.ProjectStatus;
import com.projectmanagement.core_system.enums.TaskStatus;
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
<<<<<<< HEAD
=======
import java.util.Map;
import java.util.HashMap;
import java.util.stream.Collectors;
>>>>>>> 4b9455b (fixLoiConflict)

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

    // 1. Tạo Task
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

        User sender = assignee; 
        String message = "Bạn được giao công việc mới: " + savedTask.getTitle() + " từ dự án: " + project.getName();
        notificationService.createNotification(assignee, sender, savedTask, message, "TASK_ASSIGNED");

        return savedTask;
    }

    // 2. Update Status & Tiến độ
    public Task updateStatus(String taskId, TaskStatus newStatus, int percent, String submissionLink) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new RuntimeException("Task không tồn tại!"));

        if (task.getProject().getStatus() == ProjectStatus.CLOSED) {
            throw new RuntimeException("KHÔNG THỂ CẬP NHẬT: Dự án này đã bị đóng!");
        }

        task.setStatus(newStatus);
        task.setCompletionPercentage(percent);
        if (submissionLink != null && !submissionLink.trim().isEmpty()) {
            task.setSubmissionLink(submissionLink);
        }
        
        Task savedTask = taskRepository.save(task);

        User manager = task.getProject().getDepartment() != null ? task.getProject().getDepartment().getManager() : null;
        if (manager != null && !manager.getId().equals(task.getAssignee().getId())) {
            String message = task.getAssignee().getFullName() + " đã cập nhật tiến độ công việc '" + task.getTitle() + "' thành " + percent + "%.";
            notificationService.createNotification(manager, task.getAssignee(), savedTask, message, "TASK_UPDATED");
        }

        return savedTask;
    }

    public List<Task> getTasksByProject(String projectId) {
        Project p = new Project();
        p.setId(projectId);
        return taskRepository.findByProject(p);
    }

    public List<Task> getMyTasks(String userId) {
        User u = new User();
        u.setId(userId);
        return taskRepository.findByAssignee(u);
    }
<<<<<<< HEAD
=======

    // 5. Thống kê Toàn diện
    public Map<String, Object> getTaskStatistics() {
        List<Task> allTasks = taskRepository.findAll();
        List<Project> allProjects = projectRepository.findAll();
        List<User> allUsers = userRepository.findAll();
        List<Department> allDepts = departmentRepository.findAll();
        
        // --- TASK STATS ---
        long todoCount = allTasks.stream().filter(t -> t.getStatus() == TaskStatus.TO_DO).count();
        long inProgressCount = allTasks.stream().filter(t -> t.getStatus() == TaskStatus.IN_PROGRESS).count();
        long doneCount = allTasks.stream().filter(t -> t.getStatus() == TaskStatus.DONE).count();
        
        long highPriority = allTasks.stream().filter(t -> t.getPriority() == com.projectmanagement.core_system.enums.Priority.HIGH).count();
        long mediumPriority = allTasks.stream().filter(t -> t.getPriority() == com.projectmanagement.core_system.enums.Priority.MEDIUM).count();
        long lowPriority = allTasks.stream().filter(t -> t.getPriority() == com.projectmanagement.core_system.enums.Priority.LOW).count();
        
        Map<String, Long> byProject = new HashMap<>();
        allProjects.forEach(p -> byProject.put(p.getName(), 0L));
        allTasks.forEach(t -> {
            if (t.getProject() != null) {
                String pName = t.getProject().getName();
                byProject.put(pName, byProject.getOrDefault(pName, 0L) + 1);
            }
        });
        
        Map<String, Long> byAssignee = allTasks.stream()
            .filter(t -> t.getAssignee() != null)
            .collect(Collectors.groupingBy(
                t -> t.getAssignee().getFullName(),
                Collectors.counting()
            ));

        // --- PROJECT STATS ---
        long openProjects = allProjects.stream().filter(p -> p.getStatus() == ProjectStatus.OPEN).count();
        long closedProjects = allProjects.stream().filter(p -> p.getStatus() == ProjectStatus.CLOSED).count();
        long draftProjects = allProjects.stream().filter(p -> p.getStatus() == ProjectStatus.DRAFT).count();

        // --- USER STATS ---
        Map<String, Long> byDepartment = allUsers.stream()
            .filter(u -> u.getDepartment() != null)
            .collect(Collectors.groupingBy(
                u -> u.getDepartment().getName(),
                Collectors.counting()
            ));
        
        return Map.of(
            "totalTasks", allTasks.size(),
            "totalProjects", allProjects.size(),
            "totalUsers", allUsers.size(),
            "totalDepts", allDepts.size(),
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
            "byAssignee", byAssignee,
            "projectStatus", Map.of(
                "OPEN", openProjects,
                "CLOSED", closedProjects,
                "DRAFT", draftProjects
            ),
            "userDept", byDepartment
        );
    }
>>>>>>> 4b9455b (fixLoiConflict)
}