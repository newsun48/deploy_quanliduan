package com.projectmanagement.core_system.service;

import com.projectmanagement.core_system.enums.ApprovalStatus;
import com.projectmanagement.core_system.enums.ERole;
import com.projectmanagement.core_system.enums.ProjectStatus;
import com.projectmanagement.core_system.enums.TaskStatus;
import com.projectmanagement.core_system.model.ApproveUserRequest;
import com.projectmanagement.core_system.model.Department;
import com.projectmanagement.core_system.model.GoogleAuthenticatedUser;
import com.projectmanagement.core_system.model.GoogleLoginResult;
import com.projectmanagement.core_system.model.Project;
import com.projectmanagement.core_system.model.RejectUserRequest;
import com.projectmanagement.core_system.model.SignupRequest;
import com.projectmanagement.core_system.model.UpdateUserRequest;
import com.projectmanagement.core_system.model.UpdateUserStatusRequest;
import com.projectmanagement.core_system.model.User;
import com.projectmanagement.core_system.repository.DepartmentRepository;
import com.projectmanagement.core_system.repository.ProjectRepository;
import com.projectmanagement.core_system.repository.TaskRepository;
import com.projectmanagement.core_system.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private DepartmentRepository departmentRepository;

    @Mock
    private ProjectRepository projectRepository;

    @Mock
    private TaskRepository taskRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private GoogleTokenVerifierService googleTokenVerifierService;

    @Mock
    private UserActivityService userActivityService;

    @Mock
    private EmailDeliveryService emailDeliveryService;

    @InjectMocks
    private UserService userService;

    @Test
    void updateUserStatus_rejectsDeactivatingAdminTarget() {
        User actorAdmin = buildUser("admin-actor", "admin@example.com", ERole.ADMIN, true);
        User targetAdmin = buildUser("admin-target", "other-admin@example.com", ERole.ADMIN, true);
        UpdateUserStatusRequest request = new UpdateUserStatusRequest();
        request.setActive(false);

        when(userRepository.findByEmailIgnoreCase("admin@example.com")).thenReturn(Optional.of(actorAdmin));
        when(userRepository.findById("admin-target")).thenReturn(Optional.of(targetAdmin));

        RuntimeException error = assertThrows(RuntimeException.class,
                () -> userService.updateUserStatus("admin-target", request, "admin@example.com"));

        assertEquals("Tài khoản ADMIN luôn hoạt động và không thể bị khóa!", error.getMessage());
    }

    @Test
    void updateUserStatus_allowsLockingNonAdminUser() {
        User actorAdmin = buildUser("admin-actor", "admin@example.com", ERole.ADMIN, true);
        User employee = buildUser("employee-1", "employee@example.com", ERole.EMPLOYEE, true);
        UpdateUserStatusRequest request = new UpdateUserStatusRequest();
        request.setActive(false);

        when(userRepository.findByEmailIgnoreCase("admin@example.com")).thenReturn(Optional.of(actorAdmin));
        when(userRepository.findById("employee-1")).thenReturn(Optional.of(employee));
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        User updatedUser = userService.updateUserStatus("employee-1", request, "admin@example.com");

        assertFalse(updatedUser.isActive());
        verify(userRepository).save(employee);
    }

    @Test
    void updateUserStatus_rejectsUnlockingPendingUser() {
        User actorAdmin = buildUser("admin-actor", "admin@example.com", ERole.ADMIN, true);
        User pendingUser = buildUser("pending-1", "pending@example.com", null, false);
        pendingUser.setApprovalStatus(ApprovalStatus.PENDING);
        UpdateUserStatusRequest request = new UpdateUserStatusRequest();
        request.setActive(true);

        when(userRepository.findByEmailIgnoreCase("admin@example.com")).thenReturn(Optional.of(actorAdmin));
        when(userRepository.findById("pending-1")).thenReturn(Optional.of(pendingUser));

        RuntimeException error = assertThrows(RuntimeException.class,
                () -> userService.updateUserStatus("pending-1", request, "admin@example.com"));

        assertEquals("Không thể mở khóa tài khoản đang chờ phê duyệt. Vui lòng phê duyệt tài khoản trước!", error.getMessage());
    }

    @Test
    void signupPendingUser_createsPendingInactiveUserWithoutRole() {
        SignupRequest request = new SignupRequest();
        request.setFullName("Pending User");
        request.setEmail("pending-user@example.com");
        request.setPassword("password123");

        when(userRepository.existsByEmailIgnoreCase("pending-user@example.com")).thenReturn(false);
        when(passwordEncoder.encode("password123")).thenReturn("encoded-pass");
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        User createdUser = userService.signupPendingUser(request);

        assertEquals(ApprovalStatus.PENDING, createdUser.getApprovalStatus());
        assertFalse(createdUser.isActive());
        assertEquals(null, createdUser.getRole());
        assertEquals("pending-user@example.com", createdUser.getEmail());
    }

    @Test
    void authenticateWithGoogle_linksApprovedExistingUserAndReturnsApprovedStatus() {
        User existingUser = buildUser("user-1", "member@example.com", ERole.EMPLOYEE, true);
        existingUser.setGoogleSubject(null);
        existingUser.setGoogleEmailVerified(null);
        GoogleAuthenticatedUser googleUser = new GoogleAuthenticatedUser(
                "google-sub-1",
                "member@example.com",
                true,
                "Member Name",
                "https://example.com/avatar.png"
        );

        when(googleTokenVerifierService.verify("valid-google-token")).thenReturn(googleUser);
        when(userRepository.findByGoogleSubject("google-sub-1")).thenReturn(Optional.empty());
        when(userRepository.findByEmailIgnoreCase("member@example.com")).thenReturn(Optional.of(existingUser));
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        GoogleLoginResult result = userService.authenticateWithGoogle("valid-google-token");

        assertEquals(GoogleLoginResult.Status.APPROVED, result.getStatus());
        assertEquals("google-sub-1", result.getUser().getGoogleSubject());
        assertEquals(Boolean.TRUE, result.getUser().getGoogleEmailVerified());
    }

    @Test
    void authenticateWithGoogle_createsPendingUserForFirstTimeGoogleEmail() {
        GoogleAuthenticatedUser googleUser = new GoogleAuthenticatedUser(
                "google-sub-new",
                "new-user@example.com",
                true,
                "New Google User",
                "https://example.com/picture.png"
        );

        when(googleTokenVerifierService.verify("new-google-token")).thenReturn(googleUser);
        when(userRepository.findByGoogleSubject("google-sub-new")).thenReturn(Optional.empty());
        when(userRepository.findByEmailIgnoreCase("new-user@example.com")).thenReturn(Optional.empty());
        when(passwordEncoder.encode(any(String.class))).thenReturn("encoded-random-password");
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        GoogleLoginResult result = userService.authenticateWithGoogle("new-google-token");

        assertEquals(GoogleLoginResult.Status.PENDING, result.getStatus());
        assertEquals(ApprovalStatus.PENDING, result.getUser().getApprovalStatus());
        assertFalse(result.getUser().isActive());
        assertEquals(null, result.getUser().getRole());
        assertEquals("google-sub-new", result.getUser().getGoogleSubject());
    }

    @Test
    void authenticateWithGoogle_rejectsDifferentLinkedGoogleSubjectForExistingEmail() {
        User existingUser = buildUser("user-1", "member@example.com", ERole.EMPLOYEE, true);
        existingUser.setGoogleSubject("another-google-sub");
        GoogleAuthenticatedUser googleUser = new GoogleAuthenticatedUser(
                "google-sub-1",
                "member@example.com",
                true,
                "Member Name",
                null
        );

        when(googleTokenVerifierService.verify("conflict-token")).thenReturn(googleUser);
        when(userRepository.findByGoogleSubject("google-sub-1")).thenReturn(Optional.empty());
        when(userRepository.findByEmailIgnoreCase("member@example.com")).thenReturn(Optional.of(existingUser));

        RuntimeException error = assertThrows(RuntimeException.class,
                () -> userService.authenticateWithGoogle("conflict-token"));

        assertEquals("Tài khoản này đã được liên kết với một tài khoản Google khác!", error.getMessage());
    }

    @Test
    void signupPendingUser_trimsAndNormalizesEmailBeforeSaving() {
        SignupRequest request = new SignupRequest();
        request.setFullName("Pending User");
        request.setEmail("  Pending-User@Example.com  ");
        request.setPassword("password123");

        when(userRepository.existsByEmailIgnoreCase("pending-user@example.com")).thenReturn(false);
        when(passwordEncoder.encode("password123")).thenReturn("encoded-pass");
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        User createdUser = userService.signupPendingUser(request);

        assertEquals("pending-user@example.com", createdUser.getEmail());
    }

    @Test
    void signupPendingUser_rejectsShortPassword() {
        SignupRequest request = new SignupRequest();
        request.setFullName("Pending User");
        request.setEmail("pending-user@example.com");
        request.setPassword("123");

        RuntimeException error = assertThrows(RuntimeException.class,
                () -> userService.signupPendingUser(request));

        assertEquals("Mật khẩu phải có ít nhất 6 ký tự!", error.getMessage());
    }

    @Test
    void createUser_rejectsEmailAlreadyPendingApproval() {
        User pendingUser = buildUser("pending-1", "pending@example.com", null, false);
        pendingUser.setApprovalStatus(ApprovalStatus.PENDING);

        User newUser = new User();
        newUser.setFullName("Admin Created");
        newUser.setEmail("pending@example.com");
        newUser.setPassword("password123");
        newUser.setRole(ERole.EMPLOYEE);

        when(userRepository.findByEmailIgnoreCase("pending@example.com")).thenReturn(Optional.of(pendingUser));

        RuntimeException error = assertThrows(RuntimeException.class,
                () -> userService.createUser(newUser, null, "admin@example.com"));

        assertEquals("Email 'pending@example.com' đã có tài khoản đang chờ duyệt. Vui lòng duyệt tài khoản này trong danh sách người dùng thay vì tạo mới!", error.getMessage());
    }

    @Test
    void createUser_rejectsEmailAlreadyRejected() {
        User rejectedUser = buildUser("rejected-1", "rejected@example.com", null, false);
        rejectedUser.setApprovalStatus(ApprovalStatus.REJECTED);

        User newUser = new User();
        newUser.setFullName("Admin Created");
        newUser.setEmail("rejected@example.com");
        newUser.setPassword("password123");
        newUser.setRole(ERole.EMPLOYEE);

        when(userRepository.findByEmailIgnoreCase("rejected@example.com")).thenReturn(Optional.of(rejectedUser));

        RuntimeException error = assertThrows(RuntimeException.class,
                () -> userService.createUser(newUser, null, "admin@example.com"));

        assertEquals("Email 'rejected@example.com' đã tồn tại với trạng thái bị từ chối. Vui lòng cập nhật hoặc xử lý tài khoản hiện có thay vì tạo mới!", error.getMessage());
    }

    @Test
    void updateEmployee_forcesPromotedAdminToRemainActive() {
        User actorAdmin = buildUser("admin-actor", "admin@example.com", ERole.ADMIN, true);
        User employee = buildUser("employee-1", "employee@example.com", ERole.EMPLOYEE, false);
        UpdateUserRequest request = new UpdateUserRequest();
        request.setRole(ERole.ADMIN);

        when(userRepository.findByEmailIgnoreCase("admin@example.com")).thenReturn(Optional.of(actorAdmin));
        when(userRepository.findById("employee-1")).thenReturn(Optional.of(employee));
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        User updatedUser = userService.updateEmployee("employee-1", request, "admin@example.com");

        assertEquals(ERole.ADMIN, updatedUser.getRole());
        assertTrue(updatedUser.isActive());
    }

    @Test
    void updateEmployee_blocksManagerDowngradeWithoutExplicitHandoff() {
        User actorAdmin = buildUser("admin-actor", "admin@example.com", ERole.ADMIN, true);
        Department department = buildDepartment("dept-1", "Engineering");
        User manager = buildUser("manager-1", "manager@example.com", ERole.MANAGER, true);
        manager.setDepartment(department);
        department.setManager(manager);

        UpdateUserRequest request = new UpdateUserRequest();
        request.setRole(ERole.EMPLOYEE);

        when(userRepository.findByEmailIgnoreCase("admin@example.com")).thenReturn(Optional.of(actorAdmin));
        when(userRepository.findById("manager-1")).thenReturn(Optional.of(manager));
        when(projectRepository.existsByDepartment_IdAndIsDeletedFalseAndStatusIn(any(), any())).thenReturn(false);
        when(projectRepository.findByIsDeletedFalseAndDepartment_Id("dept-1")).thenReturn(java.util.List.of());

        RuntimeException error = assertThrows(RuntimeException.class,
                () -> userService.updateEmployee("manager-1", request, "admin@example.com"));

        assertEquals("Không thể thay đổi vai trò hoặc phòng ban của trưởng phòng khi chưa chuyển giao manager trước.", error.getMessage());
        verify(userRepository, never()).save(any(User.class));
        verify(departmentRepository, never()).save(any(Department.class));
    }

    @Test
    void updateEmployee_blocksManagerDowngradeWithOpenWorkAndInvalidSuccessor() {
        User actorAdmin = buildUser("admin-actor", "admin@example.com", ERole.ADMIN, true);
        Department department = buildDepartment("dept-1", "Engineering");
        User manager = buildUser("manager-1", "manager@example.com", ERole.MANAGER, true);
        User employeeSuccessor = buildUser("employee-2", "employee2@example.com", ERole.EMPLOYEE, true);
        manager.setDepartment(department);
        employeeSuccessor.setDepartment(department);
        department.setManager(manager);

        Project openProject = new Project();
        openProject.setId("project-1");
        openProject.setDepartment(department);
        openProject.setStatus(ProjectStatus.OPEN);

        UpdateUserRequest request = new UpdateUserRequest();
        request.setRole(ERole.EMPLOYEE);
        request.setHandoffManagerId("employee-2");

        when(userRepository.findByEmailIgnoreCase("admin@example.com")).thenReturn(Optional.of(actorAdmin));
        when(userRepository.findById("manager-1")).thenReturn(Optional.of(manager));
        when(userRepository.findById("employee-2")).thenReturn(Optional.of(employeeSuccessor));
        when(projectRepository.existsByDepartment_IdAndIsDeletedFalseAndStatusIn(any(), any())).thenReturn(true);
        when(projectRepository.findByIsDeletedFalseAndDepartment_Id("dept-1")).thenReturn(java.util.List.of(openProject));
        when(taskRepository.existsByProjectInAndStatusIn(any(), any())).thenReturn(true);

        RuntimeException error = assertThrows(RuntimeException.class,
                () -> userService.updateEmployee("manager-1", request, "admin@example.com"));

        assertEquals("Người nhận bàn giao phải là MANAGER. Vui lòng bổ nhiệm người thay thế trước khi downgrade.", error.getMessage());
        verify(userRepository, never()).save(any(User.class));
        verify(departmentRepository, never()).save(any(Department.class));
    }

    @Test
    void updateEmployee_downgradesManagerAfterExplicitHandoff() {
        User actorAdmin = buildUser("admin-actor", "admin@example.com", ERole.ADMIN, true);
        Department department = buildDepartment("dept-1", "Engineering");
        User currentManager = buildUser("manager-1", "manager@example.com", ERole.MANAGER, true);
        User successorManager = buildUser("manager-2", "successor@example.com", ERole.MANAGER, true);
        currentManager.setDepartment(department);
        successorManager.setDepartment(department);
        department.setManager(currentManager);

        Project openProject = new Project();
        openProject.setId("project-1");
        openProject.setDepartment(department);
        openProject.setStatus(ProjectStatus.OPEN);

        UpdateUserRequest request = new UpdateUserRequest();
        request.setRole(ERole.EMPLOYEE);
        request.setHandoffManagerId("manager-2");
        request.setHandoffNote("Ban giao van hanh quy 2");

        when(userRepository.findByEmailIgnoreCase("admin@example.com")).thenReturn(Optional.of(actorAdmin));
        when(userRepository.findById("manager-1")).thenReturn(Optional.of(currentManager));
        when(userRepository.findById("manager-2")).thenReturn(Optional.of(successorManager));
        when(projectRepository.existsByDepartment_IdAndIsDeletedFalseAndStatusIn(any(), any())).thenReturn(true);
        when(projectRepository.findByIsDeletedFalseAndDepartment_Id("dept-1")).thenReturn(java.util.List.of(openProject));
        when(taskRepository.existsByProjectInAndStatusIn(any(), any())).thenReturn(true);
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(departmentRepository.save(any(Department.class))).thenAnswer(invocation -> invocation.getArgument(0));

        User updatedUser = userService.updateEmployee("manager-1", request, "admin@example.com");

        assertEquals(ERole.EMPLOYEE, updatedUser.getRole());
        assertEquals(successorManager, department.getManager());
        verify(departmentRepository).save(department);
        verify(userActivityService).record(any(User.class), any(User.class), any(String.class), any(String.class), any(Map.class));
    }

    @Test
    void approvePendingUser_setsRoleApprovedAndActive() {
        User actorAdmin = buildUser("admin-actor", "admin@example.com", ERole.ADMIN, true);
        User pendingUser = buildUser("pending-1", "pending@example.com", null, false);
        pendingUser.setApprovalStatus(ApprovalStatus.PENDING);
        pendingUser.setRejectionReason("old reason");

        ApproveUserRequest request = new ApproveUserRequest();
        request.setRole(ERole.EMPLOYEE);

        when(userRepository.findByEmailIgnoreCase("admin@example.com")).thenReturn(Optional.of(actorAdmin));
        when(userRepository.findById("pending-1")).thenReturn(Optional.of(pendingUser));
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        User updatedUser = userService.approvePendingUser("pending-1", request, "admin@example.com");

        assertEquals(ERole.EMPLOYEE, updatedUser.getRole());
        assertEquals(ApprovalStatus.APPROVED, updatedUser.getApprovalStatus());
        assertTrue(updatedUser.isActive());
        assertEquals(null, updatedUser.getRejectionReason());
        verify(emailDeliveryService).sendEmail(any(String.class), any(String.class), any(String.class), any());
    }

    @Test
    void rejectPendingUser_setsRejectedStatusStoresReasonAndSendsEmail() {
        User actorAdmin = buildUser("admin-actor", "admin@example.com", ERole.ADMIN, true);
        User pendingUser = buildUser("pending-1", "pending@example.com", null, false);
        pendingUser.setApprovalStatus(ApprovalStatus.PENDING);

        RejectUserRequest request = new RejectUserRequest();
        request.setReason("  Hồ sơ không đầy đủ  ");

        when(userRepository.findByEmailIgnoreCase("admin@example.com")).thenReturn(Optional.of(actorAdmin));
        when(userRepository.findById("pending-1")).thenReturn(Optional.of(pendingUser));
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        User updatedUser = userService.rejectPendingUser("pending-1", request, "admin@example.com");

        assertEquals(ApprovalStatus.REJECTED, updatedUser.getApprovalStatus());
        assertFalse(updatedUser.isActive());
        assertEquals("Hồ sơ không đầy đủ", updatedUser.getRejectionReason());
        ArgumentCaptor<String> toCaptor = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> subjectCaptor = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> bodyCaptor = ArgumentCaptor.forClass(String.class);
        verify(emailDeliveryService).sendEmail(toCaptor.capture(), subjectCaptor.capture(), bodyCaptor.capture(), any());
        assertEquals("pending@example.com", toCaptor.getValue());
        assertTrue(subjectCaptor.getValue().contains("tu choi"));
        assertTrue(bodyCaptor.getValue().contains("Hồ sơ không đầy đủ"));
    }

    @Test
    void validateUserCanLogin_rejectsRejectedUserWithReason() {
        User rejectedUser = buildUser("user-1", "rejected@example.com", ERole.EMPLOYEE, false);
        rejectedUser.setApprovalStatus(ApprovalStatus.REJECTED);
        rejectedUser.setRejectionReason("Thiếu thông tin xác minh");

        RuntimeException error = assertThrows(RuntimeException.class,
                () -> userService.validateUserCanLogin(rejectedUser));

        assertEquals("Tài khoản của bạn đã bị từ chối: Thiếu thông tin xác minh", error.getMessage());
    }

    @Test
    void deleteUser_rejectsWhenUserHasAssignedTasks() {
        User actorAdmin = buildUser("admin-actor", "admin@example.com", ERole.ADMIN, true);
        User employee = buildUser("employee-1", "employee@example.com", ERole.EMPLOYEE, true);

        when(userRepository.findByEmailIgnoreCase("admin@example.com")).thenReturn(Optional.of(actorAdmin));
        when(userRepository.findById("employee-1")).thenReturn(Optional.of(employee));
        when(taskRepository.existsByAssignee_Id("employee-1")).thenReturn(true);

        RuntimeException error = assertThrows(RuntimeException.class,
                () -> userService.deleteUser("employee-1", "admin@example.com"));

        assertEquals("Không thể xóa nhân viên này vì vẫn còn công việc đang được giao!", error.getMessage());
        verify(userRepository, never()).deleteById("employee-1");
        verify(userActivityService, never()).record(any(), any(), any(), any(), any());
    }

    @Test
    void deleteUser_deletesNonAdminWithoutAssignedTasks() {
        User actorAdmin = buildUser("admin-actor", "admin@example.com", ERole.ADMIN, true);
        User employee = buildUser("employee-1", "employee@example.com", ERole.EMPLOYEE, true);

        when(userRepository.findById("employee-1")).thenReturn(Optional.of(employee));
        when(userRepository.findByEmailIgnoreCase("admin@example.com")).thenReturn(Optional.of(actorAdmin));
        when(taskRepository.existsByAssignee_Id("employee-1")).thenReturn(false);

        userService.deleteUser("employee-1", "admin@example.com");

        verify(userRepository).deleteById("employee-1");
        verify(userActivityService).record(any(User.class), any(User.class), any(), any(), any());
    }

    @Test
    void deleteUser_stillRejectsAdminDeletion() {
        User actorAdmin = buildUser("admin-actor", "admin@example.com", ERole.ADMIN, true);
        User targetAdmin = buildUser("admin-target", "other-admin@example.com", ERole.ADMIN, true);

        when(userRepository.findByEmailIgnoreCase("admin@example.com")).thenReturn(Optional.of(actorAdmin));
        when(userRepository.findById("admin-target")).thenReturn(Optional.of(targetAdmin));

        RuntimeException error = assertThrows(RuntimeException.class,
                () -> userService.deleteUser("admin-target", "admin@example.com"));

        assertEquals("Không được phép xóa tài khoản Quản trị viên (ADMIN)!", error.getMessage());
        verify(taskRepository, never()).existsByAssignee_Id("admin-target");
        verify(userRepository, never()).deleteById("admin-target");
    }

    @Test
    void deleteUser_rejectsNonAdminActor() {
        User actorEmployee = buildUser("employee-actor", "employee.actor@example.com", ERole.EMPLOYEE, true);

        when(userRepository.findByEmailIgnoreCase("employee.actor@example.com")).thenReturn(Optional.of(actorEmployee));

        RuntimeException error = assertThrows(RuntimeException.class,
                () -> userService.deleteUser("employee-1", "employee.actor@example.com"));

        assertEquals("Bạn không có quyền thực hiện thao tác này!", error.getMessage());
        verify(userRepository, never()).deleteById("employee-1");
    }

    @Test
    void downloadImageFromUrl_rejectsLocalhostHost() {
        IllegalArgumentException error = assertThrows(IllegalArgumentException.class,
                () -> userService.downloadImageFromUrl("http://localhost/avatar.png"));

        assertEquals("URL ảnh không được trỏ tới host nội bộ!", error.getMessage());
    }

    @Test
    void downloadImageFromUrl_rejectsNonHttpSchemes() {
        IllegalArgumentException error = assertThrows(IllegalArgumentException.class,
                () -> userService.downloadImageFromUrl("ftp://example.com/avatar.png"));

        assertEquals("Chỉ chấp nhận URL ảnh qua HTTP hoặc HTTPS!", error.getMessage());
    }

    private User buildUser(String id, String email, ERole role, boolean active) {
        User user = new User();
        user.setId(id);
        user.setEmail(email);
        user.setRole(role);
        user.setActive(active);
        user.setApprovalStatus(ApprovalStatus.APPROVED);
        user.setFullName(email);
        return user;
    }

    private Department buildDepartment(String id, String name) {
        Department department = new Department();
        department.setId(id);
        department.setName(name);
        return department;
    }
}
