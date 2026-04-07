package com.projectmanagement.core_system.repository;

import com.projectmanagement.core_system.model.Project;
import com.projectmanagement.core_system.enums.ProjectStatus;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;
import java.util.Collection;
import java.util.List;

@Repository
public interface ProjectRepository extends MongoRepository<Project, String> {
    
    // Tìm danh sách dự án thuộc về một phòng ban cụ thể
    List<Project> findByDepartment_Id(String departmentId);
    
    // Kiểm tra xem phòng ban này có dự án nào không (Để chặn xóa phòng ban)
    boolean existsByDepartment_Id(String departmentId);

    // 🔥 MỚI: Tìm kiếm dự án theo tên (Không phân biệt hoa thường)
    // Ví dụ: Gõ "java" ra "Dự án Java Web", "JAVA Core"
    List<Project> findByNameContainingIgnoreCase(String name);
    
    // Soft delete support
    List<Project> findByIsDeletedFalse();
    List<Project> findByIsDeletedFalseAndDepartment_Id(String departmentId);
    List<Project> findByIsDeletedFalseAndNameContainingIgnoreCase(String name);
    boolean existsByDepartment_IdAndIsDeletedFalseAndStatusIn(String departmentId, Collection<ProjectStatus> statuses);
    
    // Deleted projects support
    List<Project> findByIsDeletedTrue();
    List<Project> findByIsDeletedTrueAndDepartment_Id(String departmentId);
}
