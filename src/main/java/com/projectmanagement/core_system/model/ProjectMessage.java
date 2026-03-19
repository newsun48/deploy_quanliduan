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

    @DBRef
    @JsonIgnoreProperties({"department"})
    private User sender;

    @DBRef
    private Project project;

    private LocalDateTime createdAt = LocalDateTime.now();
    private LocalDateTime updatedAt = LocalDateTime.now();
}
