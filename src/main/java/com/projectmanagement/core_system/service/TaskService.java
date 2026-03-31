package com.projectmanagement.core_system.service;

import com.projectmanagement.core_system.enums.ProjectStatus;
import com.projectmanagement.core_system.enums.TaskStatus;
import com.projectmanagement.core_system.enums.Priority;
import com.projectmanagement.core_system.model.AttachmentInfo;
import com.projectmanagement.core_system.model.ChecklistItem;
import com.projectmanagement.core_system.model.Project;
import com.projectmanagement.core_system.model.Task;
import com.projectmanagement.core_system.model.TaskActivity;
import com.projectmanagement.core_system.model.TaskUpdateRequest;
import com.projectmanagement.core_system.model.User;
import com.projectmanagement.core_system.model.Department;
import com.projectmanagement.core_system.repository.CommentRepository;
import com.projectmanagement.core_system.repository.NotificationRepository;
import com.projectmanagement.core_system.repository.ProjectRepository;
import com.projectmanagement.core_system.repository.TaskActivityRepository;
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
import java.time.LocalDate;
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

    @Autowired
    private CommentRepository commentRepository;

    @Autowired
    private TaskActivityRepository taskActivityRepository;

    @Autowired
    private NotificationRepository notificationRepository;

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

        validateTaskDeadline(task.getDeadline());

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

    public Task updateTask(String taskId, TaskUpdateRequest request, String managerEmail) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new RuntimeException("Task không tồn tại!"));

        if (request == null) {
            throw new RuntimeException("Dữ liệu cập nhật không hợp lệ!");
        }

        if (task.getProject().getStatus() == ProjectStatus.CLOSED) {
            throw new RuntimeException("KHÔNG THỂ CẬP NHẬT: Dự án này đã bị đóng!");
        }

        User manager = ensureManagerCanManageTask(task, managerEmail);

        if (request.getTitle() != null && !request.getTitle().trim().isEmpty()) {
            task.setTitle(request.getTitle().trim());
        }

        if (request.getDescription() != null) {
            task.setDescription(request.getDescription().trim());
        }

        if (request.getPriority() != null) {
            task.setPriority(request.getPriority());
        }

        if (request.getDeadline() != null) {
            validateTaskDeadline(request.getDeadline());
            if (task.getProject().getDeadline() != null && request.getDeadline().isAfter(task.getProject().getDeadline())) {
                throw new RuntimeException("LỖI: Deadline Task vượt quá Deadline dự án!");
            }
            task.setDeadline(request.getDeadline());
        }

        if (request.getAssigneeId() != null && !request.getAssigneeId().isBlank()) {
            User assignee = userRepository.findById(request.getAssigneeId())
                    .orElseThrow(() -> new RuntimeException("Người được gán không tồn tại!"));

            boolean isMember = task.getProject().getMembers().stream()
                    .anyMatch(member -> member.getId().equals(assignee.getId()));
            if (!isMember) {
                throw new RuntimeException("LỖI: Người này chưa tham gia dự án!");
            }

            User oldAssignee = task.getAssignee();
            boolean assigneeChanged = oldAssignee == null || !oldAssignee.getId().equals(assignee.getId());

            if (assigneeChanged) {
                task.setAssignee(assignee);

                if (oldAssignee != null) {
                    notificationRepository.deleteByReceiverAndTaskAndType(oldAssignee, task, "TASK_ASSIGNED");
                }

                String message = "Bạn được giao công việc mới: " + task.getTitle() + " từ dự án: " + task.getProject().getName();
                notificationService.createNotification(assignee, manager, task, message, "TASK_ASSIGNED");
            }
        }

        Task savedTask = taskRepository.save(task);
        taskActivityService.record(savedTask, manager, "TASK_UPDATED_BY_MANAGER",
                manager.getFullName() + " đã cập nhật task '" + savedTask.getTitle() + "'",
                Map.of("taskId", savedTask.getId(), "projectId", savedTask.getProject().getId()));

        return savedTask;
    }

    public void deleteTask(String taskId, String managerEmail) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new RuntimeException("Task không tồn tại!"));

        if (task.getProject().getStatus() == ProjectStatus.CLOSED) {
            throw new RuntimeException("KHÔNG THỂ XÓA: Dự án này đã bị đóng!");
        }

        User manager = ensureManagerCanManageTask(task, managerEmail);

        commentRepository.deleteByTask(task);
        taskActivityRepository.deleteByTaskId(task.getId());
        notificationRepository.deleteByTask(task);
        taskRepository.delete(task);

        userActivityService.record(manager, manager, "TASK_DELETED",
                manager.getFullName() + " đã xóa task '" + task.getTitle() + "'",
                Map.of("taskId", task.getId(), "projectId", task.getProject().getId()));
    }

    // 2. Cập nhật trạng thái và tiến độ
    public Task updateStatus(String taskId, TaskStatus newStatus, int percent, String submissionLink) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new RuntimeException("Task không tồn tại!"));

        if (task.getProject().getStatus() == ProjectStatus.CLOSED) {
            throw new RuntimeException("KHÔNG THỂ CẬP NHẬT: Dự án này đã bị đóng!");
        }

        TaskStatus effectiveStatus = percent == 100 ? TaskStatus.DONE : newStatus;

        validateTaskStatusUpdate(effectiveStatus, percent);

        task.setStatus(effectiveStatus);
        task.setCompletionPercentage(percent);
        task.setSubmissionLink(submissionLink);
        
        Task savedTask = taskRepository.save(task);
        taskActivityService.record(savedTask, task.getAssignee(), "TASK_STATUS_UPDATED",
                task.getAssignee().getFullName() + " đã cập nhật trạng thái thành " + effectiveStatus + " (" + percent + "%)",
                Map.of(
                        "status", effectiveStatus.name(),
                        "completionPercentage", percent,
                        "submissionLink", submissionLink == null ? "" : submissionLink
                ));
        userActivityService.record(task.getAssignee(), task.getAssignee(), "TASK_STATUS_UPDATED",
                task.getAssignee().getFullName() + " đã cập nhật task '" + task.getTitle() + "' thành " + effectiveStatus,
                Map.of("taskId", savedTask.getId(), "status", effectiveStatus.name(), "completionPercentage", percent));

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

    private void validateTaskDeadline(LocalDate deadline) {
        if (deadline != null && deadline.isBefore(LocalDate.now())) {
            throw new RuntimeException("LỖI: Deadline Task không được ở quá khứ!");
        }
    }

    private void validateTaskStatusUpdate(TaskStatus newStatus, int percent) {
        if (newStatus == null) {
            throw new RuntimeException("Trạng thái công việc không hợp lệ!");
        }

        if (percent < 0 || percent > 100) {
            throw new RuntimeException("Phần trăm hoàn thành phải nằm trong khoảng từ 0 đến 100!");
        }

        if (newStatus == TaskStatus.DONE && percent < 100) {
            throw new RuntimeException("Không thể chuyển task sang DONE khi tiến độ chưa đạt 100%!");
        }
    }

    private User ensureManagerCanManageTask(Task task, String managerEmail) {
        if (managerEmail == null || managerEmail.isBlank()) {
            throw new RuntimeException("Thiếu thông tin trưởng phòng thực hiện!");
        }

        User actingUser = userRepository.findByEmailIgnoreCase(managerEmail.trim().toLowerCase())
                .orElseThrow(() -> new RuntimeException("Không tìm thấy thông tin người dùng thực hiện!"));

        User projectManager = getProjectManager(task.getProject());
        if (!projectManager.getId().equals(actingUser.getId())) {
            throw new RuntimeException("Bạn không có quyền chỉnh sửa hoặc xóa công việc này!");
        }

        return actingUser;
    }

    private User getProjectManager(Project project) {
        if (project == null || project.getDepartment() == null || project.getDepartment().getManager() == null) {
            throw new RuntimeException("Dự án chưa có trưởng phòng quản lý!");
        }

        return project.getDepartment().getManager();
    }
}
