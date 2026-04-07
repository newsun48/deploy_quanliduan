package com.projectmanagement.core_system.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.LinkedHashMap;
import java.util.Map;

@Service
public class ResendEmailService implements EmailDeliveryService {

    private static final Logger logger = LoggerFactory.getLogger(ResendEmailService.class);

    private final RestClient restClient;

    @Value("${app.email.from:}")
    private String senderEmail;

    @Value("${app.email.reply-to:}")
    private String replyToEmail;

    @Value("${app.email.resend.api-key:}")
    private String resendApiKey;

    public ResendEmailService(
            @Value("${app.email.resend.base-url:https://api.resend.com}") String resendBaseUrl,
            @Value("${app.email.resend.connect-timeout-ms:5000}") int connectTimeoutMs,
            @Value("${app.email.resend.read-timeout-ms:10000}") int readTimeoutMs
    ) {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(connectTimeoutMs);
        requestFactory.setReadTimeout(readTimeoutMs);

        this.restClient = RestClient.builder()
                .baseUrl(resendBaseUrl)
                .requestFactory(requestFactory)
                .build();
    }

    @Override
    public void sendEmail(String to, String subject, String text, String idempotencyKey) {
        if (!StringUtils.hasText(resendApiKey) || !StringUtils.hasText(senderEmail)) {
            throw new IllegalStateException("Dịch vụ email chưa được cấu hình đầy đủ");
        }

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("from", senderEmail);
        payload.put("to", new String[]{to});
        payload.put("subject", subject);
        payload.put("text", text);

        if (StringUtils.hasText(replyToEmail)) {
            payload.put("reply_to", replyToEmail);
        }

        try {
            RestClient.RequestBodySpec request = restClient.post()
                    .uri("/emails")
                    .contentType(MediaType.APPLICATION_JSON)
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + resendApiKey);

            if (StringUtils.hasText(idempotencyKey)) {
                request.header("Idempotency-Key", idempotencyKey);
            }

            request.body(payload)
                    .retrieve()
                    .toBodilessEntity();
        } catch (RestClientException e) {
            logger.error("Email provider request failed", e);
            throw new RuntimeException("Không thể gửi email", e);
        }
    }
}
