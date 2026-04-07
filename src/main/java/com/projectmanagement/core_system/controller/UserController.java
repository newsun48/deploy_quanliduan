package com.projectmanagement.core_system.controller;

import com.projectmanagement.core_system.controller.support.AuthenticatedUserHelper;
import com.projectmanagement.core_system.enums.ApprovalStatus;
import com.projectmanagement.core_system.model.CreateUserRequest;
import com.projectmanagement.core_system.model.ChangePasswordRequest;
import com.projectmanagement.core_system.model.ApproveUserRequest;
import com.projectmanagement.core_system.model.RejectUserRequest;
import com.projectmanagement.core_system.model.UpdateAvatarRequest;
import com.projectmanagement.core_system.model.UpdateUserStatusRequest;
import com.projectmanagement.core_system.model.User;
import com.projectmanagement.core_system.repository.UserRepository;
import com.projectmanagement.core_system.service.UserService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
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
    private AuthenticatedUserHelper authenticatedUserHelper;

    @GetMapping("/me")
    public ResponseEntity<?> getCurrentUser(Authentication authentication) {
        try {
            return ResponseEntity.ok(authenticatedUserHelper.requireAuthenticatedUser(authentication));
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
    public ResponseEntity<?> getMyDepartmentUsers(Authentication authentication) {
        try {
            User currentUser = authenticatedUserHelper.requireAuthenticatedUser(authentication);

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
            @Valid @RequestBody CreateUserRequest request,
            @RequestParam(required = false) String deptId,
            Authentication authentication
    ) {
        try {
            return ResponseEntity.ok(userService.createUser(toUser(request), deptId, authenticatedUserHelper.requireActorEmail(authentication)));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // 4. Xóa nhân viên
    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteUser(
            @PathVariable String id,
            @RequestParam(required = false) String successorId,
            Authentication authentication
    ) {
        try {
            userService.deleteUser(id, authenticatedUserHelper.requireActorEmail(authentication), successorId);
            return ResponseEntity.ok("Đã xóa nhân viên thành công!");
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // 5. 🔥 API MỚI: Đổi mật khẩu
    @PostMapping("/change-password")
    public ResponseEntity<?> changePassword(
            Authentication authentication,
            @Valid @RequestBody ChangePasswordRequest request
    ) {
        try {
            User user = authenticatedUserHelper.requireAuthenticatedUser(authentication);
            userService.changePassword(user.getId(), request.getOldPassword(), request.getNewPassword());

            return ResponseEntity.ok("Đã đổi mật khẩu thành công! Vui lòng đăng nhập lại.");
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        } catch (Exception e) {
            return ResponseEntity.status(401).body("Không đủ quyền hoặc token không hợp lệ!");
        }
    }

    // 6. 🔥 API MỚI: Upload avatar
    @PostMapping("/upload-avatar")
    public ResponseEntity<?> uploadAvatar(
            Authentication authentication,
            @RequestParam(value = "avatar", required = false) MultipartFile avatarFile,
            @RequestParam(value = "avatarUrl", required = false) String avatarUrl
    ) {
        try {
            User currentUser = authenticatedUserHelper.requireAuthenticatedUser(authentication);

            User user;
            if (avatarFile != null && !avatarFile.isEmpty()) {
                user = userService.uploadAvatar(currentUser.getId(), avatarFile);
            } else if (avatarUrl != null && !avatarUrl.isEmpty()) {
                user = userService.uploadAvatarFromUrl(currentUser.getId(), avatarUrl);
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
            Authentication authentication,
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
            
            return ResponseEntity.ok(userService.createUser(user, deptId, authenticatedUserHelper.requireActorEmail(authentication)));
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
            @Valid @RequestBody UpdateUserRequest request,
            Authentication authentication
    ) {
        try {
            return ResponseEntity.ok(userService.updateEmployee(id, request, authenticatedUserHelper.requireActorEmail(authentication)));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        } catch (Exception e) {
            return ResponseEntity.status(500).body("Lỗi server: " + e.getMessage());
        }
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<?> updateUserStatus(
            @PathVariable String id,
            Authentication authentication,
            @Valid @RequestBody UpdateUserStatusRequest request
    ) {
        try {
            return ResponseEntity.ok(userService.updateUserStatus(id, request, authenticatedUserHelper.requireActorEmail(authentication)));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        } catch (Exception e) {
            return ResponseEntity.status(500).body("Lỗi server: " + e.getMessage());
        }
    }

    @PatchMapping("/{id}/approve")
    public ResponseEntity<?> approveUser(
            @PathVariable String id,
            Authentication authentication,
            @Valid @RequestBody ApproveUserRequest request
    ) {
        try {
            return ResponseEntity.ok(userService.approvePendingUser(id, request, authenticatedUserHelper.requireActorEmail(authentication)));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        } catch (Exception e) {
            return ResponseEntity.status(500).body("Lỗi server: " + e.getMessage());
        }
    }

    @PatchMapping("/{id}/reject")
    public ResponseEntity<?> rejectUser(
            @PathVariable String id,
            Authentication authentication,
            @Valid @RequestBody RejectUserRequest request
    ) {
        try {
            return ResponseEntity.ok(userService.rejectPendingUser(id, request, authenticatedUserHelper.requireActorEmail(authentication)));
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
            Authentication authentication
    ) {
        try {
            String adminEmail = authenticatedUserHelper.requireActorEmail(authentication);
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
            Authentication authentication,
            @Valid @RequestBody UpdateAvatarRequest request) {
        try {
            return ResponseEntity.ok(userService.updateAvatar(id, request.getAvatarUrl(), authenticatedUserHelper.requireActorEmail(authentication)));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        } catch (Exception e) {
            return ResponseEntity.status(500).body("Lỗi server: " + e.getMessage());
        }
    }

    private User toUser(CreateUserRequest request) {
        User user = new User();
        user.setFullName(request.getFullName() != null ? request.getFullName().trim() : null);
        user.setEmail(request.getEmail() != null ? request.getEmail().trim() : null);
        user.setPassword(request.getPassword());
        user.setRole(request.getRole());
        return user;
    }
}
