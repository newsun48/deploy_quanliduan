package com.projectmanagement.core_system.service;

import com.projectmanagement.core_system.enums.ERole;
import com.projectmanagement.core_system.enums.EnterpriseRequestType;
import com.projectmanagement.core_system.enums.EnterpriseStepStatus;
import com.projectmanagement.core_system.enums.EnterpriseWorkflowStatus;
import com.projectmanagement.core_system.model.CreateEnterpriseRequestPayload;
import com.projectmanagement.core_system.model.Department;
import com.projectmanagement.core_system.model.EnterpriseApprovalStep;
import com.projectmanagement.core_system.model.EnterpriseDecisionHistory;
import com.projectmanagement.core_system.model.EnterpriseDecisionRequest;
import com.projectmanagement.core_system.model.EnterpriseWorkflowRequest;
import com.projectmanagement.core_system.model.Project;
import com.projectmanagement.core_system.model.User;
import com.projectmanagement.core_system.repository.EnterpriseWorkflowRequestRepository;
import com.projectmanagement.core_system.repository.ProjectRepository;
import com.projectmanagement.core_system.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

@Service
public class EnterpriseWorkflowService {

    @Autowired
    private EnterpriseWorkflowRequestRepository enterpriseWorkflowRequestRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ProjectRepository projectRepository;

    @Autowired
    private ProjectService projectService;

    @Autowired
    private NotificationService notificationService;

    @Autowired
    private UserActivityService userActivityService;

    public EnterpriseWorkflowRequest createRequest(CreateEnterpriseRequestPayload payload, String requesterEmail) {
        User requester = requireActiveUser(requesterEmail);

        if (payload == null || payload.getType() == null) {
            throw new RuntimeException("Loại yêu cầu không được để trống!");
        }
        if (!StringUtils.hasText(payload.getTitle())) {
            throw new RuntimeException("Tiêu đề yêu cầu không được để trống!");
        }

        if (payload.getType() == EnterpriseRequestType.PROJECT_CLOSE && !StringUtils.hasText(payload.getProjectId())) {
            throw new RuntimeException("Yêu cầu đóng dự án bắt buộc phải có projectId!");
        }

        Project targetProject = null;
        if (payload.getType() == EnterpriseRequestType.PROJECT_CLOSE) {
            targetProject = projectRepository.findById(payload.getProjectId())
                    .orElseThrow(() -> new RuntimeException("Dự án cần đóng không tồn tại!"));

            if (targetProject.isDeleted()) {
                throw new RuntimeException("Không thể gửi yêu cầu đóng cho dự án đã bị xóa!");
            }

            if (targetProject.getDepartment() == null
                    || requester.getDepartment() == null
                    || targetProject.getDepartment().getId() == null
                    || !targetProject.getDepartment().getId().equals(requester.getDepartment().getId())) {
                throw new AccessDeniedException("Bạn không có quyền gửi yêu cầu đóng cho dự án ngoài phòng ban của mình!");
            }
        }

        List<EnterpriseApprovalStep> steps = buildApprovalSteps(payload.getType(), requester);
        if (steps.isEmpty()) {
            throw new RuntimeException("Không tìm thấy tuyến duyệt phù hợp cho yêu cầu này!");
        }

        EnterpriseWorkflowRequest request = new EnterpriseWorkflowRequest();
        request.setType(payload.getType());
        request.setTitle(payload.getTitle().trim());
        request.setReason(payload.getReason() != null ? payload.getReason().trim() : null);
        request.setProjectId(payload.getProjectId());
        request.setRequesterId(requester.getId());
        request.setRequesterName(requester.getFullName());
        request.setRequesterEmail(requester.getEmail());
        request.setRequesterDepartmentId(requester.getDepartment() != null ? requester.getDepartment().getId() : null);
        request.setRequesterDepartmentName(requester.getDepartment() != null ? requester.getDepartment().getName() : null);
        request.setPriority(payload.getPriority() != null ? payload.getPriority() : com.projectmanagement.core_system.enums.Priority.MEDIUM);
        request.setStatus(EnterpriseWorkflowStatus.PENDING);
        request.setApprovalSteps(steps);
        request.setDecisionHistory(new ArrayList<>());
        request.setActiveStepIndex(0);
        request.setCreatedAt(System.currentTimeMillis());
        request.setUpdatedAt(System.currentTimeMillis());

        EnterpriseWorkflowRequest saved = enterpriseWorkflowRequestRepository.save(request);
        notifyCurrentApprover(saved, requester);
        userActivityService.record(requester, requester, "ENTERPRISE_REQUEST_CREATED",
                requester.getFullName() + " đã tạo yêu cầu " + payload.getType().name(),
                Map.of(
                        "requestId", saved.getId(),
                        "requestType", saved.getType().name()
                ));
        return saved;
    }

