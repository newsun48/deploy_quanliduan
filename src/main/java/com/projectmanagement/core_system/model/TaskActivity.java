package com.projectmanagement.core_system.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.HashMap;
import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "task_activities")
public class TaskActivity {
    @Id
    private String id;

    private String taskId;
    private String actorId;
    private String actorName;
    private String type;
    private String message;
    private Map<String, Object> metadata = new HashMap<>();
    private Long createdAt = System.currentTimeMillis();
}
