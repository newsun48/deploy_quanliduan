package com.projectmanagement.core_system.model;

import com.projectmanagement.core_system.enums.EnterpriseRequestType;
import com.projectmanagement.core_system.enums.Priority;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public class CreateEnterpriseRequestPayload {
    @NotNull(message = "Loại yêu cầu không được để trống!")
    private EnterpriseRequestType type;

    @NotBlank(message = "Tiêu đề yêu cầu không được để trống!")
    private String title;
    private String reason;
    private String projectId;
    private Priority priority;

    @AssertTrue(message = "Yêu cầu đóng dự án bắt buộc phải có projectId!")
    public boolean isProjectIdValidForRequestType() {
        return type != EnterpriseRequestType.PROJECT_CLOSE
                || (projectId != null && !projectId.trim().isEmpty());
    }

    public EnterpriseRequestType getType() {
        return type;
    }

    public void setType(EnterpriseRequestType type) {
        this.type = type;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }

    public String getProjectId() {
        return projectId;
    }

    public void setProjectId(String projectId) {
        this.projectId = projectId;
    }

    public Priority getPriority() {
        return priority;
    }

    public void setPriority(Priority priority) {
        this.priority = priority;
    }
}
