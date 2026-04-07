package com.projectmanagement.core_system.controller;

import com.projectmanagement.core_system.model.CreateEnterpriseRequestPayload;
import com.projectmanagement.core_system.model.EnterpriseDecisionRequest;
import com.projectmanagement.core_system.service.EnterpriseWorkflowService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/enterprise-requests")
public class EnterpriseWorkflowController {

    @Autowired
    private EnterpriseWorkflowService enterpriseWorkflowService;

    @PostMapping
    public ResponseEntity<?> createRequest(@Valid @RequestBody CreateEnterpriseRequestPayload payload, Authentication authentication) {
        try {
            return ResponseEntity.ok(enterpriseWorkflowService.createRequest(payload, authentication.getName()));
        } catch (AccessDeniedException e) {
            return ResponseEntity.status(403).body(e.getMessage());
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PostMapping("/{requestId}/decision")
    public ResponseEntity<?> decideRequest(
            @PathVariable String requestId,
            @Valid @RequestBody EnterpriseDecisionRequest decisionRequest,
            Authentication authentication) {
        try {
            return ResponseEntity.ok(enterpriseWorkflowService.decideRequest(requestId, decisionRequest, authentication.getName()));
        } catch (AccessDeniedException e) {
            return ResponseEntity.status(403).body(e.getMessage());
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @GetMapping("/mine")
    public ResponseEntity<?> getMyRequests(Authentication authentication) {
        try {
            return ResponseEntity.ok(enterpriseWorkflowService.getMyRequests(authentication.getName()));
        } catch (AccessDeniedException e) {
            return ResponseEntity.status(403).body(e.getMessage());
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @GetMapping("/approvals")
    public ResponseEntity<?> getMyApprovalQueue(Authentication authentication) {
        try {
            return ResponseEntity.ok(enterpriseWorkflowService.getMyApprovalQueue(authentication.getName()));
        } catch (AccessDeniedException e) {
            return ResponseEntity.status(403).body(e.getMessage());
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @GetMapping("/history")
    public ResponseEntity<?> getVisibleHistory(Authentication authentication) {
        try {
            return ResponseEntity.ok(enterpriseWorkflowService.getVisibleHistory(authentication.getName()));
        } catch (AccessDeniedException e) {
            return ResponseEntity.status(403).body(e.getMessage());
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @GetMapping("/{requestId}")
    public ResponseEntity<?> getRequestDetail(@PathVariable String requestId, Authentication authentication) {
        try {
            return ResponseEntity.ok(enterpriseWorkflowService.getById(requestId, authentication.getName()));
        } catch (AccessDeniedException e) {
            return ResponseEntity.status(403).body(e.getMessage());
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
}
