package com.projectmanagement.core_system.controller;

import com.projectmanagement.core_system.controller.support.AuthenticatedUserHelper;
import com.projectmanagement.core_system.enums.TemplateGroupType;
import com.projectmanagement.core_system.model.CreateProjectTemplateRequest;
import com.projectmanagement.core_system.model.ProjectTemplate;
import com.projectmanagement.core_system.model.ProjectTemplateChecklistTemplate;
import com.projectmanagement.core_system.model.ProjectTemplateInstantiationRequest;
import com.projectmanagement.core_system.model.ProjectTemplateInstantiationProjectRequest;
import com.projectmanagement.core_system.model.ProjectTemplateTaskTemplate;
import com.projectmanagement.core_system.model.ProjectTemplateChecklistTemplateRequest;
import com.projectmanagement.core_system.model.ProjectTemplateTaskTemplateRequest;
import com.projectmanagement.core_system.service.ProjectTemplateService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/project-templates")
public class ProjectTemplateController {

    @Autowired
    private ProjectTemplateService projectTemplateService;

    @Autowired
    private AuthenticatedUserHelper authenticatedUserHelper;

    @PostMapping
    public ResponseEntity<?> createTemplate(@Valid @RequestBody CreateProjectTemplateRequest request, Authentication authentication) {
        try {
            return ResponseEntity.ok(projectTemplateService.createTemplate(toProjectTemplate(request), authenticatedUserHelper.requireActorEmail(authentication)));
        } catch (AccessDeniedException e) {
            return ResponseEntity.status(403).body(e.getMessage());
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @GetMapping
    public ResponseEntity<?> getTemplates(@RequestParam(required = false) TemplateGroupType templateGroupType, Authentication authentication) {
        try {
            return ResponseEntity.ok(projectTemplateService.getTemplates(templateGroupType, authenticatedUserHelper.requireActorEmail(authentication)));
        } catch (AccessDeniedException e) {
            return ResponseEntity.status(403).body(e.getMessage());
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PostMapping("/{templateId}/instantiate")
    public ResponseEntity<?> instantiateTemplate(
            @PathVariable String templateId,
            @Valid @RequestBody ProjectTemplateInstantiationRequest request,
            Authentication authentication) {
        try {
            return ResponseEntity.ok(projectTemplateService.instantiateTemplate(templateId, request, authenticatedUserHelper.requireActorEmail(authentication)));
        } catch (AccessDeniedException e) {
            return ResponseEntity.status(403).body(e.getMessage());
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    private ProjectTemplate toProjectTemplate(CreateProjectTemplateRequest request) {
        ProjectTemplate template = new ProjectTemplate();
        template.setName(request.getName() != null ? request.getName().trim() : null);
        template.setDescription(request.getDescription() != null ? request.getDescription().trim() : null);
        template.setTemplateGroupType(request.getTemplateGroupType());
        List<ProjectTemplateTaskTemplateRequest> taskTemplates = request.getTaskTemplates() != null ? request.getTaskTemplates() : List.of();
        template.setTaskTemplates(taskTemplates.stream().map(this::toTaskTemplate).toList());
        return template;
    }

    private ProjectTemplateTaskTemplate toTaskTemplate(ProjectTemplateTaskTemplateRequest request) {
        ProjectTemplateTaskTemplate template = new ProjectTemplateTaskTemplate();
        template.setId(request.getId());
        template.setTitle(request.getTitle() != null ? request.getTitle().trim() : null);
        template.setDescription(request.getDescription() != null ? request.getDescription().trim() : null);
        template.setPriority(request.getPriority());
        template.setDeadlineOffsetDays(request.getDeadlineOffsetDays());
        List<ProjectTemplateChecklistTemplateRequest> checklistTemplates = request.getChecklistTemplates() != null ? request.getChecklistTemplates() : List.of();
        template.setChecklistTemplates(checklistTemplates.stream().map(this::toChecklistTemplate).toList());
        return template;
    }

    private ProjectTemplateChecklistTemplate toChecklistTemplate(ProjectTemplateChecklistTemplateRequest request) {
        ProjectTemplateChecklistTemplate template = new ProjectTemplateChecklistTemplate();
        template.setTitle(request.getTitle() != null ? request.getTitle().trim() : null);
        return template;
    }
}
