package com.projectmanagement.core_system.model;

import com.projectmanagement.core_system.enums.TemplateGroupType;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.ArrayList;
import java.util.List;

@Document(collection = "project_templates")
public class ProjectTemplate {
    @Id
    private String id;

    private String name;
    private String description;
    private TemplateGroupType templateGroupType = TemplateGroupType.OTHER;
    private Integer version = 1;
    private String createdByEmail;
    private String ownerDepartmentId;
    private String ownerDepartmentName;
    private boolean archived = false;
    private Long createdAt = System.currentTimeMillis();
    private Long updatedAt = System.currentTimeMillis();
    private List<ProjectTemplateTaskTemplate> taskTemplates = new ArrayList<>();

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

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

    public Integer getVersion() {
        return version;
    }

    public void setVersion(Integer version) {
        this.version = version;
    }

    public String getCreatedByEmail() {
        return createdByEmail;
    }

    public void setCreatedByEmail(String createdByEmail) {
        this.createdByEmail = createdByEmail;
    }

    public String getOwnerDepartmentId() {
        return ownerDepartmentId;
    }

    public void setOwnerDepartmentId(String ownerDepartmentId) {
        this.ownerDepartmentId = ownerDepartmentId;
    }

    public String getOwnerDepartmentName() {
        return ownerDepartmentName;
    }

    public void setOwnerDepartmentName(String ownerDepartmentName) {
        this.ownerDepartmentName = ownerDepartmentName;
    }

    public boolean isArchived() {
        return archived;
    }

    public void setArchived(boolean archived) {
        this.archived = archived;
    }

    public Long getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Long createdAt) {
        this.createdAt = createdAt;
    }

    public Long getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Long updatedAt) {
        this.updatedAt = updatedAt;
    }

    public List<ProjectTemplateTaskTemplate> getTaskTemplates() {
        return taskTemplates;
    }

    public void setTaskTemplates(List<ProjectTemplateTaskTemplate> taskTemplates) {
        this.taskTemplates = taskTemplates;
    }
}
