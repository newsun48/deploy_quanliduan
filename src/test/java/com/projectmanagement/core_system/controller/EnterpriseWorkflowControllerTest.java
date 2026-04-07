package com.projectmanagement.core_system.controller;

import com.projectmanagement.core_system.model.CreateEnterpriseRequestPayload;
import com.projectmanagement.core_system.model.EnterpriseWorkflowRequest;
import com.projectmanagement.core_system.service.EnterpriseWorkflowService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class EnterpriseWorkflowControllerTest {

    @Mock
    private EnterpriseWorkflowService enterpriseWorkflowService;

    @InjectMocks
    private EnterpriseWorkflowController enterpriseWorkflowController;

    @Test
    void createRequest_usesAuthenticatedEmail() {
        Authentication authentication = mock(Authentication.class);
        CreateEnterpriseRequestPayload payload = new CreateEnterpriseRequestPayload();

        when(authentication.getName()).thenReturn("employee@example.com");
        when(enterpriseWorkflowService.createRequest(any(CreateEnterpriseRequestPayload.class), eq("employee@example.com")))
                .thenReturn(new EnterpriseWorkflowRequest());

        ResponseEntity<?> response = enterpriseWorkflowController.createRequest(payload, authentication);

        assertEquals(200, response.getStatusCode().value());
    }

    @Test
    void getRequestDetail_returnsForbiddenOnAccessDenied() {
        Authentication authentication = mock(Authentication.class);
        when(authentication.getName()).thenReturn("employee@example.com");
        when(enterpriseWorkflowService.getById("request-1", "employee@example.com"))
                .thenThrow(new AccessDeniedException("Bạn không có quyền xem yêu cầu này!"));

        ResponseEntity<?> response = enterpriseWorkflowController.getRequestDetail("request-1", authentication);

        assertEquals(403, response.getStatusCode().value());
        assertEquals("Bạn không có quyền xem yêu cầu này!", response.getBody());
    }
}
