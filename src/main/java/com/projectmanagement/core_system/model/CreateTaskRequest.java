package com.projectmanagement.core_system.model;

import com.projectmanagement.core_system.enums.Priority;
import jakarta.validation.constraints.NotBlank;

import java.time.LocalDate;

public class CreateTaskRequest {
    @NotBlank(message = "Tiêu đề task không được để trống!")
    private String title;
    private String description;
    private LocalDate deadline;
    private Priority priority;

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public LocalDate getDeadline() {
        return deadline;
    }

    public void setDeadline(LocalDate deadline) {
        this.deadline = deadline;
    }

    public Priority getPriority() {
        return priority;
    }

    public void setPriority(Priority priority) {
        this.priority = priority;
    }
}
