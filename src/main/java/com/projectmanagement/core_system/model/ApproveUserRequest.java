package com.projectmanagement.core_system.model;

import com.projectmanagement.core_system.enums.ERole;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class ApproveUserRequest {
    @NotNull(message = "Vai trò không được để trống khi phê duyệt tài khoản!")
    private ERole role;
    private String deptId;

    public ERole getRole() {
        return role;
    }

    public void setRole(ERole role) {
        this.role = role;
    }

    public String getDeptId() {
        return deptId;
    }

    public void setDeptId(String deptId) {
        this.deptId = deptId;
    }
}
