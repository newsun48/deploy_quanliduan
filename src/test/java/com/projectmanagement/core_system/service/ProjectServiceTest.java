package com.projectmanagement.core_system.service;

import com.projectmanagement.core_system.enums.ERole;
import com.projectmanagement.core_system.enums.ProjectStatus;
import com.projectmanagement.core_system.model.Department;
import com.projectmanagement.core_system.model.Project;
import com.projectmanagement.core_system.model.User;
import com.projectmanagement.core_system.repository.DepartmentRepository;
import com.projectmanagement.core_system.repository.ProjectRepository;
import com.projectmanagement.core_system.repository.TaskRepository;
import com.projectmanagement.core_system.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProjectServiceTest {

    @Mock
    private ProjectRepository projectRepository;

    @Mock
    private DepartmentRepository departmentRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private TaskRepository taskRepository;

    @Mock
    private NotificationService notificationService;

    @InjectMocks
    private ProjectService projectService;

    @Test
    void createProject_allowsAdminAndUsesAuthenticatedEmail() {
        User admin = buildUser("admin-1", "admin@example.com", "Admin", ERole.ADMIN, true, null);
        Department department = buildDepartment("dept-1", null);
        Project project = buildProject("project-1", department);
        project.setName("New Project");

        when(departmentRepository.findById("dept-1")).thenReturn(Optional.of(department));
        when(userRepository.findByEmailIgnoreCase("admin@example.com")).thenReturn(Optional.of(admin));
        when(projectRepository.save(any(Project.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Project saved = projectService.createProject(project, "dept-1", "admin@example.com");

        assertEquals("admin@example.com", saved.getCreatedBy());
        assertEquals(ProjectStatus.OPEN, saved.getStatus());
    }

    @Test
    void createProject_rejectsEmployeeActor() {
        User employee = buildUser("user-1", "employee@example.com", "Employee", ERole.EMPLOYEE, true, "dept-1");
        User manager = buildUser("manager-1", "manager@example.com", "Manager", ERole.MANAGER, true, "dept-1");
        Department department = buildDepartment("dept-1", manager);
        Project project = buildProject("project-1", department);
        project.setName("New Project");

        when(departmentRepository.findById("dept-1")).thenReturn(Optional.of(department));
        when(userRepository.findByEmailIgnoreCase("employee@example.com")).thenReturn(Optional.of(employee));

        AccessDeniedException error = assertThrows(AccessDeniedException.class,
                () -> projectService.createProject(project, "dept-1", "employee@example.com"));

        assertEquals("Bạn không có quyền quản lý dự án của phòng ban này!", error.getMessage());
        verify(projectRepository, never()).save(any(Project.class));
    }

    @Test
    void createProject_rejectsPastStartDate() {
        User admin = buildUser("admin-1", "admin@example.com", "Admin", ERole.ADMIN, true, null);
        Department department = buildDepartment("dept-1", null);
        Project project = buildProject("project-1", department);
        project.setStartDate(LocalDate.now().minusDays(1));
        project.setDeadline(LocalDate.now().plusDays(5));

        RuntimeException error = assertThrows(RuntimeException.class,
                () -> projectService.createProject(project, "dept-1", "admin@example.com"));

        assertEquals("Ngày bắt đầu dự án không được ở quá khứ!", error.getMessage());
        verify(projectRepository, never()).save(any(Project.class));
    }

    @Test
    void createProject_rejectsDeadlineBeforeStartDate() {
        User admin = buildUser("admin-1", "admin@example.com", "Admin", ERole.ADMIN, true, null);
        Department department = buildDepartment("dept-1", null);
        Project project = buildProject("project-1", department);
        project.setStartDate(LocalDate.now().plusDays(3));
        project.setDeadline(LocalDate.now().plusDays(1));

        RuntimeException error = assertThrows(RuntimeException.class,
                () -> projectService.createProject(project, "dept-1", "admin@example.com"));

        assertEquals("Hạn cuối dự án không được sớm hơn ngày bắt đầu!", error.getMessage());
        verify(projectRepository, never()).save(any(Project.class));
    }

    @Test
    void createProject_allowsStartDateEqualToDeadline() {
        User admin = buildUser("admin-1", "admin@example.com", "Admin", ERole.ADMIN, true, null);
        Department department = buildDepartment("dept-1", null);
        Project project = buildProject("project-1", department);
        LocalDate sameDay = LocalDate.now().plusDays(2);
        project.setStartDate(sameDay);
        project.setDeadline(sameDay);

        when(departmentRepository.findById("dept-1")).thenReturn(Optional.of(department));
        when(userRepository.findByEmailIgnoreCase("admin@example.com")).thenReturn(Optional.of(admin));
        when(projectRepository.save(any(Project.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Project saved = projectService.createProject(project, "dept-1", "admin@example.com");

        assertEquals(sameDay, saved.getStartDate());
        assertEquals(sameDay, saved.getDeadline());
    }

    @Test
    void addMembers_allowsDepartmentManagerAndSendsNotificationAfterSave() {
        User manager = buildUser("manager-1", "manager@example.com", "Manager", ERole.MANAGER, true, "dept-1");
        User employee = buildUser("employee-1", "employee@example.com", "Employee", ERole.EMPLOYEE, true, "dept-1");
        Department department = buildDepartment("dept-1", manager);
        Project project = buildProject("project-1", department);

        when(projectRepository.findById("project-1")).thenReturn(Optional.of(project));
        when(userRepository.findByEmailIgnoreCase("manager@example.com")).thenReturn(Optional.of(manager));
        when(userRepository.findById("employee-1")).thenReturn(Optional.of(employee));
        when(projectRepository.save(any(Project.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Project saved = projectService.addMembers("project-1", List.of("employee-1"), "manager@example.com");

        assertEquals(1, saved.getMembers().size());
        verify(notificationService).createNotification(employee, manager, null, "Bạn đã được thêm vào dự án: Project project-1", "PROJECT_JOINED");
    }

    @Test
    void addMembers_rejectsDepartmentManagerSelfInviteWithoutNotification() {
        User manager = buildUser("manager-1", "manager@example.com", "Manager", ERole.MANAGER, true, "dept-1");
        Department department = buildDepartment("dept-1", manager);
        Project project = buildProject("project-1", department);

        when(projectRepository.findById("project-1")).thenReturn(Optional.of(project));
        when(userRepository.findByEmailIgnoreCase("manager@example.com")).thenReturn(Optional.of(manager));
        when(userRepository.findById("manager-1")).thenReturn(Optional.of(manager));

        RuntimeException error = assertThrows(RuntimeException.class,
                () -> projectService.addMembers("project-1", List.of("manager-1"), "manager@example.com"));

        assertEquals("Không thể thêm trưởng phòng vào danh sách thành viên dự án!", error.getMessage());
        verify(notificationService, never()).createNotification(any(User.class), any(User.class), isNull(), anyString(), anyString());
        verify(projectRepository, never()).save(any(Project.class));
    }

    @Test
    void addMembers_rejectsUnauthorizedEmployee() {
        User employeeActor = buildUser("employee-actor", "employee@example.com", "Employee", ERole.EMPLOYEE, true, "dept-1");
        User manager = buildUser("manager-1", "manager@example.com", "Manager", ERole.MANAGER, true, "dept-1");
        Department department = buildDepartment("dept-1", manager);
        Project project = buildProject("project-1", department);

        when(projectRepository.findById("project-1")).thenReturn(Optional.of(project));
        when(userRepository.findByEmailIgnoreCase("employee@example.com")).thenReturn(Optional.of(employeeActor));

        AccessDeniedException error = assertThrows(AccessDeniedException.class,
                () -> projectService.addMembers("project-1", List.of("employee-1"), "employee@example.com"));

        assertEquals("Bạn không có quyền quản lý dự án của phòng ban này!", error.getMessage());
        verify(projectRepository, never()).save(any(Project.class));
        verify(notificationService, never()).createNotification(any(User.class), any(User.class), isNull(), anyString(), anyString());
    }

    @Test
    void completeProject_allowsDepartmentManager() {
        User manager = buildUser("manager-1", "manager@example.com", "Manager", ERole.MANAGER, true, "dept-1");
        User member = buildUser("employee-1", "employee@example.com", "Employee", ERole.EMPLOYEE, true, "dept-1");
        Department department = buildDepartment("dept-1", manager);
        Project project = buildProject("project-1", department);
        project.getMembers().add(member);

        when(projectRepository.findById("project-1")).thenReturn(Optional.of(project));
        when(userRepository.findByEmailIgnoreCase("manager@example.com")).thenReturn(Optional.of(manager));
        when(projectRepository.save(any(Project.class))).thenAnswer(invocation -> invocation.getArgument(0));

        projectService.completeProject("project-1", "manager@example.com");

        assertEquals(ProjectStatus.CLOSED, project.getStatus());
        verify(notificationService).createNotification(member, manager, null, "Dự án 'Project project-1' đã hoàn thành và chính thức đóng lại!", "PROJECT_CLOSED");
    }

    @Test
    void completeProject_rejectsWhenProjectStillHasIncompleteTasks() {
        User manager = buildUser("manager-1", "manager@example.com", "Manager", ERole.MANAGER, true, "dept-1");
        Department department = buildDepartment("dept-1", manager);
        Project project = buildProject("project-1", department);
        com.projectmanagement.core_system.model.Task task = new com.projectmanagement.core_system.model.Task();
        task.setStatus(com.projectmanagement.core_system.enums.TaskStatus.IN_PROGRESS);
        task.setCompletionPercentage(80);

        when(projectRepository.findById("project-1")).thenReturn(Optional.of(project));
        when(userRepository.findByEmailIgnoreCase("manager@example.com")).thenReturn(Optional.of(manager));
        when(taskRepository.findByProject_Id("project-1")).thenReturn(List.of(task));

        RuntimeException error = assertThrows(RuntimeException.class,
                () -> projectService.completeProject("project-1", "manager@example.com"));

        assertEquals("Không thể hoàn thành dự án khi vẫn còn task chưa hoàn tất. Vui lòng xử lý xong toàn bộ task trước!", error.getMessage());
        verify(projectRepository, never()).save(any(Project.class));
        verify(notificationService, never()).createNotification(any(User.class), any(User.class), isNull(), anyString(), anyString());
    }

    @Test
    void completeProject_allowsWhenAllTasksAreDoneAtOneHundredPercent() {
        User manager = buildUser("manager-1", "manager@example.com", "Manager", ERole.MANAGER, true, "dept-1");
        User member = buildUser("employee-1", "employee@example.com", "Employee", ERole.EMPLOYEE, true, "dept-1");
        Department department = buildDepartment("dept-1", manager);
        Project project = buildProject("project-1", department);
        project.getMembers().add(member);
        com.projectmanagement.core_system.model.Task doneTask = new com.projectmanagement.core_system.model.Task();
        doneTask.setStatus(com.projectmanagement.core_system.enums.TaskStatus.DONE);
        doneTask.setCompletionPercentage(100);

        when(projectRepository.findById("project-1")).thenReturn(Optional.of(project));
        when(userRepository.findByEmailIgnoreCase("manager@example.com")).thenReturn(Optional.of(manager));
        when(taskRepository.findByProject_Id("project-1")).thenReturn(List.of(doneTask));
        when(projectRepository.save(any(Project.class))).thenAnswer(invocation -> invocation.getArgument(0));

        projectService.completeProject("project-1", "manager@example.com");

        assertEquals(ProjectStatus.CLOSED, project.getStatus());
        verify(projectRepository).save(project);
    }

    @Test
    void completeProject_rejectsUnauthorizedActor() {
        User otherManager = buildUser("manager-2", "other@example.com", "Manager", ERole.MANAGER, true, "dept-2");
        User manager = buildUser("manager-1", "manager@example.com", "Manager", ERole.MANAGER, true, "dept-1");
        Department department = buildDepartment("dept-1", manager);
        Project project = buildProject("project-1", department);

        when(projectRepository.findById("project-1")).thenReturn(Optional.of(project));
        when(userRepository.findByEmailIgnoreCase("other@example.com")).thenReturn(Optional.of(otherManager));

        AccessDeniedException error = assertThrows(AccessDeniedException.class,
                () -> projectService.completeProject("project-1", "other@example.com"));

        assertEquals("Bạn không có quyền quản lý dự án của phòng ban này!", error.getMessage());
        assertEquals(ProjectStatus.OPEN, project.getStatus());
        verify(projectRepository, never()).save(any(Project.class));
    }

    @Test
    void updateProject_rejectsUnauthorizedActor() {
        User manager = buildUser("manager-1", "manager@example.com", "Manager", ERole.MANAGER, true, "dept-1");
        User employee = buildUser("employee-1", "employee@example.com", "Employee", ERole.EMPLOYEE, true, "dept-1");
        Department department = buildDepartment("dept-1", manager);
        Project project = buildProject("project-1", department);
        Project updated = new Project();
        updated.setName("Updated Project");

        when(projectRepository.findById("project-1")).thenReturn(Optional.of(project));
        when(userRepository.findByEmailIgnoreCase("employee@example.com")).thenReturn(Optional.of(employee));

        AccessDeniedException error = assertThrows(AccessDeniedException.class,
                () -> projectService.updateProject("project-1", updated, "employee@example.com"));

        assertEquals("Bạn không có quyền quản lý dự án của phòng ban này!", error.getMessage());
        verify(projectRepository, never()).save(any(Project.class));
    }

    @Test
    void updateProject_rejectsPastStartDateWhenChanged() {
        User manager = buildUser("manager-1", "manager@example.com", "Manager", ERole.MANAGER, true, "dept-1");
        Department department = buildDepartment("dept-1", manager);
        Project project = buildProject("project-1", department);
        project.setStartDate(LocalDate.now().plusDays(1));
        project.setDeadline(LocalDate.now().plusDays(5));

        Project updated = new Project();
        updated.setStartDate(LocalDate.now().minusDays(1));

        when(projectRepository.findById("project-1")).thenReturn(Optional.of(project));
        when(userRepository.findByEmailIgnoreCase("manager@example.com")).thenReturn(Optional.of(manager));

        RuntimeException error = assertThrows(RuntimeException.class,
                () -> projectService.updateProject("project-1", updated, "manager@example.com"));

        assertEquals("Ngày bắt đầu dự án không được ở quá khứ!", error.getMessage());
        verify(projectRepository, never()).save(any(Project.class));
    }

    @Test
    void updateProject_allowsNonDateEditOnLegacyProjectWithPastDates() {
        User manager = buildUser("manager-1", "manager@example.com", "Manager", ERole.MANAGER, true, "dept-1");
        Department department = buildDepartment("dept-1", manager);
        Project project = buildProject("project-1", department);
        project.setStartDate(LocalDate.now().minusDays(10));
        project.setDeadline(LocalDate.now().minusDays(2));

        Project updated = new Project();
        updated.setName("Updated legacy project");

        when(projectRepository.findById("project-1")).thenReturn(Optional.of(project));
        when(userRepository.findByEmailIgnoreCase("manager@example.com")).thenReturn(Optional.of(manager));
        when(projectRepository.save(any(Project.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Project saved = projectService.updateProject("project-1", updated, "manager@example.com");

        assertEquals("Updated legacy project", saved.getName());
        assertEquals(LocalDate.now().minusDays(10), saved.getStartDate());
        verify(projectRepository).save(project);
    }

    @Test
    void updateProject_rejectsDeadlineBeforeFinalStartDate() {
        User manager = buildUser("manager-1", "manager@example.com", "Manager", ERole.MANAGER, true, "dept-1");
        Department department = buildDepartment("dept-1", manager);
        Project project = buildProject("project-1", department);
        project.setStartDate(LocalDate.now().plusDays(3));
        project.setDeadline(LocalDate.now().plusDays(7));

        Project updated = new Project();
        updated.setDeadline(LocalDate.now().plusDays(1));

        when(projectRepository.findById("project-1")).thenReturn(Optional.of(project));
        when(userRepository.findByEmailIgnoreCase("manager@example.com")).thenReturn(Optional.of(manager));

        RuntimeException error = assertThrows(RuntimeException.class,
                () -> projectService.updateProject("project-1", updated, "manager@example.com"));

        assertEquals("Hạn cuối dự án không được sớm hơn ngày bắt đầu!", error.getMessage());
        verify(projectRepository, never()).save(any(Project.class));
    }

    @Test
    void getAccessibleProjects_rejectsNonAdminAccessToAnotherUsersProjects() {
        User employee = buildUser("employee-1", "employee@example.com", "Employee", ERole.EMPLOYEE, true, "dept-1");

        when(userRepository.findByEmailIgnoreCase("employee@example.com")).thenReturn(Optional.of(employee));

        AccessDeniedException error = assertThrows(AccessDeniedException.class,
                () -> projectService.getAccessibleProjects("user-2", "employee@example.com"));

        assertEquals("Bạn không có quyền xem danh sách dự án của người dùng khác!", error.getMessage());
        verify(userRepository, never()).findById("user-2");
    }

    @Test
    void getAccessibleProjects_rejectsAdminAccessToAnotherUsersProjects() {
        User admin = buildUser("admin-1", "admin@example.com", "Admin", ERole.ADMIN, true, null);

        when(userRepository.findByEmailIgnoreCase("admin@example.com")).thenReturn(Optional.of(admin));

        AccessDeniedException error = assertThrows(AccessDeniedException.class,
                () -> projectService.getAccessibleProjects("user-2", "admin@example.com"));

        assertEquals("Bạn không có quyền xem danh sách dự án của người dùng khác!", error.getMessage());
        verify(userRepository, never()).findById("user-2");
    }

    @Test
    void getAllProjects_returnsOnlyAccessibleProjectsForNonAdmin() {
        User employee = buildUser("employee-1", "employee@example.com", "Employee", ERole.EMPLOYEE, true, "dept-1");
        Department ownDepartment = buildDepartment("dept-1", null);
        Department otherDepartment = buildDepartment("dept-2", null);
        Project memberProject = buildProject("project-1", ownDepartment);
        memberProject.getMembers().add(employee);
        Project otherProject = buildProject("project-2", otherDepartment);

        when(userRepository.findByEmailIgnoreCase("employee@example.com")).thenReturn(Optional.of(employee));
        when(userRepository.findById("employee-1")).thenReturn(Optional.of(employee));
        when(projectRepository.findByIsDeletedFalse()).thenReturn(List.of(memberProject, otherProject));

        List<Project> result = projectService.getAllProjects("employee@example.com");

        assertEquals(1, result.size());
        assertEquals("project-1", result.get(0).getId());
    }

    @Test
    void softDelete_rejectsNonAdmin() {
        User manager = buildUser("manager-1", "manager@example.com", "Manager", ERole.MANAGER, true, "dept-1");

        when(userRepository.findByEmailIgnoreCase("manager@example.com")).thenReturn(Optional.of(manager));

        AccessDeniedException error = assertThrows(AccessDeniedException.class,
                () -> projectService.softDelete("project-1", "manager@example.com"));

        assertEquals("Bạn không có quyền thực hiện thao tác này!", error.getMessage());
        verify(projectRepository, never()).findById(anyString());
    }

    @Test
    void softDelete_rejectsWhenProjectStillHasTasks() {
        User admin = buildUser("admin-1", "admin@example.com", "Admin", ERole.ADMIN, true, null);
        Department department = buildDepartment("dept-1", null);
        Project project = buildProject("project-1", department);

        when(userRepository.findByEmailIgnoreCase("admin@example.com")).thenReturn(Optional.of(admin));
        when(projectRepository.findById("project-1")).thenReturn(Optional.of(project));
        when(taskRepository.existsByProject_Id("project-1")).thenReturn(true);

        RuntimeException error = assertThrows(RuntimeException.class,
                () -> projectService.softDelete("project-1", "admin@example.com"));

        assertEquals("Không thể xóa dự án này vì vẫn còn task đang thuộc dự án. Vui lòng xóa hoặc xử lý toàn bộ task trước khi xóa dự án!", error.getMessage());
        verify(projectRepository, never()).save(any(Project.class));
    }

    @Test
    void softDelete_allowsAdminWhenProjectHasNoTasks() {
        User admin = buildUser("admin-1", "admin@example.com", "Admin", ERole.ADMIN, true, null);
        Department department = buildDepartment("dept-1", null);
        Project project = buildProject("project-1", department);

        when(userRepository.findByEmailIgnoreCase("admin@example.com")).thenReturn(Optional.of(admin));
        when(projectRepository.findById("project-1")).thenReturn(Optional.of(project));
        when(taskRepository.existsByProject_Id("project-1")).thenReturn(false);
        when(projectRepository.save(any(Project.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Project deleted = projectService.softDelete("project-1", "admin@example.com");

        assertEquals(true, deleted.isDeleted());
        assertEquals(LocalDate.now(), deleted.getDeletedAt());
    }

    @Test
    void restoreProject_allowsAdmin() {
        User admin = buildUser("admin-1", "admin@example.com", "Admin", ERole.ADMIN, true, null);
        Department department = buildDepartment("dept-1", null);
        Project project = buildProject("project-1", department);
        project.setDeleted(true);
        project.setDeletedAt(LocalDate.now());

        when(userRepository.findByEmailIgnoreCase("admin@example.com")).thenReturn(Optional.of(admin));
        when(projectRepository.findById("project-1")).thenReturn(Optional.of(project));
        when(projectRepository.save(any(Project.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Project restored = projectService.restoreProject("project-1", "admin@example.com");

        assertEquals(false, restored.isDeleted());
        assertEquals(null, restored.getDeletedAt());
    }

    @Test
    void getDeletedProjects_rejectsNonAdmin() {
        User manager = buildUser("manager-1", "manager@example.com", "Manager", ERole.MANAGER, true, "dept-1");

        when(userRepository.findByEmailIgnoreCase("manager@example.com")).thenReturn(Optional.of(manager));

        AccessDeniedException error = assertThrows(AccessDeniedException.class,
                () -> projectService.getDeletedProjects("manager@example.com"));

        assertEquals("Bạn không có quyền thực hiện thao tác này!", error.getMessage());
    }

    private User buildUser(String id, String email, String fullName, ERole role, boolean active, String deptId) {
        User user = new User();
        user.setId(id);
        user.setEmail(email);
        user.setFullName(fullName);
        user.setRole(role);
        user.setActive(active);
        if (deptId != null) {
            Department department = new Department();
            department.setId(deptId);
            user.setDepartment(department);
        }
        return user;
    }

    private Department buildDepartment(String id, User manager) {
        Department department = new Department();
        department.setId(id);
        department.setManager(manager);
        return department;
    }

    private Project buildProject(String id, Department department) {
        Project project = new Project();
        project.setId(id);
        project.setName("Project " + id);
        project.setDepartment(department);
        project.setStatus(ProjectStatus.OPEN);
        project.setMembers(new ArrayList<>());
        return project;
    }
}
