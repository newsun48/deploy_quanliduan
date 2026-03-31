package com.projectmanagement.core_system.repository;

import com.projectmanagement.core_system.model.Comment;
import com.projectmanagement.core_system.model.Task;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface CommentRepository extends MongoRepository<Comment, String> {
    List<Comment> findByTaskIdOrderByCreatedAtAsc(String taskId);

    void deleteByTask(Task task);
}
