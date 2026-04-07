package com.projectmanagement.core_system.controller;

import com.projectmanagement.core_system.model.UpdateOkrKeyResultRequest;
import com.projectmanagement.core_system.model.UpdateOkrReviewSummaryRequest;
import com.projectmanagement.core_system.model.UpsertDepartmentOkrRequest;
import com.projectmanagement.core_system.service.DepartmentPerformanceService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestParam;

@RestController
@RequestMapping("/api/department-performance")
public class DepartmentPerformanceController {

    @Autowired
    private DepartmentPerformanceService departmentPerformanceService;

    @GetMapping("/kpis")
    public ResponseEntity<?> getDepartmentKpis(Authentication authentication) {
        try {
            return ResponseEntity.ok(departmentPerformanceService.getDepartmentKpis(authentication.getName()));
        } catch (AccessDeniedException e) {
            return ResponseEntity.status(403).body(e.getMessage());
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PostMapping("/okrs")
    public ResponseEntity<?> upsertDepartmentOkr(@RequestBody UpsertDepartmentOkrRequest request, Authentication authentication) {
        try {
            return ResponseEntity.ok(departmentPerformanceService.upsertQuarterlyOkr(request, authentication.getName()));
        } catch (AccessDeniedException e) {
            return ResponseEntity.status(403).body(e.getMessage());
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PatchMapping("/okrs/{okrId}/key-results/{keyResultId}")
    public ResponseEntity<?> updateKeyResult(
            @PathVariable String okrId,
            @PathVariable String keyResultId,
            @RequestBody UpdateOkrKeyResultRequest request,
            Authentication authentication) {
        try {
            return ResponseEntity.ok(departmentPerformanceService.updateKeyResultProgress(okrId, keyResultId, request, authentication.getName()));
        } catch (AccessDeniedException e) {
            return ResponseEntity.status(403).body(e.getMessage());
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PatchMapping("/okrs/{okrId}/review-summary")
    public ResponseEntity<?> updateReviewSummary(
            @PathVariable String okrId,
            @RequestBody UpdateOkrReviewSummaryRequest request,
            Authentication authentication) {
        try {
            return ResponseEntity.ok(departmentPerformanceService.updateReviewSummary(okrId, request, authentication.getName()));
        } catch (AccessDeniedException e) {
            return ResponseEntity.status(403).body(e.getMessage());
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PostMapping("/generate-insights")
    public ResponseEntity<?> generateInsights(
            @RequestParam String departmentId,
            @RequestParam Integer year,
            @RequestParam Integer quarter,
            Authentication authentication) {
        try {
            return ResponseEntity.ok(departmentPerformanceService.generateQuarterlyInsights(departmentId, year, quarter, authentication.getName()));
        } catch (AccessDeniedException e) {
            return ResponseEntity.status(403).body(e.getMessage());
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @GetMapping("/okrs/{departmentId}")
    public ResponseEntity<?> getDepartmentOkrs(
            @PathVariable String departmentId,
            @RequestParam(required = false) Integer year,
            @RequestParam(required = false) Integer quarter,
            Authentication authentication) {
        try {
            return ResponseEntity.ok(departmentPerformanceService.getDepartmentOkrs(departmentId, year, quarter, authentication.getName()));
        } catch (AccessDeniedException e) {
            return ResponseEntity.status(403).body(e.getMessage());
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
}
