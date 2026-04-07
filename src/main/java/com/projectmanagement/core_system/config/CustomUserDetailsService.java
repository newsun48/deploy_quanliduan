package com.projectmanagement.core_system.config;

import com.projectmanagement.core_system.enums.ApprovalStatus;
import com.projectmanagement.core_system.model.User;
import com.projectmanagement.core_system.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
public class CustomUserDetailsService implements UserDetailsService {

    @Autowired
    private UserRepository userRepository;

    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        User user = userRepository.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new UsernameNotFoundException("User not found with email: " + email));

        if (user.isDeleted()) {
            throw new UsernameNotFoundException("Tài khoản này không còn tồn tại trên hệ thống!");
        }

        if (user.getApprovalStatus() == ApprovalStatus.PENDING) {
            throw new DisabledException("Tài khoản đang chờ phê duyệt!");
        }

        if (user.getApprovalStatus() == ApprovalStatus.REJECTED) {
            if (StringUtils.hasText(user.getRejectionReason())) {
                throw new DisabledException("Tài khoản đã bị từ chối: " + user.getRejectionReason());
            }
            throw new DisabledException("Tài khoản đã bị từ chối bởi quản trị viên!");
        }

        if (user.getRole() == null) {
            throw new DisabledException("Tài khoản chưa được gán vai trò!");
        }

        return org.springframework.security.core.userdetails.User.builder()
                .username(user.getEmail())
                .password(user.getPassword())
                .roles(user.getRole().name())
                .disabled(!user.isActive())
                .build();
    }
}
