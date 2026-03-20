package com.projectmanagement.core_system.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.Transient;
import org.springframework.data.mongodb.core.mapping.DBRef;
import org.springframework.data.mongodb.core.mapping.Document;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "project_messages")
public class ProjectMessage {

    @Transient
    public static final String SEQUENCE_NAME = "project_messages_sequence";

    @Id
    private String id;

    private String content;

    // TEXT, IMAGE, FILE
    private String messageType = "TEXT";

    // URL file đã upload (cho IMAGE/FILE)
    private String fileUrl;

    @DBRef
    @JsonIgnoreProperties({"department", "password"})
    private User sender;

    // Group chat: project != null, receiver = null
    @DBRef
    private Project project;

    // Private chat: receiver != null (project có thể null hoặc rỗng)
    @DBRef
    @JsonIgnoreProperties({"department", "password"})
    private User receiver;

    // Reply: tham chiếu tin nhắn gốc
    @DBRef
    @JsonIgnoreProperties({"replyTo", "project"})
    private ProjectMessage replyTo;

    // Soft delete (thu hồi tin nhắn)
    private boolean isDeleted = false;

    // Đánh dấu tin nhắn đã được chỉnh sửa
    private boolean isEdited = false;

    private LocalDateTime createdAt = LocalDateTime.now();
    private LocalDateTime updatedAt = LocalDateTime.now();
}
