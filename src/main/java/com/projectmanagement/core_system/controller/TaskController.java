package com.projectmanagement.core_system.controller;

import com.projectmanagement.core_system.controller.support.AuthenticatedUserHelper;
import com.projectmanagement.core_system.model.AttachmentInfo;
import com.projectmanagement.core_system.model.ChecklistItem;
import com.projectmanagement.core_system.model.CreateTaskRequest;
import com.projectmanagement.core_system.enums.TaskStatus;
import com.projectmanagement.core_system.model.Task;
import com.projectmanagement.core_system.model.TaskActivity;
import com.projectmanagement.core_system.model.TaskUpdateRequest;
import com.projectmanagement.core_system.service.TaskService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
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
    private AuthenticatedUserHelper authenticatedUserHelper;

    // 1. Tạo Task mới
    @PostMapping("/create")
    public ResponseEntity<?> createTask(
            @Valid @RequestBody CreateTaskRequest request,
            @RequestParam String projectId,
            @RequestParam String assigneeId,
            Authentication authentication) {
        try {
            return ResponseEntity.ok(taskService.createTask(toTask(request), projectId, assigneeId, authenticatedUserHelper.requireActorEmail(authentication)));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // 2. Lấy Task theo Dự án (Manager xem)
    @GetMapping("/project/{projectId}")
    public List<Task> getTasksByProject(
            @PathVariable String projectId,
            Authentication authentication) {
        return taskService.getTasksByProject(projectId, authenticatedUserHelper.requireActorEmail(authentication));
    }

    // 3. Lấy Task của Tôi (Nhân viên xem)
    @GetMapping("/my-tasks/{userId}")
    public List<Task> getMyTasks(
            @PathVariable String userId,
            Authentication authentication) {
        return taskService.getMyTasks(userId, authenticatedUserHelper.requireActorEmail(authentication));
    }

    @GetMapping("/{taskId}")
    public ResponseEntity<?> getTaskDetail(
            @PathVariable String taskId,
            Authentication authentication) {
        try {
            return ResponseEntity.ok(taskService.getTaskDetail(taskId, authenticatedUserHelper.requireActorEmail(authentication)));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // 4. 🔥 QUAN TRỌNG: Cập nhật Tiến độ & Trạng thái (Nhân viên dùng)
    @PutMapping("/{taskId}/status")
    public ResponseEntity<?> updateTaskStatus(
            @PathVariable String taskId,
            Authentication authentication,
            @RequestBody Map<String, Object> payload // Nhận JSON { "status": "DONE", "percent": 100 }
    ) {
        try {
            String statusStr = (String) payload.get("status");
            int percent = Integer.parseInt(payload.get("percent").toString());
            String submissionLink = (String) payload.get("submissionLink");
            TaskStatus newStatus = TaskStatus.valueOf(statusStr); // Chuyển chuỗi thành Enum

            return ResponseEntity.ok(taskService.updateStatus(taskId, newStatus, percent, submissionLink, authenticatedUserHelper.requireActorEmail(authentication)));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("Lỗi cập nhật: " + e.getMessage());
        }
    }

    @PutMapping("/{taskId}")
    public ResponseEntity<?> updateTaskByManager(
            @PathVariable String taskId,
            Authentication authentication,
            @Valid @RequestBody TaskUpdateRequest request) {
        try {
            return ResponseEntity.ok(taskService.updateTask(taskId, request, authenticatedUserHelper.requireActorEmail(authentication)));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @DeleteMapping("/{taskId}")
    public ResponseEntity<?> deleteTaskByManager(
            @PathVariable String taskId,
            Authentication authentication) {
        try {
            taskService.deleteTask(taskId, authenticatedUserHelper.requireActorEmail(authentication));
            return ResponseEntity.ok("Xóa task thành công!");
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // 5. Thống kê Task (Dashboard Charts)
    @GetMapping("/statistics")
    public Map<String, Object> getTaskStatistics(Authentication authentication) {
        return taskService.getTaskStatistics(authenticatedUserHelper.requireActorEmail(authentication));
    }

    @GetMapping("/stats/workload")
    public ResponseEntity<?> getWorkloadStatistics(
            @RequestParam(required = false) String departmentId,
            Authentication authentication) {
        try {
            return ResponseEntity.ok(taskService.getWorkloadStatistics(
                    authenticatedUserHelper.requireActorEmail(authentication),
                    departmentId
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @GetMapping("/department/{deptId}")
    public ResponseEntity<?> getTasksByDepartment(
            @PathVariable String deptId,
            Authentication authentication) {
        try {
            return ResponseEntity.ok(taskService.getTasksByDepartment(
                    deptId,
                    authenticatedUserHelper.requireActorEmail(authentication)
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PostMapping("/{taskId}/checklist-items")
    public ResponseEntity<?> addChecklistItem(
            @PathVariable String taskId,
            Authentication authentication,
            @RequestBody Map<String, Object> payload) {
        try {
            ChecklistItem item = taskService.addChecklistItem(
                    taskId,
                    payload.get("title") != null ? payload.get("title").toString() : "",
                    authenticatedUserHelper.requireActorEmail(authentication)
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
            Authentication authentication,
            @RequestBody Map<String, Object> payload) {
        try {
            ChecklistItem item = taskService.updateChecklistItem(
                    taskId,
                    itemId,
                    payload,
                    authenticatedUserHelper.requireActorEmail(authentication)
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
            Authentication authentication,
            @RequestParam(required = false) String actorId) {
        try {
            return ResponseEntity.ok(taskService.deleteChecklistItem(taskId, itemId, authenticatedUserHelper.requireActorEmail(authentication)));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PostMapping("/{taskId}/attachments")
    public ResponseEntity<?> addTaskAttachment(
            @PathVariable String taskId,
            Authentication authentication,
            @RequestBody Map<String, Object> payload) {
        try {
            AttachmentInfo attachment = parseAttachment(payload);
            AttachmentInfo savedAttachment = taskService.addTaskAttachment(
                    taskId,
                    attachment,
                    authenticatedUserHelper.requireActorEmail(authentication)
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
            Authentication authentication,
            @RequestParam(required = false) String actorId) {
        try {
            return ResponseEntity.ok(taskService.deleteTaskAttachment(taskId, attachmentId, authenticatedUserHelper.requireActorEmail(authentication)));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @GetMapping("/{taskId}/activity")
    public ResponseEntity<?> getTaskActivity(
            @PathVariable String taskId,
            Authentication authentication) {
        try {
            List<TaskActivity> activity = taskService.getTaskActivity(taskId, authenticatedUserHelper.requireActorEmail(authentication));
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

    private Task toTask(CreateTaskRequest request) {
        Task task = new Task();
        task.setTitle(request.getTitle() != null ? request.getTitle().trim() : null);
        task.setDescription(request.getDescription() != null ? request.getDescription().trim() : null);
        task.setDeadline(request.getDeadline());
        task.setPriority(request.getPriority());
        return task;
    }
}
