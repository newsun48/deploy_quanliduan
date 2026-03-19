package com.projectmanagement.core_system.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.Transient;
import org.springframework.data.mongodb.core.mapping.DBRef;
import org.springframework.data.mongodb.core.mapping.Document;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "notifications")
public class Notification {

    @Transient
    public static final String SEQUENCE_NAME = "notifications_sequence";

    @Id
    private String id;

    @DBRef
    @JsonIgnoreProperties({"password", "department"})
    private User receiver;  // Người nhận thông báo

    @DBRef
    @JsonIgnoreProperties({"password", "department"})
    private User sender;    // Người gửi thông báo (Manager)

    @DBRef
    private Task task;      // Task liên quan (nếu có)

    private String message; // Nội dung thông báo
    private String type;    // Loại thông báo: TASK_ASSIGNED, TASK_UPDATED, etc.
    
    @JsonProperty("isRead")
    private boolean read = false;
    
    private Long createdAt = System.currentTimeMillis();
}
