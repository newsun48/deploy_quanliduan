package com.projectmanagement.core_system.repository;

import com.projectmanagement.core_system.model.Project; // Nhớ import
import com.projectmanagement.core_system.model.Task;
import com.projectmanagement.core_system.model.User;    // Nhớ import
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface TaskRepository extends MongoRepository<Task, String> {

    // ✅ SỬA LẠI: Tìm theo đối tượng Project
    // Spring Data sẽ tự hiểu và so sánh ID bên trong DBRef
    List<Task> findByProject(Project project);

    // ✅ SỬA LẠI: Tìm theo đối tượng User (Assignee)
    List<Task> findByAssignee(User assignee);
}