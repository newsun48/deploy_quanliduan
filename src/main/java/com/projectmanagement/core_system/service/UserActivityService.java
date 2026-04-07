package com.projectmanagement.core_system.service;

import com.projectmanagement.core_system.model.*;
import com.projectmanagement.core_system.repository.*;
import com.projectmanagement.core_system.enums.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDate;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class UserActivityService {

    @Autowired
    private UserActivityRepository userActivityRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private DepartmentRepository departmentRepository;

    @Autowired
    private ProjectRepository projectRepository;
    
    @Autowired
    private TaskRepository taskRepository;

    @Autowired
    private DepartmentQuarterlyOkrRepository departmentQuarterlyOkrRepository;

    @Autowired
    private ObjectMapper objectMapper;

    public UserActivity record(User actor, User targetUser, String type, String message) {
        return record(actor, targetUser, type, message, Map.of());
    }

    public UserActivity record(User actor, User targetUser, String type, String message, Map<String, Object> metadata) {
        UserActivity activity = new UserActivity();
        activity.setActorId(actor != null ? actor.getId() : null);
        activity.setActorName(actor != null ? actor.getFullName() : null);
        activity.setActorEmail(actor != null ? actor.getEmail() : null);
        activity.setTargetUserId(targetUser != null ? targetUser.getId() : null);
        activity.setTargetUserName(targetUser != null ? targetUser.getFullName() : null);
        activity.setTargetUserEmail(targetUser != null ? targetUser.getEmail() : null);
        activity.setType(type);
        activity.setMessage(message);
        activity.setMetadata(new HashMap<>(metadata));
        activity.setCreatedAt(LocalDateTime.now());
        return userActivityRepository.save(activity);
    }

    public List<UserActivity> getRecentActivities(String userId, int limit) {
        int safeLimit = Math.max(1, Math.min(limit, 200));
        if (userId == null || userId.isBlank()) {
            return userActivityRepository.findAllByOrderByCreatedAtDesc(PageRequest.of(0, safeLimit)).getContent();
        }

        return userActivityRepository.findByActorIdOrTargetUserIdOrderByCreatedAtDesc(userId, userId, PageRequest.of(0, safeLimit)).getContent();
    }

    public void undoActivity(String activityId) {
        UserActivity activity = userActivityRepository.findById(activityId)
                .orElseThrow(() -> new RuntimeException("Hoạt động không tồn tại!"));

        String type = activity.getType();
        Map<String, Object> metadata = activity.getMetadata();
        boolean changed = false;
        String undoType = "ACTIVITY_UNDO";
        String undoMessage = "Hoàn tác hoạt động: " + activity.getMessage();

        try {
            switch (type) {
                // --- USER ACTIONS ---
                case "USER_APPROVED":
                case "USER_REJECTED":
                    updateUserStatus(activity.getTargetUserId(), ApprovalStatus.PENDING, false);
                    changed = true;
                    break;

                case "USER_LOCKED":
                    updateUserActiveStatus(activity.getTargetUserId(), true);
                    changed = true;
                    break;

                case "USER_UNLOCKED":
                    updateUserActiveStatus(activity.getTargetUserId(), false);
                    changed = true;
                    break;

                case "USER_UPDATED":
                    revertUserUpdate(activity.getTargetUserId(), metadata);
                    changed = true;
                    break;

                case "MANAGER_HANDOFF_COMPLETED":
                    undoManagerHandoff(metadata);
                    revertUserUpdate(activity.getTargetUserId(), metadata);
                    changed = true;
                    break;

                case "USER_CREATED":
                case "USER_SIGNUP_PENDING":
                    userRepository.deleteById(activity.getTargetUserId());
                    changed = true;
                    break;

                case "USER_DELETED":
                    String userId = activity.getTargetUserId();
                    if (userId != null && userRepository.existsById(userId)) {
                        User u = userRepository.findById(userId).get();
                        u.setDeleted(false);
                        u.setDeletedAt(null);
                        userRepository.save(u);
                    } else {
                        restoreEntity(metadata, User.class, userRepository);
                    }
                    changed = true;
                    break;

                // --- PROJECT ACTIONS ---
                case "PROJECT_CREATED":
                    String createdProjectId = (String) metadata.get("projectId");
                    if (createdProjectId != null) {
                        projectRepository.deleteById(createdProjectId);
                        changed = true;
                    }
                    break;

                case "PROJECT_UPDATED":
                    revertProjectUpdate((String) metadata.get("projectId"), metadata);
                    changed = true;
                    break;

                case "PROJECT_DELETED":
                case "PROJECT_SOFT_DELETED":
                    String pId = (String) metadata.get("projectId");
                    if (pId != null && projectRepository.existsById(pId)) {
                        updateProjectDeleteStatus(pId, false);
                    } else {
                        restoreEntity(metadata, Project.class, projectRepository);
                    }
                    changed = true;
                    break;

                case "PROJECT_RESTORED":
                    updateProjectDeleteStatus((String) metadata.get("projectId"), true);
                    changed = true;
                    break;

                case "PROJECT_CLOSED":
                    updateProjectStatus((String) metadata.get("projectId"), ProjectStatus.OPEN);
                    changed = true;
                    break;

                case "PROJECT_MEMBER_ADDED":
                    toggleProjectMember((String) metadata.get("projectId"), (String) metadata.get("memberId"), false);
                    changed = true;
                    break;

                case "PROJECT_MEMBER_REMOVED":
                    toggleProjectMember((String) metadata.get("projectId"), (String) metadata.get("memberId"), true);
                    changed = true;
                    break;

                // --- DEPARTMENT ACTIONS ---
                case "DEPARTMENT_CREATED":
                    departmentRepository.deleteById((String) metadata.get("departmentId"));
                    changed = true;
                    break;

                case "DEPARTMENT_UPDATED":
                    revertDepartmentUpdate((String) metadata.get("departmentId"), metadata);
                    changed = true;
                    break;

                case "DEPARTMENT_DELETED":
                    String deptId = (String) metadata.get("departmentId");
                    if (deptId != null && departmentRepository.existsById(deptId)) {
                        Department d = departmentRepository.findById(deptId).get();
                        d.setDeleted(false);
                        d.setDeletedAt(null);
                        departmentRepository.save(d);
                    } else {
                        restoreEntity(metadata, Department.class, departmentRepository);
                    }
                    changed = true;
                    break;

                // --- TASK ACTIONS ---
                case "TASK_CREATED":
                    taskRepository.deleteById((String) metadata.get("taskId"));
                    changed = true;
                    break;

                case "TASK_STATUS_UPDATED":
                    updateTaskStatus((String) metadata.get("taskId"), (String) metadata.get("oldStatus"));
                    changed = true;
                    break;

                case "TASK_DELETED":
                    String taskId = (String) metadata.get("taskId");
                    if (taskId != null && taskRepository.existsById(taskId)) {
                        Task t = taskRepository.findById(taskId).get();
                        t.setDeleted(false);
                        t.setDeletedAt(null);
                        taskRepository.save(t);
                    } else {
                        restoreEntity(metadata, Task.class, taskRepository);
                    }
                    changed = true;
                    break;

                // --- OKR ACTIONS ---
                case "DEPARTMENT_OKR_UPSERTED":
                case "DEPARTMENT_OKR_KEY_RESULT_UPDATED":
                case "DEPARTMENT_OKR_REVIEW_UPDATED":
                    Object okrSnapshot = metadata.get("snapshot");
                    if ("NEW_OKR".equals(okrSnapshot)) {
                        departmentQuarterlyOkrRepository.deleteById((String) metadata.get("okrId"));
                    } else {
                        restoreEntity(metadata, DepartmentQuarterlyOkr.class, departmentQuarterlyOkrRepository);
                    }
                    changed = true;
                    break;

                case "LOGIN_SUCCESS":
                case "LOGIN_FAILED":
                case "LOGIN_BLOCKED":
                    throw new RuntimeException("Hoạt động đăng nhập không thể hoàn tác!");

                default:
                    throw new RuntimeException("Hệ thống chưa hỗ trợ hoàn tác cho loại hoạt động này: " + type);
            }
        } catch (Exception e) {
            throw new RuntimeException("Lỗi hoàn tác: " + e.getMessage(), e);
        }

        if (changed) {
            User actor = null;
            if (activity.getActorId() != null) {
                actor = userRepository.findById(activity.getActorId()).orElse(null);
            }
            User targetUser = null;
            if (activity.getTargetUserId() != null) {
                targetUser = userRepository.findById(activity.getTargetUserId()).orElse(null);
            }
            
            record(actor, targetUser, undoType, undoMessage, 
                Map.of("originalActivityId", activity.getId(), "originalType", activity.getType()));
        }
    }

    private void updateUserStatus(String userId, ApprovalStatus status, boolean active) {
        User user = userRepository.findById(userId).orElseThrow(() -> new RuntimeException("Người dùng không tồn tại!"));
        user.setApprovalStatus(status);
        user.setActive(active);
        user.setRejectionReason(null);
        userRepository.save(user);
    }

    private void updateUserActiveStatus(String userId, boolean active) {
        User user = userRepository.findById(userId).orElseThrow(() -> new RuntimeException("Người dùng không tồn tại!"));
        user.setActive(active);
        userRepository.save(user);
    }

    private void revertUserUpdate(String userId, Map<String, Object> metadata) {
        User user = userRepository.findById(userId).orElseThrow(() -> new RuntimeException("Người dùng không tồn tại!"));
        if (metadata.containsKey("oldEmail")) user.setEmail((String) metadata.get("oldEmail"));
        if (metadata.containsKey("oldRole")) user.setRole(ERole.valueOf((String) metadata.get("oldRole")));
        if (metadata.containsKey("oldDepartmentId")) {
            String oldDeptId = (String) metadata.get("oldDepartmentId");
            user.setDepartment(oldDeptId != null && !oldDeptId.isEmpty() ? departmentRepository.findById(oldDeptId).orElse(null) : null);
        }
        userRepository.save(user);
    }

    private void revertProjectUpdate(String projectId, Map<String, Object> metadata) {
        Project project = projectRepository.findById(projectId).orElseThrow(() -> new RuntimeException("Dự án không tồn tại!"));
        if (metadata.containsKey("oldName")) project.setName((String) metadata.get("oldName"));
        if (metadata.containsKey("oldDescription")) project.setDescription((String) metadata.get("oldDescription"));
        if (metadata.containsKey("oldStatus")) project.setStatus(ProjectStatus.valueOf((String) metadata.get("oldStatus")));
        if (metadata.containsKey("oldStartDate")) project.setStartDate(LocalDate.parse((String) metadata.get("oldStartDate")));
        if (metadata.containsKey("oldDeadline")) project.setDeadline(LocalDate.parse((String) metadata.get("oldDeadline")));
        projectRepository.save(project);
    }

    private void updateProjectDeleteStatus(String projectId, boolean deleted) {
        Project project = projectRepository.findById(projectId).orElseThrow(() -> new RuntimeException("Dự án không tồn tại!"));
        project.setDeleted(deleted);
        project.setDeletedAt(deleted ? LocalDate.now() : null);
        projectRepository.save(project);
    }

    private void updateProjectStatus(String projectId, ProjectStatus status) {
        Project project = projectRepository.findById(projectId).orElseThrow(() -> new RuntimeException("Dự án không tồn tại!"));
        project.setStatus(status);
        projectRepository.save(project);
    }

    private void toggleProjectMember(String projectId, String memberId, boolean add) {
        Project project = projectRepository.findById(projectId).orElseThrow(() -> new RuntimeException("Dự án không tồn tại!"));
        User member = userRepository.findById(memberId).orElseThrow(() -> new RuntimeException("Nhân viên không tồn tại!"));
        if (add) {
            if (project.getMembers().stream().noneMatch(m -> m.getId().equals(memberId))) {
                project.getMembers().add(member);
            }
        } else {
            project.getMembers().removeIf(m -> m.getId().equals(memberId));
        }
        projectRepository.save(project);
    }

    private void revertDepartmentUpdate(String deptId, Map<String, Object> metadata) {
        Department dept = departmentRepository.findById(deptId).orElseThrow(() -> new RuntimeException("Phòng ban không tồn tại!"));
        if (metadata.containsKey("oldName")) dept.setName((String) metadata.get("oldName"));
        if (metadata.containsKey("oldDescription")) dept.setDescription((String) metadata.get("oldDescription"));
        if (metadata.containsKey("oldManagerId")) {
            String oldManagerId = (String) metadata.get("oldManagerId");
            dept.setManager(oldManagerId != null && !oldManagerId.isEmpty() ? userRepository.findById(oldManagerId).orElse(null) : null);
        }
        departmentRepository.save(dept);
    }

    private void updateTaskStatus(String taskId, String statusStr) {
        Task task = taskRepository.findById(taskId).orElseThrow(() -> new RuntimeException("Công việc không tồn tại!"));
        task.setStatus(TaskStatus.valueOf(statusStr));
        taskRepository.save(task);
    }

    private <T> void restoreEntity(Map<String, Object> metadata, Class<T> clazz, org.springframework.data.mongodb.repository.MongoRepository<T, String> repository) {
        Object snapshot = metadata.get("snapshot");
        if (snapshot == null) {
            throw new RuntimeException("Không tìm thấy bản sao lưu (snapshot) để khôi phục và đối tượng không còn trong hệ thống!");
        }
        T entity = objectMapper.convertValue(snapshot, clazz);
        repository.save(entity);
    }

    private void undoManagerHandoff(Map<String, Object> metadata) {
        String successorId = (String) metadata.get("successorId");
        String oldManagerId = (String) metadata.get("oldManagerId");
        String deptId = (String) metadata.get("deptId");
        String successorOldRoleStr = (String) metadata.get("successorOldRole");

        if (successorId != null && successorOldRoleStr != null) {
            userRepository.findById(successorId).ifPresent(successor -> {
                successor.setRole(ERole.valueOf(successorOldRoleStr));
                userRepository.save(successor);
            });
        }

        if (deptId != null && oldManagerId != null) {
            departmentRepository.findById(deptId).ifPresent(dept -> {
                userRepository.findById(oldManagerId).ifPresent(oldManager -> {
                    dept.setManager(oldManager);
                    departmentRepository.save(dept);
                });
            });
        }
    }
}
