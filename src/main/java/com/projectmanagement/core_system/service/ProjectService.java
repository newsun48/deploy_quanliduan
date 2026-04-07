package com.projectmanagement.core_system.service;

import com.projectmanagement.core_system.enums.ProjectStatus;
import com.projectmanagement.core_system.enums.TaskStatus;
import com.projectmanagement.core_system.enums.ERole;
import com.projectmanagement.core_system.model.Department;
import com.projectmanagement.core_system.model.Project;
import com.projectmanagement.core_system.model.User;
import com.projectmanagement.core_system.repository.DepartmentRepository;
import com.projectmanagement.core_system.repository.ProjectRepository;
import com.projectmanagement.core_system.repository.TaskRepository;
import com.projectmanagement.core_system.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.List;
import java.time.LocalDate;
import java.util.ArrayList;

@Service
public class ProjectService {

    @Autowired
    private ProjectRepository projectRepository;

    @Autowired
    private DepartmentRepository departmentRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private TaskRepository taskRepository;

    @Autowired
    private NotificationService notificationService;

    // 1. Tạo dự án mới
    public Project createProject(Project project, String departmentId, String creatorEmail) {
        // 🔥 Validate: Tên dự án không được để trống
        if (!StringUtils.hasText(project.getName())) {
            throw new RuntimeException("Tên dự án không được để trống!");
        }

        validateProjectDates(project.getStartDate(), project.getDeadline());

        Department dept = departmentRepository.findById(departmentId)
                .orElseThrow(() -> new RuntimeException("Phòng ban không tồn tại!"));

        User actor = requireActiveActor(creatorEmail);
        ensureDepartmentManagerOrAdmin(dept, actor);

        // Để MongoDB tự tạo ID
        project.setDepartment(dept);
        project.setCreatedBy(actor.getEmail());
        
        // Nếu chưa có status thì set mặc định OPEN
        if (project.getStatus() == null) {
            project.setStatus(ProjectStatus.OPEN); 
        }

        return projectRepository.save(project);
    }

