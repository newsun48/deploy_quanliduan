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

    // Private chat: lấy tin nhắn giữa 2 user (A→B hoặc B→A)
    @Query("{ '$or': [ " +
           "  { 'sender.$id': ObjectId(?0), 'receiver.$id': ObjectId(?1) }, " +
           "  { 'sender.$id': ObjectId(?1), 'receiver.$id': ObjectId(?0) } " +
           "], 'project': null }")
    List<ProjectMessage> findPrivateMessages(String userId1, String userId2);
}

