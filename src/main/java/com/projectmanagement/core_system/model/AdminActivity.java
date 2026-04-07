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
@Document(collection = "admin_activities")
public class AdminActivity {
    @Id
    private String id;

    // Actor information
    private String actorId;
    private String actorName;
    private String actorEmail;

    // Activity details
    private String type; // USER_CREATED, PROJECT_CREATED, DEPARTMENT_CREATED, etc.
    private String entityType; // USER, PROJECT, DEPARTMENT, TASK
    private String entityId; // ID of the affected entity
    private String message; // Human readable description
    
    // Undo support
    private boolean undoable = true;
    private boolean undone = false;
    private String undoneBy;
    private LocalDateTime undoneAt;
    
    // Store previous state for undo
    private Map<String, Object> previousState = new HashMap<>();
    private Map<String, Object> newState = new HashMap<>();
    private Map<String, Object> metadata = new HashMap<>();
    
    private LocalDateTime createdAt = LocalDateTime.now();
}