package com.projectmanagement.core_system.controller;

import com.projectmanagement.core_system.model.AttachmentInfo;
import com.projectmanagement.core_system.model.ChecklistItem;
import com.projectmanagement.core_system.enums.TaskStatus;
import com.projectmanagement.core_system.model.Task;
import com.projectmanagement.core_system.model.TaskActivity;
import com.projectmanagement.core_system.model.TaskUpdateRequest;
import com.projectmanagement.core_system.config.JwtUtil;
import com.projectmanagement.core_system.service.TaskService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/tasks")
@CrossOrigin(origins = "http://localhost:5173")
public class TaskController {

    @Autowired
    private TaskService taskService;

    @Autowired
    private JwtUtil jwtUtil;

    // 1. Tạo Task mới
    @PostMapping("/create")
    public ResponseEntity<?> createTask(
            @RequestBody Task task,
            @RequestParam String projectId,
            @RequestParam String assigneeId) {
        try {
            return ResponseEntity.ok(taskService.createTask(task, projectId, assigneeId));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // 2. Lấy Task theo Dự án (Manager xem)
    @GetMapping("/project/{projectId}")
    public List<Task> getTasksByProject(@PathVariable String projectId) {
        return taskService.getTasksByProject(projectId);
    }

    // 3. Lấy Task của Tôi (Nhân viên xem)
    @GetMapping("/my-tasks/{userId}")
    public List<Task> getMyTasks(@PathVariable String userId) {
        return taskService.getMyTasks(userId);
    }

    @GetMapping("/{taskId}")
    public ResponseEntity<?> getTaskDetail(@PathVariable String taskId) {
        try {
            return ResponseEntity.ok(taskService.getTaskDetail(taskId));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // 4. 🔥 QUAN TRỌNG: Cập nhật Tiến độ & Trạng thái (Nhân viên dùng)
    @PutMapping("/{taskId}/status")
    public ResponseEntity<?> updateTaskStatus(
            @PathVariable String taskId,
            @RequestBody Map<String, Object> payload // Nhận JSON { "status": "DONE", "percent": 100 }
    ) {
        try {
            String statusStr = (String) payload.get("status");
            int percent = Integer.parseInt(payload.get("percent").toString());
            String submissionLink = (String) payload.get("submissionLink");
            
            System.out.println("🔵 [DEBUG] Cập nhật TaskID: " + taskId + ", Status: " + statusStr + ", Percent: " + percent + ", Link: " + submissionLink);
            
            TaskStatus newStatus = TaskStatus.valueOf(statusStr); // Chuyển chuỗi thành Enum

            return ResponseEntity.ok(taskService.updateStatus(taskId, newStatus, percent, submissionLink));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("Lỗi cập nhật: " + e.getMessage());
        }
    }

    @PutMapping("/{taskId}")
    public ResponseEntity<?> updateTaskByManager(
            @PathVariable String taskId,
            @RequestHeader("Authorization") String token,
            @RequestBody TaskUpdateRequest request) {
        try {
            String managerEmail = jwtUtil.extractEmail(token.replace("Bearer ", ""));
            return ResponseEntity.ok(taskService.updateTask(taskId, request, managerEmail));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @DeleteMapping("/{taskId}")
    public ResponseEntity<?> deleteTaskByManager(
            @PathVariable String taskId,
            @RequestHeader("Authorization") String token) {
        try {
            String managerEmail = jwtUtil.extractEmail(token.replace("Bearer ", ""));
            taskService.deleteTask(taskId, managerEmail);
            return ResponseEntity.ok("Xóa task thành công!");
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // 5. Thống kê Task (Dashboard Charts)
    @GetMapping("/statistics")
    public Map<String, Object> getTaskStatistics() {
        return taskService.getTaskStatistics();
    }

    @PostMapping("/{taskId}/checklist-items")
    public ResponseEntity<?> addChecklistItem(@PathVariable String taskId, @RequestBody Map<String, Object> payload) {
        try {
            ChecklistItem item = taskService.addChecklistItem(
                    taskId,
                    payload.get("title") != null ? payload.get("title").toString() : "",
                    payload.get("actorId") != null ? payload.get("actorId").toString() : null
            );
            return ResponseEntity.ok(item);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PutMapping("/{taskId}/checklist-items/{itemId}")
    public ResponseEntity<?> updateChecklistItem(
            @PathVariable String taskId,
            @PathVariable String itemId,
            @RequestBody Map<String, Object> payload) {
        try {
            ChecklistItem item = taskService.updateChecklistItem(
                    taskId,
                    itemId,
                    payload,
                    payload.get("actorId") != null ? payload.get("actorId").toString() : null
            );
            return ResponseEntity.ok(item);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @DeleteMapping("/{taskId}/checklist-items/{itemId}")
    public ResponseEntity<?> deleteChecklistItem(
            @PathVariable String taskId,
            @PathVariable String itemId,
            @RequestParam(required = false) String actorId) {
        try {
            return ResponseEntity.ok(taskService.deleteChecklistItem(taskId, itemId, actorId));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PostMapping("/{taskId}/attachments")
    public ResponseEntity<?> addTaskAttachment(@PathVariable String taskId, @RequestBody Map<String, Object> payload) {
        try {
            AttachmentInfo attachment = parseAttachment(payload);
            AttachmentInfo savedAttachment = taskService.addTaskAttachment(
                    taskId,
                    attachment,
                    payload.get("actorId") != null ? payload.get("actorId").toString() : null
            );
            return ResponseEntity.ok(savedAttachment);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @DeleteMapping("/{taskId}/attachments/{attachmentId}")
    public ResponseEntity<?> deleteTaskAttachment(
            @PathVariable String taskId,
            @PathVariable String attachmentId,
            @RequestParam(required = false) String actorId) {
        try {
            return ResponseEntity.ok(taskService.deleteTaskAttachment(taskId, attachmentId, actorId));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @GetMapping("/{taskId}/activity")
    public ResponseEntity<?> getTaskActivity(@PathVariable String taskId) {
        try {
            List<TaskActivity> activity = taskService.getTaskActivity(taskId);
            return ResponseEntity.ok(activity);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    private AttachmentInfo parseAttachment(Map<String, Object> payload) {
        AttachmentInfo attachment = new AttachmentInfo();
        attachment.setId(payload.get("id") != null ? payload.get("id").toString() : null);
        attachment.setUrl(payload.get("url") != null ? payload.get("url").toString() : null);
        attachment.setOriginalName(payload.get("originalName") != null ? payload.get("originalName").toString() : null);
        attachment.setSize(payload.get("size") != null ? Long.parseLong(payload.get("size").toString()) : 0L);
        attachment.setUploadedById(payload.get("uploadedById") != null ? payload.get("uploadedById").toString() : null);
        attachment.setUploadedByName(payload.get("uploadedByName") != null ? payload.get("uploadedByName").toString() : null);
        attachment.setUploadedAt(payload.get("uploadedAt") != null ? Long.parseLong(payload.get("uploadedAt").toString()) : 0L);
        return attachment;
    }
}
