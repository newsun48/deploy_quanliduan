package com.projectmanagement.core_system.config;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import javax.crypto.SecretKey;
import java.util.Date;
import java.util.Objects;

@Component
public class JwtUtil {

    @Value("${app.jwt.secret:}")
    private String secretKey;

    @Value("${app.jwt.expiration-ms:86400000}")
    private long expirationTime;

    @PostConstruct
    void validateConfiguration() {
        if (!StringUtils.hasText(secretKey) || secretKey.trim().length() < 32) {
            throw new IllegalStateException("JWT secret must be configured and at least 32 characters long");
        }
    }

    private SecretKey getSigningKey() {
        return Keys.hmacShaKeyFor(secretKey.getBytes());
    }

    public String generateToken(String email, String role, Long authVersion) {
        return Jwts.builder()
                .setSubject(email)
                .claim("role", role)
                .claim("authVersion", authVersion != null ? authVersion : 0L)
                .setIssuedAt(new Date())
                .setExpiration(new Date(System.currentTimeMillis() + expirationTime))
                .signWith(getSigningKey(), SignatureAlgorithm.HS256)
                .compact();
    }

    public Long extractAuthVersion(String token) {
        return extractAllClaims(token).get("authVersion", Long.class);
    }

    public String extractEmail(String token) {
        return extractAllClaims(token).getSubject();
    }

    public String extractRole(String token) {
        return extractAllClaims(token).get("role", String.class);
    }

    public boolean isTokenExpired(String token) {
        return extractAllClaims(token)
                .getExpiration()
                .before(new Date());
    }

    public boolean validateToken(String token, com.projectmanagement.core_system.model.User user) {
        long currentAuthVersion = user.getAuthVersion() != null ? user.getAuthVersion() : 0L;
        Long tokenAuthVersion = extractAuthVersion(token);
        return user.getEmail().equals(extractEmail(token))
                && !isTokenExpired(token)
                && Objects.equals(currentAuthVersion, tokenAuthVersion != null ? tokenAuthVersion : 0L);
    }

    private Claims extractAllClaims(String token) {
        return Jwts.parserBuilder()
                .setSigningKey(getSigningKey())
                .build()
                .parseClaimsJws(token)
                .getBody();
    }
}
