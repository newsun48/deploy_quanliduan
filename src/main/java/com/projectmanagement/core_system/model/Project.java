package com.projectmanagement.core_system.model;

import com.projectmanagement.core_system.enums.Priority;
import com.projectmanagement.core_system.enums.ProjectStatus;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.Transient;
import org.springframework.data.mongodb.core.mapping.DBRef;
import org.springframework.data.mongodb.core.mapping.Document;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import java.time.LocalDate;
import java.util.List;
import java.util.ArrayList;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "projects")
public class Project {

    @Transient
    public static final String SEQUENCE_NAME = "projects_sequence";

    @Id
    private String id;

    private String name;
    private String description;
    
    private LocalDate deadline;
    private Priority priority;
    
    private ProjectStatus status = ProjectStatus.OPEN;

    @DBRef
    @JsonIgnoreProperties({"manager", "members"})
    private Department department;

    @DBRef
    @JsonIgnoreProperties({"department"})
    private List<User> members = new ArrayList<>();

    private String createdBy;
    private Long createdDate = System.currentTimeMillis();
}