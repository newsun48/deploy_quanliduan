package com.projectmanagement.core_system.controller;

import com.projectmanagement.core_system.config.JwtUtil;
import com.projectmanagement.core_system.model.ForgotPasswordRequest;
 import com.projectmanagement.core_system.model.LoginRequest;
import com.projectmanagement.core_system.model.ResetPasswordRequest;
import com.projectmanagement.core_system.model.User;
import com.projectmanagement.core_system.repository.UserRepository;
import com.projectmanagement.core_system.service.PasswordResetService;
import com.projectmanagement.core_system.service.UserActivityService;
import jakarta.servlet.http.HttpServletRequest;
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
    private PasswordResetService passwordResetService;

    @Autowired
    private UserActivityService userActivityService;

    private static final Logger logger = LoggerFactory.getLogger(AuthController.class);
    
    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest loginRequest, HttpServletRequest request) {
        logger.info("Login attempt for email: {}", loginRequest.getEmail());
        
        // Tìm user theo email
        Optional<User> userOpt = userRepository.findByEmail(loginRequest.getEmail());

        if (userOpt.isEmpty()) {
            userActivityService.record(null, null, "LOGIN_FAILED",
                    "Đăng nhập thất bại với email không tồn tại",
                    Map.of("email", loginRequest.getEmail(), "ip", request.getRemoteAddr()));
            return ResponseEntity.badRequest().body("Email không tồn tại!");
        }

        User user = userOpt.get();

        if (!user.isActive()) {
            userActivityService.record(user, user, "LOGIN_BLOCKED",
                    user.getFullName() + " đăng nhập thất bại vì tài khoản bị khóa",
                    Map.of("ip", request.getRemoteAddr()));
            return ResponseEntity.badRequest().body("Tài khoản của bạn đang bị khóa!");
        }

        // So sánh mật khẩu
        if (!passwordEncoder.matches(loginRequest.getPassword(), user.getPassword())) {
            userActivityService.record(user, user, "LOGIN_FAILED",
                    user.getFullName() + " đăng nhập thất bại do sai mật khẩu",
                    Map.of("ip", request.getRemoteAddr()));
            return ResponseEntity.badRequest().body("Sai mật khẩu!");
        }

        // Tạo JWT token
        String token = jwtUtil.generateToken(user.getEmail(), user.getRole().name());
        logger.info(">>> Login SUCCESS for user: {}. Role: {}", user.getEmail(), user.getRole());

        // Trả về token và thông tin user
        Map<String, Object> response = new HashMap<>();
        response.put("token", token);
        response.put("user", user);
        userActivityService.record(user, user, "LOGIN_SUCCESS",
                user.getFullName() + " đã đăng nhập thành công",
                Map.of("ip", request.getRemoteAddr(), "role", user.getRole().name()));

        return ResponseEntity.ok(response);
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<?> forgotPassword(@RequestBody ForgotPasswordRequest request) {
        try {
            return ResponseEntity.ok(passwordResetService.requestPasswordReset(request.getEmail()));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @GetMapping("/reset-password/validate")
    public ResponseEntity<?> validateResetPasswordToken(@RequestParam String token) {
        try {
            passwordResetService.validateResetToken(token);
            return ResponseEntity.ok(Map.of("valid", true));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PostMapping("/reset-password")
    public ResponseEntity<?> resetPassword(@RequestBody ResetPasswordRequest request) {
        try {
            passwordResetService.resetPassword(request.getToken(), request.getNewPassword());
            return ResponseEntity.ok("Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại.");
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
}
