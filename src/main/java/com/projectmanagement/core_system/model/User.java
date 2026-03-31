package com.projectmanagement.core_system.model;

import com.projectmanagement.core_system.enums.ApprovalStatus;
import com.projectmanagement.core_system.enums.ERole;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.Transient;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.DBRef;
import org.springframework.data.mongodb.core.mapping.Document;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "users")
public class User {

    @Transient
    public static final String SEQUENCE_NAME = "users_sequence";

    @Id
    private String id;

    private String fullName;

    @Indexed(unique = true)
    private String email;

    @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
    private String password;

    private ERole role;

    private ApprovalStatus approvalStatus = ApprovalStatus.APPROVED;

    @DBRef
    @JsonIgnoreProperties({"manager", "members"})
    private Department department;

    private boolean isActive = true;
    private Long createdAt = System.currentTimeMillis();
    private String rejectionReason;

    @Indexed(unique = true, sparse = true)
    private String googleSubject;

    private Boolean googleEmailVerified;
    
    private String avatarUrl;
}