    public EnterpriseWorkflowRequest decideRequest(String requestId, EnterpriseDecisionRequest decisionRequest, String approverEmail) {
        User approver = requireActiveUser(approverEmail);
        EnterpriseWorkflowRequest request = enterpriseWorkflowRequestRepository.findById(requestId)
                .orElseThrow(() -> new RuntimeException("Yêu cầu không tồn tại!"));

        if (request.getStatus() != EnterpriseWorkflowStatus.PENDING) {
            throw new RuntimeException("Yêu cầu này đã hoàn tất xử lý!");
        }
        if (request.getActiveStepIndex() == null || request.getActiveStepIndex() < 0 || request.getActiveStepIndex() >= request.getApprovalSteps().size()) {
            throw new RuntimeException("Yêu cầu đang ở trạng thái không hợp lệ!");
        }

        EnterpriseApprovalStep currentStep = request.getApprovalSteps().get(request.getActiveStepIndex());
        if (!approver.getId().equals(currentStep.getApproverId())) {
            throw new AccessDeniedException("Bạn không phải người duyệt hiện tại của yêu cầu này!");
        }

        boolean approved = Boolean.TRUE.equals(decisionRequest.getApproved());
        String comment = decisionRequest != null ? decisionRequest.getComment() : null;
        long now = System.currentTimeMillis();

        currentStep.setStatus(approved ? EnterpriseStepStatus.APPROVED : EnterpriseStepStatus.REJECTED);
        currentStep.setDecisionComment(comment);
        currentStep.setDecidedAt(now);

        EnterpriseDecisionHistory history = new EnterpriseDecisionHistory();
        history.setStepOrder(currentStep.getStepOrder());
        history.setApproverId(approver.getId());
        history.setApproverName(approver.getFullName());
        history.setApproverEmail(approver.getEmail());
        history.setDecision(currentStep.getStatus());
        history.setComment(comment);
        history.setDecidedAt(now);
        request.getDecisionHistory().add(history);

        if (!approved) {
            request.setStatus(EnterpriseWorkflowStatus.REJECTED);
            request.setActiveStepIndex(-1);
            request.setResolvedAt(now);
        } else {
            int nextStepIndex = request.getActiveStepIndex() + 1;
            if (nextStepIndex >= request.getApprovalSteps().size()) {
                request.setStatus(EnterpriseWorkflowStatus.APPROVED);
                request.setActiveStepIndex(-1);
                request.setResolvedAt(now);

                if (request.getType() == EnterpriseRequestType.PROJECT_CLOSE && StringUtils.hasText(request.getProjectId())) {
                    projectService.completeProject(request.getProjectId(), approver.getEmail());
                }
            } else {
                request.setActiveStepIndex(nextStepIndex);
            }
        }

        request.setUpdatedAt(now);
        EnterpriseWorkflowRequest saved = enterpriseWorkflowRequestRepository.save(request);

        User requester = userRepository.findById(saved.getRequesterId()).orElse(null);
        if (requester != null) {
            String requesterMessage = approved
                    ? "Yêu cầu '" + saved.getTitle() + "' đã được duyệt bởi " + approver.getFullName()
                    : "Yêu cầu '" + saved.getTitle() + "' đã bị từ chối bởi " + approver.getFullName();
            notificationService.createNotification(requester, approver, null, requesterMessage,
                    approved ? "ENTERPRISE_REQUEST_APPROVED_STEP" : "ENTERPRISE_REQUEST_REJECTED");
        }

        if (saved.getStatus() == EnterpriseWorkflowStatus.PENDING) {
            notifyCurrentApprover(saved, approver);
        }

        userActivityService.record(approver, requester, approved ? "ENTERPRISE_REQUEST_STEP_APPROVED" : "ENTERPRISE_REQUEST_STEP_REJECTED",
                approver.getFullName() + (approved ? " đã duyệt bước của yêu cầu " : " đã từ chối yêu cầu ") + saved.getTitle(),
                Map.of(
                        "requestId", saved.getId(),
                        "requestType", saved.getType().name(),
                        "requestStatus", saved.getStatus().name()
                ));

        return saved;
    }

    public List<EnterpriseWorkflowRequest> getMyRequests(String requesterEmail) {
        User requester = requireActiveUser(requesterEmail);
        return enterpriseWorkflowRequestRepository.findByRequesterIdOrderByCreatedAtDesc(requester.getId());
    }

    public List<EnterpriseWorkflowRequest> getMyApprovalQueue(String approverEmail) {
        User approver = requireActiveUser(approverEmail);
        return enterpriseWorkflowRequestRepository.findByStatusOrderByCreatedAtDesc(EnterpriseWorkflowStatus.PENDING)
                .stream()
                .filter(item -> item.getActiveStepIndex() != null
                        && item.getActiveStepIndex() >= 0
                        && item.getActiveStepIndex() < item.getApprovalSteps().size()
                        && approver.getId().equals(item.getApprovalSteps().get(item.getActiveStepIndex()).getApproverId()))
                .toList();
    }

    public List<EnterpriseWorkflowRequest> getVisibleHistory(String actorEmail) {
        User actor = requireActiveUser(actorEmail);

        return enterpriseWorkflowRequestRepository.findAll().stream()
                .filter(request -> canViewRequest(actor, request))
                .sorted(Comparator.comparing(EnterpriseWorkflowRequest::getCreatedAt, Comparator.nullsLast(Long::compareTo)).reversed())
                .toList();
    }

