package com.projectmanagement.core_system.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "user_activities")
public class UserActivity {
    @Id
    private String id;

    private String actorId;
    private String actorName;
    private String actorEmail;
    private String targetUserId;
    private String targetUserName;
    private String targetUserEmail;
    private String type;
    private String message;
    private Map<String, Object> metadata = new HashMap<>();
    private LocalDateTime createdAt = LocalDateTime.now();
}
