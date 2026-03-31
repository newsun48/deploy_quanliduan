package com.projectmanagement.core_system.model;

import com.projectmanagement.core_system.enums.Priority;
import lombok.Data;

import java.time.LocalDate;

@Data
public class TaskUpdateRequest {
    private String title;
    private String description;
    private LocalDate deadline;
    private Priority priority;
    private String assigneeId;
}
