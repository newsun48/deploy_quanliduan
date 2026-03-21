package com.projectmanagement.core_system.controller;

import com.projectmanagement.core_system.enums.ProjectStatus;
import com.projectmanagement.core_system.model.Project;
import com.projectmanagement.core_system.repository.ProjectRepository;
import com.projectmanagement.core_system.service.ProjectService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/projects")
@CrossOrigin(origins = "http://localhost:5173")
public class ProjectController {

    @Autowired
    private ProjectService projectService;

    // 1. Tạo dự án
    @PostMapping("/create")
    public ResponseEntity<?> createProject(
            @RequestBody Project project,
            @RequestParam String deptId,
            @RequestParam String email) {
        try {
            project.setStatus(ProjectStatus.OPEN);
            return ResponseEntity.ok(projectService.createProject(project, deptId, email));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // 1b. Cập nhật dự án
    @PutMapping("/{id}/update")
    public ResponseEntity<?> updateProject(@PathVariable String id, @RequestBody Project projectDetails) {
        try {
            return ResponseEntity.ok(projectService.updateProject(id, projectDetails));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // 2. Thêm thành viên
    @PostMapping("/{projectId}/add-member/{userId}")
    public ResponseEntity<?> addMember(@PathVariable String projectId, @PathVariable String userId) {
        try {
            return ResponseEntity.ok(projectService.addMember(projectId, userId));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // 2b. Thêm NHIỀU thành viên (🔥 MỚI)
    @PostMapping("/{projectId}/add-members")
    public ResponseEntity<?> addMembers(@PathVariable String projectId, @RequestBody List<String> userIds) {
        try {
            return ResponseEntity.ok(projectService.addMembers(projectId, userIds));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // 3. Lấy tất cả
    @GetMapping
    public ResponseEntity<?> getAll() {
        try {
            return ResponseEntity.ok(projectService.getAllProjects());
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).body("Lỗi: " + e.getMessage());
        }
    }

    // 4. 🔥 API MỚI: Tìm kiếm dự án
    // GET /api/projects/search?keyword=abc
    @GetMapping("/search")
    public List<Project> search(@RequestParam String keyword) {
        return projectService.searchProjects(keyword);
    }

    // 4b. 🆕 Lấy các dự án mà người dùng có thể truy cập
    // GET /api/projects/accessible/{userId}
    @GetMapping("/accessible/{userId}")
    public ResponseEntity<?> getAccessibleProjects(@PathVariable String userId) {
        try {
            List<Project> projects = projectService.getAccessibleProjects(userId);
            return ResponseEntity.ok(projects);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // 5. Đóng dự án
    @PutMapping("/{id}/complete")
    public ResponseEntity<?> completeProject(@PathVariable String id) {
        try {
            projectService.completeProject(id);
            return ResponseEntity.ok("Dự án đã được đóng thành công!");
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // 6. Soft Delete Project (Admin only)
    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteProject(@PathVariable String id, @RequestParam String adminEmail) {
        try {
            return ResponseEntity.ok(projectService.softDelete(id, adminEmail));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // 7. Get deleted projects (Admin)
    @GetMapping("/deleted")
    public ResponseEntity<?> getDeletedProjects() {
        try {
            return ResponseEntity.ok(projectService.getDeletedProjects());
        } catch (Exception e) {
            return ResponseEntity.status(500).body("Lỗi: " + e.getMessage());
        }
    }

    // 8. Restore deleted project (Admin)
    @PostMapping("/{id}/restore")
    public ResponseEntity<?> restoreProject(@PathVariable String id, @RequestParam String adminEmail) {
        try {
            return ResponseEntity.ok(projectService.restoreProject(id, adminEmail));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
}
