package com.projectmanagement.core_system.controller;

import com.projectmanagement.core_system.model.Project;
import com.projectmanagement.core_system.service.ProjectService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProjectControllerTest {

    @Mock
    private ProjectService projectService;

    @InjectMocks
    private ProjectController projectController;

    @Test
    void createProject_usesAuthenticatedActorEmail() {
        Authentication authentication = mock(Authentication.class);
        Project project = new Project();

        when(authentication.getName()).thenReturn("manager@example.com");
        when(projectService.createProject(any(Project.class), eq("dept-1"), eq("manager@example.com"))).thenReturn(project);

        ResponseEntity<?> response = projectController.createProject(project, "dept-1", authentication);

        assertEquals(200, response.getStatusCode().value());
        verify(projectService).createProject(project, "dept-1", "manager@example.com");
    }

    @Test
    void updateProject_returnsForbiddenOnAccessDenied() {
        Authentication authentication = mock(Authentication.class);
        Project project = new Project();
        when(authentication.getName()).thenReturn("employee@example.com");
        when(projectService.updateProject("project-1", project, "employee@example.com"))
                .thenThrow(new AccessDeniedException("Bạn không có quyền quản lý dự án của phòng ban này!"));

        ResponseEntity<?> response = projectController.updateProject("project-1", project, authentication);

        assertEquals(403, response.getStatusCode().value());
        assertEquals("Bạn không có quyền quản lý dự án của phòng ban này!", response.getBody());
    }

    @Test
    void addMembers_returnsForbiddenOnAccessDenied() {
        Authentication authentication = mock(Authentication.class);
        when(authentication.getName()).thenReturn("employee@example.com");
        when(projectService.addMembers("project-1", java.util.List.of("user-1"), "employee@example.com"))
                .thenThrow(new AccessDeniedException("Bạn không có quyền quản lý dự án của phòng ban này!"));

        ResponseEntity<?> response = projectController.addMembers("project-1", java.util.List.of("user-1"), authentication);

        assertEquals(403, response.getStatusCode().value());
        assertEquals("Bạn không có quyền quản lý dự án của phòng ban này!", response.getBody());
    }

    @Test
    void deleteProject_returnsForbiddenOnAccessDenied() {
        Authentication authentication = mock(Authentication.class);
        when(authentication.getName()).thenReturn("manager@example.com");
        when(projectService.softDelete("project-1", "manager@example.com"))
                .thenThrow(new AccessDeniedException("Bạn không có quyền thực hiện thao tác này!"));

        ResponseEntity<?> response = projectController.deleteProject("project-1", authentication);

        assertEquals(403, response.getStatusCode().value());
        assertEquals("Bạn không có quyền thực hiện thao tác này!", response.getBody());
    }

    @Test
    void updateProject_returnsBadRequestOnPastDateBusinessError() {
        Authentication authentication = mock(Authentication.class);
        Project project = new Project();
        when(authentication.getName()).thenReturn("manager@example.com");
        when(projectService.updateProject("project-1", project, "manager@example.com"))
                .thenThrow(new RuntimeException("Ngày bắt đầu dự án không được ở quá khứ!"));

        ResponseEntity<?> response = projectController.updateProject("project-1", project, authentication);

        assertEquals(400, response.getStatusCode().value());
        assertEquals("Ngày bắt đầu dự án không được ở quá khứ!", response.getBody());
    }

    @Test
    void deleteProject_returnsBadRequestWhenProjectStillHasTasks() {
        Authentication authentication = mock(Authentication.class);
        when(authentication.getName()).thenReturn("admin@example.com");
        when(projectService.softDelete("project-1", "admin@example.com"))
                .thenThrow(new RuntimeException("Không thể xóa dự án này vì vẫn còn task đang thuộc dự án. Vui lòng xóa hoặc xử lý toàn bộ task trước khi xóa dự án!"));

        ResponseEntity<?> response = projectController.deleteProject("project-1", authentication);

        assertEquals(400, response.getStatusCode().value());
        assertEquals("Không thể xóa dự án này vì vẫn còn task đang thuộc dự án. Vui lòng xóa hoặc xử lý toàn bộ task trước khi xóa dự án!", response.getBody());
    }

    @Test
    void getAccessibleProjects_returnsForbiddenOnAccessDenied() {
        Authentication authentication = mock(Authentication.class);
        when(authentication.getName()).thenReturn("employee@example.com");
        when(projectService.getAccessibleProjects("user-2", "employee@example.com"))
                .thenThrow(new AccessDeniedException("Bạn không có quyền xem danh sách dự án của người dùng khác!"));

        ResponseEntity<?> response = projectController.getAccessibleProjects("user-2", authentication);

        assertEquals(403, response.getStatusCode().value());
        assertEquals("Bạn không có quyền xem danh sách dự án của người dùng khác!", response.getBody());
    }

    @Test
    void getAll_usesAuthenticatedActorEmail() {
        Authentication authentication = mock(Authentication.class);
        when(authentication.getName()).thenReturn("admin@example.com");
        when(projectService.getAllProjects("admin@example.com")).thenReturn(java.util.List.of());

        ResponseEntity<?> response = projectController.getAll(authentication);

        assertEquals(200, response.getStatusCode().value());
        verify(projectService).getAllProjects("admin@example.com");
    }
}
