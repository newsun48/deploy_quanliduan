package com.projectmanagement.core_system.model;

import com.projectmanagement.core_system.enums.ERole;
import lombok.Data;

@Data
public class ApproveUserRequest {
    private ERole role;
    private String deptId;
}
