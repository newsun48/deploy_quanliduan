package com.projectmanagement.core_system.controller;

import com.projectmanagement.core_system.controller.support.AuthenticatedUserHelper;
import com.projectmanagement.core_system.model.Notification;
import com.projectmanagement.core_system.model.User;
import com.projectmanagement.core_system.service.NotificationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/notifications")
@CrossOrigin(origins = "http://localhost:5173")
public class NotificationController {

    @Autowired
    private NotificationService notificationService;

    @Autowired
    private AuthenticatedUserHelper authenticatedUserHelper;

    // Lấy danh sách thông báo của user hiện tại
    @GetMapping
    public ResponseEntity<?> getNotifications(Authentication authentication) {
        try {
            User user = authenticatedUserHelper.requireAuthenticatedUser(authentication);
            List<Notification> notifications = notificationService.getNotifications(user);
            return ResponseEntity.ok(notifications);
        } catch (AccessDeniedException e) {
            return ResponseEntity.status(401).body("Không đủ quyền!");
        }
    }

    // Lấy số lượng thông báo chưa đọc
    @GetMapping("/unread-count")
    public ResponseEntity<?> getUnreadCount(Authentication authentication) {
        try {
            User user = authenticatedUserHelper.requireAuthenticatedUser(authentication);
            long count = notificationService.getUnreadCount(user);
            Map<String, Object> response = new HashMap<>();
            response.put("unreadCount", count);
            return ResponseEntity.ok(response);
        } catch (AccessDeniedException e) {
            return ResponseEntity.status(401).body("Không đủ quyền!");
        }
    }

    // Lấy danh sách thông báo chưa đọc
    @GetMapping("/unread")
    public ResponseEntity<?> getUnreadNotifications(Authentication authentication) {
        try {
            User user = authenticatedUserHelper.requireAuthenticatedUser(authentication);
            List<Notification> notifications = notificationService.getUnreadNotifications(user);
            return ResponseEntity.ok(notifications);
        } catch (AccessDeniedException e) {
            return ResponseEntity.status(401).body("Không đủ quyền!");
        }
    }

    // Đánh dấu thông báo là đã đọc
    @PostMapping("/{notificationId}/mark-as-read")
    public ResponseEntity<?> markAsRead(@PathVariable String notificationId, Authentication authentication) {
        if (notificationId == null || notificationId.trim().isEmpty()) {
            return ResponseEntity.badRequest().body("ID thông báo không hợp lệ!");
        }
        try {
            Notification notification = notificationService.markAsRead(notificationId, authenticatedUserHelper.requireAuthenticatedUser(authentication));
            return ResponseEntity.ok(notification);
        } catch (AccessDeniedException e) {
            return ResponseEntity.status(403).body(e.getMessage());
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // Đánh dấu tất cả thông báo là đã đọc
    @PostMapping("/mark-all-as-read")
    public ResponseEntity<?> markAllAsRead(Authentication authentication) {
        try {
            User user = authenticatedUserHelper.requireAuthenticatedUser(authentication);
            notificationService.markAllAsRead(user);
            return ResponseEntity.ok("Đã đánh dấu tất cả thông báo là đã đọc!");
        } catch (AccessDeniedException e) {
            return ResponseEntity.status(401).body("Không đủ quyền!");
        }
    }
}
