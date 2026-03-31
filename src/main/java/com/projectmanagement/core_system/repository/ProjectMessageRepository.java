package com.projectmanagement.core_system.repository;

import com.projectmanagement.core_system.model.ProjectMessage;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface ProjectMessageRepository extends MongoRepository<ProjectMessage, String> {

    // Group chat: lấy tin nhắn theo project (receiver = null = group)
    List<ProjectMessage> findByProjectIdOrderByCreatedAtAsc(String projectId);

    List<ProjectMessage> findByReceiverIsNotNullOrderByCreatedAtAsc();
}

