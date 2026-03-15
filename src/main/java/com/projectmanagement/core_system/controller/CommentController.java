package com.projectmanagement.core_system.controller;

import com.projectmanagement.core_system.model.Comment;
import com.projectmanagement.core_system.service.CommentService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/comments")
@CrossOrigin(origins = "http://localhost:5173")
public class CommentController {

    @Autowired
    private CommentService commentService;

    // 1. Get all comments by Task ID
    @GetMapping("/task/{taskId}")
    public ResponseEntity<?> getCommentsByTask(@PathVariable String taskId) {
        try {
            List<Comment> comments = commentService.getCommentsByTaskId(taskId);
            return ResponseEntity.ok(comments);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // 1b. 🆕 Get all comments by Project ID
    @GetMapping("/project/{projectId}")
    public ResponseEntity<?> getCommentsByProject(@PathVariable String projectId) {
        try {
            List<Comment> comments = commentService.getCommentsByProjectId(projectId);
            return ResponseEntity.ok(comments);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // 2. Add new comment
    @PostMapping("/add")
    public ResponseEntity<?> addComment(
            @RequestParam String taskId,
            @RequestParam String userId,
            @RequestBody Map<String, String> payload) {
        try {
            String content = payload.get("content");
            Comment comment = commentService.addComment(taskId, userId, content);
            return ResponseEntity.ok(comment);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // 3. Update comment
    @PutMapping("/{commentId}")
    public ResponseEntity<?> updateComment(
            @PathVariable String commentId,
            @RequestBody Map<String, String> payload) {
        try {
            String newContent = payload.get("content");
            Comment comment = commentService.updateComment(commentId, newContent);
            return ResponseEntity.ok(comment);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // 4. Delete comment
    @DeleteMapping("/{commentId}")
    public ResponseEntity<?> deleteComment(@PathVariable String commentId) {
        try {
            commentService.deleteComment(commentId);
            return ResponseEntity.ok("Bình luận đã được xóa!");
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
}
