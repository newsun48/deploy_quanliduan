package com.projectmanagement.core_system.repository;

import com.projectmanagement.core_system.model.Department;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface DepartmentRepository extends MongoRepository<Department, String> {
    
    // Kiểm tra tên phòng ban (Chính xác)
    boolean existsByName(String name);

    // 🔥 MỚI: Kiểm tra trùng tên KHÔNG phân biệt hoa thường
    // (Ví dụ: Đã có "IT" thì không cho tạo "it" hay "It" nữa)
    boolean existsByNameIgnoreCase(String name);

    @Query("{ '$or': [ { 'isDeleted': false }, { 'isDeleted': { '$exists': false } } ] }")
    List<Department> findAllByIsDeletedFalse();

    @Query("{ '_id': ?0, '$or': [ { 'isDeleted': false }, { 'isDeleted': { '$exists': false } } ] }")
    Optional<Department> findByIdAndIsDeletedFalse(String id);
}