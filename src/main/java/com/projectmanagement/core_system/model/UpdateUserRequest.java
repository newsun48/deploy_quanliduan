package com.projectmanagement.core_system.model;

import com.projectmanagement.core_system.enums.ERole;
import jakarta.validation.constraints.Email;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class UpdateUserRequest {
    @Email(message = "Email không hợp lệ!")
    private String email;
    private String deptId;
    private ERole role;
    private String successorId;

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getDeptId() {
        return deptId;
    }

    public void setDeptId(String deptId) {
        this.deptId = deptId;
    }

    public ERole getRole() {
        return role;
    }

    public void setRole(ERole role) {
        this.role = role;
    }

    public String getSuccessorId() {
        return successorId;
    }

    public void setSuccessorId(String successorId) {
        this.successorId = successorId;
    }
}

