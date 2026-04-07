package com.projectmanagement.core_system.model;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class UpdateUserStatusRequest {
    @NotNull(message = "Trạng thái active không được để trống!")
    private Boolean active;
}
