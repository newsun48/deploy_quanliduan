package com.projectmanagement.core_system.repository;

import com.projectmanagement.core_system.model.Project; // Nhớ import
import com.projectmanagement.core_system.model.Task;
import com.projectmanagement.core_system.model.User;    // Nhớ import
import com.projectmanagement.core_system.enums.TaskStatus;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;
import java.util.Collection;
import java.util.List;

@Repository
public interface TaskRepository extends MongoRepository<Task, String> {

    // ✅ SỬA LẠI: Tìm theo ID bên trong đối tượng Project (@DBRef)
    List<Task> findByProject_Id(String projectId);

    boolean existsByProject_Id(String projectId);

    // ✅ SỬA LẠI: Tìm theo đối tượng Project
    List<Task> findByProject(Project project);

    // ✅ SỬA LẠI: Tìm theo ID bên trong đối tượng User (Assignee @DBRef)
    List<Task> findByAssignee_Id(String userId);

    boolean existsByAssignee_Id(String userId);

    List<Task> findByProjectIn(Collection<Project> projects);

    boolean existsByProjectInAndStatusIn(List<Project> projects, Collection<TaskStatus> statuses);

    // ✅ SỬA LẠI: Tìm theo đối tượng User (Assignee)
    List<Task> findByAssignee(User assignee);
}
