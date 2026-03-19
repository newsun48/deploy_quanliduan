package com.projectmanagement.core_system.controller;

import com.projectmanagement.core_system.enums.TaskStatus;
import com.projectmanagement.core_system.model.Task;
import com.projectmanagement.core_system.service.TaskService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/tasks")
@CrossOrigin(origins = "http://localhost:5173") // Cho phép React gọi API
public class TaskController {

    @Autowired
    private TaskService taskService;

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

    // 4. 🔥 QUAN TRỌNG: Cập nhật Tiến độ & Trạng thái (Nhân viên dùng)
    @PutMapping("/{taskId}/status")
    public ResponseEntity<?> updateTaskStatus(
            @PathVariable String taskId,
            @RequestBody Map<String, Object> payload // Nhận JSON { "status": "DONE", "percent": 100 }
    ) {
        try {
            String statusStr = (String) payload.get("status");
            int percent = Integer.parseInt(payload.get("percent").toString());

            TaskStatus newStatus = TaskStatus.valueOf(statusStr); // Chuyển chuỗi thành Enum

            return ResponseEntity.ok(taskService.updateStatus(taskId, newStatus, percent));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("Lỗi cập nhật: " + e.getMessage());
        }
    }
}