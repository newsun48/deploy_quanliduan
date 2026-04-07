package com.projectmanagement.core_system.service;

public interface EmailDeliveryService {
    void sendEmail(String to, String subject, String text, String idempotencyKey);
}