    public EnterpriseWorkflowRequest getById(String requestId, String actorEmail) {
        User actor = requireActiveUser(actorEmail);
        EnterpriseWorkflowRequest request = enterpriseWorkflowRequestRepository.findById(requestId)
                .orElseThrow(() -> new RuntimeException("Yêu cầu không tồn tại!"));

        if (!canViewRequest(actor, request)) {
            throw new AccessDeniedException("Bạn không có quyền xem yêu cầu này!");
        }

        return request;
    }

    private boolean canViewRequest(User actor, EnterpriseWorkflowRequest request) {
        if (actor.getRole() == ERole.ADMIN) {
            return true;
        }

        if (actor.getId().equals(request.getRequesterId())) {
            return true;
        }

        if (request.getApprovalSteps().stream().anyMatch(step -> actor.getId().equals(step.getApproverId()))) {
            return true;
        }

        return actor.getRole() == ERole.MANAGER
                && actor.getDepartment() != null
                && actor.getDepartment().getId() != null
                && actor.getDepartment().getId().equals(request.getRequesterDepartmentId());
    }

    private void notifyCurrentApprover(EnterpriseWorkflowRequest request, User sender) {
        if (request.getActiveStepIndex() == null || request.getActiveStepIndex() < 0 || request.getActiveStepIndex() >= request.getApprovalSteps().size()) {
            return;
        }

        EnterpriseApprovalStep currentStep = request.getApprovalSteps().get(request.getActiveStepIndex());
        User currentApprover = userRepository.findById(currentStep.getApproverId()).orElse(null);
        if (currentApprover == null) {
            return;
        }

        String message = "Bạn có yêu cầu cần duyệt: " + request.getTitle();
        notificationService.createNotification(currentApprover, sender, null, message, "ENTERPRISE_REQUEST_PENDING");
    }

    private List<EnterpriseApprovalStep> buildApprovalSteps(EnterpriseRequestType requestType, User requester) {
        List<EnterpriseApprovalStep> steps = new ArrayList<>();

        if (requestType == EnterpriseRequestType.LEAVE_REQUEST) {
            if (requester.getRole() == ERole.MANAGER) {
                steps.add(buildStep(1, requireAnyActiveAdmin(), ERole.ADMIN));
                return steps;
            }

            steps.add(buildStep(1, requireDepartmentManager(requester), ERole.MANAGER));
            return steps;
        }

        if (requester.getRole() == ERole.MANAGER) {
            steps.add(buildStep(1, requireAnyActiveAdmin(), ERole.ADMIN));
            return steps;
        }

        if (requester.getRole() == ERole.ADMIN) {
            throw new RuntimeException("Tài khoản ADMIN không cần tạo yêu cầu theo luồng này!");
        }

        steps.add(buildStep(1, requireDepartmentManager(requester), ERole.MANAGER));
        steps.add(buildStep(2, requireAnyActiveAdmin(), ERole.ADMIN));
        return steps;
    }

    private EnterpriseApprovalStep buildStep(int order, User approver, ERole role) {
        EnterpriseApprovalStep step = new EnterpriseApprovalStep();
        step.setStepOrder(order);
        step.setApproverRole(role);
        step.setApproverId(approver.getId());
        step.setApproverName(approver.getFullName());
        step.setApproverEmail(approver.getEmail());
        step.setStatus(EnterpriseStepStatus.PENDING);
        return step;
    }

    private User requireDepartmentManager(User requester) {
        Department department = requester.getDepartment();
        if (department == null || department.getManager() == null || !StringUtils.hasText(department.getManager().getId())) {
            throw new RuntimeException("Phòng ban của người yêu cầu chưa có trưởng phòng để duyệt!");
        }
        User manager = userRepository.findById(department.getManager().getId())
                .orElseThrow(() -> new RuntimeException("Trưởng phòng của bộ phận không tồn tại!"));
        if (!manager.isActive()) {
            throw new RuntimeException("Trưởng phòng của bộ phận đang bị khóa!");
        }
        return manager;
    }

    private User requireAnyActiveAdmin() {
        return userRepository.findAll().stream()
                .filter(user -> user.getRole() == ERole.ADMIN)
                .filter(User::isActive)
                .findFirst()
                .orElseThrow(() -> new RuntimeException("Không có quản trị viên hoạt động để duyệt yêu cầu!"));
    }

    private User requireActiveUser(String email) {
        if (!StringUtils.hasText(email)) {
            throw new AccessDeniedException("Thiếu thông tin người dùng thực hiện!");
        }

        User user = userRepository.findByEmailIgnoreCase(email.trim().toLowerCase())
                .orElseThrow(() -> new AccessDeniedException("Người dùng thực hiện không tồn tại!"));

        if (!user.isActive()) {
            throw new AccessDeniedException("Tài khoản của bạn đang bị khóa!");
        }

        return user;
    }
}
