package com.projectmanagement.core_system.repository;

import com.projectmanagement.core_system.model.DepartmentQuarterlyOkr;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DepartmentQuarterlyOkrRepository extends MongoRepository<DepartmentQuarterlyOkr, String> {
    Optional<DepartmentQuarterlyOkr> findByDepartment_IdAndYearAndQuarter(String departmentId, Integer year,
            Integer quarter);

    List<DepartmentQuarterlyOkr> findByDepartment_IdOrderByYearDescQuarterDesc(String departmentId);

    List<DepartmentQuarterlyOkr> findByDepartment_IdAndYearAndQuarterOrderByYearDescQuarterDesc(String departmentId,
            Integer year, Integer quarter);
}
