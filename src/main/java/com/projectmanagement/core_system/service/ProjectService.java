package com.projectmanagement.core_system.service;

import com.projectmanagement.core_system.enums.ProjectStatus;
import com.projectmanagement.core_system.model.Department;
import com.projectmanagement.core_system.model.Project;
import com.projectmanagement.core_system.model.User;
import com.projectmanagement.core_system.repository.DepartmentRepository;
import com.projectmanagement.core_system.repository.ProjectRepository;
import com.projectmanagement.core_system.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.List;
import java.time.LocalDate;

@Service
public class ProjectService {

    @Autowired
    private ProjectRepository projectRepository;

    @Autowired
    private DepartmentRepository departmentRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private NotificationService notificationService;

    // 1. Tạo dự án mới
    public Project createProject(Project project, String departmentId, String creatorEmail) {
        // 🔥 Validate: Tên dự án không được để trống
        if (!StringUtils.hasText(project.getName())) {
            throw new RuntimeException("Tên dự án không được để trống!");
        }

        Department dept = departmentRepository.findById(departmentId)
                .orElseThrow(() -> new RuntimeException("Phòng ban không tồn tại!"));

        // Để MongoDB tự tạo ID
        project.setDepartment(dept);
        project.setCreatedBy(creatorEmail);
        
        // Nếu chưa có status thì set mặc định OPEN
        if (project.getStatus() == null) {
            project.setStatus(ProjectStatus.OPEN); 
        }

        return projectRepository.save(project);
    }

    // 1b. Cập nhật dự án
    public Project updateProject(String id, Project updatedInfo) {
        Project project = projectRepository.findById(id).orElseThrow(() -> new RuntimeException("Dự án không tồn tại!"));
        if (StringUtils.hasText(updatedInfo.getName())) {
            project.setName(updatedInfo.getName());
        }
        if (StringUtils.hasText(updatedInfo.getDescription())) {
            project.setDescription(updatedInfo.getDescription());
        }
        if (updatedInfo.getStartDate() != null) {
            project.setStartDate(updatedInfo.getStartDate());
        }
        if (updatedInfo.getDeadline() != null) {
            project.setDeadline(updatedInfo.getDeadline());
        }
        if (updatedInfo.getDocumentLink() != null) {
            project.setDocumentLink(updatedInfo.getDocumentLink());
        }
        return projectRepository.save(project);
    }

    // 2. Thêm thành viên vào dự án
    public Project addMember(String projectId, String userId) {
        return addMembers(projectId, List.of(userId));
    }

    // 2b. Thêm nhiều thành viên vào dự án (🔥 MỚI)
    public Project addMembers(String projectId, List<String> userIds) {
        System.out.println("🔵 [DEBUG] Thêm nhiều members: projectId=" + projectId + ", userIds=" + userIds);

        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new RuntimeException("Dự án không tìm thấy!"));

        if (project.getStatus() == ProjectStatus.CLOSED) {
            throw new RuntimeException("Dự án đã đóng, không thể thêm thành viên!");
        }

        if (project.getDepartment() == null) {
            throw new RuntimeException("Dự án này không thuộc về phòng ban nào!");
        }
        User manager = project.getDepartment().getManager();
        String projectDeptId = project.getDepartment().getId();

        for (String userId : userIds) {
            User user = userRepository.findById(userId)
                    .orElseThrow(() -> new RuntimeException("Nhân viên " + userId + " không tìm thấy!"));

            // Check cùng phòng ban
            String userDeptId = (user.getDepartment() != null) ? user.getDepartment().getId() : null;
            if (!projectDeptId.equals(userDeptId)) {
                throw new RuntimeException("LỖI: Nhân viên " + user.getFullName() + " thuộc phòng ban khác!");
            }

            // Check trùng lặp
            boolean exists = project.getMembers().stream().anyMatch(m -> m.getId().equals(userId));
            if (!exists) {
                project.getMembers().add(user);
                // Bắn thông báo
                String message = "Bạn đã được thêm vào dự án: " + project.getName();
                notificationService.createNotification(user, manager, null, message, "PROJECT_JOINED");
            }
        }

