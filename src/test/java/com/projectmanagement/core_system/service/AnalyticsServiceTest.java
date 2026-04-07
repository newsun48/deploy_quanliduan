package com.projectmanagement.core_system.service;

import com.projectmanagement.core_system.enums.ERole;
import com.projectmanagement.core_system.enums.Priority;
import com.projectmanagement.core_system.enums.TaskStatus;
import com.projectmanagement.core_system.model.Department;
import com.projectmanagement.core_system.model.Project;
import com.projectmanagement.core_system.model.Task;
import com.projectmanagement.core_system.model.TaskActivity;
import com.projectmanagement.core_system.model.User;
import com.projectmanagement.core_system.repository.DepartmentRepository;
import com.projectmanagement.core_system.repository.TaskActivityRepository;
import com.projectmanagement.core_system.repository.TaskRepository;
import com.projectmanagement.core_system.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AnalyticsServiceTest {

    @Mock
    private TaskRepository taskRepository;

    @Mock
    private TaskActivityRepository taskActivityRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private DepartmentRepository departmentRepository;

    @InjectMocks
    private AnalyticsService analyticsService;

    @Test
    void getDeliveryAnalytics_buildsExpectedMetricsForScopedDepartment() {
        User admin = buildUser("admin-1", "admin@example.com", ERole.ADMIN, null);
        User assigneeOne = buildUser("u-1", "u1@example.com", ERole.EMPLOYEE, "dept-1");
        User assigneeTwo = buildUser("u-2", "u2@example.com", ERole.EMPLOYEE, "dept-1");
        User foreignAssignee = buildUser("u-9", "u9@example.com", ERole.EMPLOYEE, "dept-2");

        Task doneTask = buildTask("task-1", "Done Task", "dept-1", assigneeOne, TaskStatus.DONE, Priority.HIGH, 100, LocalDate.now().minusDays(5));
        Task overdueTask = buildTask("task-2", "Overdue Task", "dept-1", assigneeOne, TaskStatus.IN_PROGRESS, Priority.HIGH, 40, LocalDate.now().minusDays(1));
        Task stalledTask = buildTask("task-3", "Stalled Task", "dept-1", assigneeTwo, TaskStatus.TO_DO, Priority.MEDIUM, 10, LocalDate.now().plusDays(14));
        Task otherDepartmentTask = buildTask("task-9", "Other Dept", "dept-2", foreignAssignee, TaskStatus.DONE, Priority.LOW, 100, LocalDate.now().plusDays(3));

        List<Task> tasks = List.of(doneTask, overdueTask, stalledTask, otherDepartmentTask);

        List<TaskActivity> activities = new ArrayList<>();
        activities.add(activity("task-1", "TASK_CREATED", null, daysAgo(20)));
        activities.add(activity("task-1", "TASK_STATUS_UPDATED", TaskStatus.IN_PROGRESS.name(), daysAgo(15)));
        activities.add(activity("task-1", "TASK_STATUS_UPDATED", TaskStatus.DONE.name(), daysAgo(10)));

        activities.add(activity("task-2", "TASK_CREATED", null, daysAgo(12)));
        activities.add(activity("task-2", "TASK_STATUS_UPDATED", TaskStatus.IN_PROGRESS.name(), daysAgo(8)));
        activities.add(activity("task-2", "TASK_COMMENTED", null, daysAgo(2)));

        activities.add(activity("task-3", "TASK_CREATED", null, daysAgo(30)));

        activities.add(activity("task-9", "TASK_CREATED", null, daysAgo(25)));
        activities.add(activity("task-9", "TASK_STATUS_UPDATED", TaskStatus.DONE.name(), daysAgo(12)));

        when(userRepository.findByEmailIgnoreCase("admin@example.com")).thenReturn(Optional.of(admin));
        when(departmentRepository.existsById("dept-1")).thenReturn(true);
        when(taskRepository.findAll()).thenReturn(tasks);
        when(taskActivityRepository.findByTaskIdInOrderByCreatedAtAsc(anyList())).thenReturn(activities);

        Map<String, Object> response = analyticsService.getDeliveryAnalytics("admin@example.com", "dept-1", 84, 7);

        Map<String, Object> overdueRate = castMap(response.get("overdueRate"));
        assertEquals(2L, overdueRate.get("openTasks"));
        assertEquals(1L, overdueRate.get("overdueOpenTasks"));
        assertEquals(0.5d, overdueRate.get("rate"));

        Map<String, Object> leadTime = castMap(response.get("leadTime"));
        assertEquals(1, leadTime.get("count"));
        assertEquals(10.0d, leadTime.get("averageDays"));

        Map<String, Object> cycleTime = castMap(response.get("cycleTime"));
        assertEquals(5.0d, cycleTime.get("averageDays"));

        Map<String, Object> bottleneck = castMap(response.get("bottleneck"));
        assertEquals(1L, bottleneck.get("overdueOpenTasks"));
        assertEquals(1L, bottleneck.get("stalledTasks"));

        List<Map<String, Object>> risk = castList(response.get("deadlineRisk"));
        assertEquals(2, risk.size());
        assertEquals("task-2", risk.get(0).get("taskId"));
    }

    @Test
    void getDeliveryAnalytics_managerCannotQueryAnotherDepartment() {
        User manager = buildUser("manager-1", "manager@example.com", ERole.MANAGER, "dept-1");
        Department managedDepartment = new Department();
        managedDepartment.setId("dept-1");
        managedDepartment.setManager(manager);
        when(userRepository.findByEmailIgnoreCase("manager@example.com")).thenReturn(Optional.of(manager));
        when(departmentRepository.findById("dept-1")).thenReturn(Optional.of(managedDepartment));

        AccessDeniedException error = assertThrows(
                AccessDeniedException.class,
                () -> analyticsService.getDeliveryAnalytics("manager@example.com", "dept-2", 84, 7)
        );

        assertEquals("Bạn chỉ được xem analytics của phòng ban do bạn quản lý!", error.getMessage());
    }

    @Test
    void getDeliveryAnalytics_usesLatestDoneAndCreatedFallbackForTimelineMetrics() {
        User admin = buildUser("admin-1", "admin@example.com", ERole.ADMIN, null);
        User assignee = buildUser("u-1", "u1@example.com", ERole.EMPLOYEE, "dept-1");

        Task reopenedDoneTask = buildTask("task-1", "Reopened Done", "dept-1", assignee, TaskStatus.DONE, Priority.HIGH, 100, LocalDate.now().plusDays(2));
        reopenedDoneTask.getProject().setCreatedDate(daysAgo(15));

        Task directDoneTask = buildTask("task-2", "Direct Done", "dept-1", assignee, TaskStatus.DONE, Priority.MEDIUM, 100, LocalDate.now().plusDays(4));
        directDoneTask.getProject().setCreatedDate(daysAgo(9));

        Task noHistoryTask = buildTask("task-3", "No History", "dept-1", assignee, TaskStatus.TO_DO, Priority.LOW, 0, LocalDate.now().plusDays(10));
        noHistoryTask.getProject().setCreatedDate(daysAgo(1));

        List<Task> tasks = List.of(reopenedDoneTask, directDoneTask, noHistoryTask);

        List<TaskActivity> activities = new ArrayList<>();
        activities.add(activity("task-1", "TASK_CREATED", null, daysAgo(14)));
        activities.add(activity("task-1", "TASK_STATUS_UPDATED", TaskStatus.IN_PROGRESS.name(), daysAgo(12)));
        activities.add(activity("task-1", "TASK_STATUS_UPDATED", TaskStatus.DONE.name(), daysAgo(10)));
        activities.add(activity("task-1", "TASK_STATUS_UPDATED", TaskStatus.IN_PROGRESS.name(), daysAgo(4)));
        activities.add(activity("task-1", "TASK_STATUS_UPDATED", TaskStatus.DONE.name(), daysAgo(2)));
        activities.add(activity("task-2", "TASK_CREATED", null, daysAgo(8)));
        activities.add(activity("task-2", "TASK_STATUS_UPDATED", TaskStatus.DONE.name(), daysAgo(3)));

        when(userRepository.findByEmailIgnoreCase("admin@example.com")).thenReturn(Optional.of(admin));
        when(taskRepository.findAll()).thenReturn(tasks);
        when(taskActivityRepository.findByTaskIdInOrderByCreatedAtAsc(anyList())).thenReturn(activities);

        Map<String, Object> response = analyticsService.getDeliveryAnalytics("admin@example.com", null, 84, 7);

        Map<String, Object> leadTime = castMap(response.get("leadTime"));
        assertEquals(2, leadTime.get("count"));
        assertEquals(8.5d, leadTime.get("averageDays"));

        Map<String, Object> cycleTime = castMap(response.get("cycleTime"));
        assertEquals(2, cycleTime.get("count"));
        assertEquals(3.5d, cycleTime.get("averageDays"));

        List<Map<String, Object>> risk = castList(response.get("deadlineRisk"));
        Map<String, Object> noHistory = risk.stream().filter(item -> "task-3".equals(item.get("taskId"))).findFirst().orElseThrow();
        assertEquals(daysAgo(1), noHistory.get("createdAt"));

        Map<String, Object> bottleneck = castMap(response.get("bottleneck"));
        assertEquals(0L, bottleneck.get("stalledTasks"));
    }

    private Task buildTask(
            String id,
            String title,
            String departmentId,
            User assignee,
            TaskStatus status,
            Priority priority,
            int completion,
            LocalDate deadline) {
        Department department = new Department();
        department.setId(departmentId);
        department.setName("Dept " + departmentId);

        Project project = new Project();
        project.setId("project-" + id);
        project.setDepartment(department);
        project.setStartDate(LocalDate.now().minusDays(30));
        project.setDeadline(LocalDate.now().plusDays(3));

        Task task = new Task();
        task.setId(id);
        task.setTitle(title);
        task.setProject(project);
        task.setAssignee(assignee);
        task.setStatus(status);
        task.setPriority(priority);
        task.setCompletionPercentage(completion);
        task.setDeadline(deadline);
        return task;
    }

    private TaskActivity activity(String taskId, String type, String status, long createdAtMillis) {
        TaskActivity activity = new TaskActivity();
        activity.setTaskId(taskId);
        activity.setType(type);
        activity.setCreatedAt(createdAtMillis);
        if (status != null) {
            activity.setMetadata(Map.of("status", status));
        }
        return activity;
    }

    private User buildUser(String id, String email, ERole role, String departmentId) {
        User user = new User();
        user.setId(id);
        user.setEmail(email);
        user.setRole(role);
        user.setActive(true);
        user.setFullName(id + " Name");
        if (departmentId != null) {
            Department department = new Department();
            department.setId(departmentId);
            user.setDepartment(department);
        }
        return user;
    }

    private long daysAgo(long days) {
        return LocalDate.now().minusDays(days)
                .atStartOfDay(ZoneId.systemDefault())
                .toInstant()
                .toEpochMilli();
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> castMap(Object value) {
        return (Map<String, Object>) value;
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> castList(Object value) {
        return (List<Map<String, Object>>) value;
    }
}
