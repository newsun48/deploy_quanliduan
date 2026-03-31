package com.projectmanagement.core_system.service;

import com.projectmanagement.core_system.model.PasswordResetToken;
import com.projectmanagement.core_system.model.User;
import com.projectmanagement.core_system.repository.PasswordResetTokenRepository;
import com.projectmanagement.core_system.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.HexFormat;
import java.util.Optional;

@Service
public class PasswordResetService {

    private static final Logger logger = LoggerFactory.getLogger(PasswordResetService.class);

    private static final String GENERIC_FORGOT_PASSWORD_MESSAGE = "Nếu email tồn tại trong hệ thống, chúng tôi đã gửi hướng dẫn đặt lại mật khẩu.";

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordResetTokenRepository passwordResetTokenRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JavaMailSender mailSender;

    @Autowired
    private UserActivityService userActivityService;

    @Value("${spring.mail.username:}")
    private String senderEmail;

    @Value("${app.password-reset.frontend-url:http://localhost:5173/reset-password}")
    private String resetPasswordFrontendUrl;

    @Value("${app.password-reset.token-ttl-minutes:30}")
    private long tokenTtlMinutes;

    public String requestPasswordReset(String email) {
        if (!StringUtils.hasText(email)) {
            throw new RuntimeException("Email không được để trống!");
        }

        Optional<User> userOpt = userRepository.findByEmail(email.trim());
        if (userOpt.isEmpty() || !userOpt.get().isActive()) {
            return GENERIC_FORGOT_PASSWORD_MESSAGE;
        }

        User user = userOpt.get();
        passwordResetTokenRepository.deleteByUserId(user.getId());

        String rawToken = generateSecureToken();
        PasswordResetToken resetToken = new PasswordResetToken();
        resetToken.setUserId(user.getId());
        resetToken.setTokenHash(hashToken(rawToken));
        resetToken.setCreatedAt(LocalDateTime.now());
        resetToken.setExpiresAt(LocalDateTime.now().plusMinutes(tokenTtlMinutes));
        resetToken.setUsedAt(null);
        passwordResetTokenRepository.save(resetToken);
        userActivityService.record(user, user, "PASSWORD_RESET_REQUESTED",
                user.getFullName() + " đã yêu cầu đặt lại mật khẩu");

        try {
            sendResetEmail(user, rawToken);
        } catch (RuntimeException e) {
            logger.error("Failed to send password reset email for {}", user.getEmail(), e);
        }

        return GENERIC_FORGOT_PASSWORD_MESSAGE;
    }

    public void validateResetToken(String token) {
        resolveValidToken(token);
    }

    public void resetPassword(String token, String newPassword) {
        if (!StringUtils.hasText(newPassword) || newPassword.length() < 6) {
            throw new RuntimeException("Mật khẩu mới phải có ít nhất 6 ký tự!");
        }

        PasswordResetToken resetToken = resolveValidToken(token);
        User user = userRepository.findById(resetToken.getUserId())
                .orElseThrow(() -> new RuntimeException("Người dùng không tồn tại!"));

        user.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);

        resetToken.setUsedAt(LocalDateTime.now());
        passwordResetTokenRepository.save(resetToken);
        userActivityService.record(user, user, "PASSWORD_RESET_COMPLETED",
                user.getFullName() + " đã hoàn tất đặt lại mật khẩu");
    }

    private PasswordResetToken resolveValidToken(String rawToken) {
        if (!StringUtils.hasText(rawToken)) {
            throw new RuntimeException("Token đặt lại mật khẩu không hợp lệ!");
        }

        PasswordResetToken resetToken = passwordResetTokenRepository.findByTokenHash(hashToken(rawToken))
                .orElseThrow(() -> new RuntimeException("Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn!"));

        if (resetToken.getUsedAt() != null) {
            throw new RuntimeException("Liên kết đặt lại mật khẩu đã được sử dụng!");
        }

        if (resetToken.getExpiresAt() == null || resetToken.getExpiresAt().isBefore(LocalDateTime.now())) {
            throw new RuntimeException("Liên kết đặt lại mật khẩu đã hết hạn!");
        }

        return resetToken;
    }

    private void sendResetEmail(User user, String rawToken) {
        String resetLink = resetPasswordFrontendUrl + "?token=" + rawToken;

        SimpleMailMessage message = new SimpleMailMessage();
        message.setTo(user.getEmail());
        message.setFrom(senderEmail);
        message.setSubject("Dat lai mat khau tai khoan");
        message.setText("Xin chao " + user.getFullName() + ",\n\n"
                + "Ban vua yeu cau dat lai mat khau. Hay mo lien ket duoi day de tao mat khau moi:\n"
                + resetLink + "\n\n"
                + "Lien ket co hieu luc trong " + tokenTtlMinutes + " phut va chi su dung duoc 1 lan.\n"
                + "Neu ban khong yeu cau, vui long bo qua email nay.");
        mailSender.send(message);
    }

    private String generateSecureToken() {
        byte[] bytes = new byte[32];
        new SecureRandom().nextBytes(bytes);
        return HexFormat.of().formatHex(bytes);
    }

    private String hashToken(String token) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("Không thể tạo mã hash cho token reset mật khẩu", e);
        }
    }
}
