package com.projectmanagement.core_system.service;

import com.projectmanagement.core_system.enums.ProjectStatus;
import com.projectmanagement.core_system.enums.TaskStatus;
import com.projectmanagement.core_system.model.Department;
import com.projectmanagement.core_system.model.Project;
import com.projectmanagement.core_system.model.Task;
import com.projectmanagement.core_system.model.TaskUpdateRequest;
import com.projectmanagement.core_system.model.User;
import com.projectmanagement.core_system.repository.CommentRepository;
import com.projectmanagement.core_system.repository.DepartmentRepository;
import com.projectmanagement.core_system.repository.NotificationRepository;
import com.projectmanagement.core_system.repository.ProjectRepository;
import com.projectmanagement.core_system.repository.TaskActivityRepository;
import com.projectmanagement.core_system.repository.TaskRepository;
import com.projectmanagement.core_system.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TaskServiceTest {

    @Mock
    private TaskRepository taskRepository;

    @Mock
    private ProjectRepository projectRepository;

    @Mock
    private DepartmentRepository departmentRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private NotificationService notificationService;

    @Mock
    private TaskActivityService taskActivityService;

    @Mock
    private UserActivityService userActivityService;

    @Mock
    private CommentRepository commentRepository;

    @Mock
    private TaskActivityRepository taskActivityRepository;

    @Mock
    private NotificationRepository notificationRepository;

    @InjectMocks
    private TaskService taskService;

    @Test
    void createTask_rejectsPastDeadline() {
        User manager = buildUser("manager-1", "Manager", "manager@example.com");
        User assignee = buildUser("employee-1", "Employee", "employee@example.com");
        Project project = buildProject("project-1", manager, assignee);
        Task task = new Task();
        task.setDeadline(LocalDate.now().minusDays(1));

        when(projectRepository.findById("project-1")).thenReturn(Optional.of(project));
        when(userRepository.findById("employee-1")).thenReturn(Optional.of(assignee));

        RuntimeException error = assertThrows(RuntimeException.class,
                () -> taskService.createTask(task, "project-1", "employee-1"));

        assertEquals("LỖI: Deadline Task không được ở quá khứ!", error.getMessage());
        verify(taskRepository, never()).save(any(Task.class));
    }

    @Test
    void updateTask_rejectsPastDeadline() {
        User manager = buildUser("manager-1", "Manager", "manager@example.com");
        User assignee = buildUser("employee-1", "Employee", "employee@example.com");
        Task task = buildTask("task-1", "Task A", manager, assignee);

        TaskUpdateRequest request = new TaskUpdateRequest();
        request.setDeadline(LocalDate.now().minusDays(2));

        when(taskRepository.findById("task-1")).thenReturn(Optional.of(task));
        when(userRepository.findByEmailIgnoreCase("manager@example.com")).thenReturn(Optional.of(manager));

        RuntimeException error = assertThrows(RuntimeException.class,
                () -> taskService.updateTask("task-1", request, "manager@example.com"));

        assertEquals("LỖI: Deadline Task không được ở quá khứ!", error.getMessage());
        verify(taskRepository, never()).save(any(Task.class));
    }

    @Test
    void updateTask_rejectsUserWhoIsNotDepartmentManager() {
        User manager = buildUser("manager-1", "Manager", "manager@example.com");
        User assignee = buildUser("employee-1", "Employee", "employee@example.com");
        Task task = buildTask("task-1", "Task A", manager, assignee);
        TaskUpdateRequest request = new TaskUpdateRequest();
        request.setTitle("Updated title");

        when(taskRepository.findById("task-1")).thenReturn(Optional.of(task));
        when(userRepository.findByEmailIgnoreCase("employee@example.com")).thenReturn(Optional.of(assignee));

        RuntimeException error = assertThrows(RuntimeException.class,
                () -> taskService.updateTask("task-1", request, "employee@example.com"));

        assertEquals("Bạn không có quyền chỉnh sửa hoặc xóa công việc này!", error.getMessage());
        verify(taskRepository, never()).save(any(Task.class));
    }

    @Test
    void deleteTask_rejectsUserWhoIsNotDepartmentManager() {
        User manager = buildUser("manager-1", "Manager", "manager@example.com");
        User assignee = buildUser("employee-1", "Employee", "employee@example.com");
        Task task = buildTask("task-1", "Task A", manager, assignee);

        when(taskRepository.findById("task-1")).thenReturn(Optional.of(task));
        when(userRepository.findByEmailIgnoreCase("employee@example.com")).thenReturn(Optional.of(assignee));

        RuntimeException error = assertThrows(RuntimeException.class,
                () -> taskService.deleteTask("task-1", "employee@example.com"));

        assertEquals("Bạn không có quyền chỉnh sửa hoặc xóa công việc này!", error.getMessage());
        verify(taskRepository, never()).delete(any(Task.class));
        verify(commentRepository, never()).deleteByTask(any(Task.class));
    }

    @Test
    void deleteTask_managerRemovesTaskAndRelatedData() {
        User manager = buildUser("manager-1", "Manager", "manager@example.com");
        User assignee = buildUser("employee-1", "Employee", "employee@example.com");
        Task task = buildTask("task-1", "Task A", manager, assignee);

        when(taskRepository.findById("task-1")).thenReturn(Optional.of(task));
        when(userRepository.findByEmailIgnoreCase("manager@example.com")).thenReturn(Optional.of(manager));

        taskService.deleteTask("task-1", "manager@example.com");

        verify(commentRepository).deleteByTask(task);
        verify(taskActivityRepository).deleteByTaskId("task-1");
        verify(notificationRepository).deleteByTask(task);
        verify(taskRepository).delete(task);
        verify(userActivityService).record(any(User.class), any(User.class), anyString(), anyString(), anyMap());
    }

    @Test
    void updateTask_reassignsAssignee_notifiesNewAssignee_andClearsOldTaskAssignedNotification() {
        User manager = buildUser("manager-1", "Manager", "manager@example.com");
        User oldAssignee = buildUser("employee-1", "Employee A", "employee-a@example.com");
        User newAssignee = buildUser("employee-2", "Employee B", "employee-b@example.com");

        Project project = buildProject("project-1", manager, oldAssignee);
        project.getMembers().add(newAssignee);

        Task task = new Task();
        task.setId("task-1");
        task.setTitle("Task A");
        task.setProject(project);
        task.setAssignee(oldAssignee);

        TaskUpdateRequest request = new TaskUpdateRequest();
        request.setAssigneeId("employee-2");

        when(taskRepository.findById("task-1")).thenReturn(Optional.of(task));
        when(userRepository.findByEmailIgnoreCase("manager@example.com")).thenReturn(Optional.of(manager));
        when(userRepository.findById("employee-2")).thenReturn(Optional.of(newAssignee));
        when(taskRepository.save(task)).thenReturn(task);

        Task updated = taskService.updateTask("task-1", request, "manager@example.com");

        assertEquals("employee-2", updated.getAssignee().getId());
        verify(notificationRepository).deleteByReceiverAndTaskAndType(oldAssignee, task, "TASK_ASSIGNED");
        verify(notificationService).createNotification(eq(newAssignee), eq(manager), eq(task), anyString(), eq("TASK_ASSIGNED"));
    }

    @Test
    void updateTask_keepsAssignee_doesNotCreateOrDeleteTaskAssignedNotifications() {
        User manager = buildUser("manager-1", "Manager", "manager@example.com");
        User assignee = buildUser("employee-1", "Employee", "employee@example.com");
        Task task = buildTask("task-1", "Task A", manager, assignee);

        TaskUpdateRequest request = new TaskUpdateRequest();
        request.setAssigneeId("employee-1");

        when(taskRepository.findById("task-1")).thenReturn(Optional.of(task));
        when(userRepository.findByEmailIgnoreCase("manager@example.com")).thenReturn(Optional.of(manager));
        when(userRepository.findById("employee-1")).thenReturn(Optional.of(assignee));
        when(taskRepository.save(task)).thenReturn(task);

        taskService.updateTask("task-1", request, "manager@example.com");

        verify(notificationRepository, never()).deleteByReceiverAndTaskAndType(any(User.class), any(Task.class), anyString());
        verify(notificationService, never()).createNotification(any(User.class), any(User.class), any(Task.class), anyString(), eq("TASK_ASSIGNED"));
    }

    @Test
    void updateTask_reassignRejectsUserOutsideProjectMembers() {
        User manager = buildUser("manager-1", "Manager", "manager@example.com");
        User assignee = buildUser("employee-1", "Employee", "employee@example.com");
        User outsider = buildUser("employee-2", "Outsider", "outsider@example.com");
        Task task = buildTask("task-1", "Task A", manager, assignee);

        TaskUpdateRequest request = new TaskUpdateRequest();
        request.setAssigneeId("employee-2");

        when(taskRepository.findById("task-1")).thenReturn(Optional.of(task));
        when(userRepository.findByEmailIgnoreCase("manager@example.com")).thenReturn(Optional.of(manager));
        when(userRepository.findById("employee-2")).thenReturn(Optional.of(outsider));

        RuntimeException error = assertThrows(RuntimeException.class,
                () -> taskService.updateTask("task-1", request, "manager@example.com"));

        assertEquals("LỖI: Người này chưa tham gia dự án!", error.getMessage());
        verify(taskRepository, never()).save(any(Task.class));
        verify(notificationRepository, never()).deleteByReceiverAndTaskAndType(any(User.class), any(Task.class), anyString());
        verify(notificationService, never()).createNotification(any(User.class), any(User.class), any(Task.class), anyString(), eq("TASK_ASSIGNED"));
    }

    @Test
    void updateStatus_rejectsDoneWhenCompletionIsBelowOneHundredPercent() {
        User manager = buildUser("manager-1", "Manager", "manager@example.com");
        User assignee = buildUser("employee-1", "Employee", "employee@example.com");
        Task task = buildTask("task-1", "Task A", manager, assignee);

        when(taskRepository.findById("task-1")).thenReturn(Optional.of(task));

        RuntimeException error = assertThrows(RuntimeException.class,
                () -> taskService.updateStatus("task-1", TaskStatus.DONE, 80, "https://submit.example.com"));

        assertEquals("Không thể chuyển task sang DONE khi tiến độ chưa đạt 100%!", error.getMessage());
        verify(taskRepository, never()).save(any(Task.class));
    }

    @Test
    void updateStatus_allowsDoneWhenCompletionReachesOneHundredPercent() {
        User manager = buildUser("manager-1", "Manager", "manager@example.com");
        User assignee = buildUser("employee-1", "Employee", "employee@example.com");
        Task task = buildTask("task-1", "Task A", manager, assignee);

        when(taskRepository.findById("task-1")).thenReturn(Optional.of(task));
        when(taskRepository.save(any(Task.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Task savedTask = taskService.updateStatus("task-1", TaskStatus.DONE, 100, "https://submit.example.com");

        assertEquals(TaskStatus.DONE, savedTask.getStatus());
        assertEquals(100, savedTask.getCompletionPercentage());
        verify(taskRepository).save(task);
    }

    @Test
    void updateStatus_autoConvertsOneHundredPercentToDone() {
        User manager = buildUser("manager-1", "Manager", "manager@example.com");
        User assignee = buildUser("employee-1", "Employee", "employee@example.com");
        Task task = buildTask("task-1", "Task A", manager, assignee);

        when(taskRepository.findById("task-1")).thenReturn(Optional.of(task));
        when(taskRepository.save(any(Task.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Task savedTask = taskService.updateStatus("task-1", TaskStatus.IN_PROGRESS, 100, "https://submit.example.com");

        assertEquals(TaskStatus.DONE, savedTask.getStatus());
        assertEquals(100, savedTask.getCompletionPercentage());
        verify(taskRepository).save(task);
    }

    private User buildUser(String id, String fullName, String email) {
        User user = new User();
        user.setId(id);
        user.setFullName(fullName);
        user.setEmail(email);
        return user;
    }

    private Project buildProject(String id, User manager, User assignee) {
        Department department = new Department();
        department.setId("dept-1");
        department.setManager(manager);

        Project project = new Project();
        project.setId(id);
        project.setDepartment(department);
        project.setStatus(ProjectStatus.OPEN);
        project.setMembers(new ArrayList<>(List.of(assignee)));
        project.setDeadline(LocalDate.now().plusDays(10));
        return project;
    }

    private Task buildTask(String taskId, String title, User manager, User assignee) {
        Task task = new Task();
        task.setId(taskId);
        task.setTitle(title);
        task.setProject(buildProject("project-1", manager, assignee));
        task.setAssignee(assignee);
        task.setDeadline(LocalDate.now().plusDays(5));
        return task;
    }
}
