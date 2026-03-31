package com.projectmanagement.core_system.service;

import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import com.projectmanagement.core_system.model.GoogleAuthenticatedUser;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.io.IOException;
import java.security.GeneralSecurityException;
import java.util.Collections;

@Service
public class GoogleTokenVerifierService {

    private final String clientId;

    public GoogleTokenVerifierService(@Value("${app.google.client-id:}") String clientId) {
        this.clientId = clientId != null ? clientId.trim() : "";
    }

    public GoogleAuthenticatedUser verify(String credential) {
        if (!StringUtils.hasText(credential)) {
            throw new RuntimeException("Thiếu thông tin xác thực Google!");
        }

        if (!StringUtils.hasText(clientId)) {
            throw new RuntimeException("Thiếu cấu hình GOOGLE_WEB_CLIENT_ID cho đăng nhập Google!");
        }

        try {
            GoogleIdTokenVerifier verifier = new GoogleIdTokenVerifier.Builder(new NetHttpTransport(), GsonFactory.getDefaultInstance())
                    .setAudience(Collections.singletonList(clientId))
                    .build();
            GoogleIdToken idToken = verifier.verify(credential);
            if (idToken == null) {
                throw new RuntimeException("Token Google không hợp lệ!");
            }

            GoogleIdToken.Payload payload = idToken.getPayload();
            String email = payload.getEmail();
            Object emailVerified = payload.get("email_verified");
            boolean verified = Boolean.TRUE.equals(emailVerified)
                    || "true".equalsIgnoreCase(String.valueOf(emailVerified));

            if (!verified) {
                throw new RuntimeException("Email Google chưa được xác minh!");
            }

            return new GoogleAuthenticatedUser(
                    payload.getSubject(),
                    email,
                    true,
                    (String) payload.get("name"),
                    (String) payload.get("picture")
            );
        } catch (GeneralSecurityException | IOException e) {
            throw new RuntimeException("Không thể xác thực token Google!", e);
        }
    }
}
