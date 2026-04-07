package com.projectmanagement.core_system.service;

import com.projectmanagement.core_system.enums.ERole;
import com.projectmanagement.core_system.enums.Priority;
import com.projectmanagement.core_system.enums.TemplateGroupType;
import com.projectmanagement.core_system.model.ChecklistItem;
import com.projectmanagement.core_system.model.Project;
import com.projectmanagement.core_system.model.ProjectTemplate;
import com.projectmanagement.core_system.model.ProjectTemplateChecklistTemplate;
import com.projectmanagement.core_system.model.ProjectTemplateInstantiationProjectRequest;
import com.projectmanagement.core_system.model.ProjectTemplateInstantiationRequest;
import com.projectmanagement.core_system.model.ProjectTemplateTaskTemplate;
import com.projectmanagement.core_system.model.Task;
import com.projectmanagement.core_system.model.User;
import com.projectmanagement.core_system.repository.ProjectTemplateRepository;
import com.projectmanagement.core_system.repository.TaskRepository;
import com.projectmanagement.core_system.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class ProjectTemplateService {

    @Autowired
    private ProjectTemplateRepository projectTemplateRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ProjectService projectService;

    @Autowired
    private TaskRepository taskRepository;

    @Autowired
    private UserActivityService userActivityService;

    public ProjectTemplate createTemplate(ProjectTemplate template, String actorEmail) {
        User actor = requireTemplateManager(actorEmail);

        if (template == null || !StringUtils.hasText(template.getName())) {
            throw new RuntimeException("Tên template không được để trống!");
        }

        ProjectTemplate newTemplate = new ProjectTemplate();
        newTemplate.setName(template.getName().trim());
        newTemplate.setDescription(template.getDescription() != null ? template.getDescription().trim() : null);
        newTemplate.setTemplateGroupType(template.getTemplateGroupType() != null ? template.getTemplateGroupType() : TemplateGroupType.OTHER);
        newTemplate.setVersion(1);
        newTemplate.setCreatedByEmail(actor.getEmail());
        newTemplate.setOwnerDepartmentId(actor.getDepartment() != null ? actor.getDepartment().getId() : null);
        newTemplate.setOwnerDepartmentName(actor.getDepartment() != null ? actor.getDepartment().getName() : null);
        newTemplate.setArchived(false);
        newTemplate.setCreatedAt(System.currentTimeMillis());
        newTemplate.setUpdatedAt(System.currentTimeMillis());
        newTemplate.setTaskTemplates(normalizeTaskTemplates(template.getTaskTemplates()));

        ProjectTemplate saved = projectTemplateRepository.save(newTemplate);
        userActivityService.record(actor, actor, "PROJECT_TEMPLATE_CREATED",
                actor.getFullName() + " đã tạo project template " + saved.getName(),
                Map.of("templateId", saved.getId(), "templateGroupType", saved.getTemplateGroupType().name()));
        return saved;
    }

    public List<ProjectTemplate> getTemplates(TemplateGroupType templateGroupType, String actorEmail) {
        User actor = requireTemplateViewer(actorEmail);

        if (actor.getRole() == ERole.ADMIN) {
            if (templateGroupType == null) {
                return projectTemplateRepository.findByArchivedFalseOrderByCreatedAtDesc();
            }
            return projectTemplateRepository.findByArchivedFalseAndTemplateGroupTypeOrderByCreatedAtDesc(templateGroupType);
        }

        if (actor.getDepartment() == null || !StringUtils.hasText(actor.getDepartment().getId())) {
            return List.of();
        }

        if (templateGroupType == null) {
            return projectTemplateRepository.findByArchivedFalseAndOwnerDepartmentIdOrderByCreatedAtDesc(actor.getDepartment().getId());
        }
        return projectTemplateRepository.findByArchivedFalseAndOwnerDepartmentIdAndTemplateGroupTypeOrderByCreatedAtDesc(actor.getDepartment().getId(), templateGroupType);
    }

    public Project instantiateTemplate(String templateId, ProjectTemplateInstantiationRequest request, String actorEmail) {
        User actor = requireTemplateManager(actorEmail);
        ProjectTemplate template = projectTemplateRepository.findById(templateId)
                .orElseThrow(() -> new RuntimeException("Template không tồn tại!"));

        if (template.isArchived()) {
            throw new RuntimeException("Template đã lưu trữ, không thể sử dụng để khởi tạo dự án!");
        }
        if (request == null || request.getProject() == null) {
            throw new RuntimeException("Thông tin dự án khởi tạo không hợp lệ!");
        }
        if (!StringUtils.hasText(request.getDepartmentId())) {
            throw new RuntimeException("departmentId không được để trống!");
        }

        Project baseProject = request.toProjectEntity();
        baseProject.setSourceTemplateId(template.getId());
        baseProject.setSourceTemplateVersion(template.getVersion());

        Project createdProject = projectService.createProject(baseProject, request.getDepartmentId(), actor.getEmail());

        List<Task> tasks = new ArrayList<>();
        for (ProjectTemplateTaskTemplate taskTemplate : template.getTaskTemplates()) {
            Task task = new Task();
            task.setTitle(taskTemplate.getTitle());
            task.setDescription(taskTemplate.getDescription());
            task.setPriority(taskTemplate.getPriority() != null ? taskTemplate.getPriority() : Priority.MEDIUM);
            task.setStatus(com.projectmanagement.core_system.enums.TaskStatus.TO_DO);
            task.setCompletionPercentage(0);
            task.setProject(createdProject);
            task.setSourceTemplateTaskId(taskTemplate.getId());
            task.setChecklistItems(buildChecklistSnapshot(taskTemplate.getChecklistTemplates()));
            task.setAttachments(new ArrayList<>());

            if (taskTemplate.getDeadlineOffsetDays() != null && createdProject.getStartDate() != null) {
                task.setDeadline(createdProject.getStartDate().plusDays(taskTemplate.getDeadlineOffsetDays()));
            } else {
                task.setDeadline((LocalDate) null);
            }

            tasks.add(task);
        }

        if (!tasks.isEmpty()) {
            taskRepository.saveAll(tasks);
        }

        userActivityService.record(actor, actor, "PROJECT_TEMPLATE_INSTANTIATED",
                actor.getFullName() + " đã khởi tạo dự án từ template " + template.getName(),
                Map.of(
                        "templateId", template.getId(),
                        "projectId", createdProject.getId(),
                        "taskCount", tasks.size()
                ));

        return createdProject;
    }

    private List<ProjectTemplateTaskTemplate> normalizeTaskTemplates(List<ProjectTemplateTaskTemplate> taskTemplates) {
        List<ProjectTemplateTaskTemplate> normalized = new ArrayList<>();
        if (taskTemplates == null) {
            return normalized;
        }

        for (ProjectTemplateTaskTemplate input : taskTemplates) {
            if (input == null || !StringUtils.hasText(input.getTitle())) {
                continue;
            }
            ProjectTemplateTaskTemplate taskTemplate = new ProjectTemplateTaskTemplate();
            taskTemplate.setId(StringUtils.hasText(input.getId()) ? input.getId() : UUID.randomUUID().toString());
            taskTemplate.setTitle(input.getTitle().trim());
            taskTemplate.setDescription(input.getDescription() != null ? input.getDescription().trim() : null);
            taskTemplate.setPriority(input.getPriority() != null ? input.getPriority() : Priority.MEDIUM);
            taskTemplate.setDeadlineOffsetDays(input.getDeadlineOffsetDays());
            taskTemplate.setChecklistTemplates(normalizeChecklistTemplates(input.getChecklistTemplates()));
            normalized.add(taskTemplate);
        }

        return normalized;
    }

    private List<ProjectTemplateChecklistTemplate> normalizeChecklistTemplates(List<ProjectTemplateChecklistTemplate> checklistTemplates) {
        List<ProjectTemplateChecklistTemplate> normalized = new ArrayList<>();
        if (checklistTemplates == null) {
            return normalized;
        }

        for (ProjectTemplateChecklistTemplate input : checklistTemplates) {
            if (input == null || !StringUtils.hasText(input.getTitle())) {
                continue;
            }
            ProjectTemplateChecklistTemplate checklistTemplate = new ProjectTemplateChecklistTemplate();
            checklistTemplate.setTitle(input.getTitle().trim());
            normalized.add(checklistTemplate);
        }

        return normalized;
    }

    private List<ChecklistItem> buildChecklistSnapshot(List<ProjectTemplateChecklistTemplate> checklistTemplates) {
        List<ChecklistItem> checklistItems = new ArrayList<>();
        if (checklistTemplates == null) {
            return checklistItems;
        }

        for (int i = 0; i < checklistTemplates.size(); i++) {
            ProjectTemplateChecklistTemplate checklistTemplate = checklistTemplates.get(i);
            if (checklistTemplate == null || !StringUtils.hasText(checklistTemplate.getTitle())) {
                continue;
            }

            ChecklistItem item = new ChecklistItem();
            item.setId(UUID.randomUUID().toString());
            item.setTitle(checklistTemplate.getTitle());
            item.setCompleted(false);
            item.setPosition(i);
            item.setCreatedAt(System.currentTimeMillis());
            item.setUpdatedAt(System.currentTimeMillis());
            checklistItems.add(item);
        }

        return checklistItems;
    }

    private User requireTemplateManager(String actorEmail) {
        if (!StringUtils.hasText(actorEmail)) {
            throw new AccessDeniedException("Thiếu thông tin người dùng thực hiện!");
        }
        User actor = userRepository.findByEmailIgnoreCase(actorEmail.trim().toLowerCase())
                .orElseThrow(() -> new AccessDeniedException("Người dùng thực hiện không tồn tại!"));

        if (!actor.isActive()) {
            throw new AccessDeniedException("Tài khoản của bạn đang bị khóa!");
        }
        if (actor.getRole() != ERole.ADMIN && actor.getRole() != ERole.MANAGER) {
            throw new AccessDeniedException("Bạn không có quyền quản lý project template!");
        }
        return actor;
    }

    private User requireTemplateViewer(String actorEmail) {
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
}