    // 1b. Cập nhật dự án
    public Project updateProject(String id, Project updatedInfo, String actorEmail) {
        Project project = getMutableProject(id);
        ensureProjectManagerOrAdmin(project, actorEmail);

        LocalDate effectiveStartDate = updatedInfo.getStartDate() != null ? updatedInfo.getStartDate() : project.getStartDate();
        LocalDate effectiveDeadline = updatedInfo.getDeadline() != null ? updatedInfo.getDeadline() : project.getDeadline();
        validateProjectDatesForUpdate(project, updatedInfo, effectiveStartDate, effectiveDeadline);

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
    public Project addMember(String projectId, String userId, String actorEmail) {
        return addMembers(projectId, List.of(userId), actorEmail);
    }

    // 2b. Thêm nhiều thành viên vào dự án (🔥 MỚI)
    public Project addMembers(String projectId, List<String> userIds, String actorEmail) {
        Project project = getMutableProject(projectId);
        User actor = ensureProjectManagerOrAdmin(project, actorEmail);

        List<User> newMembers = new ArrayList<>();

        if (project.getDepartment() == null) {
            throw new RuntimeException("Dự án này không thuộc về phòng ban nào!");
        }
        User manager = project.getDepartment().getManager();
        String projectDeptId = project.getDepartment().getId();

        for (String userId : userIds) {
            User user = userRepository.findById(userId)
                    .orElseThrow(() -> new RuntimeException("Nhân viên " + userId + " không tìm thấy!"));

            if (manager != null && manager.getId() != null && manager.getId().equals(userId)) {
                throw new RuntimeException("Không thể thêm trưởng phòng vào danh sách thành viên dự án!");
            }

            // Check cùng phòng ban
            String userDeptId = (user.getDepartment() != null) ? user.getDepartment().getId() : null;
            if (!projectDeptId.equals(userDeptId)) {
                throw new RuntimeException("LỖI: Nhân viên " + user.getFullName() + " thuộc phòng ban khác!");
            }

            // Check trùng lặp
            boolean exists = project.getMembers().stream().anyMatch(m -> m.getId().equals(userId));
            if (!exists) {
                project.getMembers().add(user);
                newMembers.add(user);
            }
        }

        Project saved = projectRepository.save(project);

        for (User newMember : newMembers) {
            String message = "Bạn đã được thêm vào dự án: " + project.getName();
            notificationService.createNotification(newMember, actor, null, message, "PROJECT_JOINED");
        }

        // Broadcast real-time update to the department topic (🔥 MỚI)
        if (projectDeptId != null) {
            notificationService.sendRealTimeUpdate("/topic/department/" + projectDeptId + "/update", "REFRESH_PROJECTS");
        }

        return saved;
    }

    // 2c. Bỏ thành viên ra khỏi dự án
    public Project removeMember(String projectId, String userId, String actorEmail) {
        Project project = getMutableProject(projectId);
        User actor = ensureProjectManagerOrAdmin(project, actorEmail);

        User userToRemove = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("Nhân viên không tồn tại!"));

        // Kiểm tra xem nhân viên có trong dự án không
        boolean exists = project.getMembers().removeIf(m -> m.getId().equals(userId));
        if (!exists) {
            throw new RuntimeException("Nhân viên này không có trong dự án!");
        }

        Project saved = projectRepository.save(project);

        // Gửi thông báo
        String message = "Bạn đã bị xóa khỏi dự án: " + project.getName() + 
                         (userToRemove.isActive() ? "" : " (tài khoản bị khóa)");
        notificationService.createNotification(userToRemove, actor, null, message, "PROJECT_REMOVED");

        // Broadcast real-time update to the department topic
        String projectDeptId = (project.getDepartment() != null) ? project.getDepartment().getId() : null;
        if (projectDeptId != null) {
            notificationService.sendRealTimeUpdate("/topic/department/" + projectDeptId + "/update", "REFRESH_PROJECTS");
        }

        return saved;
    }

    // 2d. Bỏ NHIỀU thành viên ra khỏi dự án
    public Project removeMembers(String projectId, List<String> userIds, String actorEmail) {
        Project project = getMutableProject(projectId);
        User actor = ensureProjectManagerOrAdmin(project, actorEmail);

        List<User> removedMembers = new ArrayList<>();

        for (String userId : userIds) {
            User user = userRepository.findById(userId)
                    .orElseThrow(() -> new RuntimeException("Nhân viên " + userId + " không tồn tại!"));

            boolean removed = project.getMembers().removeIf(m -> m.getId().equals(userId));
            if (removed) {
                removedMembers.add(user);
            }
        }

        if (removedMembers.isEmpty()) {
            throw new RuntimeException("Không tìm thấy nhân viên nào để xóa!");
        }

        Project saved = projectRepository.save(project);

        // Gửi thông báo cho các nhân viên bị xóa
        for (User removedMember : removedMembers) {
            String message = "Bạn đã bị xóa khỏi dự án: " + project.getName() + 
                             (removedMember.isActive() ? "" : " (tài khoản bị khóa)");
            notificationService.createNotification(removedMember, actor, null, message, "PROJECT_REMOVED");
        }

        // Broadcast real-time update
        String projectDeptId = (project.getDepartment() != null) ? project.getDepartment().getId() : null;
        if (projectDeptId != null) {
            notificationService.sendRealTimeUpdate("/topic/department/" + projectDeptId + "/update", "REFRESH_PROJECTS");
        }

        return saved;
    }

    // 3. Lấy tất cả
    public List<Project> getAllProjects(String actorEmail) {
        User actor = requireActiveActor(actorEmail);
        if (actor.getRole() == ERole.ADMIN) {
            return projectRepository.findByIsDeletedFalse();
        }
        return getAccessibleProjects(actor.getId(), actor.getEmail());
    }

