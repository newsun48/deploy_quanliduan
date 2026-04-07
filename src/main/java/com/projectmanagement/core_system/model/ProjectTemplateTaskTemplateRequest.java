package com.projectmanagement.core_system.model;

import com.projectmanagement.core_system.enums.Priority;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;

import java.util.ArrayList;
import java.util.List;

public class ProjectTemplateTaskTemplateRequest {
    private String id;

    @NotBlank(message = "Tiêu đề task template không được để trống!")
    private String title;

    private String description;
    private Priority priority;
    private Integer deadlineOffsetDays;

    @Valid
    private List<ProjectTemplateChecklistTemplateRequest> checklistTemplates = new ArrayList<>();

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

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

    public Priority getPriority() {
        return priority;
    }

    public void setPriority(Priority priority) {
        this.priority = priority;
    }

    public Integer getDeadlineOffsetDays() {
        return deadlineOffsetDays;
    }

    public void setDeadlineOffsetDays(Integer deadlineOffsetDays) {
        this.deadlineOffsetDays = deadlineOffsetDays;
    }

    public List<ProjectTemplateChecklistTemplateRequest> getChecklistTemplates() {
        return checklistTemplates;
    }

    public void setChecklistTemplates(List<ProjectTemplateChecklistTemplateRequest> checklistTemplates) {
        this.checklistTemplates = checklistTemplates;
    }
}
