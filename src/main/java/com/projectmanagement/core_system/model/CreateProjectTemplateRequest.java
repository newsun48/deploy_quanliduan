package com.projectmanagement.core_system.model;

import com.projectmanagement.core_system.enums.TemplateGroupType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;

import java.util.ArrayList;
import java.util.List;

public class CreateProjectTemplateRequest {
    @NotBlank(message = "Tên template không được để trống!")
    private String name;
    private String description;
    private TemplateGroupType templateGroupType;

    @Valid
    private List<ProjectTemplateTaskTemplateRequest> taskTemplates = new ArrayList<>();

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

    public TemplateGroupType getTemplateGroupType() {
        return templateGroupType;
    }

    public void setTemplateGroupType(TemplateGroupType templateGroupType) {
        this.templateGroupType = templateGroupType;
    }

    public List<ProjectTemplateTaskTemplateRequest> getTaskTemplates() {
        return taskTemplates;
    }

    public void setTaskTemplates(List<ProjectTemplateTaskTemplateRequest> taskTemplates) {
        this.taskTemplates = taskTemplates;
    }
}
