package com.projectmanagement.core_system.service;

import com.projectmanagement.core_system.model.Department;
import com.projectmanagement.core_system.model.User;
import com.projectmanagement.core_system.repository.DepartmentRepository;
import com.projectmanagement.core_system.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;
import java.util.Base64;

import java.util.List;
import java.io.IOException;
import java.net.URL;
import java.net.URLConnection;

@Service
public class UserService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private DepartmentRepository departmentRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    // 1. Tạo User (Thêm Validate kỹ càng hơn)
    public User createUser(User user, String deptId) {
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
        
        return userRepository.save(user);
    }

    // 2. Lấy tất cả
    public List<User> getAllUsers() { 
        return userRepository.findAll(); 
    }

    // 3. Xóa User
    public void deleteUser(String userId) {
        if (!userRepository.existsById(userId)) throw new RuntimeException("User không tồn tại!");
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
        return userRepository.save(user);
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
        user.setAvatar(base64Avatar);

        return userRepository.save(user);
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
        user.setAvatar(base64Avatar);

        return userRepository.save(user);
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
}