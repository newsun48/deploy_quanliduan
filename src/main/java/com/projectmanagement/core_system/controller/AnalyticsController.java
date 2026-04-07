package com.projectmanagement.core_system.controller;

import com.projectmanagement.core_system.service.AnalyticsService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/analytics")
public class AnalyticsController {

    @Autowired
    private AnalyticsService analyticsService;

    @GetMapping("/delivery")
    public ResponseEntity<?> getDeliveryAnalytics(
            Authentication authentication,
            @RequestParam(required = false) String departmentId,
            @RequestParam(required = false) Integer rangeDays,
            @RequestParam(required = false) Integer stalledDays) {
        try {
            return ResponseEntity.ok(
                    analyticsService.getDeliveryAnalytics(authentication.getName(), departmentId, rangeDays, stalledDays)
            );
        } catch (AccessDeniedException e) {
            return ResponseEntity.status(403).body(e.getMessage());
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
}
