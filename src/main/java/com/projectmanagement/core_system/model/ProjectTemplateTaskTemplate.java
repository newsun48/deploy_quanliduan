package com.projectmanagement.core_system.model;

import com.projectmanagement.core_system.enums.Priority;

import java.util.ArrayList;
import java.util.List;

public class ProjectTemplateTaskTemplate {
    private String id;
    private String title;
    private String description;
    private Priority priority;
    private Integer deadlineOffsetDays;
    private List<ProjectTemplateChecklistTemplate> checklistTemplates = new ArrayList<>();

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

    public List<ProjectTemplateChecklistTemplate> getChecklistTemplates() {
        return checklistTemplates;
    }

    public void setChecklistTemplates(List<ProjectTemplateChecklistTemplate> checklistTemplates) {
        this.checklistTemplates = checklistTemplates;
    }
}
