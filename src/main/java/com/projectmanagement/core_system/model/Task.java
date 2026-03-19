package com.projectmanagement.core_system.model;

import com.projectmanagement.core_system.enums.Priority;
import com.projectmanagement.core_system.enums.TaskStatus;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.Transient;
import org.springframework.data.mongodb.core.mapping.DBRef;
import org.springframework.data.mongodb.core.mapping.Document;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import java.time.LocalDate;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "tasks")
public class Task {

    @Transient
    public static final String SEQUENCE_NAME = "tasks_sequence";

    @Id
    private String id;

    private String title;
    private String description;
    private LocalDate deadline;
    private Priority priority;
    
    private TaskStatus status = TaskStatus.TO_DO;
    private int completionPercentage = 0;

    @DBRef
    @JsonIgnoreProperties({"department", "members"})
    private Project project;

    @DBRef
    @JsonIgnoreProperties({"department"})
    private User assignee;
}