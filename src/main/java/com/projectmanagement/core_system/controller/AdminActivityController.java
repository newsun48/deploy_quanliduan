package com.projectmanagement.core_system.controller;

import com.projectmanagement.core_system.service.UserService;
import com.projectmanagement.core_system.controller.support.AuthenticatedUserHelper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin/user-activities")
public class AdminActivityController {

    @Autowired
    private UserService userService;

    @Autowired
    private AuthenticatedUserHelper authenticatedUserHelper;

    @PostMapping("/{id}/undo")
    public ResponseEntity<?> undoActivity(
            @PathVariable String id,
            Authentication authentication
    ) {
        try {
            String adminEmail = authenticatedUserHelper.requireActorEmail(authentication);
            userService.undoActivity(id, adminEmail);
            return ResponseEntity.ok("Đã hoàn tác hoạt động thành công!");
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        } catch (Exception e) {
            return ResponseEntity.status(500).body("Lỗi hệ thống: " + e.getMessage());
        }
    }
}
