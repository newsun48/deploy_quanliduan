package com.projectmanagement.core_system.controller;

import com.projectmanagement.core_system.config.JwtUtil;
import com.projectmanagement.core_system.enums.ApprovalStatus;
import com.projectmanagement.core_system.model.ChangePasswordRequest;
import com.projectmanagement.core_system.model.ApproveUserRequest;
import com.projectmanagement.core_system.model.RejectUserRequest;
import com.projectmanagement.core_system.model.UpdateUserStatusRequest;
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
import java.util.Map;

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

    @GetMapping("/me")
    public ResponseEntity<?> getCurrentUser(@RequestHeader("Authorization") String token) {
        try {
            return ResponseEntity.ok(getAuthenticatedUser(token));
        } catch (RuntimeException e) {
            if ("USER_NOT_FOUND".equals(e.getMessage())) {
                return ResponseEntity.status(404).body("User không tồn tại!");
            }
            return ResponseEntity.status(401).body("Không đủ quyền hoặc token không hợp lệ!");
        } catch (Exception e) {
            return ResponseEntity.status(401).body("Không đủ quyền hoặc token không hợp lệ!");
        }
    }

    @GetMapping("/my-department")
    public ResponseEntity<?> getMyDepartmentUsers(@RequestHeader("Authorization") String token) {
        try {
            User currentUser = getAuthenticatedUser(token);

            if (currentUser.getDepartment() == null) {
                return ResponseEntity.ok(List.of());
            }

            return ResponseEntity.ok(userRepository.findByDepartment_Id(currentUser.getDepartment().getId()));
        } catch (RuntimeException e) {
            if ("USER_NOT_FOUND".equals(e.getMessage())) {
                return ResponseEntity.status(404).body("User không tồn tại!");
            }
            return ResponseEntity.status(401).body("Không đủ quyền hoặc token không hợp lệ!");
        } catch (Exception e) {
            return ResponseEntity.status(401).body("Không đủ quyền hoặc token không hợp lệ!");
        }
    }

    // 2. Lấy danh sách tất cả (Mặc định)
    @GetMapping
    public ResponseEntity<?> getAll() { 
        try {
            return ResponseEntity.ok(userService.getAllUsers());
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).body("Lỗi: " + e.getMessage());
        }
    }

    @GetMapping("/fix-active")
    public String fixActive() {
        List<User> users = userRepository.findAll();
         for (User u : users) {
             if (u.getApprovalStatus() == ApprovalStatus.APPROVED) {
                 u.setActive(true);
              }
               userRepository.save(u);
          }
        return "Fixed " + users.size() + " users";
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
            @RequestParam(required = false) String deptId,
            @RequestHeader("Authorization") String token
    ) {
        try {
            return ResponseEntity.ok(userService.createUser(user, deptId, extractEmailSafely(token)));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // 4. Xóa nhân viên
    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteUser(@PathVariable String id, @RequestHeader("Authorization") String token) {
        try {
            userService.deleteUser(id, extractEmailSafely(token));
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
            Optional<User> userOpt = userRepository.findByEmailIgnoreCase(email);

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
            Optional<User> userOpt = userRepository.findByEmailIgnoreCase(email);

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
            @RequestHeader("Authorization") String token,
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
                user.setAvatarUrl(userService.convertFileToBase64(avatarFile));
            } else if (avatarUrl != null && !avatarUrl.isEmpty()) {
                user.setAvatarUrl(userService.downloadImageFromUrl(avatarUrl));
            }
            
            return ResponseEntity.ok(userService.createUser(user, deptId, extractEmailSafely(token)));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        } catch (Exception e) {
            return ResponseEntity.status(500).body("Lỗi tạo user với avatar: " + e.getMessage());
        }
    }

    // 8. Cập nhật thông tin nhân viên (Admin)
    @PatchMapping("/{id}")
    public ResponseEntity<?> updateUser(
            @PathVariable String id,
            @RequestBody UpdateUserRequest request,
            @RequestHeader("Authorization") String token
    ) {
        try {
            String email = jwtUtil.extractEmail(token.replace("Bearer ", ""));
            return ResponseEntity.ok(userService.updateEmployee(id, request, email));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        } catch (Exception e) {
            return ResponseEntity.status(500).body("Lỗi server: " + e.getMessage());
        }
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<?> updateUserStatus(
            @PathVariable String id,
            @RequestHeader("Authorization") String token,
            @RequestBody UpdateUserStatusRequest request
    ) {
        try {
            String email = jwtUtil.extractEmail(token.replace("Bearer ", ""));
            return ResponseEntity.ok(userService.updateUserStatus(id, request, email));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        } catch (Exception e) {
            return ResponseEntity.status(500).body("Lỗi server: " + e.getMessage());
        }
    }

    @PatchMapping("/{id}/approve")
    public ResponseEntity<?> approveUser(
            @PathVariable String id,
            @RequestHeader("Authorization") String token,
            @RequestBody ApproveUserRequest request
    ) {
        try {
            String email = jwtUtil.extractEmail(token.replace("Bearer ", ""));
            return ResponseEntity.ok(userService.approvePendingUser(id, request, email));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        } catch (Exception e) {
            return ResponseEntity.status(500).body("Lỗi server: " + e.getMessage());
        }
    }

    @PatchMapping("/{id}/reject")
    public ResponseEntity<?> rejectUser(
            @PathVariable String id,
            @RequestHeader("Authorization") String token,
            @RequestBody RejectUserRequest request
    ) {
        try {
            String email = jwtUtil.extractEmail(token.replace("Bearer ", ""));
            return ResponseEntity.ok(userService.rejectPendingUser(id, request, email));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        } catch (Exception e) {
            return ResponseEntity.status(500).body("Lỗi server: " + e.getMessage());
        }
    }

    // 8b. Cập nhật phòng ban cho NHIỀU nhân viên (🔥 MỚI)
    @PatchMapping("/bulk-update-dept")
    public ResponseEntity<?> bulkUpdateDept(
            @RequestBody java.util.List<String> userIds,
            @RequestParam String deptId,
            @RequestParam String adminEmail
    ) {
        try {
            java.util.List<User> updatedUsers = new java.util.ArrayList<>();
            for (String userId : userIds) {
                UpdateUserRequest request = new UpdateUserRequest();
                request.setDeptId(deptId);
                updatedUsers.add(userService.updateEmployee(userId, request, adminEmail));
            }
            return ResponseEntity.ok(updatedUsers);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        } catch (Exception e) {
            return ResponseEntity.status(500).body("Lỗi server: " + e.getMessage());
        }
    }

    // 🔥 5. API CẬP NHẬT AVATAR
    @PutMapping("/{id}/avatar")
    public ResponseEntity<?> updateAvatar(
            @PathVariable String id,
            @RequestHeader("Authorization") String token,
            @RequestBody Map<String, String> request) {
        try {
            String avatarUrl = request.get("avatarUrl");
            if (avatarUrl == null || avatarUrl.trim().isEmpty()) {
                return ResponseEntity.badRequest().body("avatarUrl không được để trống!");
            }
            return ResponseEntity.ok(userService.updateAvatar(id, avatarUrl, extractEmailSafely(token)));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        } catch (Exception e) {
            return ResponseEntity.status(500).body("Lỗi server: " + e.getMessage());
        }
    }

    private String extractEmailSafely(String token) {
        if (token == null || token.isBlank() || !token.startsWith("Bearer ")) {
            return null;
        }

        return jwtUtil.extractEmail(token.replace("Bearer ", ""));
    }

    private User getAuthenticatedUser(String token) {
        String email = jwtUtil.extractEmail(token.replace("Bearer ", ""));
        return userRepository.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new RuntimeException("USER_NOT_FOUND"));
    }
}
