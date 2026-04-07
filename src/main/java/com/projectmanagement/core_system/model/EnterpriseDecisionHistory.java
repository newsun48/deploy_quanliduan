package com.projectmanagement.core_system.model;

import com.projectmanagement.core_system.enums.EnterpriseStepStatus;

public class EnterpriseDecisionHistory {
    private int stepOrder;
    private String approverId;
    private String approverName;
    private String approverEmail;
    private EnterpriseStepStatus decision;
    private String comment;
    private Long decidedAt;

    public int getStepOrder() {
        return stepOrder;
    }

    public void setStepOrder(int stepOrder) {
        this.stepOrder = stepOrder;
    }

    public String getApproverId() {
        return approverId;
    }

    public void setApproverId(String approverId) {
        this.approverId = approverId;
    }

    public String getApproverName() {
        return approverName;
    }

    public void setApproverName(String approverName) {
        this.approverName = approverName;
    }

    public String getApproverEmail() {
        return approverEmail;
    }

    public void setApproverEmail(String approverEmail) {
        this.approverEmail = approverEmail;
    }

    public EnterpriseStepStatus getDecision() {
        return decision;
    }

    public void setDecision(EnterpriseStepStatus decision) {
        this.decision = decision;
    }

    public String getComment() {
        return comment;
    }

    public void setComment(String comment) {
        this.comment = comment;
    }

    public Long getDecidedAt() {
        return decidedAt;
    }

    public void setDecidedAt(Long decidedAt) {
        this.decidedAt = decidedAt;
    }
}
