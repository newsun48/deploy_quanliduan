package com.projectmanagement.core_system.service;

import com.projectmanagement.core_system.model.Department;
import com.projectmanagement.core_system.repository.DepartmentRepository;
import com.projectmanagement.core_system.repository.ProjectRepository;
import com.projectmanagement.core_system.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.List;

@Service
public class DepartmentService {

    @Autowired
    private DepartmentRepository departmentRepository;

    @Autowired
    private ProjectRepository projectRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private UserActivityService userActivityService;

    @Autowired
    private AdminActivityService adminActivityService;

    // 1. Lấy danh sách (Chỉ lấy phòng ban chưa bị xóa)
    public List<Department> getAllDepartments() {
        return departmentRepository.findAllByIsDeletedFalse();
    }

    // 2. Tạo phòng ban mới
    public Department createDepartment(Department department, String actorEmail) {
        if (!StringUtils.hasText(department.getName())) {
            throw new RuntimeException("Tên phòng ban không được để trống!");
        }
        if (departmentRepository.existsByNameIgnoreCase(department.getName())) {
            throw new RuntimeException("Phòng ban '" + department.getName() + "' đã tồn tại!");
        }

        Department saved = departmentRepository.save(department);
        
        com.projectmanagement.core_system.model.User actor = null;
        if (actorEmail != null) {
            actor = userRepository.findByEmailIgnoreCase(actorEmail).orElse(null);
        }

        userActivityService.record(actor, null, "DEPARTMENT_CREATED",
                (actor != null ? actor.getFullName() : "Hệ thống") + " đã tạo phòng ban: " + saved.getName(),
                java.util.Map.of("departmentId", saved.getId(), "name", saved.getName()));

        return saved;
    }

    // 3. Xóa phòng ban an toàn
    public void deleteDepartment(String id, String actorEmail) {
        Department dept = departmentRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Phòng ban không tồn tại!"));

        // 🛑 Chặn xóa nếu còn Nhân viên
        if (!userRepository.findByDepartment_Id(id).isEmpty()) {
            throw new RuntimeException("Không thể xóa: Vẫn còn nhân viên thuộc phòng ban này!");
        }

        // 🛑 Chặn xóa nếu còn Dự án
        if (projectRepository.existsByDepartment_Id(id)) {
            throw new RuntimeException("Không thể xóa: Phòng ban đang phụ trách dự án!");
        }

        dept.setDeleted(true);
        departmentRepository.save(dept);
        
        com.projectmanagement.core_system.model.User actor = null;
        if (actorEmail != null) {
            actor = userRepository.findByEmailIgnoreCase(actorEmail).orElse(null);
        }

        userActivityService.record(actor, null, "DEPARTMENT_DELETED",
                (actor != null ? actor.getFullName() : "Hệ thống") + " đã xóa phòng ban: " + dept.getName(),
                java.util.Map.of("snapshot", dept));

        adminActivityService.recordActivity(actor, "DEPARTMENT_DELETED", "DEPARTMENT", dept.getId(),
                (actor != null ? actor.getFullName() : "Hệ thống") + " đã xóa phòng ban: " + dept.getName(),
                java.util.Map.of("name", dept.getName()),
                java.util.Map.of("isDeleted", true),
                true);
    }

    // 4. Cập nhật phòng ban
    public Department updateDepartment(String id, Department updatedData, String actorEmail) {
        Department existingDept = departmentRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Phòng ban không tồn tại!"));

        String oldName = existingDept.getName();
        String oldDescription = existingDept.getDescription();
        com.projectmanagement.core_system.model.User oldManager = existingDept.getManager();

        // Cập nhật nếu tên thay đổi
        if (StringUtils.hasText(updatedData.getName()) && !existingDept.getName().equalsIgnoreCase(updatedData.getName())) {
            if (departmentRepository.existsByNameIgnoreCase(updatedData.getName())) {
                throw new RuntimeException("Phòng ban '" + updatedData.getName() + "' đã tồn tại!");
            }
            existingDept.setName(updatedData.getName());
        }

        if (updatedData.getDescription() != null) {
            existingDept.setDescription(updatedData.getDescription());
        }

        if (updatedData.getManager() != null && updatedData.getManager().getId() != null) {
            com.projectmanagement.core_system.model.User newManager = userRepository.findById(updatedData.getManager().getId())
                    .orElseThrow(() -> new RuntimeException("Trưởng phòng không tồn tại!"));
            
            if (newManager.getRole() != com.projectmanagement.core_system.enums.ERole.MANAGER) {
                throw new RuntimeException("Người dùng vừa chọn không phải là Trưởng phòng!");
            }

            existingDept.setManager(newManager);
            
            newManager.setDepartment(existingDept);
            userRepository.save(newManager);
        } else if (updatedData.getManager() == null) {
            existingDept.setManager(null);
        }


        Department savedDept = departmentRepository.save(existingDept);

        // Record activity
        com.projectmanagement.core_system.model.User actor = null;
        if (actorEmail != null) {
            actor = userRepository.findByEmailIgnoreCase(actorEmail).orElse(null);
        }

        java.util.Map<String, Object> metadata = new java.util.HashMap<>();
        metadata.put("departmentId", savedDept.getId());
        if (!oldName.equals(savedDept.getName())) metadata.put("oldName", oldName);
        if (oldDescription != null && !oldDescription.equals(savedDept.getDescription())) metadata.put("oldDescription", oldDescription);
        if (oldManager != null) metadata.put("oldManagerId", oldManager.getId());

        userActivityService.record(actor, null, "DEPARTMENT_UPDATED",
                (actor != null ? actor.getFullName() : "Hệ thống") + " đã cập nhật phòng ban: " + savedDept.getName(),
                metadata);

        // 🔥 Auto-sync logic
        if (savedDept.getManager() != null) {
            com.projectmanagement.core_system.model.User newDeptManager = savedDept.getManager();
            List<com.projectmanagement.core_system.model.Project> projectsOfDept = projectRepository.findByIsDeletedFalseAndDepartment_Id(savedDept.getId());
            
            boolean changed = false;
            for (com.projectmanagement.core_system.model.Project project : projectsOfDept) {
                project.setManager(newDeptManager);
                if (project.getMembers() == null) project.setMembers(new java.util.ArrayList<>());
                if (project.getMembers().stream().noneMatch(m -> m.getId().equals(newDeptManager.getId()))) {
                    project.getMembers().add(newDeptManager);
                }
                changed = true;
            }
            if (changed) projectRepository.saveAll(projectsOfDept);
        }

        return savedDept;
    }
}