package com.projectmanagement.core_system.service;

import com.projectmanagement.core_system.enums.ERole;
import com.projectmanagement.core_system.model.UpdateUserRequest;
import com.projectmanagement.core_system.model.UpdateUserStatusRequest;
import com.projectmanagement.core_system.model.User;
import com.projectmanagement.core_system.repository.DepartmentRepository;
import com.projectmanagement.core_system.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private DepartmentRepository departmentRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private UserActivityService userActivityService;

    @InjectMocks
    private UserService userService;

    @Test
    void updateUserStatus_rejectsDeactivatingAdminTarget() {
        User actorAdmin = buildUser("admin-actor", "admin@example.com", ERole.ADMIN, true);
        User targetAdmin = buildUser("admin-target", "other-admin@example.com", ERole.ADMIN, true);
        UpdateUserStatusRequest request = new UpdateUserStatusRequest(false);

        when(userRepository.findByEmail("admin@example.com")).thenReturn(Optional.of(actorAdmin));
        when(userRepository.findById("admin-target")).thenReturn(Optional.of(targetAdmin));

        RuntimeException error = assertThrows(RuntimeException.class,
                () -> userService.updateUserStatus("admin-target", request, "admin@example.com"));

        assertEquals("Tài khoản ADMIN luôn hoạt động và không thể bị khóa!", error.getMessage());
    }

    @Test
    void updateUserStatus_allowsLockingNonAdminUser() {
        User actorAdmin = buildUser("admin-actor", "admin@example.com", ERole.ADMIN, true);
        User employee = buildUser("employee-1", "employee@example.com", ERole.EMPLOYEE, true);
        UpdateUserStatusRequest request = new UpdateUserStatusRequest(false);

        when(userRepository.findByEmail("admin@example.com")).thenReturn(Optional.of(actorAdmin));
        when(userRepository.findById("employee-1")).thenReturn(Optional.of(employee));
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        User updatedUser = userService.updateUserStatus("employee-1", request, "admin@example.com");

        assertTrue(!updatedUser.isActive());
        verify(userRepository).save(employee);
    }

    @Test
    void updateEmployee_forcesPromotedAdminToRemainActive() {
        User actorAdmin = buildUser("admin-actor", "admin@example.com", ERole.ADMIN, true);
        User employee = buildUser("employee-1", "employee@example.com", ERole.EMPLOYEE, false);
        UpdateUserRequest request = new UpdateUserRequest();
        request.setRole(ERole.ADMIN);

        when(userRepository.findByEmail("admin@example.com")).thenReturn(Optional.of(actorAdmin));
        when(userRepository.findById("employee-1")).thenReturn(Optional.of(employee));
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        User updatedUser = userService.updateEmployee("employee-1", request, "admin@example.com");

        assertEquals(ERole.ADMIN, updatedUser.getRole());
        assertTrue(updatedUser.isActive());
    }

    private User buildUser(String id, String email, ERole role, boolean active) {
        User user = new User();
        user.setId(id);
        user.setEmail(email);
        user.setRole(role);
        user.setActive(active);
        user.setFullName(email);
        return user;
    }
}
