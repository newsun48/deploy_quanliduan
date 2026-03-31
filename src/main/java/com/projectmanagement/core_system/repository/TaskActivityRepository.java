package com.projectmanagement.core_system.repository;

import com.projectmanagement.core_system.model.TaskActivity;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TaskActivityRepository extends MongoRepository<TaskActivity, String> {
    List<TaskActivity> findByTaskIdOrderByCreatedAtDesc(String taskId);

    void deleteByTaskId(String taskId);
}
