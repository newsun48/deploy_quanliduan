package com.projectmanagement.core_system.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.Transient;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.DBRef;
import org.springframework.data.mongodb.core.mapping.Document;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "departments")
public class Department {
    
    @Transient
    public static final String SEQUENCE_NAME = "departments_sequence";

    @Id
    private String id;

    @Indexed(unique = true)
    private String name;

    private String description;

    @DBRef
    @JsonIgnoreProperties({"department"})
    private User manager; 
}