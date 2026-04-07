package com.projectmanagement.core_system.service;

import com.projectmanagement.core_system.enums.ERole;
import com.projectmanagement.core_system.model.Department;
import com.projectmanagement.core_system.model.DepartmentOkrKeyResult;
import com.projectmanagement.core_system.model.DepartmentQuarterlyOkr;
import com.projectmanagement.core_system.model.UpsertDepartmentOkrRequest;
import com.projectmanagement.core_system.model.User;
import com.projectmanagement.core_system.repository.DepartmentQuarterlyOkrRepository;
import com.projectmanagement.core_system.repository.DepartmentRepository;
import com.projectmanagement.core_system.repository.ProjectRepository;
import com.projectmanagement.core_system.repository.TaskActivityRepository;
import com.projectmanagement.core_system.repository.TaskRepository;
import com.projectmanagement.core_system.repository.UserActivityRepository;
import com.projectmanagement.core_system.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DepartmentPerformanceServiceTest {

    @Mock
    private DepartmentRepository departmentRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private ProjectRepository projectRepository;

    @Mock
    private TaskRepository taskRepository;

    @Mock
    private TaskActivityRepository taskActivityRepository;

    @Mock
    private UserActivityRepository userActivityRepository;

    @Mock
    private DepartmentQuarterlyOkrRepository departmentQuarterlyOkrRepository;

    @Mock
    private UserActivityService userActivityService;

    @InjectMocks
    private DepartmentPerformanceService departmentPerformanceService;

    @Test
    void upsertQuarterlyOkr_createsNewRecordAndGeneratesKeyResultId() {
        User manager = new User();
        manager.setId("manager-1");
        manager.setEmail("manager@example.com");
        manager.setRole(ERole.MANAGER);
        manager.setActive(true);
        manager.setFullName("Manager");

        Department department = new Department();
        setField(department, "id", "dept-1");
        setField(department, "name", "Engineering");
        setField(department, "manager", manager);

        DepartmentOkrKeyResult keyResult = new DepartmentOkrKeyResult();
        keyResult.setName("Release throughput");
        keyResult.setTargetValue(20d);
        keyResult.setCurrentValue(5d);

        UpsertDepartmentOkrRequest request = new UpsertDepartmentOkrRequest();
        request.setDepartmentId("dept-1");
        request.setYear(2026);
        request.setQuarter(2);
        request.setObjective("Ship with higher cadence");
        request.setKeyResults(List.of(keyResult));

        when(userRepository.findByEmailIgnoreCase("manager@example.com")).thenReturn(Optional.of(manager));
        when(departmentRepository.findById("dept-1")).thenReturn(Optional.of(department));
        when(departmentQuarterlyOkrRepository.findByDepartment_IdAndYearAndQuarter("dept-1", 2026, 2)).thenReturn(Optional.empty());
        when(departmentQuarterlyOkrRepository.save(any(DepartmentQuarterlyOkr.class))).thenAnswer(invocation -> {
            DepartmentQuarterlyOkr okr = invocation.getArgument(0);
            okr.setId("okr-1");
            return okr;
        });

        DepartmentQuarterlyOkr saved = departmentPerformanceService.upsertQuarterlyOkr(request, "manager@example.com");

        assertEquals("okr-1", saved.getId());
        assertEquals("Ship with higher cadence", saved.getObjective());
        assertEquals(1, saved.getKeyResults().size());
        assertNotNull(saved.getKeyResults().get(0).getId());
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
}
