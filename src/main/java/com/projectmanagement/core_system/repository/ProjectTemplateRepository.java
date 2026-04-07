package com.projectmanagement.core_system.repository;

import com.projectmanagement.core_system.enums.TemplateGroupType;
import com.projectmanagement.core_system.model.ProjectTemplate;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProjectTemplateRepository extends MongoRepository<ProjectTemplate, String> {
    List<ProjectTemplate> findByArchivedFalseOrderByCreatedAtDesc();
    List<ProjectTemplate> findByArchivedFalseAndTemplateGroupTypeOrderByCreatedAtDesc(TemplateGroupType templateGroupType);
    List<ProjectTemplate> findByArchivedFalseAndOwnerDepartmentIdOrderByCreatedAtDesc(String ownerDepartmentId);
    List<ProjectTemplate> findByArchivedFalseAndOwnerDepartmentIdAndTemplateGroupTypeOrderByCreatedAtDesc(String ownerDepartmentId, TemplateGroupType templateGroupType);
}
