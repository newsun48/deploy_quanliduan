package com.projectmanagement.core_system.model;

import jakarta.validation.constraints.NotBlank;

public class ProjectTemplateChecklistTemplateRequest {
    @NotBlank(message = "Tiêu đề checklist template không được để trống!")
    private String title;

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }
}
