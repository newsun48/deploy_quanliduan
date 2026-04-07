package com.projectmanagement.core_system.model;

import jakarta.validation.constraints.NotBlank;

public class GoogleLoginRequest {
    @NotBlank(message = "Google credential không được để trống!")
    private String credential;

    public String getCredential() {
        return credential;
    }

    public void setCredential(String credential) {
        this.credential = credential;
    }
}
