package com.projectmanagement.core_system.controller;

import com.projectmanagement.core_system.config.JwtUtil;
import com.projectmanagement.core_system.model.ChangePasswordRequest;
import com.projectmanagement.core_system.model.User;
import com.projectmanagement.core_system.repository.UserRepository;
import com.projectmanagement.core_system.service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import com.projectmanagement.core_system.model.UpdateUserRequest;

import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/users")
@CrossOrigin(origins = "http://localhost:5173")
public class UserController {

    @Autowired
    private UserService userService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JwtUtil jwtUtil;

    // 1. Lấy danh sách tất cả (Mặc định)
    @GetMapping
    public ResponseEntity<?> getAll() { 
        try {
            return ResponseEntity.ok(userService.getAllUsers());
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).body("Lỗi: " + e.getMessage());
        }
    }

    // 2. 🔥 API MỚI: Tìm kiếm nhân viên
    // Cách gọi: GET http://localhost:8080/api/users/search?keyword=abc
    @GetMapping("/search")
    public List<User> search(@RequestParam String keyword) {
        return userService.searchUsers(keyword);
    }

    // 3. Tạo nhân viên mới
    @PostMapping
    public ResponseEntity<?> create(
            @RequestBody User user,
            @RequestParam(required = false) String deptId 
    ) {
        try {
            return ResponseEntity.ok(userService.createUser(user, deptId));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // 4. Xóa nhân viên
    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteUser(@PathVariable String id) {
        try {
            userService.deleteUser(id);
            return ResponseEntity.ok("Đã xóa nhân viên thành công!");
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // 5. 🔥 API MỚI: Đổi mật khẩu
    @PostMapping("/change-password")
    public ResponseEntity<?> changePassword(
            @RequestHeader("Authorization") String token,
            @RequestBody ChangePasswordRequest request
    ) {
        try {
            // Extract email từ JWT token
            String email = jwtUtil.extractEmail(token.replace("Bearer ", ""));
            Optional<User> userOpt = userRepository.findByEmail(email);

            if (userOpt.isEmpty()) {
                return ResponseEntity.status(401).body("User không tồn tại!");
            }

            User user = userOpt.get();
            User updatedUser = userService.changePassword(user.getId(), request.getOldPassword(), request.getNewPassword());

            return ResponseEntity.ok("Đã đổi mật khẩu thành công!");
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        } catch (Exception e) {
            return ResponseEntity.status(401).body("Không đủ quyền hoặc token không hợp lệ!");
        }
    }

    // 6. 🔥 API MỚI: Upload avatar
    @PostMapping("/upload-avatar")
    public ResponseEntity<?> uploadAvatar(
            @RequestHeader("Authorization") String token,
            @RequestParam(value = "avatar", required = false) MultipartFile avatarFile,
            @RequestParam(value = "avatarUrl", required = false) String avatarUrl
    ) {
        try {
            String email = jwtUtil.extractEmail(token.replace("Bearer ", ""));
            Optional<User> userOpt = userRepository.findByEmail(email);

            if (userOpt.isEmpty()) {
                return ResponseEntity.status(401).body("User không tồn tại!");
            }

            User user;
            if (avatarFile != null && !avatarFile.isEmpty()) {
                user = userService.uploadAvatar(userOpt.get().getId(), avatarFile);
            } else if (avatarUrl != null && !avatarUrl.isEmpty()) {
                user = userService.uploadAvatarFromUrl(userOpt.get().getId(), avatarUrl);
            } else {
                return ResponseEntity.badRequest().body("Vui lòng cung cấp file ảnh hoặc URL!");
            }
            
            return ResponseEntity.ok(user);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        } catch (Exception e) {
            return ResponseEntity.status(500).body("Lỗi upload avatar: " + e.getMessage());
        }
    }

    // 7. 🔥 API MỚI: Update user with avatar on creation
    @PostMapping("/create-with-avatar")
    public ResponseEntity<?> createWithAvatar(
            @RequestParam(required = false) String deptId,
            @RequestParam("fullName") String fullName,
            @RequestParam("email") String email,
            @RequestParam("password") String password,
            @RequestParam(value = "role", defaultValue = "EMPLOYEE") String role,
            @RequestParam(value = "avatar", required = false) MultipartFile avatarFile,
            @RequestParam(value = "avatarUrl", required = false) String avatarUrl
    ) {
        try {
            User user = new User();
            user.setFullName(fullName);
            user.setEmail(email);
            user.setPassword(password);
            user.setRole(com.projectmanagement.core_system.enums.ERole.valueOf(role));
            
            if (avatarFile != null && !avatarFile.isEmpty()) {
                user.setAvatar(userService.convertFileToBase64(avatarFile));
            } else if (avatarUrl != null && !avatarUrl.isEmpty()) {
                user.setAvatar(userService.downloadImageFromUrl(avatarUrl));
            }
            
            return ResponseEntity.ok(userService.createUser(user, deptId));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        } catch (Exception e) {
            return ResponseEntity.status(500).body("Lỗi tạo user với avatar: " + e.getMessage());
        }
    }

    // 8. Admin update employee (email, department, role)
    @PatchMapping("/{id}")
    public ResponseEntity<?> updateEmployee(
            @PathVariable String id,
            @RequestBody UpdateUserRequest request,
            @RequestParam String adminEmail
    ) {
        try {
            return ResponseEntity.ok(userService.updateEmployee(id, request, adminEmail));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
}
