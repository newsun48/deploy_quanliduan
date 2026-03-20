package com.projectmanagement.core_system.controller;

import com.projectmanagement.core_system.model.ProjectMessage;
import com.projectmanagement.core_system.service.ProjectMessageService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/project-messages")
public class ProjectMessageController {

    private static final java.util.logging.Logger logger = java.util.logging.Logger.getLogger(ProjectMessageController.class.getName());

    @Autowired
    private ProjectMessageService projectMessageService;

    // 1. Get group chat messages (with access control)
    @GetMapping("/project/{projectId}/user/{userId}")
    public ResponseEntity<?> getProjectMessagesWithAccess(
            @PathVariable String projectId,
            @PathVariable String userId) {
        if (projectId == null || projectId.trim().isEmpty() || userId == null || userId.trim().isEmpty()) {
            return ResponseEntity.badRequest().body("Dữ liệu projectId hoặc userId không hợp lệ!");
        }
        try {
            List<ProjectMessage> messages = projectMessageService.getMessagesByProjectIdWithAccess(projectId, userId);
            return ResponseEntity.ok(messages);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // 2. Get private chat messages between 2 users
    @GetMapping("/private/user/{userId1}/{userId2}")
    public ResponseEntity<?> getPrivateMessages(
            @PathVariable String userId1,
            @PathVariable String userId2) {
        if (userId1 == null || userId1.trim().isEmpty() || userId2 == null || userId2.trim().isEmpty()) {
            return ResponseEntity.badRequest().body("Dữ liệu userId không hợp lệ!");
        }
        try {
            List<ProjectMessage> messages = projectMessageService.getPrivateMessages(userId1, userId2);
            return ResponseEntity.ok(messages);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // 3. Send message (Group hoặc Private - dùng chung 1 API)
    @PostMapping("/send")
    public ResponseEntity<?> sendMessage(@RequestBody Map<String, String> payload) {
        try {
            ProjectMessage message = projectMessageService.sendMessage(payload);
            return ResponseEntity.ok(message);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // 4. Update message (kiểm tra 1 giờ trong Service)
    @PutMapping("/{messageId}")
    public ResponseEntity<?> updateMessage(
            @PathVariable String messageId,
            @RequestBody Map<String, String> payload) {
        logger.info(">>> Entering updateMessage: " + messageId);
        try {
            String newContent = payload.get("content");
            ProjectMessage message = projectMessageService.updateMessage(messageId, newContent);
            logger.info("<<< Success updateMessage: " + messageId);
            return ResponseEntity.ok(message);
        } catch (RuntimeException e) {
            logger.severe("!!! Error in updateMessage: " + e.getMessage());
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // 5. Delete message (soft delete, kiểm tra 1 giờ trong Service)
    @DeleteMapping("/{messageId}")
    public ResponseEntity<?> deleteMessage(@PathVariable String messageId) {
        logger.info(">>> Entering deleteMessage: " + messageId);
        try {
            ProjectMessage message = projectMessageService.deleteMessage(messageId);
            logger.info("<<< Success deleteMessage: " + messageId);
            return ResponseEntity.ok(message);
        } catch (RuntimeException e) {
            logger.severe("!!! Error in deleteMessage: " + e.getMessage());
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
}

