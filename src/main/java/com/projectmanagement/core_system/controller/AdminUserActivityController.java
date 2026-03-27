package com.projectmanagement.core_system.controller;

import com.projectmanagement.core_system.model.UserActivity;
import com.projectmanagement.core_system.service.UserActivityService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

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
}
