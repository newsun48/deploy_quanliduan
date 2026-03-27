package com.projectmanagement.core_system.service;

import com.projectmanagement.core_system.model.Task;
import com.projectmanagement.core_system.model.TaskActivity;
import com.projectmanagement.core_system.model.User;
import com.projectmanagement.core_system.repository.TaskActivityRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class TaskActivityService {

    @Autowired
    private TaskActivityRepository taskActivityRepository;

    public TaskActivity record(Task task, User actor, String type, String message) {
        return record(task, actor, type, message, Map.of());
    }

    public TaskActivity record(Task task, User actor, String type, String message, Map<String, Object> metadata) {
        TaskActivity activity = new TaskActivity();
        activity.setTaskId(task.getId());
        activity.setActorId(actor != null ? actor.getId() : null);
        activity.setActorName(actor != null ? actor.getFullName() : "Hệ thống");
        activity.setType(type);
        activity.setMessage(message);
        activity.setMetadata(new HashMap<>(metadata));
        activity.setCreatedAt(System.currentTimeMillis());
        return taskActivityRepository.save(activity);
    }

    public List<TaskActivity> getTaskActivities(String taskId) {
        return taskActivityRepository.findByTaskIdOrderByCreatedAtDesc(taskId);
    }
}