    // 3b. Đóng dự án
    public void completeProject(String projectId, String actorEmail) {
        Project project = getMutableProject(projectId);
        User actor = ensureProjectManagerOrAdmin(project, actorEmail);

        List<com.projectmanagement.core_system.model.Task> projectTasks = taskRepository.findByProject_Id(projectId);
        boolean hasIncompleteTasks = projectTasks.stream().anyMatch(task ->
                task.getStatus() != TaskStatus.DONE || task.getCompletionPercentage() < 100
        );
        if (hasIncompleteTasks) {
            throw new RuntimeException("Không thể hoàn thành dự án khi vẫn còn task chưa hoàn tất. Vui lòng xử lý xong toàn bộ task trước!");
        }

        project.setStatus(ProjectStatus.CLOSED);
        projectRepository.save(project);

        // 🔥 Bắn thông báo: Dự án đóng cho tất cả thành viên
        String message = "Dự án '" + project.getName() + "' đã hoàn thành và chính thức đóng lại!";
        
        for (User member : project.getMembers()) {
            notificationService.createNotification(member, actor, null, message, "PROJECT_CLOSED");
        }
    }

    // 4. 🔥 MỚI: Tìm kiếm dự án
    public List<Project> searchProjects(String keyword, String actorEmail) {
        if (keyword == null || keyword.trim().isEmpty()) {
            return getAllProjects(actorEmail);
        }
        User actor = requireActiveActor(actorEmail);
        if (actor.getRole() == ERole.ADMIN) {
            return projectRepository.findByIsDeletedFalseAndNameContainingIgnoreCase(keyword);
        }

        String normalizedKeyword = keyword.trim().toLowerCase();
        return getAccessibleProjects(actor.getId(), actor.getEmail())
                .stream()
                .filter(project -> project.getName() != null && project.getName().toLowerCase().contains(normalizedKeyword))
                .toList();
    }

    // 5. 🆕 Lấy các dự án mà người dùng có thể truy cập
    // Bao gồm: (1) Dự án user là thành viên, (2) Dự án user là trưởng phòng
    public List<Project> getAccessibleProjects(String userId, String actorEmail) {
        User actor = requireActiveActor(actorEmail);
        if (!actor.getId().equals(userId)) {
            throw new AccessDeniedException("Bạn không có quyền xem danh sách dự án của người dùng khác!");
        }

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
    public List<Project> getDeletedProjects(String actorEmail) {
        requireAdminActor(actorEmail);
        return projectRepository.findByIsDeletedTrue();
    }

    // Get deleted projects by department
    public List<Project> getDeletedProjectsByDept(String deptId) {
        return projectRepository.findByIsDeletedTrueAndDepartment_Id(deptId);
    }

    // Restore deleted project
    public Project restoreProject(String projectId, String adminEmail) {
        requireAdminActor(adminEmail);
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
        requireAdminActor(adminEmail);
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new RuntimeException("Dự án không tồn tại!"));
        
        if (project.isDeleted()) {
            throw new RuntimeException("Dự án đã bị xóa rồi!");
        }

        if (taskRepository.existsByProject_Id(projectId)) {
            throw new RuntimeException("Không thể xóa dự án này vì vẫn còn task đang thuộc dự án. Vui lòng xóa hoặc xử lý toàn bộ task trước khi xóa dự án!");
        }
        
        project.setDeleted(true);
        project.setDeletedAt(LocalDate.now());
        return projectRepository.save(project);
    }

