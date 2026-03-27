package com.projectmanagement.core_system.service;

import com.projectmanagement.core_system.model.Department;
import com.projectmanagement.core_system.model.UpdateUserStatusRequest;
import com.projectmanagement.core_system.model.User;
import com.projectmanagement.core_system.repository.DepartmentRepository;
import com.projectmanagement.core_system.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;
import java.util.Base64;
import java.util.Map;

import java.util.List;
import java.io.IOException;
import java.net.URL;
import java.net.URLConnection;
import com.projectmanagement.core_system.model.UpdateUserRequest;
import com.projectmanagement.core_system.enums.ERole;

@Service
public class UserService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private DepartmentRepository departmentRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private UserActivityService userActivityService;

    // 1. Tạo User (Thêm Validate kỹ càng hơn)
    public User createUser(User user, String deptId) {
        return createUser(user, deptId, null);
    }

    public User createUser(User user, String deptId, String actorEmail) {
        // 🔥 Validate dữ liệu đầu vào
        if (!StringUtils.hasText(user.getFullName())) {
            throw new RuntimeException("Họ tên không được để trống!");
        }
        if (!StringUtils.hasText(user.getEmail())) {
            throw new RuntimeException("Email không được để trống!");
        }
        if (!StringUtils.hasText(user.getPassword())) {
            throw new RuntimeException("Mật khẩu không được để trống!");
        }

        // Check trùng email
        if (userRepository.existsByEmail(user.getEmail())) {
            throw new RuntimeException("Email '" + user.getEmail() + "' đã tồn tại trong hệ thống!");
        }

        // Logic gắn phòng ban
        if (deptId != null && !deptId.isEmpty()) {
            Department dept = departmentRepository.findById(deptId)
                    .orElseThrow(() -> new RuntimeException("Phòng ban không tồn tại!"));
            user.setDepartment(dept);
        }

        // Mã hóa pass - ID để MongoDB tự tạo
        user.setPassword(passwordEncoder.encode(user.getPassword()));
        if (user.getRole() == ERole.ADMIN) {
            user.setActive(true);
        }
        
        user = userRepository.save(user);

        // Auto assign as manager if role is MANAGER
        if (user.getRole() == com.projectmanagement.core_system.enums.ERole.MANAGER && user.getDepartment() != null) {
            Department dept = user.getDepartment();
            dept.setManager(user);
            departmentRepository.save(dept);
        }

        User actor = getActorByEmail(actorEmail);
        userActivityService.record(actor, user, "USER_CREATED",
                (actor != null ? actor.getFullName() : "Hệ thống") + " đã tạo tài khoản cho " + user.getFullName(),
                Map.of(
                        "role", user.getRole().name(),
                        "departmentId", user.getDepartment() != null ? user.getDepartment().getId() : ""
                ));

        return user;
    }

    // 2. Lấy tất cả
    public List<User> getAllUsers() { 
        return userRepository.findAll(); 
    }

    // 3. Xóa User
    public void deleteUser(String userId) {
        deleteUser(userId, null);
    }

    public void deleteUser(String userId, String actorEmail) {
        User user = userRepository.findById(userId).orElseThrow(() -> new RuntimeException("User không tồn tại!"));
        if (user.getRole() == com.projectmanagement.core_system.enums.ERole.ADMIN) {
            throw new RuntimeException("Không được phép xóa tài khoản Quản trị viên (ADMIN)!");
        }
        User actor = getActorByEmail(actorEmail);
        userActivityService.record(actor, user, "USER_DELETED",
                (actor != null ? actor.getFullName() : "Hệ thống") + " đã xóa tài khoản của " + user.getFullName(),
                Map.of("role", user.getRole().name()));
        userRepository.deleteById(userId);
    }

    // 4. Lấy theo ID
    public User getUserById(String id) {
        return userRepository.findById(id).orElseThrow(() -> new RuntimeException("Không tìm thấy User: " + id));
    }

    // 5. 🔥 MỚI: Tìm kiếm User
    public List<User> searchUsers(String keyword) {
        if (keyword == null || keyword.trim().isEmpty()) {
            return getAllUsers(); // Nếu từ khóa rỗng thì trả về tất cả
        }
        return userRepository.findByFullNameContainingIgnoreCaseOrEmailContainingIgnoreCase(keyword, keyword);
    }

    // 6. 🔥 MỚI: Đổi mật khẩu
    public User changePassword(String userId, String oldPassword, String newPassword) {
        User user = getUserById(userId);

        // Verify old password
        if (!passwordEncoder.matches(oldPassword, user.getPassword())) {
            throw new RuntimeException("Mật khẩu cũ không chính xác!");
        }

        // Validate new password
        if (!StringUtils.hasText(newPassword) || newPassword.length() < 6) {
            throw new RuntimeException("Mật khẩu mới phải có ít nhất 6 ký tự!");
        }

        // Update password
        user.setPassword(passwordEncoder.encode(newPassword));
        User savedUser = userRepository.save(user);
        userActivityService.record(savedUser, savedUser, "PASSWORD_CHANGED",
                savedUser.getFullName() + " đã thay đổi mật khẩu");
        return savedUser;
    }

    // 7. 🔥 MỚI: Upload Avatar
    public User uploadAvatar(String userId, MultipartFile avatarFile) throws IOException {
        if (avatarFile == null || avatarFile.isEmpty()) {
            throw new IllegalArgumentException("File ảnh không được để trống!");
        }

        String contentType = avatarFile.getContentType();
        if (contentType == null || !contentType.matches("image/(png|jpeg|jpg)")) {
            throw new IllegalArgumentException("Chỉ chấp nhận file ảnh PNG hoặc JPG!");
        }

        if (avatarFile.getSize() > 5 * 1024 * 1024) {
            throw new IllegalArgumentException("Kích thước ảnh không được vượt quá 5MB!");
        }

        User user = getUserById(userId);
        String base64Avatar = convertFileToBase64(avatarFile);
        user.setAvatarUrl(base64Avatar);
        User savedUser = userRepository.save(user);
        userActivityService.record(savedUser, savedUser, "AVATAR_UPDATED",
                savedUser.getFullName() + " đã cập nhật avatar");
        return savedUser;
    }

    // 8. 🔥 MỚI: Convert File to Base64
    public String convertFileToBase64(MultipartFile file) throws IOException {
        if (file == null || file.isEmpty()) {
            return null;
        }

        byte[] fileBytes = file.getBytes();
        String base64 = Base64.getEncoder().encodeToString(fileBytes);
        String contentType = file.getContentType();
        
        // Return data URL format
        return "data:" + contentType + ";base64," + base64;
    }

    // 9. 🔥 MỚI: Upload Avatar from URL
    public User uploadAvatarFromUrl(String userId, String imageUrl) throws IOException {
        if (imageUrl == null || imageUrl.isEmpty()) {
            throw new IllegalArgumentException("URL ảnh không được để trống!");
        }

        User user = getUserById(userId);
        String base64Avatar = downloadImageFromUrl(imageUrl);
        user.setAvatarUrl(base64Avatar);
        User savedUser = userRepository.save(user);
        userActivityService.record(savedUser, savedUser, "AVATAR_UPDATED",
                savedUser.getFullName() + " đã cập nhật avatar từ URL");
        return savedUser;
    }

    // 10. 🔥 MỚI: Download Image from URL and convert to Base64
    public String downloadImageFromUrl(String imageUrl) throws IOException {
        if (imageUrl == null || imageUrl.isEmpty()) {
            throw new IllegalArgumentException("URL ảnh không được để trống!");
        }

        try {
            URL url = new URL(imageUrl);
            URLConnection connection = url.openConnection();
            connection.setConnectTimeout(5000);
            connection.setReadTimeout(5000);
            connection.setRequestProperty("User-Agent", "Mozilla/5.0");

            String contentType = connection.getContentType();
            if (contentType == null || !contentType.startsWith("image/")) {
                throw new IllegalArgumentException("URL không chỉ tới một file ảnh!");
            }

            byte[] imageBytes = connection.getInputStream().readAllBytes();

            if (imageBytes.length > 5 * 1024 * 1024) {
                throw new IllegalArgumentException("Kích thước ảnh từ URL không được vượt quá 5MB!");
            }

            String base64 = Base64.getEncoder().encodeToString(imageBytes);
            return "data:" + contentType + ";base64," + base64;
        } catch (java.net.MalformedURLException e) {
            throw new IllegalArgumentException("URL không hợp lệ!");
        } catch (java.net.SocketTimeoutException e) {
            throw new IllegalArgumentException("Timeout khi tải ảnh từ URL!");
        } catch (IOException e) {
            throw new IOException("Lỗi khi tải ảnh từ URL: " + e.getMessage());
        }
    }

    // 11. Admin update employee info (email, department, role)
    public User updateEmployee(String userId, UpdateUserRequest request, String adminEmail) {
        User admin = requireAdminActor(adminEmail);
        User user = getUserById(userId);

        if (user.getRole() == com.projectmanagement.core_system.enums.ERole.ADMIN) {
            throw new RuntimeException("Không được phép chỉnh sửa thông tin của Quản trị viên (ADMIN)!");
        }

        // Optional fields only
        if (request.getEmail() != null && !request.getEmail().isEmpty()) {
            if (userRepository.existsByEmail(request.getEmail()) && !user.getEmail().equals(request.getEmail())) {
                throw new RuntimeException("Email '" + request.getEmail() + "' đã được sử dụng bởi tài khoản khác!");
            }
            user.setEmail(request.getEmail());
        }

        Department oldDepartment = user.getDepartment();
        com.projectmanagement.core_system.enums.ERole oldRole = user.getRole();
        String oldEmail = user.getEmail();

        if (request.getDeptId() != null && !request.getDeptId().isEmpty()) {
            Department dept = departmentRepository.findById(request.getDeptId())
                    .orElseThrow(() -> new RuntimeException("Phòng ban không tồn tại!"));
            user.setDepartment(dept);
        }

        if (request.getRole() != null) {
            user.setRole(request.getRole());
            if (request.getRole() == ERole.ADMIN) {
                user.setActive(true);
            }
        }

        user = userRepository.save(user);

        // Bidirectional Manager Sync
        boolean roleChanged = request.getRole() != null && oldRole != request.getRole();
        boolean deptChanged = request.getDeptId() != null && !request.getDeptId().isEmpty() && 
                              (oldDepartment == null || !oldDepartment.getId().equals(request.getDeptId()));

        // 1. If user was a MANAGER and either their role changed OR they moved to a different department,
        // we must remove them as manager from their OLD department.
        if (oldRole == com.projectmanagement.core_system.enums.ERole.MANAGER && (roleChanged || deptChanged)) {
            if (oldDepartment != null && oldDepartment.getManager() != null 
                && oldDepartment.getManager().getId().equals(user.getId())) {
                oldDepartment.setManager(null);
                departmentRepository.save(oldDepartment);
            }
        }

        // 2. If user is NOW a MANAGER and their role changed OR they moved to a new department,
        // we must assign them as manager to their NEW department.
        if (user.getRole() == com.projectmanagement.core_system.enums.ERole.MANAGER && (roleChanged || deptChanged)) {
            if (user.getDepartment() != null) {
                Department currentDept = user.getDepartment();
                currentDept.setManager(user);
                departmentRepository.save(currentDept);
            }
        }

        userActivityService.record(admin, user, "USER_UPDATED",
                admin.getFullName() + " đã cập nhật thông tin của " + user.getFullName(),
                Map.of(
                        "oldEmail", oldEmail,
                        "newEmail", user.getEmail(),
                        "oldRole", oldRole.name(),
                        "newRole", user.getRole().name(),
                        "oldDepartmentId", oldDepartment != null ? oldDepartment.getId() : "",
                        "newDepartmentId", user.getDepartment() != null ? user.getDepartment().getId() : ""
                ));

        return user;
    }

    public User updateUserStatus(String userId, UpdateUserStatusRequest request, String adminEmail) {
        User admin = requireAdminActor(adminEmail);
        User user = getUserById(userId);

        if (request.getActive() == null) {
            throw new RuntimeException("Trạng thái active không được để trống!");
        }

        if (user.getRole() == ERole.ADMIN) {
            if (!request.getActive()) {
                throw new RuntimeException("Tài khoản ADMIN luôn hoạt động và không thể bị khóa!");
            }
            user.setActive(true);
            User savedUser = userRepository.save(user);
            userActivityService.record(admin, savedUser, "ADMIN_STATUS_RECONFIRMED",
                    admin.getFullName() + " đã xác nhận trạng thái hoạt động của ADMIN " + savedUser.getFullName());
            return savedUser;
        }

        user.setActive(request.getActive());
        User savedUser = userRepository.save(user);
        userActivityService.record(admin, savedUser, request.getActive() ? "USER_UNLOCKED" : "USER_LOCKED",
                admin.getFullName() + (request.getActive() ? " đã mở khóa tài khoản " : " đã khóa tài khoản ") + savedUser.getFullName());
        return savedUser;
    }

    // 🔥 6. MỚI: Cập nhật Avatar URL
    public User updateAvatar(String userId, String avatarUrl, String actorEmail) {
        User user = getUserById(userId); // Validate tồn tại
        if (!user.isActive()) {
            throw new RuntimeException("Không thể cập nhật avatar cho tài khoản đã bị khóa!");
        }
        User actor = getActorByEmail(actorEmail);
        if (actor == null) {
            throw new RuntimeException("Thiếu thông tin người dùng thực hiện thao tác!");
        }
        boolean isAdmin = actor.getRole() == ERole.ADMIN;
        boolean isSelf = actor.getId().equals(user.getId());
        if (!isAdmin && !isSelf) {
            throw new RuntimeException("Bạn không có quyền cập nhật avatar của tài khoản này!");
        }
        user.setAvatarUrl(avatarUrl.trim());
        User savedUser = userRepository.save(user);
        userActivityService.record(actor, savedUser, "AVATAR_UPDATED",
                actor.getFullName() + " đã cập nhật avatar cho " + savedUser.getFullName());
        return savedUser;
    }

    private User requireAdminActor(String adminEmail) {
        if (!StringUtils.hasText(adminEmail)) {
            throw new RuntimeException("Thiếu thông tin quản trị viên!");
        }

        User admin = userRepository.findByEmail(adminEmail)
                .orElseThrow(() -> new RuntimeException("Quản trị viên không tồn tại!"));

        if (admin.getRole() != ERole.ADMIN) {
            throw new RuntimeException("Bạn không có quyền thực hiện thao tác này!");
        }

        if (!admin.isActive()) {
            throw new RuntimeException("Tài khoản quản trị viên đã bị khóa!");
        }

        return admin;
    }

    private User getActorByEmail(String actorEmail) {
        if (!StringUtils.hasText(actorEmail)) {
            return null;
        }

        return userRepository.findByEmail(actorEmail).orElse(null);
    }
}
