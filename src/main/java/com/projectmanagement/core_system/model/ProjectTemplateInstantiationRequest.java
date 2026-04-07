package com.projectmanagement.core_system.model;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import com.projectmanagement.core_system.enums.Priority;

public class ProjectTemplateInstantiationRequest {
    @NotBlank(message = "departmentId không được để trống!")
    private String departmentId;

    @NotNull(message = "Thông tin dự án khởi tạo không hợp lệ!")
    @Valid
    private ProjectTemplateInstantiationProjectRequest project;

    private transient Project legacyProject;

    public String getDepartmentId() {
        return departmentId;
    }

    public void setDepartmentId(String departmentId) {
        this.departmentId = departmentId;
    }

    public ProjectTemplateInstantiationProjectRequest getProject() {
        return project;
    }

    public void setProject(ProjectTemplateInstantiationProjectRequest project) {
        this.project = project;
    }

    public void setProject(Project project) {
        if (project == null) {
            this.project = null;
            this.legacyProject = null;
            return;
        }

        this.legacyProject = project;
        ProjectTemplateInstantiationProjectRequest mappedProject = new ProjectTemplateInstantiationProjectRequest();
        mappedProject.setName(project.getName());
        mappedProject.setDescription(project.getDescription());
        mappedProject.setStartDate(project.getStartDate());
        mappedProject.setDeadline(project.getDeadline());
        Priority priority = project.getPriority();
        mappedProject.setPriority(priority);
        this.project = mappedProject;
    }

    public Project toProjectEntity() {
        if (legacyProject != null) {
            return legacyProject;
        }

        if (project == null) {
            return null;
        }

        Project mappedProject = new Project();
        mappedProject.setName(project.getName());
        mappedProject.setDescription(project.getDescription());
        mappedProject.setStartDate(project.getStartDate());
        mappedProject.setDeadline(project.getDeadline());
        mappedProject.setPriority(project.getPriority());
        return mappedProject;
    }
}
