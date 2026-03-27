package com.projectmanagement.core_system.service;

import com.projectmanagement.core_system.enums.ProjectStatus;
import com.projectmanagement.core_system.enums.TaskStatus;
import com.projectmanagement.core_system.enums.Priority;
import com.projectmanagement.core_system.model.AttachmentInfo;
import com.projectmanagement.core_system.model.ChecklistItem;
import com.projectmanagement.core_system.model.Project;
import com.projectmanagement.core_system.model.Task;
import com.projectmanagement.core_system.model.TaskActivity;
import com.projectmanagement.core_system.model.User;
import com.projectmanagement.core_system.model.Department;
import com.projectmanagement.core_system.repository.ProjectRepository;
import com.projectmanagement.core_system.repository.TaskRepository;
import com.projectmanagement.core_system.repository.UserRepository;
import com.projectmanagement.core_system.repository.DepartmentRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.HashMap;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class TaskService {

    @Autowired
    private TaskRepository taskRepository;

    @Autowired
    private ProjectRepository projectRepository;

    @Autowired
    private DepartmentRepository departmentRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private NotificationService notificationService;

    @Autowired
    private TaskActivityService taskActivityService;

    @Autowired
    private UserActivityService userActivityService;

    // 1. Tạo Task mới
    public Task createTask(Task task, String projectId, String assigneeId) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new RuntimeException("Dự án không tồn tại!"));

        if (project.getStatus() == ProjectStatus.CLOSED) {
            throw new RuntimeException("Dự án đã đóng, không thể giao việc mới!");
        }

        User assignee = userRepository.findById(assigneeId)
                .orElseThrow(() -> new RuntimeException("Người được gán không tồn tại!"));

        boolean isMember = project.getMembers().stream()
                .anyMatch(member -> member.getId().equals(assigneeId));
        
        if (!isMember) {
            throw new RuntimeException("LỖI: Người này chưa tham gia dự án!");
        }

        if (task.getDeadline() != null && project.getDeadline() != null) {
            if (task.getDeadline().isAfter(project.getDeadline())) {
                throw new RuntimeException("LỖI: Deadline Task vượt quá Deadline dự án!");
            }
        }

        task.setProject(project);
        task.setAssignee(assignee);
        task.setStatus(TaskStatus.TO_DO);
        task.setCompletionPercentage(0);
        task.setChecklistItems(new ArrayList<>());
        task.setAttachments(new ArrayList<>());

        Task savedTask = taskRepository.save(task);

        // Thông báo cho nhân viên: Người giao là Manager của phòng ban chứa dự án
        User manager = project.getDepartment() != null ? project.getDepartment().getManager() : null;
        String message = "Bạn được giao công việc mới: " + savedTask.getTitle() + " từ dự án: " + project.getName();
        notificationService.createNotification(assignee, manager != null ? manager : assignee, savedTask, message, "TASK_ASSIGNED");
        taskActivityService.record(savedTask, manager != null ? manager : assignee, "TASK_CREATED",
                "Đã tạo công việc '" + savedTask.getTitle() + "' và giao cho " + assignee.getFullName(),
                Map.of("projectId", project.getId(), "assigneeId", assignee.getId()));
        userActivityService.record(manager != null ? manager : assignee, assignee, "TASK_CREATED",
                (manager != null ? manager.getFullName() : assignee.getFullName()) + " đã tạo task '" + savedTask.getTitle() + "'",
                Map.of("taskId", savedTask.getId(), "projectId", project.getId()));

        return savedTask;
    }

    // 2. Cập nhật trạng thái và tiến độ
    public Task updateStatus(String taskId, TaskStatus newStatus, int percent, String submissionLink) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new RuntimeException("Task không tồn tại!"));

        if (task.getProject().getStatus() == ProjectStatus.CLOSED) {
            throw new RuntimeException("KHÔNG THỂ CẬP NHẬT: Dự án này đã bị đóng!");
        }

        task.setStatus(newStatus);
        task.setCompletionPercentage(percent);
        task.setSubmissionLink(submissionLink);
        
        Task savedTask = taskRepository.save(task);
        taskActivityService.record(savedTask, task.getAssignee(), "TASK_STATUS_UPDATED",
                task.getAssignee().getFullName() + " đã cập nhật trạng thái thành " + newStatus + " (" + percent + "%)",
                Map.of(
                        "status", newStatus.name(),
                        "completionPercentage", percent,
                        "submissionLink", submissionLink == null ? "" : submissionLink
                ));
        userActivityService.record(task.getAssignee(), task.getAssignee(), "TASK_STATUS_UPDATED",
                task.getAssignee().getFullName() + " đã cập nhật task '" + task.getTitle() + "' thành " + newStatus,
                Map.of("taskId", savedTask.getId(), "status", newStatus.name(), "completionPercentage", percent));

        // Thông báo cho quản lý nếu cần
        User manager = task.getProject().getDepartment() != null ? task.getProject().getDepartment().getManager() : null;
        if (manager != null && !manager.getId().equals(task.getAssignee().getId())) {
            String message = task.getAssignee().getFullName() + " đã cập nhật tiến độ công việc '" + task.getTitle() + "' thành " + percent + "%.";
            notificationService.createNotification(manager, task.getAssignee(), savedTask, message, "TASK_UPDATED");
        }

        return savedTask;
    }

    public Task getTaskDetail(String taskId) {
        return taskRepository.findById(taskId)
                .orElseThrow(() -> new RuntimeException("Task không tồn tại!"));
    }

    public ChecklistItem addChecklistItem(String taskId, String title, String actorId) {
        Task task = getTaskDetail(taskId);
        User actor = getActor(actorId, task.getAssignee());

        if (title == null || title.trim().isEmpty()) {
            throw new RuntimeException("Tên checklist không được để trống!");
        }

        ChecklistItem item = new ChecklistItem();
        item.setId(UUID.randomUUID().toString());
        item.setTitle(title.trim());
        item.setCompleted(false);
        item.setPosition(task.getChecklistItems().size());
        item.setCreatedById(actor != null ? actor.getId() : null);
        item.setCreatedByName(actor != null ? actor.getFullName() : "Hệ thống");
        item.setCreatedAt(System.currentTimeMillis());
        item.setUpdatedAt(System.currentTimeMillis());

        task.getChecklistItems().add(item);
        taskRepository.save(task);

        taskActivityService.record(task, actor, "CHECKLIST_ITEM_ADDED",
                (actor != null ? actor.getFullName() : "Hệ thống") + " đã thêm checklist: " + item.getTitle(),
                Map.of("itemId", item.getId(), "title", item.getTitle()));

        return item;
    }

    public ChecklistItem updateChecklistItem(String taskId, String itemId, Map<String, Object> payload, String actorId) {
        Task task = getTaskDetail(taskId);
        User actor = getActor(actorId, task.getAssignee());
        ChecklistItem item = task.getChecklistItems().stream()
                .filter(checklistItem -> checklistItem.getId().equals(itemId))
                .findFirst()
                .orElseThrow(() -> new RuntimeException("Checklist item không tồn tại!"));

        String oldTitle = item.getTitle();
        boolean oldCompleted = item.isCompleted();

        Object titleValue = payload.get("title");
        if (titleValue instanceof String title && !title.trim().isEmpty()) {
            item.setTitle(title.trim());
        }

        Object completedValue = payload.get("completed");
        if (completedValue != null) {
            item.setCompleted(Boolean.parseBoolean(completedValue.toString()));
        }

        Object positionValue = payload.get("position");
        if (positionValue != null) {
            item.setPosition(Integer.parseInt(positionValue.toString()));
            task.getChecklistItems().sort(Comparator.comparingInt(ChecklistItem::getPosition));
        }

        item.setUpdatedAt(System.currentTimeMillis());
        taskRepository.save(task);

        if (!oldTitle.equals(item.getTitle())) {
            taskActivityService.record(task, actor, "CHECKLIST_ITEM_RENAMED",
                    (actor != null ? actor.getFullName() : "Hệ thống") + " đã đổi tên checklist thành: " + item.getTitle(),
                    Map.of("itemId", item.getId(), "title", item.getTitle()));
        }

        if (oldCompleted != item.isCompleted()) {
            taskActivityService.record(task, actor, item.isCompleted() ? "CHECKLIST_ITEM_COMPLETED" : "CHECKLIST_ITEM_REOPENED",
                    (actor != null ? actor.getFullName() : "Hệ thống") + (item.isCompleted() ? " đã hoàn thành checklist: " : " đã mở lại checklist: ") + item.getTitle(),
                    Map.of("itemId", item.getId(), "title", item.getTitle(), "completed", item.isCompleted()));
        }

        return item;
    }

    public Task deleteChecklistItem(String taskId, String itemId, String actorId) {
        Task task = getTaskDetail(taskId);
        User actor = getActor(actorId, task.getAssignee());

        ChecklistItem item = task.getChecklistItems().stream()
                .filter(checklistItem -> checklistItem.getId().equals(itemId))
                .findFirst()
                .orElseThrow(() -> new RuntimeException("Checklist item không tồn tại!"));

        task.setChecklistItems(task.getChecklistItems().stream()
                .filter(checklistItem -> !checklistItem.getId().equals(itemId))
                .collect(Collectors.toCollection(ArrayList::new)));

        for (int i = 0; i < task.getChecklistItems().size(); i++) {
            task.getChecklistItems().get(i).setPosition(i);
        }

        Task savedTask = taskRepository.save(task);
        taskActivityService.record(savedTask, actor, "CHECKLIST_ITEM_DELETED",
                (actor != null ? actor.getFullName() : "Hệ thống") + " đã xóa checklist: " + item.getTitle(),
                Map.of("itemId", item.getId(), "title", item.getTitle()));

        return savedTask;
    }

    public AttachmentInfo addTaskAttachment(String taskId, AttachmentInfo attachmentInfo, String actorId) {
        Task task = getTaskDetail(taskId);
        User actor = getActor(actorId, task.getAssignee());

        if (attachmentInfo == null || attachmentInfo.getUrl() == null || attachmentInfo.getUrl().isBlank()) {
            throw new RuntimeException("File đính kèm không hợp lệ!");
        }

        AttachmentInfo attachment = new AttachmentInfo();
        attachment.setId(UUID.randomUUID().toString());
        attachment.setUrl(attachmentInfo.getUrl());
        attachment.setOriginalName(attachmentInfo.getOriginalName());
        attachment.setSize(attachmentInfo.getSize());
        attachment.setUploadedById(actor != null ? actor.getId() : null);
        attachment.setUploadedByName(actor != null ? actor.getFullName() : "Hệ thống");
        attachment.setUploadedAt(System.currentTimeMillis());

        task.getAttachments().add(attachment);
        taskRepository.save(task);

        taskActivityService.record(task, actor, "TASK_ATTACHMENT_ADDED",
                (actor != null ? actor.getFullName() : "Hệ thống") + " đã thêm file: " + attachment.getOriginalName(),
                Map.of("attachmentId", attachment.getId(), "fileName", attachment.getOriginalName()));

        return attachment;
    }

    public Task deleteTaskAttachment(String taskId, String attachmentId, String actorId) {
        Task task = getTaskDetail(taskId);
        User actor = getActor(actorId, task.getAssignee());

        AttachmentInfo attachment = task.getAttachments().stream()
                .filter(item -> item.getId().equals(attachmentId))
                .findFirst()
                .orElseThrow(() -> new RuntimeException("File đính kèm không tồn tại!"));

        task.setAttachments(task.getAttachments().stream()
                .filter(item -> !item.getId().equals(attachmentId))
                .collect(Collectors.toCollection(ArrayList::new)));

        Task savedTask = taskRepository.save(task);
        taskActivityService.record(savedTask, actor, "TASK_ATTACHMENT_REMOVED",
                (actor != null ? actor.getFullName() : "Hệ thống") + " đã xóa file: " + attachment.getOriginalName(),
                Map.of("attachmentId", attachment.getId(), "fileName", attachment.getOriginalName()));

        return savedTask;
    }

    public List<TaskActivity> getTaskActivity(String taskId) {
        getTaskDetail(taskId);
        return taskActivityService.getTaskActivities(taskId);
    }

    // 3. Lấy task theo dự án
    public List<Task> getTasksByProject(String projectId) {
        return taskRepository.findByProject_Id(projectId);
    }

    // 4. Lấy task của cá nhân
    public List<Task> getMyTasks(String userId) {
        return taskRepository.findByAssignee_Id(userId);
    }

    // 5. Thống kê Toàn diện cho Dashboard
    public Map<String, Object> getTaskStatistics() {
        List<Task> allTasks = taskRepository.findAll();
        List<Project> allProjects = projectRepository.findAll();
        List<User> allUsers = userRepository.findAll();
        List<Department> allDepts = departmentRepository.findAll();

        // 5.1. Thống kê Trạng thái
        long todoCount = allTasks.stream().filter(t -> t.getStatus() == TaskStatus.TO_DO).count();
        long inProgressCount = allTasks.stream().filter(t -> t.getStatus() == TaskStatus.IN_PROGRESS).count();
        long doneCount = allTasks.stream().filter(t -> t.getStatus() == TaskStatus.DONE).count();

        // 5.2. Thống kê Độ ưu tiên
        long highPriority = allTasks.stream().filter(t -> t.getPriority() == Priority.HIGH).count();
        long mediumPriority = allTasks.stream().filter(t -> t.getPriority() == Priority.MEDIUM).count();
        long lowPriority = allTasks.stream().filter(t -> t.getPriority() == Priority.LOW).count();

        // 5.3. Thống kê theo Dự án
        Map<String, Long> byProject = allTasks.stream()
                .filter(t -> t.getProject() != null)
                .collect(Collectors.groupingBy(t -> t.getProject().getName(), Collectors.counting()));

        // 5.4. Thống kê theo Người thực hiện
        Map<String, Long> byAssignee = allTasks.stream()
                .filter(t -> t.getAssignee() != null)
                .collect(Collectors.groupingBy(t -> t.getAssignee().getFullName(), Collectors.counting()));

        // 5.5. Thống kê Trạng thái Dự án
        long openProjects = allProjects.stream().filter(p -> p.getStatus() == ProjectStatus.OPEN).count();
        long closedProjects = allProjects.stream().filter(p -> p.getStatus() == ProjectStatus.CLOSED).count();
        long draftProjects = allProjects.stream().filter(p -> p.getStatus() == ProjectStatus.DRAFT).count();

        // 5.6. Phân bổ nhân sự theo Phòng ban
        Map<String, Long> userDept = allUsers.stream()
                .filter(u -> u.getDepartment() != null)
                .collect(Collectors.groupingBy(u -> u.getDepartment().getName(), Collectors.counting()));

        // Tổng hợp JSON trả về cho Frontend
        Map<String, Object> results = new HashMap<>();
        results.put("totalTasks", allTasks.size());
        results.put("totalProjects", allProjects.size());
        results.put("totalUsers", allUsers.size());
        results.put("totalDepts", allDepts.size());
        
        results.put("byStatus", Map.of(
            "TO_DO", todoCount,
            "IN_PROGRESS", inProgressCount,
            "DONE", doneCount
        ));
        
        results.put("byPriority", Map.of(
            "HIGH", highPriority,
            "MEDIUM", mediumPriority,
            "LOW", lowPriority
        ));
        
        results.put("byProject", byProject);
        results.put("byAssignee", byAssignee);
        results.put("projectStatus", Map.of(
            "OPEN", openProjects,
            "CLOSED", closedProjects,
            "DRAFT", draftProjects
        ));
        results.put("userDept", userDept);

        return results;
    }

    private User getActor(String actorId, User fallbackUser) {
        if (actorId == null || actorId.isBlank()) {
            return fallbackUser;
        }

        return userRepository.findById(actorId).orElse(fallbackUser);
    }
}
