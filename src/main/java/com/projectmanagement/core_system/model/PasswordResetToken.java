package com.projectmanagement.core_system.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "password_reset_tokens")
public class PasswordResetToken {
    @Id
    private String id;

    private String userId;
    private String tokenHash;

    @Indexed(expireAfterSeconds = 0)
    private LocalDateTime expiresAt;

    private LocalDateTime usedAt;
    private LocalDateTime createdAt = LocalDateTime.now();
}
