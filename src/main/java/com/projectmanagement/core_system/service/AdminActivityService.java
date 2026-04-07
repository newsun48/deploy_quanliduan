package com.projectmanagement.core_system.service;

import com.projectmanagement.core_system.model.*;
import com.projectmanagement.core_system.repository.*;
import com.projectmanagement.core_system.enums.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class AdminActivityService {

    @Autowired
    private AdminActivityRepository adminActivityRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private DepartmentRepository departmentRepository;

    @Autowired
    private ProjectRepository projectRepository;

    @Autowired
    private TaskRepository taskRepository;

    // Record admin activity with undo support
    public AdminActivity recordActivity(User actor, String type, String entityType, String entityId, 
                                      String message, Map<String, Object> previousState, 
                                      Map<String, Object> newState, boolean undoable) {
        AdminActivity activity = new AdminActivity();
        activity.setActorId(actor != null ? actor.getId() : null);
        activity.setActorName(actor != null ? actor.getFullName() : null);
        activity.setActorEmail(actor != null ? actor.getEmail() : null);
        activity.setType(type);
        activity.setEntityType(entityType);
        activity.setEntityId(entityId);
        activity.setMessage(message);
        activity.setPreviousState(new HashMap<>(previousState != null ? previousState : Map.of()));
        activity.setNewState(new HashMap<>(newState != null ? newState : Map.of()));
        activity.setUndoable(undoable);
        activity.setCreatedAt(LocalDateTime.now());
        
        return adminActivityRepository.save(activity);
    }

    // Get recent activities with pagination
    public Page<AdminActivity> getRecentActivities(int page, int size) {
        return adminActivityRepository.findAllByOrderByCreatedAtDesc(PageRequest.of(page, size));
    }

    // Get undoable activities
    public Page<AdminActivity> getUndoableActivities(int page, int size) {
        return adminActivityRepository.findByUndoableAndUndoneOrderByCreatedAtDesc(true, false, PageRequest.of(page, size));
    }

    // Get activities for specific entity
    public List<AdminActivity> getEntityActivities(String entityType, String entityId) {
        return adminActivityRepository.findByEntityTypeAndEntityIdOrderByCreatedAtDesc(entityType, entityId);
    }

    public void undoActivity(String activityId, User undoActor) {
        AdminActivity activity = adminActivityRepository.findById(activityId)
                .orElseThrow(() -> new RuntimeException("Hoạt động không tồn tại!"));

        if (!activity.isUndoable()) {
            throw new RuntimeException("Hoạt động này không thể hoàn tác!");
        }

        if (activity.isUndone()) {
            throw new RuntimeException("Hoạt động này đã được hoàn tác trước đó!");
        }

        // Perform undo based on activity type
        performUndo(activity);

        // Mark as undone
        activity.setUndone(true);
        activity.setUndoneBy(undoActor != null ? undoActor.getFullName() : "Hệ thống");
        activity.setUndoneAt(LocalDateTime.now());
        adminActivityRepository.save(activity);

        // Record the undo action
        recordActivity(undoActor, "ACTIVITY_UNDO", activity.getEntityType(), activity.getEntityId(),
                (undoActor != null ? undoActor.getFullName() : "Hệ thống") + " đã hoàn tác: " + activity.getMessage(),
                Map.of("originalActivityId", activity.getId(), "originalType", activity.getType()),
                Map.of(), false);
    }

    private void performUndo(AdminActivity activity) {
        String entityType = activity.getEntityType();
        String entityId = activity.getEntityId();
        Map<String, Object> previousState = activity.getPreviousState();

        switch (entityType) {
            case "USER":
                undoUserActivity(activity, entityId, previousState);
                break;
            case "DEPARTMENT":
                undoDepartmentActivity(activity, entityId, previousState);
                break;
            case "PROJECT":
                undoProjectActivity(activity, entityId, previousState);
                break;
            case "TASK":
                undoTaskActivity(activity, entityId, previousState);
                break;
            default:
                throw new RuntimeException("Không hỗ trợ hoàn tác cho loại entity: " + entityType);
        }
    }

    private void undoUserActivity(AdminActivity activity, String userId, Map<String, Object> previousState) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("Người dùng không tồn tại!"));

        String activityType = activity.getType();
        
        switch (activityType) {
            case "USER_CREATED":
                // For created users, we soft delete them
                user.setActive(false);
                user.setApprovalStatus(ApprovalStatus.REJECTED);
                user.setRejectionReason("Hoàn tác tạo tài khoản");
                user.setDeleted(true);
                userRepository.save(user);
                break;
                
            case "USER_APPROVED":
            case "USER_REJECTED":
                user.setApprovalStatus(ApprovalStatus.PENDING);
                user.setActive(false);
                user.setRejectionReason(null);
                userRepository.save(user);
                break;
                
            case "USER_LOCKED":
                user.setActive(true);
                userRepository.save(user);
                break;
                
            case "USER_UNLOCKED":
                user.setActive(false);
                userRepository.save(user);
                break;
                
            case "USER_UPDATED":
                // Restore previous values
                if (previousState.containsKey("email")) {
                    user.setEmail((String) previousState.get("email"));
                }
                if (previousState.containsKey("fullName")) {
                    user.setFullName((String) previousState.get("fullName"));
                }
                if (previousState.containsKey("role")) {
                    user.setRole(ERole.valueOf((String) previousState.get("role")));
                }
                if (previousState.containsKey("departmentId")) {
                    String deptId = (String) previousState.get("departmentId");
                    if (deptId != null && !deptId.isEmpty()) {
                        Department dept = departmentRepository.findById(deptId).orElse(null);
                        user.setDepartment(dept);
                    } else {
                        user.setDepartment(null);
                    }
                }
                userRepository.save(user);
                break;
                
            case "USER_DELETED":
                user.setDeleted(false);
                userRepository.save(user);
                break;
                
            default:
                throw new RuntimeException("Không hỗ trợ hoàn tác cho loại hoạt động user: " + activityType);
        }
    }

    private void undoDepartmentActivity(AdminActivity activity, String deptId, Map<String, Object> previousState) {
        String activityType = activity.getType();
        
        switch (activityType) {
            case "DEPARTMENT_CREATED":
                // Soft delete department
                Department dept = departmentRepository.findById(deptId)
                        .orElseThrow(() -> new RuntimeException("Phòng ban không tồn tại!"));
                dept.setDeleted(true);
                departmentRepository.save(dept);
                break;
                
            case "DEPARTMENT_DELETED":
                Department deletedDept = departmentRepository.findById(deptId)
                        .orElseThrow(() -> new RuntimeException("Phòng ban không tồn tại!"));
                deletedDept.setDeleted(false);
                departmentRepository.save(deletedDept);
                break;

            case "DEPARTMENT_UPDATED":
                Department department = departmentRepository.findById(deptId)
                        .orElseThrow(() -> new RuntimeException("Phòng ban không tồn tại!"));
                
                if (previousState.containsKey("name")) {
                    department.setName((String) previousState.get("name"));
                }
                if (previousState.containsKey("managerId")) {
                    String managerId = (String) previousState.get("managerId");
                    if (managerId != null && !managerId.isEmpty()) {
                        User manager = userRepository.findById(managerId).orElse(null);
                        department.setManager(manager);
                    } else {
                        department.setManager(null);
                    }
                }
                departmentRepository.save(department);
                break;
                
            default:
                throw new RuntimeException("Không hỗ trợ hoàn tác cho loại hoạt động department: " + activityType);
        }
    }

    private void undoProjectActivity(AdminActivity activity, String projectId, Map<String, Object> previousState) {
        String activityType = activity.getType();
        
        switch (activityType) {
            case "PROJECT_CREATED":
                // Soft delete project
                Project project = projectRepository.findById(projectId)
                        .orElseThrow(() -> new RuntimeException("Dự án không tồn tại!"));
                project.setDeleted(true);
                projectRepository.save(project);
                break;
                
            case "PROJECT_UPDATED":
                Project proj = projectRepository.findById(projectId)
                        .orElseThrow(() -> new RuntimeException("Dự án không tồn tại!"));
                
                if (previousState.containsKey("name")) {
                    proj.setName((String) previousState.get("name"));
                }
                if (previousState.containsKey("description")) {
                    proj.setDescription((String) previousState.get("description"));
                }
                if (previousState.containsKey("status")) {
                    proj.setStatus(ProjectStatus.valueOf((String) previousState.get("status")));
                }
                projectRepository.save(proj);
                break;
                
            case "PROJECT_MEMBER_ADDED":
                Project memberProject = projectRepository.findById(projectId)
                        .orElseThrow(() -> new RuntimeException("Dự án không tồn tại!"));
                String addedUserId = (String) previousState.get("userId");
                if (addedUserId != null) {
                    User userToRemove = userRepository.findById(addedUserId).orElse(null);
                    if (userToRemove != null) {
                        memberProject.getMembers().removeIf(m -> m.getId().equals(userToRemove.getId()));
                        projectRepository.save(memberProject);
                    }
                }
                break;
                
            case "PROJECT_MEMBER_REMOVED":
                Project removedProject = projectRepository.findById(projectId)
                        .orElseThrow(() -> new RuntimeException("Dự án không tồn tại!"));
                String removedUserId = (String) previousState.get("userId");
                if (removedUserId != null) {
                    User userToAdd = userRepository.findById(removedUserId).orElse(null);
                    if (userToAdd != null && removedProject.getMembers().stream().noneMatch(m -> m.getId().equals(userToAdd.getId()))) {
                        removedProject.getMembers().add(userToAdd);
                        projectRepository.save(removedProject);
                    }
                }
                break;
                
            case "PROJECT_DELETED":
                Project deletedProject = projectRepository.findById(projectId)
                        .orElseThrow(() -> new RuntimeException("Dự án không tồn tại!"));
                deletedProject.setDeleted(false);
                deletedProject.setDeletedAt(null);
                projectRepository.save(deletedProject);
                break;
                
            default:
                throw new RuntimeException("Không hỗ trợ hoàn tác cho loại hoạt động project: " + activityType);
        }
    }

    private void undoTaskActivity(AdminActivity activity, String taskId, Map<String, Object> previousState) {
        String activityType = activity.getType();
        
        switch (activityType) {
            case "TASK_CREATED":
                // Soft delete task
                Task task = taskRepository.findById(taskId)
                        .orElseThrow(() -> new RuntimeException("Task không tồn tại!"));
                task.setDeleted(true);
                taskRepository.save(task);
                break;
                
            case "TASK_UPDATED":
                Task taskToUpdate = taskRepository.findById(taskId)
                        .orElseThrow(() -> new RuntimeException("Task không tồn tại!"));
                
                if (previousState.containsKey("name")) {
                    taskToUpdate.setTitle((String) previousState.get("name"));
                }
                if (previousState.containsKey("description")) {
                    taskToUpdate.setDescription((String) previousState.get("description"));
                }
                if (previousState.containsKey("status")) {
                    taskToUpdate.setStatus(TaskStatus.valueOf((String) previousState.get("status")));
                }
                if (previousState.containsKey("assigneeId")) {
                    String assigneeId = (String) previousState.get("assigneeId");
                    if (assigneeId != null && !assigneeId.isEmpty()) {
                        User assignee = userRepository.findById(assigneeId).orElse(null);
                        taskToUpdate.setAssignee(assignee);
                    } else {
                        taskToUpdate.setAssignee(null);
                    }
                }
                taskRepository.save(taskToUpdate);
                break;
                
            case "TASK_DELETED":
                Task deletedTask = taskRepository.findById(taskId)
                        .orElseThrow(() -> new RuntimeException("Công việc không tồn tại!"));
                deletedTask.setDeleted(false);
                deletedTask.setDeletedAt(null);
                taskRepository.save(deletedTask);
                break;
                
            default:
                throw new RuntimeException("Không hỗ trợ hoàn tác cho loại hoạt động task: " + activityType);
        }
    }
}