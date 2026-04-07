package com.projectmanagement.core_system.controller.support;

import com.projectmanagement.core_system.model.User;
import com.projectmanagement.core_system.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
public class AuthenticatedUserHelper {

    @Autowired
    private UserRepository userRepository;

    public String requireActorEmail(Authentication authentication) {
        if (authentication == null || !StringUtils.hasText(authentication.getName())) {
            throw new AccessDeniedException("Không đủ quyền!");
        }

        return authentication.getName().trim().toLowerCase();
    }

    public User requireAuthenticatedUser(Authentication authentication) {
        String actorEmail = requireActorEmail(authentication);
        return userRepository.findByEmailIgnoreCase(actorEmail)
                .orElseThrow(() -> new AccessDeniedException("Không đủ quyền!"));
    }
}
