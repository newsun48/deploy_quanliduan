package com.projectmanagement.core_system.controller;

import com.projectmanagement.core_system.config.JwtUtil;
import com.projectmanagement.core_system.model.GoogleLoginRequest;
import com.projectmanagement.core_system.model.GoogleLoginResult;
import com.projectmanagement.core_system.model.LoginRequest;
import com.projectmanagement.core_system.model.SignupRequest;
import com.projectmanagement.core_system.model.User;
import com.projectmanagement.core_system.repository.UserRepository;
import com.projectmanagement.core_system.service.UserActivityService;
import com.projectmanagement.core_system.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "http://localhost:5173") // Cho phép Frontend gọi vào
public class AuthController {

    @Autowired
    private UserRepository userRepository;


    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtUtil jwtUtil;

    @Autowired
    private UserActivityService userActivityService;

    @Autowired
    private UserService userService;

    private static final Logger logger = LoggerFactory.getLogger(AuthController.class);

    @PostMapping("/signup")
    public ResponseEntity<?> signup(@Valid @RequestBody SignupRequest signupRequest) {
        try {
            userService.signupPendingUser(signupRequest);
            return ResponseEntity.ok(Map.of("message", "Đăng ký thành công! Tài khoản của bạn đang chờ quản trị viên phê duyệt."));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(buildAuthError("SIGNUP_FAILED", e.getMessage()));
        }
    }
    
    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest loginRequest, HttpServletRequest request) {
        String normalizedEmail = loginRequest.getEmail() != null ? loginRequest.getEmail().trim().toLowerCase() : null;
        logger.info("Login attempt for email: {}", normalizedEmail);
        
        // Tìm user theo email
        Optional<User> userOpt = userRepository.findByEmailIgnoreCase(normalizedEmail);

        if (userOpt.isEmpty()) {
            userActivityService.record(null, null, "LOGIN_FAILED",
                    "Đăng nhập thất bại với email không tồn tại",
                    Map.of("email", normalizedEmail != null ? normalizedEmail : "", "ip", request.getRemoteAddr()));
            return ResponseEntity.badRequest().body(buildAuthError("INVALID_CREDENTIALS", "Email hoặc mật khẩu không chính xác!"));
        }

        User user = userOpt.get();

        try {
            userService.validateUserCanLogin(user);
        } catch (RuntimeException e) {
            userActivityService.record(user, user, "LOGIN_BLOCKED",
                    user.getFullName() + " đăng nhập thất bại vì " + e.getMessage().toLowerCase(),
                    Map.of("ip", request.getRemoteAddr()));
            return ResponseEntity.badRequest().body(resolveLoginBlockedResponse(e.getMessage()));
        }

        // So sánh mật khẩu
        if (!passwordEncoder.matches(loginRequest.getPassword(), user.getPassword())) {
            userActivityService.record(user, user, "LOGIN_FAILED",
                    user.getFullName() + " đăng nhập thất bại do sai mật khẩu",
                    Map.of("ip", request.getRemoteAddr()));
            return ResponseEntity.badRequest().body(buildAuthError("INVALID_CREDENTIALS", "Email hoặc mật khẩu không chính xác!"));
        }

        Map<String, Object> response = buildAuthSuccessResponse(user);
        userActivityService.record(user, user, "LOGIN_SUCCESS",
                user.getFullName() + " đã đăng nhập thành công",
                Map.of("ip", request.getRemoteAddr(), "role", user.getRole().name()));

        return ResponseEntity.ok(response);
    }

    @PostMapping("/google")
    public ResponseEntity<?> loginWithGoogle(@Valid @RequestBody GoogleLoginRequest googleLoginRequest, HttpServletRequest request) {
        try {
            GoogleLoginResult result = userService.authenticateWithGoogle(googleLoginRequest != null ? googleLoginRequest.getCredential() : null);
            User user = result.getUser();

            if (result.getStatus() == GoogleLoginResult.Status.PENDING) {
                userActivityService.record(user, user, "LOGIN_BLOCKED",
                        user.getFullName() + " đăng nhập Google nhưng tài khoản đang chờ phê duyệt",
                        Map.of("ip", request.getRemoteAddr()));
                return ResponseEntity.status(202).body(Map.of(
                        "code", "PENDING_APPROVAL",
                        "message", result.getMessage()
                ));
            }

            userActivityService.record(user, user, "LOGIN_SUCCESS_GOOGLE",
                    user.getFullName() + " đã đăng nhập Google thành công",
                    Map.of("ip", request.getRemoteAddr(), "role", user.getRole().name()));
            return ResponseEntity.ok(buildAuthSuccessResponse(user));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "GOOGLE_LOGIN_FAILED",
                    "message", e.getMessage()
            ));
        }
    }

    private Map<String, Object> buildAuthError(String code, String message) {
        return Map.of("code", code, "message", message);
    }

    private Map<String, Object> resolveLoginBlockedResponse(String message) {
        String normalized = message != null ? message.toLowerCase() : "";
        if (normalized.contains("chờ quản trị viên phê duyệt")) {
            return buildAuthError("PENDING_APPROVAL", message);
        }
        if (normalized.contains("đã bị từ chối")) {
            return buildAuthError("REJECTED_APPROVAL", message);
        }
        if (normalized.contains("đang bị khóa")) {
            return buildAuthError("ACCOUNT_LOCKED", message);
        }
        if (normalized.contains("chưa được gán vai trò")) {
            return buildAuthError("ACCOUNT_NOT_READY", message);
        }
        return buildAuthError("LOGIN_BLOCKED", message != null ? message : "Đăng nhập thất bại!");
    }

    private Map<String, Object> buildAuthSuccessResponse(User user) {
        String token = jwtUtil.generateToken(user.getEmail(), user.getRole().name(), user.getAuthVersion());
        logger.info(">>> Login SUCCESS for user: {}. Role: {}", user.getEmail(), user.getRole());

        Map<String, Object> response = new HashMap<>();
        response.put("token", token);
        response.put("user", user);
        return response;
    }
}
