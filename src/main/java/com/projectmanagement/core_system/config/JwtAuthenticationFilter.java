package com.projectmanagement.core_system.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.nio.file.StandardOpenOption;
import java.time.LocalDateTime;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    @Autowired
    private JwtUtil jwtUtil;

    @Autowired
    private UserDetailsService userDetailsService;

    private void logDebug(String message) {
        try {
            String timestamp = LocalDateTime.now().toString();
            String logMsg = timestamp + " - " + message + "\n";
            Files.write(Paths.get("auth_debug.txt"), logMsg.getBytes(), StandardOpenOption.CREATE, StandardOpenOption.APPEND);
        } catch (Exception e) {
            // ignore
        }
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        
        logDebug("Incoming request: " + request.getMethod() + " " + request.getRequestURI());

        final String authHeader = request.getHeader("Authorization");
        final String jwt;
        final String userEmail;

        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            logDebug("No Bearer token found in header");
            response.setHeader("X-Debug-Auth", "No-Header");
            filterChain.doFilter(request, response);
            return;
        }

        try {
            jwt = authHeader.substring(7);
            userEmail = jwtUtil.extractEmail(jwt);
            logDebug("Token found for user: " + userEmail);
            response.setHeader("X-Debug-User", userEmail);

            if (userEmail != null && SecurityContextHolder.getContext().getAuthentication() == null) {
                UserDetails userDetails = userDetailsService.loadUserByUsername(userEmail);
                logDebug("UserDetails loaded for: " + userEmail);

                if (jwtUtil.validateToken(jwt, userEmail)) {
                    UsernamePasswordAuthenticationToken authToken = new UsernamePasswordAuthenticationToken(
                            userDetails, null, userDetails.getAuthorities());
                    authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                    SecurityContextHolder.getContext().setAuthentication(authToken);
                    logDebug("Authentication SET in SecurityContext for: " + userEmail + " with roles: " + userDetails.getAuthorities());
                    response.setHeader("X-Debug-Auth", "Authenticated");
                } else {
                    logDebug("Token validation FAILED");
                    response.setHeader("X-Debug-Auth", "Invalid-Token");
                }
            }
        } catch (Exception e) {
            logDebug("ERROR in filter: " + e.getMessage());
            response.setHeader("X-Debug-Auth", "Error-" + e.getMessage());
        }

        filterChain.doFilter(request, response);
    }
}