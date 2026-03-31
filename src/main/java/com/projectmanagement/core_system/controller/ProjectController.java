package com.projectmanagement.core_system.controller;

import com.projectmanagement.core_system.enums.ProjectStatus;
import com.projectmanagement.core_system.model.Project;
import com.projectmanagement.core_system.repository.ProjectRepository;
import com.projectmanagement.core_system.service.ProjectService;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
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
            Authentication authentication) {
        try {
            project.setStatus(ProjectStatus.OPEN);
            return ResponseEntity.ok(projectService.createProject(project, deptId, authentication.getName()));
        } catch (AccessDeniedException e) {
            return ResponseEntity.status(403).body(e.getMessage());
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // 1b. Cập nhật dự án
    @PutMapping("/{id}/update")
    public ResponseEntity<?> updateProject(@PathVariable String id, @RequestBody Project projectDetails, Authentication authentication) {
        try {
            return ResponseEntity.ok(projectService.updateProject(id, projectDetails, authentication.getName()));
        } catch (AccessDeniedException e) {
            return ResponseEntity.status(403).body(e.getMessage());
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // 2. Thêm thành viên
    @PostMapping("/{projectId}/add-member/{userId}")
    public ResponseEntity<?> addMember(@PathVariable String projectId, @PathVariable String userId, Authentication authentication) {
        try {
            return ResponseEntity.ok(projectService.addMember(projectId, userId, authentication.getName()));
        } catch (AccessDeniedException e) {
            return ResponseEntity.status(403).body(e.getMessage());
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // 2b. Thêm NHIỀU thành viên (🔥 MỚI)
    @PostMapping("/{projectId}/add-members")
    public ResponseEntity<?> addMembers(@PathVariable String projectId, @RequestBody List<String> userIds, Authentication authentication) {
        try {
            return ResponseEntity.ok(projectService.addMembers(projectId, userIds, authentication.getName()));
        } catch (AccessDeniedException e) {
            return ResponseEntity.status(403).body(e.getMessage());
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // 3. Lấy tất cả
    @GetMapping
    public ResponseEntity<?> getAll(Authentication authentication) {
        try {
            return ResponseEntity.ok(projectService.getAllProjects(authentication.getName()));
        } catch (AccessDeniedException e) {
            return ResponseEntity.status(403).body(e.getMessage());
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).body("Lỗi: " + e.getMessage());
        }
    }

    // 4. 🔥 API MỚI: Tìm kiếm dự án
    // GET /api/projects/search?keyword=abc
    @GetMapping("/search")
    public ResponseEntity<?> search(@RequestParam String keyword, Authentication authentication) {
        try {
            return ResponseEntity.ok(projectService.searchProjects(keyword, authentication.getName()));
        } catch (AccessDeniedException e) {
            return ResponseEntity.status(403).body(e.getMessage());
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // 4b. 🆕 Lấy các dự án mà người dùng có thể truy cập
    // GET /api/projects/accessible/{userId}
    @GetMapping("/accessible/{userId}")
    public ResponseEntity<?> getAccessibleProjects(@PathVariable String userId, Authentication authentication) {
        try {
            List<Project> projects = projectService.getAccessibleProjects(userId, authentication.getName());
            return ResponseEntity.ok(projects);
        } catch (AccessDeniedException e) {
            return ResponseEntity.status(403).body(e.getMessage());
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // 5. Đóng dự án
    @PutMapping("/{id}/complete")
    public ResponseEntity<?> completeProject(@PathVariable String id, Authentication authentication) {
        try {
            projectService.completeProject(id, authentication.getName());
            return ResponseEntity.ok("Dự án đã được đóng thành công!");
        } catch (AccessDeniedException e) {
            return ResponseEntity.status(403).body(e.getMessage());
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // 6. Soft Delete Project (Admin only)
    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteProject(@PathVariable String id, Authentication authentication) {
        try {
            return ResponseEntity.ok(projectService.softDelete(id, authentication.getName()));
        } catch (AccessDeniedException e) {
            return ResponseEntity.status(403).body(e.getMessage());
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // 7. Get deleted projects (Admin)
    @GetMapping("/deleted")
    public ResponseEntity<?> getDeletedProjects(Authentication authentication) {
        try {
            return ResponseEntity.ok(projectService.getDeletedProjects(authentication.getName()));
        } catch (AccessDeniedException e) {
            return ResponseEntity.status(403).body(e.getMessage());
        } catch (Exception e) {
            return ResponseEntity.status(500).body("Lỗi: " + e.getMessage());
        }
    }

    // 8. Restore deleted project (Admin)
    @PostMapping("/{id}/restore")
    public ResponseEntity<?> restoreProject(@PathVariable String id, Authentication authentication) {
        try {
            return ResponseEntity.ok(projectService.restoreProject(id, authentication.getName()));
        } catch (AccessDeniedException e) {
            return ResponseEntity.status(403).body(e.getMessage());
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
}
