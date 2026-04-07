package com.projectmanagement.core_system.repository;

import com.projectmanagement.core_system.model.AdminActivity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AdminActivityRepository extends MongoRepository<AdminActivity, String> {
    
    Page<AdminActivity> findAllByOrderByCreatedAtDesc(Pageable pageable);
    
    List<AdminActivity> findByActorIdOrderByCreatedAtDesc(String actorId);
    
    List<AdminActivity> findByEntityTypeAndEntityIdOrderByCreatedAtDesc(String entityType, String entityId);
    
    List<AdminActivity> findByUndoableAndUndoneOrderByCreatedAtDesc(boolean undoable, boolean undone);
    
    Page<AdminActivity> findByUndoableAndUndoneOrderByCreatedAtDesc(boolean undoable, boolean undone, Pageable pageable);
}