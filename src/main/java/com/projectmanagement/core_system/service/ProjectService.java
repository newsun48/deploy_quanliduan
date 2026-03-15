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

@Service
public class ProjectService {

    @Autowired
    private ProjectRepository projectRepository;

    @Autowired
    private DepartmentRepository departmentRepository;

    @Autowired
    private UserRepository userRepository;

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

    // 2. Thêm thành viên vào dự án
    public Project addMember(String projectId, String userId) {
        System.out.println("🔵 [DEBUG] Thêm member: projectId=" + projectId + ", userId=" + userId);
        
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new RuntimeException("Dự án không tìm thấy!"));
        System.out.println("✅ [DEBUG] Found project: " + project.getName());

        // Check trạng thái trước khi thêm
        if (project.getStatus() == ProjectStatus.CLOSED) {
            throw new RuntimeException("Dự án đã đóng, không thể thêm thành viên!");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("Nhân viên không tìm thấy!"));
        System.out.println("✅ [DEBUG] Found user: " + user.getFullName());

        // Check cùng phòng ban
        String projectDeptId = project.getDepartment().getId();
        String userDeptId = (user.getDepartment() != null) ? user.getDepartment().getId() : null;
        System.out.println("🔍 [DEBUG] projectDeptId=" + projectDeptId + ", userDeptId=" + userDeptId);

        if (!projectDeptId.equals(userDeptId)) {
            throw new RuntimeException("LỖI: Nhân viên này thuộc phòng ban khác!");
        }

        // Check trùng lặp: Nếu user đã có trong list rồi thì thôi
        boolean exists = project.getMembers().stream().anyMatch(m -> m.getId().equals(userId));
        if (exists) {
            throw new RuntimeException("Nhân viên này đã tham gia dự án rồi!");
        }

        System.out.println("➕ [DEBUG] Adding member to project...");
        project.getMembers().add(user);
        Project saved = projectRepository.save(project);
        System.out.println("✅ [DEBUG] Member added successfully! Total members: " + saved.getMembers().size());
        
        return saved;
    }

    // 3. Lấy tất cả
    public List<Project> getAllProjects() {
        return projectRepository.findAll();
    }

    // 4. 🔥 MỚI: Tìm kiếm dự án
    public List<Project> searchProjects(String keyword) {
        if (keyword == null || keyword.trim().isEmpty()) {
            return getAllProjects();
        }
        return projectRepository.findByNameContainingIgnoreCase(keyword);
    }

    // 5. 🆕 Lấy các dự án mà người dùng có thể truy cập
    // Bao gồm: (1) Dự án user là thành viên, (2) Dự án user là trưởng phòng
    public List<Project> getAccessibleProjects(String userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("Người dùng không tồn tại!"));

        // Lấy tất cả dự án
        List<Project> allProjects = getAllProjects();
        
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
}