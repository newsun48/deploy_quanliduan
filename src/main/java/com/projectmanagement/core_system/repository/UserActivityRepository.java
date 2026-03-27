package com.projectmanagement.core_system.repository;

import com.projectmanagement.core_system.model.UserActivity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface UserActivityRepository extends MongoRepository<UserActivity, String> {
    Page<UserActivity> findAllByOrderByCreatedAtDesc(Pageable pageable);
    Page<UserActivity> findByActorIdOrTargetUserIdOrderByCreatedAtDesc(String actorId, String targetUserId, Pageable pageable);
}
