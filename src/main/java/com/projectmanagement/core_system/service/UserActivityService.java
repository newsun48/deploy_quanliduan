package com.projectmanagement.core_system.service;

import com.projectmanagement.core_system.model.User;
import com.projectmanagement.core_system.model.UserActivity;
import com.projectmanagement.core_system.repository.UserActivityRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class UserActivityService {

    @Autowired
    private UserActivityRepository userActivityRepository;

    public UserActivity record(User actor, User targetUser, String type, String message) {
        return record(actor, targetUser, type, message, Map.of());
    }

    public UserActivity record(User actor, User targetUser, String type, String message, Map<String, Object> metadata) {
        UserActivity activity = new UserActivity();
        activity.setActorId(actor != null ? actor.getId() : null);
        activity.setActorName(actor != null ? actor.getFullName() : null);
        activity.setActorEmail(actor != null ? actor.getEmail() : null);
        activity.setTargetUserId(targetUser != null ? targetUser.getId() : null);
        activity.setTargetUserName(targetUser != null ? targetUser.getFullName() : null);
        activity.setTargetUserEmail(targetUser != null ? targetUser.getEmail() : null);
        activity.setType(type);
        activity.setMessage(message);
        activity.setMetadata(new HashMap<>(metadata));
        activity.setCreatedAt(LocalDateTime.now());
        return userActivityRepository.save(activity);
    }

    public List<UserActivity> getRecentActivities(String userId, int limit) {
        int safeLimit = Math.max(1, Math.min(limit, 200));
        if (userId == null || userId.isBlank()) {
            return userActivityRepository.findAllByOrderByCreatedAtDesc(PageRequest.of(0, safeLimit)).getContent();
        }

        return userActivityRepository.findByActorIdOrTargetUserIdOrderByCreatedAtDesc(userId, userId, PageRequest.of(0, safeLimit)).getContent();
    }
}
