package com.projectmanagement.core_system.model;

public class GoogleLoginResult {
    public enum Status {
        APPROVED,
        PENDING
    }

    private final Status status;
    private final User user;
    private final String message;

    public GoogleLoginResult(Status status, User user, String message) {
        this.status = status;
        this.user = user;
        this.message = message;
    }

    public Status getStatus() {
        return status;
    }

    public User getUser() {
        return user;
    }

    public String getMessage() {
        return message;
    }
}
