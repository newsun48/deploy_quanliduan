package com.projectmanagement.core_system.model;

import jakarta.validation.constraints.NotNull;

public class EnterpriseDecisionRequest {
    @NotNull(message = "Quyết định duyệt không được để trống!")
    private Boolean approved;
    private String comment;

    public Boolean getApproved() {
        return approved;
    }

    public void setApproved(Boolean approved) {
        this.approved = approved;
    }

    public String getComment() {
        return comment;
    }

    public void setComment(String comment) {
        this.comment = comment;
    }
}