    private Project getMutableProject(String projectId) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new RuntimeException("Dự án không tồn tại!"));

        if (project.isDeleted()) {
            throw new RuntimeException("Dự án đã bị xóa và không thể chỉnh sửa!");
        }
        if (project.getStatus() == ProjectStatus.CLOSED) {
            throw new RuntimeException("Dự án đã đóng, không thể thực hiện thao tác này!");
        }

        return project;
    }

    private User requireActiveActor(String actorEmail) {
        if (!StringUtils.hasText(actorEmail)) {
            throw new AccessDeniedException("Thiếu thông tin người dùng thực hiện!");
        }

        User actor = userRepository.findByEmailIgnoreCase(actorEmail.trim().toLowerCase())
                .orElseThrow(() -> new AccessDeniedException("Người dùng thực hiện không tồn tại!"));

        if (!actor.isActive()) {
            throw new AccessDeniedException("Tài khoản của bạn đang bị khóa!");
        }

        return actor;
    }

    private User requireAdminActor(String actorEmail) {
        User actor = requireActiveActor(actorEmail);
        if (actor.getRole() != ERole.ADMIN) {
            throw new AccessDeniedException("Bạn không có quyền thực hiện thao tác này!");
        }
        return actor;
    }

    private User ensureDepartmentManagerOrAdmin(Department department, User actor) {
        if (actor.getRole() == ERole.ADMIN) {
            return actor;
        }

        User manager = department != null ? department.getManager() : null;
        if (actor.getRole() != ERole.MANAGER || manager == null || manager.getId() == null || !manager.getId().equals(actor.getId())) {
            throw new AccessDeniedException("Bạn không có quyền quản lý dự án của phòng ban này!");
        }

        return actor;
    }

    private User ensureProjectManagerOrAdmin(Project project, String actorEmail) {
        User actor = requireActiveActor(actorEmail);
        Department department = project.getDepartment();
        if (department == null) {
            throw new RuntimeException("Dự án này không thuộc về phòng ban nào!");
        }
        return ensureDepartmentManagerOrAdmin(department, actor);
    }

    private void validateProjectDates(LocalDate startDate, LocalDate deadline) {
        LocalDate today = LocalDate.now();

        if (startDate != null && startDate.isBefore(today)) {
            throw new RuntimeException("Ngày bắt đầu dự án không được ở quá khứ!");
        }

        if (deadline != null && deadline.isBefore(today)) {
            throw new RuntimeException("Hạn cuối dự án không được ở quá khứ!");
        }

        if (startDate != null && deadline != null && deadline.isBefore(startDate)) {
            throw new RuntimeException("Hạn cuối dự án không được sớm hơn ngày bắt đầu!");
        }
    }

    private void validateProjectDatesForUpdate(Project currentProject, Project updatedInfo, LocalDate effectiveStartDate, LocalDate effectiveDeadline) {
        LocalDate today = LocalDate.now();

        if (updatedInfo.getStartDate() != null && updatedInfo.getStartDate().isBefore(today)) {
            throw new RuntimeException("Ngày bắt đầu dự án không được ở quá khứ!");
        }

        if (updatedInfo.getDeadline() != null && updatedInfo.getDeadline().isBefore(today)) {
            throw new RuntimeException("Hạn cuối dự án không được ở quá khứ!");
        }

        boolean dateChanged = updatedInfo.getStartDate() != null || updatedInfo.getDeadline() != null;
        boolean legacyPastDatesUnchanged = currentProject.getStartDate() != null && currentProject.getStartDate().isBefore(today)
                || currentProject.getDeadline() != null && currentProject.getDeadline().isBefore(today);

        if (dateChanged || !legacyPastDatesUnchanged) {
            if (effectiveStartDate != null && effectiveStartDate.isBefore(today)) {
                throw new RuntimeException("Ngày bắt đầu dự án không được ở quá khứ!");
            }

            if (effectiveDeadline != null && effectiveDeadline.isBefore(today)) {
                throw new RuntimeException("Hạn cuối dự án không được ở quá khứ!");
            }
        }

        if (effectiveStartDate != null && effectiveDeadline != null && effectiveDeadline.isBefore(effectiveStartDate)) {
            throw new RuntimeException("Hạn cuối dự án không được sớm hơn ngày bắt đầu!");
        }
    }
}
