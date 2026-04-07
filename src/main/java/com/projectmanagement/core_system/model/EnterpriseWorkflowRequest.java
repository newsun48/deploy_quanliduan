package com.projectmanagement.core_system.model;

import com.projectmanagement.core_system.enums.EnterpriseRequestType;
import com.projectmanagement.core_system.enums.Priority;
import com.projectmanagement.core_system.enums.EnterpriseWorkflowStatus;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.ArrayList;
import java.util.List;

@Document(collection = "enterprise_workflow_requests")
public class EnterpriseWorkflowRequest {
    @Id
    private String id;

    private EnterpriseRequestType type;
    private String title;
    private String reason;
    private String projectId;

    private String requesterId;
    private String requesterName;
    private String requesterEmail;
    private String requesterDepartmentId;
    private String requesterDepartmentName;
    private Priority priority;

    private EnterpriseWorkflowStatus status = EnterpriseWorkflowStatus.PENDING;
    private Integer activeStepIndex = 0;
    private List<EnterpriseApprovalStep> approvalSteps = new ArrayList<>();
    private List<EnterpriseDecisionHistory> decisionHistory = new ArrayList<>();

    private Long createdAt = System.currentTimeMillis();
    private Long updatedAt = System.currentTimeMillis();
    private Long resolvedAt;

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
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

    public String getRequesterId() {
        return requesterId;
    }

    public void setRequesterId(String requesterId) {
        this.requesterId = requesterId;
    }

    public String getRequesterName() {
        return requesterName;
    }

    public void setRequesterName(String requesterName) {
        this.requesterName = requesterName;
    }

    public String getRequesterEmail() {
        return requesterEmail;
    }

    public void setRequesterEmail(String requesterEmail) {
        this.requesterEmail = requesterEmail;
    }

    public String getRequesterDepartmentId() {
        return requesterDepartmentId;
    }

    public void setRequesterDepartmentId(String requesterDepartmentId) {
        this.requesterDepartmentId = requesterDepartmentId;
    }

    public String getRequesterDepartmentName() {
        return requesterDepartmentName;
    }

    public void setRequesterDepartmentName(String requesterDepartmentName) {
        this.requesterDepartmentName = requesterDepartmentName;
    }

    public Priority getPriority() {
        return priority;
    }

    public void setPriority(Priority priority) {
        this.priority = priority;
    }

    public EnterpriseWorkflowStatus getStatus() {
        return status;
    }

    public void setStatus(EnterpriseWorkflowStatus status) {
        this.status = status;
    }

    public Integer getActiveStepIndex() {
        return activeStepIndex;
    }

    public void setActiveStepIndex(Integer activeStepIndex) {
        this.activeStepIndex = activeStepIndex;
    }

    public List<EnterpriseApprovalStep> getApprovalSteps() {
        return approvalSteps;
    }

    public void setApprovalSteps(List<EnterpriseApprovalStep> approvalSteps) {
        this.approvalSteps = approvalSteps;
    }

    public List<EnterpriseDecisionHistory> getDecisionHistory() {
        return decisionHistory;
    }

    public void setDecisionHistory(List<EnterpriseDecisionHistory> decisionHistory) {
        this.decisionHistory = decisionHistory;
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

    public Long getResolvedAt() {
        return resolvedAt;
    }

    public void setResolvedAt(Long resolvedAt) {
        this.resolvedAt = resolvedAt;
    }
}
