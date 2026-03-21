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
    private UserRepository userRepository;

    @Autowired
    private ProjectRepository projectRepository;

    // 1. Lấy danh sách
    public List<Department> getAllDepartments() {
        return departmentRepository.findAll();
    }

    // 2. Tạo phòng ban mới (Nâng cấp)
    public Department createDepartment(Department department) {
        // 🔥 Validate: Tên không được rỗng
        if (!StringUtils.hasText(department.getName())) {
            throw new RuntimeException("Tên phòng ban không được để trống!");
        }

        // 🔥 Validate: Check trùng tên (Không phân biệt hoa thường)
        if (departmentRepository.existsByNameIgnoreCase(department.getName())) {
            throw new RuntimeException("Phòng ban '" + department.getName() + "' đã tồn tại!");
        }

        // Để MongoDB tự tạo ID
        return departmentRepository.save(department);
    }

    // 3. Xóa phòng ban an toàn
    public void deleteDepartment(String id) {
        // Kiểm tra xem phòng ban có tồn tại không
        if (!departmentRepository.existsById(id)) {
            throw new RuntimeException("Phòng ban không tồn tại!");
        }

        // 🛑 Chặn xóa nếu còn Nhân viên
        if (!userRepository.findByDepartment_Id(id).isEmpty()) {
            throw new RuntimeException("Không thể xóa: Vẫn còn nhân viên thuộc phòng ban này!");
        }

        // 🛑 Chặn xóa nếu còn Dự án
        if (projectRepository.existsByDepartment_Id(id)) {
            throw new RuntimeException("Không thể xóa: Phòng ban đang phụ trách dự án!");
        }

        departmentRepository.deleteById(id);
    }

    // 4. Cập nhật tên phòng ban
    public Department updateDepartment(String id, Department updatedData) {
        if (!StringUtils.hasText(updatedData.getName())) {
            throw new RuntimeException("Tên phòng ban không được để trống!");
        }
        
        Department existingDept = departmentRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Phòng ban không tồn tại!"));

        // Cập nhật nếu tên thay đổi
        if (!existingDept.getName().equalsIgnoreCase(updatedData.getName())) {
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

        return departmentRepository.save(existingDept);
    }
}