package com.projectmanagement.core_system.controller;

import com.projectmanagement.core_system.model.UserActivity;
import com.projectmanagement.core_system.service.UserActivityService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/user-activities")
@CrossOrigin(origins = "http://localhost:5173")
public class AdminUserActivityController {

    @Autowired
    private UserActivityService userActivityService;

    @GetMapping
    public ResponseEntity<List<UserActivity>> getRecentActivities(
            @RequestParam(required = false) String userId,
            @RequestParam(defaultValue = "50") int limit) {
        return ResponseEntity.ok(userActivityService.getRecentActivities(userId, limit));
    }

    @PostMapping("/{id}/undo")
    public ResponseEntity<?> undoActivity(@PathVariable String id) {
        try {
            userActivityService.undoActivity(id);
            return ResponseEntity.ok().body(Map.of("message", "Đã hoàn tác hoạt động thành công!"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }
}
