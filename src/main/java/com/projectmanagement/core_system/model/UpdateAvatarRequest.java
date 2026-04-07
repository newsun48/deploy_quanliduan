package com.projectmanagement.core_system.model;

import jakarta.validation.constraints.NotBlank;

public class UpdateAvatarRequest {
    @NotBlank(message = "avatarUrl không được để trống!")
    private String avatarUrl;

    public String getAvatarUrl() {
        return avatarUrl;
    }

    public void setAvatarUrl(String avatarUrl) {
        this.avatarUrl = avatarUrl;
    }
}
