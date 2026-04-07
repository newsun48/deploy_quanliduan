package com.projectmanagement.core_system.controller;

import com.projectmanagement.core_system.controller.support.AuthenticatedUserHelper;
import com.projectmanagement.core_system.model.AdminActivity;
import com.projectmanagement.core_system.model.User;
import com.projectmanagement.core_system.service.AdminActivityService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/undo")
@CrossOrigin(origins = "http://localhost:5173")
@PreAuthorize("hasRole('ADMIN')")
public class AdminUndoController {

    @Autowired
    private AdminActivityService adminActivityService;

    @Autowired
    private AuthenticatedUserHelper authenticatedUserHelper;

    // Get all recent admin activities
    @GetMapping("/activities")
    public ResponseEntity<Page<AdminActivity>> getRecentActivities(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(adminActivityService.getRecentActivities(page, size));
    }

    // Get only undoable activities
    @GetMapping("/activities/undoable")
    public ResponseEntity<Page<AdminActivity>> getUndoableActivities(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(adminActivityService.getUndoableActivities(page, size));
    }

    // Get activities for a specific entity
    @GetMapping("/activities/{entityType}/{entityId}")
    public ResponseEntity<List<AdminActivity>> getEntityActivities(
            @PathVariable String entityType,
            @PathVariable String entityId) {
        return ResponseEntity.ok(adminActivityService.getEntityActivities(entityType, entityId));
    }

    // Undo a specific activity
    @PostMapping("/activities/{activityId}")
    public ResponseEntity<?> undoActivity(
            @PathVariable String activityId,
            Authentication authentication) {
        try {
            User currentUser = authenticatedUserHelper.requireAuthenticatedUser(authentication);
            adminActivityService.undoActivity(activityId, currentUser);
            return ResponseEntity.ok().body(Map.of(
                "message", "Đã hoàn tác hoạt động thành công!",
                "activityId", activityId
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of(
                "message", e.getMessage(),
                "activityId", activityId
            ));
        }
    }
}