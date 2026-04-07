package com.projectmanagement.core_system.service;

import com.projectmanagement.core_system.enums.ERole;
import com.projectmanagement.core_system.enums.EnterpriseRequestType;
import com.projectmanagement.core_system.enums.EnterpriseWorkflowStatus;
import com.projectmanagement.core_system.model.CreateEnterpriseRequestPayload;
import com.projectmanagement.core_system.model.Department;
import com.projectmanagement.core_system.model.EnterpriseDecisionRequest;
import com.projectmanagement.core_system.model.EnterpriseWorkflowRequest;
import com.projectmanagement.core_system.model.User;
import com.projectmanagement.core_system.repository.EnterpriseWorkflowRequestRepository;
import com.projectmanagement.core_system.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class EnterpriseWorkflowServiceTest {

    @Mock
    private EnterpriseWorkflowRequestRepository enterpriseWorkflowRequestRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private ProjectService projectService;

    @Mock
    private NotificationService notificationService;

    @Mock
    private UserActivityService userActivityService;

    @InjectMocks
    private EnterpriseWorkflowService enterpriseWorkflowService;

    @Test
    void createRequest_leaveByEmployee_routesToDepartmentManagerOnly() {
        User manager = buildUser("manager-1", "manager@example.com", ERole.MANAGER, true);
        Department department = buildDepartment("dept-1", manager);
        User employee = buildUser("employee-1", "employee@example.com", ERole.EMPLOYEE, true);
        employee.setDepartment(department);

        CreateEnterpriseRequestPayload payload = new CreateEnterpriseRequestPayload();
        payload.setType(EnterpriseRequestType.LEAVE_REQUEST);
        payload.setTitle("Nghỉ phép tháng 4");
        payload.setReason("Nghỉ phép cá nhân");

        when(userRepository.findByEmailIgnoreCase("employee@example.com")).thenReturn(Optional.of(employee));
        when(userRepository.findById("manager-1")).thenReturn(Optional.of(manager));
        when(enterpriseWorkflowRequestRepository.save(any(EnterpriseWorkflowRequest.class))).thenAnswer(invocation -> {
            EnterpriseWorkflowRequest request = invocation.getArgument(0);
            request.setId("request-1");
            return request;
        });

        EnterpriseWorkflowRequest saved = enterpriseWorkflowService.createRequest(payload, "employee@example.com");

        assertEquals(EnterpriseWorkflowStatus.PENDING, saved.getStatus());
        assertEquals(1, saved.getApprovalSteps().size());
        assertEquals("manager-1", saved.getApprovalSteps().get(0).getApproverId());
    }

    @Test
    void decideRequest_finalApprovalForProjectClose_callsCompleteProject() {
        User admin = buildUser("admin-1", "admin@example.com", ERole.ADMIN, true);
        User manager = buildUser("manager-1", "manager@example.com", ERole.MANAGER, true);

        EnterpriseWorkflowRequest workflowRequest = new EnterpriseWorkflowRequest();
        workflowRequest.setId("request-1");
        workflowRequest.setType(EnterpriseRequestType.PROJECT_CLOSE);
        workflowRequest.setTitle("Đóng dự án A");
        workflowRequest.setProjectId("project-1");
        workflowRequest.setRequesterId("manager-1");
        workflowRequest.setStatus(EnterpriseWorkflowStatus.PENDING);
        workflowRequest.setActiveStepIndex(0);
        workflowRequest.setApprovalSteps(new ArrayList<>());
        workflowRequest.setDecisionHistory(new ArrayList<>());

        com.projectmanagement.core_system.model.EnterpriseApprovalStep step = new com.projectmanagement.core_system.model.EnterpriseApprovalStep();
        step.setStepOrder(1);
        step.setApproverId("admin-1");
        step.setApproverEmail("admin@example.com");
        workflowRequest.getApprovalSteps().add(step);

        EnterpriseDecisionRequest decisionRequest = new EnterpriseDecisionRequest();
        decisionRequest.setApproved(true);
        decisionRequest.setComment("Duyệt đóng dự án");

        when(userRepository.findByEmailIgnoreCase("admin@example.com")).thenReturn(Optional.of(admin));
        when(userRepository.findById("manager-1")).thenReturn(Optional.of(manager));
        when(enterpriseWorkflowRequestRepository.findById("request-1")).thenReturn(Optional.of(workflowRequest));
        when(enterpriseWorkflowRequestRepository.save(any(EnterpriseWorkflowRequest.class))).thenAnswer(invocation -> invocation.getArgument(0));

        EnterpriseWorkflowRequest updated = enterpriseWorkflowService.decideRequest("request-1", decisionRequest, "admin@example.com");

        assertEquals(EnterpriseWorkflowStatus.APPROVED, updated.getStatus());
        verify(projectService).completeProject("project-1", "admin@example.com");
    }

    @Test
    void decideRequest_rejectsNonCurrentApprover() {
        User manager = buildUser("manager-1", "manager@example.com", ERole.MANAGER, true);
        User employee = buildUser("employee-1", "employee@example.com", ERole.EMPLOYEE, true);

        EnterpriseWorkflowRequest workflowRequest = new EnterpriseWorkflowRequest();
        workflowRequest.setId("request-1");
        workflowRequest.setStatus(EnterpriseWorkflowStatus.PENDING);
        workflowRequest.setActiveStepIndex(0);
        workflowRequest.setApprovalSteps(new ArrayList<>());

        com.projectmanagement.core_system.model.EnterpriseApprovalStep step = new com.projectmanagement.core_system.model.EnterpriseApprovalStep();
        step.setStepOrder(1);
        step.setApproverId("manager-1");
        workflowRequest.getApprovalSteps().add(step);

        EnterpriseDecisionRequest decisionRequest = new EnterpriseDecisionRequest();
        decisionRequest.setApproved(true);

        when(userRepository.findByEmailIgnoreCase("employee@example.com")).thenReturn(Optional.of(employee));
        when(enterpriseWorkflowRequestRepository.findById("request-1")).thenReturn(Optional.of(workflowRequest));

        assertThrows(org.springframework.security.access.AccessDeniedException.class,
                () -> enterpriseWorkflowService.decideRequest("request-1", decisionRequest, "employee@example.com"));

        verify(projectService, never()).completeProject(any(), any());
    }

    private User buildUser(String id, String email, ERole role, boolean active) {
        User user = new User();
        user.setId(id);
        user.setEmail(email);
        user.setRole(role);
        user.setActive(active);
        user.setFullName(email);
        return user;
    }

    private Department buildDepartment(String id, User manager) {
        Department department = new Department();
        setField(department, "id", id);
        setField(department, "manager", manager);
        return department;
    }

    private void setField(Object target, String fieldName, Object value) {
        try {
            java.lang.reflect.Field field = target.getClass().getDeclaredField(fieldName);
            field.setAccessible(true);
            field.set(target, value);
        } catch (ReflectiveOperationException e) {
            throw new RuntimeException(e);
        }
    }
}
