package com.projectmanagement.core_system.repository;

import com.projectmanagement.core_system.model.Department;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface DepartmentRepository extends MongoRepository<Department, String> {
    
    // Kiểm tra tên phòng ban (Chính xác)
    boolean existsByName(String name);

    // 🔥 MỚI: Kiểm tra trùng tên KHÔNG phân biệt hoa thường
    // (Ví dụ: Đã có "IT" thì không cho tạo "it" hay "It" nữa)
    boolean existsByNameIgnoreCase(String name);
}