        Project saved = projectRepository.save(project);

        // Broadcast real-time update to the department topic (🔥 MỚI)
        if (projectDeptId != null) {
            notificationService.sendRealTimeUpdate("/topic/department/" + projectDeptId + "/update", "REFRESH_PROJECTS");
        }

        return saved;
    }

    // 3. Lấy tất cả
    public List<Project> getAllProjects() {
        return projectRepository.findByIsDeletedFalse();
    }

    // 3b. Đóng dự án
    public void completeProject(String projectId) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new RuntimeException("Dự án không tồn tại!"));

        if (project.getStatus() == ProjectStatus.CLOSED) {
            throw new RuntimeException("Dự án đã đóng rồi!");
        }

        project.setStatus(ProjectStatus.CLOSED);
        projectRepository.save(project);

        // 🔥 Bắn thông báo: Dự án đóng cho tất cả thành viên
        User manager = project.getDepartment() != null ? project.getDepartment().getManager() : null;
        String message = "Dự án '" + project.getName() + "' đã hoàn thành và chính thức đóng lại!";
        
        for (User member : project.getMembers()) {
            notificationService.createNotification(member, manager, null, message, "PROJECT_CLOSED");
        }
    }

    // 4. 🔥 MỚI: Tìm kiếm dự án
    public List<Project> searchProjects(String keyword) {
        if (keyword == null || keyword.trim().isEmpty()) {
            return getAllProjects();
        }
        return projectRepository.findByIsDeletedFalseAndNameContainingIgnoreCase(keyword);
    }

    // 5. 🆕 Lấy các dự án mà người dùng có thể truy cập
    // Bao gồm: (1) Dự án user là thành viên, (2) Dự án user là trưởng phòng
    public List<Project> getAccessibleProjects(String userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("Người dùng không tồn tại!"));

        // Lấy tất cả dự án chưa xóa
        List<Project> allProjects = projectRepository.findByIsDeletedFalse();
        
        // Lọc các dự án mà user có thể truy cập
        return allProjects.stream()
                .filter(project -> {
                    // 1. User là thành viên dự án
                    boolean isMember = project.getMembers().stream()
                            .anyMatch(member -> member.getId().equals(userId));
                    if (isMember) {
                        return true;
                    }

                    // 2. User là trưởng phòng của phòng ban chứa dự án
                    if (project.getDepartment() != null && 
                        project.getDepartment().getManager() != null &&
                        project.getDepartment().getManager().getId().equals(userId)) {
                        return true;
                    }

                    return false;
                })
                .toList();
    }

    // Get deleted projects (Admin)
    public List<Project> getDeletedProjects() {
        return projectRepository.findByIsDeletedTrue();
    }

    // Get deleted projects by department
    public List<Project> getDeletedProjectsByDept(String deptId) {
        return projectRepository.findByIsDeletedTrueAndDepartment_Id(deptId);
    }

    // Restore deleted project
    public Project restoreProject(String projectId, String adminEmail) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new RuntimeException("Dự án không tồn tại!"));
        
        if (!project.isDeleted()) {
            throw new RuntimeException("Dự án không nằm trong thùng rác!");
        }
        
        project.setDeleted(false);
        project.setDeletedAt(null);
        return projectRepository.save(project);
    }

    // Soft delete project (Admin only)
    public Project softDelete(String projectId, String adminEmail) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new RuntimeException("Dự án không tồn tại!"));
        
        if (project.isDeleted()) {
            throw new RuntimeException("Dự án đã bị xóa rồi!");
        }
        
        project.setDeleted(true);
        project.setDeletedAt(LocalDate.now());
        return projectRepository.save(project);
    }
}
