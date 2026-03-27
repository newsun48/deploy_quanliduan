package com.projectmanagement.core_system.service;

import com.projectmanagement.core_system.model.PasswordResetToken;
import com.projectmanagement.core_system.model.User;
import com.projectmanagement.core_system.repository.PasswordResetTokenRepository;
import com.projectmanagement.core_system.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PasswordResetServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordResetTokenRepository passwordResetTokenRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private JavaMailSender mailSender;

    @Mock
    private UserActivityService userActivityService;

    @InjectMocks
    private PasswordResetService passwordResetService;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(passwordResetService, "senderEmail", "noreply@example.com");
        ReflectionTestUtils.setField(passwordResetService, "resetPasswordFrontendUrl", "http://localhost:5173/reset-password");
        ReflectionTestUtils.setField(passwordResetService, "tokenTtlMinutes", 30L);
    }

    @Test
    void requestPasswordReset_returnsGenericMessageWhenEmailUnknown() {
        when(userRepository.findByEmail("missing@example.com")).thenReturn(Optional.empty());

        String message = passwordResetService.requestPasswordReset("missing@example.com");

        assertEquals("Nếu email tồn tại trong hệ thống, chúng tôi đã gửi hướng dẫn đặt lại mật khẩu.", message);
        verify(mailSender, never()).send(any(org.springframework.mail.SimpleMailMessage.class));
    }

    @Test
    void resetPassword_rejectsUsedToken() {
        PasswordResetToken token = new PasswordResetToken();
        token.setTokenHash(hash("raw-token"));
        token.setUsedAt(LocalDateTime.now());
        token.setExpiresAt(LocalDateTime.now().plusMinutes(5));

        when(passwordResetTokenRepository.findByTokenHash(hash("raw-token"))).thenReturn(Optional.of(token));

        RuntimeException error = assertThrows(RuntimeException.class,
                () -> passwordResetService.resetPassword("raw-token", "newpass123"));

        assertEquals("Liên kết đặt lại mật khẩu đã được sử dụng!", error.getMessage());
    }

    @Test
    void resetPassword_updatesPasswordAndMarksTokenUsed() {
        User user = new User();
        user.setId("user-1");
        user.setPassword("old-hash");

        PasswordResetToken token = new PasswordResetToken();
        token.setUserId("user-1");
        token.setTokenHash(hash("raw-token"));
        token.setExpiresAt(LocalDateTime.now().plusMinutes(5));

        when(passwordResetTokenRepository.findByTokenHash(hash("raw-token"))).thenReturn(Optional.of(token));
        when(userRepository.findById("user-1")).thenReturn(Optional.of(user));
        when(passwordEncoder.encode("newpass123")).thenReturn("new-hash");

        passwordResetService.resetPassword("raw-token", "newpass123");

        ArgumentCaptor<User> userCaptor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(userCaptor.capture());
        assertEquals("new-hash", userCaptor.getValue().getPassword());

        ArgumentCaptor<PasswordResetToken> tokenCaptor = ArgumentCaptor.forClass(PasswordResetToken.class);
        verify(passwordResetTokenRepository).save(tokenCaptor.capture());
        assertDoesNotThrow(() -> tokenCaptor.getValue().getUsedAt());
    }

    private String hash(String token) {
        String value = (String) ReflectionTestUtils.invokeMethod(passwordResetService, "hashToken", token);
        assertNotEquals(token, value);
        return value;
    }
}
