package com.projectmanagement.core_system.repository;

import com.projectmanagement.core_system.enums.EnterpriseWorkflowStatus;
import com.projectmanagement.core_system.model.EnterpriseWorkflowRequest;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface EnterpriseWorkflowRequestRepository extends MongoRepository<EnterpriseWorkflowRequest, String> {
    List<EnterpriseWorkflowRequest> findByRequesterIdOrderByCreatedAtDesc(String requesterId);
    List<EnterpriseWorkflowRequest> findByStatusOrderByCreatedAtDesc(EnterpriseWorkflowStatus status);
}
