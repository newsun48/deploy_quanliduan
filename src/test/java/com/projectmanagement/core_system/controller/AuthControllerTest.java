package com.projectmanagement.core_system.controller;

import com.projectmanagement.core_system.config.JwtUtil;
import com.projectmanagement.core_system.enums.ERole;
import com.projectmanagement.core_system.model.GoogleLoginRequest;
import com.projectmanagement.core_system.model.GoogleLoginResult;
import com.projectmanagement.core_system.model.LoginRequest;
import com.projectmanagement.core_system.model.User;
import com.projectmanagement.core_system.repository.UserRepository;
import com.projectmanagement.core_system.service.UserActivityService;
import com.projectmanagement.core_system.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthControllerTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private JwtUtil jwtUtil;

    @Mock
    private UserActivityService userActivityService;

    @Mock
    private UserService userService;

    @InjectMocks
    private AuthController authController;

    @Test
    void loginWithGoogle_returnsApprovedJwtResponse() {
        GoogleLoginRequest request = new GoogleLoginRequest();
        request.setCredential("valid-token");
        HttpServletRequest servletRequest = mock(HttpServletRequest.class);
        User user = buildUser("member@example.com", ERole.EMPLOYEE);

        when(userService.authenticateWithGoogle("valid-token"))
                .thenReturn(new GoogleLoginResult(GoogleLoginResult.Status.APPROVED, user, "ok"));
        when(jwtUtil.generateToken("member@example.com", "EMPLOYEE", 0L)).thenReturn("jwt-token");
        when(servletRequest.getRemoteAddr()).thenReturn("127.0.0.1");

        ResponseEntity<?> response = authController.loginWithGoogle(request, servletRequest);

        assertEquals(200, response.getStatusCode().value());
        Map<?, ?> body = (Map<?, ?>) response.getBody();
        assertEquals("jwt-token", body.get("token"));
        assertEquals(user, body.get("user"));
    }

    @Test
    void loginWithGoogle_returnsAcceptedForPendingAccount() {
        GoogleLoginRequest request = new GoogleLoginRequest();
        request.setCredential("pending-token");
        HttpServletRequest servletRequest = mock(HttpServletRequest.class);
        User user = buildUser("pending@example.com", null);

        when(userService.authenticateWithGoogle("pending-token"))
                .thenReturn(new GoogleLoginResult(
                        GoogleLoginResult.Status.PENDING,
                        user,
                        "Tài khoản đang chờ duyệt"
                ));
        when(servletRequest.getRemoteAddr()).thenReturn("127.0.0.1");

        ResponseEntity<?> response = authController.loginWithGoogle(request, servletRequest);

        assertEquals(202, response.getStatusCode().value());
        Map<?, ?> body = (Map<?, ?>) response.getBody();
        assertEquals("PENDING_APPROVAL", body.get("code"));
        assertEquals("Tài khoản đang chờ duyệt", body.get("message"));
    }

    @Test
    void loginWithGoogle_returnsBadRequestWhenServiceFails() {
        GoogleLoginRequest request = new GoogleLoginRequest();
        request.setCredential("bad-token");
        HttpServletRequest servletRequest = mock(HttpServletRequest.class);

        when(userService.authenticateWithGoogle("bad-token"))
                .thenThrow(new RuntimeException("Token Google không hợp lệ!"));

        ResponseEntity<?> response = authController.loginWithGoogle(request, servletRequest);

        assertEquals(400, response.getStatusCode().value());
        Map<?, ?> body = (Map<?, ?>) response.getBody();
        assertEquals("GOOGLE_LOGIN_FAILED", body.get("code"));
        assertTrue(String.valueOf(body.get("message")).contains("không hợp lệ"));
    }

    @Test
    void login_returnsGenericInvalidCredentialsWhenEmailDoesNotExist() {
        LoginRequest request = new LoginRequest();
        request.setEmail("missing@example.com");
        request.setPassword("password123");
        HttpServletRequest servletRequest = mock(HttpServletRequest.class);

        when(userRepository.findByEmailIgnoreCase("missing@example.com")).thenReturn(java.util.Optional.empty());
        when(servletRequest.getRemoteAddr()).thenReturn("127.0.0.1");

        ResponseEntity<?> response = authController.login(request, servletRequest);

        assertEquals(400, response.getStatusCode().value());
        Map<?, ?> body = (Map<?, ?>) response.getBody();
        assertEquals("INVALID_CREDENTIALS", body.get("code"));
        assertEquals("Email hoặc mật khẩu không chính xác!", body.get("message"));
        verify(userActivityService).record(eq(null), eq(null), eq("LOGIN_FAILED"), any(String.class), any(Map.class));
    }

    @Test
    void login_returnsGenericInvalidCredentialsWhenPasswordIsWrong() {
        LoginRequest request = new LoginRequest();
        request.setEmail("member@example.com");
        request.setPassword("wrong-password");
        HttpServletRequest servletRequest = mock(HttpServletRequest.class);
        User user = buildUser("member@example.com", ERole.EMPLOYEE);
        user.setPassword("encoded-password");

        when(userRepository.findByEmailIgnoreCase("member@example.com")).thenReturn(java.util.Optional.of(user));
        when(passwordEncoder.matches("wrong-password", "encoded-password")).thenReturn(false);
        when(servletRequest.getRemoteAddr()).thenReturn("127.0.0.1");

        ResponseEntity<?> response = authController.login(request, servletRequest);

        assertEquals(400, response.getStatusCode().value());
        Map<?, ?> body = (Map<?, ?>) response.getBody();
        assertEquals("INVALID_CREDENTIALS", body.get("code"));
        assertEquals("Email hoặc mật khẩu không chính xác!", body.get("message"));
        verify(jwtUtil, never()).generateToken(any(String.class), any(String.class), any());
    }

    private User buildUser(String email, ERole role) {
        User user = new User();
        user.setEmail(email);
        user.setRole(role);
        user.setFullName(email);
        user.setAuthVersion(0L);
        return user;
    }
}
