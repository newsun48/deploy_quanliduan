package com.projectmanagement.core_system.repository;

import com.projectmanagement.core_system.model.ProjectMessage;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface ProjectMessageRepository extends MongoRepository<ProjectMessage, String> {
    List<ProjectMessage> findByProjectIdOrderByCreatedAtAsc(String projectId);
}
