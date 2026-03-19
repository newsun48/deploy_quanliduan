package com.projectmanagement.core_system.model;

import com.projectmanagement.core_system.enums.ERole;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class UpdateUserRequest {
    private String email;
    private String deptId;
    private ERole role;
}

