package com.projectmanagement.core_system.controller;

import com.projectmanagement.core_system.model.AttachmentInfo;
import com.projectmanagement.core_system.model.Comment;
import com.projectmanagement.core_system.config.JwtUtil;
import com.projectmanagement.core_system.service.CommentService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/comments")
@CrossOrigin(origins = "http://localhost:5173")
public class CommentController {

    @Autowired
    private CommentService commentService;

    @Autowired
    private JwtUtil jwtUtil;

    // 1. Get all comments by Task ID
    @GetMapping("/task/{taskId}")
    public ResponseEntity<?> getCommentsByTask(
            @PathVariable String taskId,
            @RequestHeader("Authorization") String token) {
        try {
            List<Comment> comments = commentService.getCommentsByTaskId(taskId, extractEmailSafely(token));
            return ResponseEntity.ok(comments);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // 1b. 🆕 Get all comments by Project ID
    @GetMapping("/project/{projectId}")
    public ResponseEntity<?> getCommentsByProject(
            @PathVariable String projectId,
            @RequestHeader("Authorization") String token) {
        try {
            List<Comment> comments = commentService.getCommentsByProjectId(projectId, extractEmailSafely(token));
            return ResponseEntity.ok(comments);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // 2. Add new comment
    @PostMapping("/add")
    public ResponseEntity<?> addComment(
            @RequestParam String taskId,
            @RequestParam(required = false) String userId,
            @RequestHeader("Authorization") String token,
            @RequestBody Map<String, Object> payload) {
        try {
            String content = payload.get("content") != null ? payload.get("content").toString() : "";
            Comment comment = commentService.addComment(taskId, userId, extractEmailSafely(token), content, parseAttachments(payload.get("attachments")));
            return ResponseEntity.ok(comment);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // 3. Update comment
    @PutMapping("/{commentId}")
    public ResponseEntity<?> updateComment(
            @PathVariable String commentId,
            @RequestHeader("Authorization") String token,
            @RequestBody Map<String, String> payload) {
        try {
            String newContent = payload.get("content");
            Comment comment = commentService.updateComment(commentId, extractEmailSafely(token), newContent);
            return ResponseEntity.ok(comment);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // 4. Delete comment
    @DeleteMapping("/{commentId}")
    public ResponseEntity<?> deleteComment(
            @PathVariable String commentId,
            @RequestHeader("Authorization") String token) {
        try {
            commentService.deleteComment(commentId, extractEmailSafely(token));
            return ResponseEntity.ok("Bình luận đã được xóa!");
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    private List<AttachmentInfo> parseAttachments(Object rawAttachments) {
        List<AttachmentInfo> attachments = new ArrayList<>();
        if (!(rawAttachments instanceof List<?> rawList)) {
            return attachments;
        }

        for (Object item : rawList) {
            if (item instanceof Map<?, ?> map) {
                AttachmentInfo attachment = new AttachmentInfo();
                attachment.setId(map.get("id") != null ? map.get("id").toString() : null);
                attachment.setUrl(map.get("url") != null ? map.get("url").toString() : null);
                attachment.setOriginalName(map.get("originalName") != null ? map.get("originalName").toString() : null);
                attachment.setSize(parseLong(map.get("size")));
                attachment.setUploadedById(map.get("uploadedById") != null ? map.get("uploadedById").toString() : null);
                attachment.setUploadedByName(map.get("uploadedByName") != null ? map.get("uploadedByName").toString() : null);
                attachment.setUploadedAt(parseLong(map.get("uploadedAt")));
                attachments.add(attachment);
            }
        }

        return attachments;
    }

    private long parseLong(Object value) {
        if (value == null) {
            return 0L;
        }

        return Long.parseLong(value.toString());
    }

    private String extractEmailSafely(String token) {
        if (token == null || token.isBlank() || !token.startsWith("Bearer ")) {
            return null;
        }

        return jwtUtil.extractEmail(token.replace("Bearer ", ""));
    }
}
