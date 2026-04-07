package com.projectmanagement.core_system.model;

import com.projectmanagement.core_system.enums.Priority;
import jakarta.validation.constraints.NotBlank;

import java.time.LocalDate;

public class ProjectTemplateInstantiationProjectRequest {
    @NotBlank(message = "Tên dự án không được để trống!")
    private String name;
    private String description;
    private LocalDate startDate;
    private LocalDate deadline;
    private Priority priority;

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public LocalDate getStartDate() {
        return startDate;
    }

    public void setStartDate(LocalDate startDate) {
        this.startDate = startDate;
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
