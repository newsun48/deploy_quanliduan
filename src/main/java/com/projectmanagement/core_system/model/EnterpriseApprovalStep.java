package com.projectmanagement.core_system.model;

import com.projectmanagement.core_system.enums.ERole;
import com.projectmanagement.core_system.enums.EnterpriseStepStatus;

public class EnterpriseApprovalStep {
    private int stepOrder;
    private ERole approverRole;
    private String approverId;
    private String approverName;
    private String approverEmail;
    private EnterpriseStepStatus status = EnterpriseStepStatus.PENDING;
    private String decisionComment;
    private Long decidedAt;

    public int getStepOrder() {
        return stepOrder;
    }

    public void setStepOrder(int stepOrder) {
        this.stepOrder = stepOrder;
    }

    public ERole getApproverRole() {
        return approverRole;
    }

    public void setApproverRole(ERole approverRole) {
        this.approverRole = approverRole;
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

    public EnterpriseStepStatus getStatus() {
        return status;
    }

    public void setStatus(EnterpriseStepStatus status) {
        this.status = status;
    }

    public String getDecisionComment() {
        return decisionComment;
    }

    public void setDecisionComment(String decisionComment) {
        this.decisionComment = decisionComment;
    }

    public Long getDecidedAt() {
        return decidedAt;
    }

    public void setDecidedAt(Long decidedAt) {
        this.decidedAt = decidedAt;
    }
}
