package com.projectmanagement.core_system.model;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class RejectUserRequest {
    @NotBlank(message = "Lý do từ chối không được để trống!")
    private String reason;

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }
}
