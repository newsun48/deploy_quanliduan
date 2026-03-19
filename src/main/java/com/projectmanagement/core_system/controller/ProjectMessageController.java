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
@CrossOrigin(origins = "http://localhost:5173")
public class ProjectMessageController {

    @Autowired
    private ProjectMessageService projectMessageService;

    // 1. Get all messages by Project ID
    @GetMapping("/project/{projectId}")
    public ResponseEntity<?> getProjectMessages(@PathVariable String projectId) {
        try {
            List<ProjectMessage> messages = projectMessageService.getMessagesByProjectId(projectId);
            return ResponseEntity.ok(messages);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // 1b. Get all messages by Project ID with access control
    @GetMapping("/project/{projectId}/user/{userId}")
    public ResponseEntity<?> getProjectMessagesWithAccess(
            @PathVariable String projectId,
            @PathVariable String userId) {
        try {
            List<ProjectMessage> messages = projectMessageService.getMessagesByProjectIdWithAccess(projectId, userId);
            return ResponseEntity.ok(messages);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // 2. Send new message
    @PostMapping("/send")
    public ResponseEntity<?> sendMessage(
            @RequestParam String projectId,
            @RequestParam String userId,
            @RequestBody Map<String, String> payload) {
        try {
            String content = payload.get("content");
            ProjectMessage message = projectMessageService.sendMessage(projectId, userId, content);
            return ResponseEntity.ok(message);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // 3. Update message
    @PutMapping("/{messageId}")
    public ResponseEntity<?> updateMessage(
            @PathVariable String messageId,
            @RequestBody Map<String, String> payload) {
        try {
            String newContent = payload.get("content");
            ProjectMessage message = projectMessageService.updateMessage(messageId, newContent);
            return ResponseEntity.ok(message);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // 4. Delete message
    @DeleteMapping("/{messageId}")
    public ResponseEntity<?> deleteMessage(@PathVariable String messageId) {
        try {
            projectMessageService.deleteMessage(messageId);
            return ResponseEntity.ok("Tin nhắn đã được xóa!");
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
}
