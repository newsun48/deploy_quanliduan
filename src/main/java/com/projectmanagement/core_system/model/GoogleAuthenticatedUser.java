package com.projectmanagement.core_system.model;

public class GoogleAuthenticatedUser {
    private final String subject;
    private final String email;
    private final boolean emailVerified;
    private final String fullName;
    private final String pictureUrl;

    public GoogleAuthenticatedUser(String subject, String email, boolean emailVerified, String fullName, String pictureUrl) {
        this.subject = subject;
        this.email = email;
        this.emailVerified = emailVerified;
        this.fullName = fullName;
        this.pictureUrl = pictureUrl;
    }

    public String getSubject() {
        return subject;
    }

    public String getEmail() {
        return email;
    }

    public boolean isEmailVerified() {
        return emailVerified;
    }

    public String getFullName() {
        return fullName;
    }

    public String getPictureUrl() {
        return pictureUrl;
    }
}
