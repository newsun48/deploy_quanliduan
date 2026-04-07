package com.projectmanagement.core_system.service;

import com.projectmanagement.core_system.enums.ERole;
import com.projectmanagement.core_system.enums.Priority;
import com.projectmanagement.core_system.enums.TemplateGroupType;
import com.projectmanagement.core_system.model.Project;
import com.projectmanagement.core_system.model.ProjectTemplate;
import com.projectmanagement.core_system.model.ProjectTemplateChecklistTemplate;
import com.projectmanagement.core_system.model.ProjectTemplateInstantiationRequest;
import com.projectmanagement.core_system.model.ProjectTemplateTaskTemplate;
import com.projectmanagement.core_system.model.Task;
import com.projectmanagement.core_system.model.User;
import com.projectmanagement.core_system.repository.ProjectTemplateRepository;
import com.projectmanagement.core_system.repository.TaskRepository;
import com.projectmanagement.core_system.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProjectTemplateServiceTest {

    @Mock
    private ProjectTemplateRepository projectTemplateRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private ProjectService projectService;

    @Mock
    private TaskRepository taskRepository;

    @Mock
    private UserActivityService userActivityService;

    @InjectMocks
    private ProjectTemplateService projectTemplateService;

    @Test
    void instantiateTemplate_snapshotsTasksAndStoresLineage() {
        User manager = new User();
        manager.setId("manager-1");
        manager.setEmail("manager@example.com");
        manager.setRole(ERole.MANAGER);
        manager.setActive(true);
        manager.setFullName("Manager");

        ProjectTemplateChecklistTemplate checklistTemplate = new ProjectTemplateChecklistTemplate();
        checklistTemplate.setTitle("Checklist A");

        ProjectTemplateTaskTemplate taskTemplate = new ProjectTemplateTaskTemplate();
        taskTemplate.setId("template-task-1");
        taskTemplate.setTitle("Task from template");
        taskTemplate.setPriority(Priority.HIGH);
        taskTemplate.setChecklistTemplates(List.of(checklistTemplate));

        ProjectTemplate template = new ProjectTemplate();
        template.setId("template-1");
        template.setName("Template Alpha");
        template.setTemplateGroupType(TemplateGroupType.DELIVERY);
        template.setVersion(3);
        template.setTaskTemplates(List.of(taskTemplate));

        Project baseProject = new Project();
        setField(baseProject, "name", "Project from template");

        Project createdProject = new Project();
        setField(createdProject, "id", "project-1");

        ProjectTemplateInstantiationRequest request = new ProjectTemplateInstantiationRequest();
        request.setDepartmentId("dept-1");
        request.setProject(baseProject);

        when(userRepository.findByEmailIgnoreCase("manager@example.com")).thenReturn(Optional.of(manager));
        when(projectTemplateRepository.findById("template-1")).thenReturn(Optional.of(template));
        when(projectService.createProject(any(Project.class), any(String.class), any(String.class))).thenReturn(createdProject);

        Project result = projectTemplateService.instantiateTemplate("template-1", request, "manager@example.com");

        assertEquals("project-1", getField(result, "id"));
        assertEquals("template-1", getField(baseProject, "sourceTemplateId"));
        assertEquals(3, getField(baseProject, "sourceTemplateVersion"));

        ArgumentCaptor<List<Task>> tasksCaptor = ArgumentCaptor.forClass(List.class);
        verify(taskRepository).saveAll(tasksCaptor.capture());
        assertEquals(1, tasksCaptor.getValue().size());
        assertEquals("template-task-1", getField(tasksCaptor.getValue().get(0), "sourceTemplateTaskId"));
        assertNotNull(tasksCaptor.getValue().get(0).getChecklistItems());
    }

    private void setField(Object target, String fieldName, Object value) {
        try {
            java.lang.reflect.Field field = target.getClass().getDeclaredField(fieldName);
            field.setAccessible(true);
            field.set(target, value);
        } catch (ReflectiveOperationException e) {
            throw new RuntimeException(e);
        }
    }

    private Object getField(Object target, String fieldName) {
        try {
            java.lang.reflect.Field field = target.getClass().getDeclaredField(fieldName);
            field.setAccessible(true);
            return field.get(target);
        } catch (ReflectiveOperationException e) {
            throw new RuntimeException(e);
        }
    }
}
