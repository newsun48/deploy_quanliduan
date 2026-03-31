package com.projectmanagement.core_system.service;

import com.projectmanagement.core_system.enums.ApprovalStatus;
import com.projectmanagement.core_system.model.Department;
import com.projectmanagement.core_system.model.ApproveUserRequest;
import com.projectmanagement.core_system.model.GoogleAuthenticatedUser;
import com.projectmanagement.core_system.model.GoogleLoginResult;
import com.projectmanagement.core_system.model.RejectUserRequest;
import com.projectmanagement.core_system.model.SignupRequest;
import com.projectmanagement.core_system.model.UpdateUserStatusRequest;
import com.projectmanagement.core_system.model.User;
import com.projectmanagement.core_system.repository.DepartmentRepository;
import com.projectmanagement.core_system.repository.TaskRepository;
import com.projectmanagement.core_system.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;
import java.util.Base64;
import java.util.Optional;
import java.util.Map;
import java.util.UUID;

import java.util.List;
import java.io.IOException;
import java.net.URL;
import java.net.URLConnection;
import com.projectmanagement.core_system.model.UpdateUserRequest;
import com.projectmanagement.core_system.enums.ERole;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Service
public class UserService {

    private static final Logger logger = LoggerFactory.getLogger(UserService.class);

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private DepartmentRepository departmentRepository;

    @Autowired
    private TaskRepository taskRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private GoogleTokenVerifierService googleTokenVerifierService;

    @Autowired
    private UserActivityService userActivityService;

    @Autowired
    private JavaMailSender mailSender;

    @Value("${spring.mail.username}")
    private String senderEmail;

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
        if (user.getPassword().trim().length() < 6) {
            throw new RuntimeException("Mật khẩu phải có ít nhất 6 ký tự!");
        }
        if (user.getRole() == null) {
            throw new RuntimeException("Vai trò không được để trống!");
        }

        user.setFullName(user.getFullName().trim());
        user.setEmail(normalizeEmail(user.getEmail()));

        // Check trùng email
        Optional<User> existingUserOpt = userRepository.findByEmailIgnoreCase(user.getEmail());
        if (existingUserOpt.isPresent()) {
            User existingUser = existingUserOpt.get();
            if (existingUser.getApprovalStatus() == ApprovalStatus.PENDING) {
                throw new RuntimeException("Email '" + user.getEmail() + "' đã có tài khoản đang chờ duyệt. Vui lòng duyệt tài khoản này trong danh sách người dùng thay vì tạo mới!");
            }
            if (existingUser.getApprovalStatus() == ApprovalStatus.REJECTED) {
                throw new RuntimeException("Email '" + user.getEmail() + "' đã tồn tại với trạng thái bị từ chối. Vui lòng cập nhật hoặc xử lý tài khoản hiện có thay vì tạo mới!");
            }
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
        user.setApprovalStatus(ApprovalStatus.APPROVED);
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
                        "role", roleNameOrEmpty(user),
                        "departmentId", user.getDepartment() != null ? user.getDepartment().getId() : ""
                ));

        return user;
    }

    // 2. Lấy tất cả
    public List<User> getAllUsers() { 
        return userRepository.findAll(); 
    }

    public User signupPendingUser(SignupRequest request) {
        if (!StringUtils.hasText(request.getFullName())) {
            throw new RuntimeException("Họ tên không được để trống!");
        }
        if (!StringUtils.hasText(request.getEmail())) {
            throw new RuntimeException("Email không được để trống!");
        }
        if (!StringUtils.hasText(request.getPassword())) {
            throw new RuntimeException("Mật khẩu không được để trống!");
        }
        if (request.getPassword().trim().length() < 6) {
            throw new RuntimeException("Mật khẩu phải có ít nhất 6 ký tự!");
        }

        String normalizedEmail = normalizeEmail(request.getEmail());
        String normalizedFullName = request.getFullName().trim();

        if (userRepository.existsByEmailIgnoreCase(normalizedEmail)) {
            throw new RuntimeException("Email '" + normalizedEmail + "' đã tồn tại trong hệ thống!");
        }

        User user = new User();
        user.setFullName(normalizedFullName);
        user.setEmail(normalizedEmail);
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user.setRole(null);
        user.setDepartment(null);
        user.setApprovalStatus(ApprovalStatus.PENDING);
        user.setActive(false);
        user.setRejectionReason(null);

        User savedUser = userRepository.save(user);
        userActivityService.record(null, savedUser, "USER_SIGNUP_PENDING",
                savedUser.getFullName() + " đã tự đăng ký tài khoản và đang chờ phê duyệt");
        return savedUser;
    }

    public GoogleLoginResult authenticateWithGoogle(String credential) {
        GoogleAuthenticatedUser googleUser = googleTokenVerifierService.verify(credential);
        String normalizedEmail = normalizeEmail(googleUser.getEmail());

        Optional<User> userByGoogleSubject = userRepository.findByGoogleSubject(googleUser.getSubject());
        if (userByGoogleSubject.isPresent()) {
            User linkedUser = syncGoogleProfile(userByGoogleSubject.get(), googleUser, normalizedEmail);
            validateUserCanLogin(linkedUser);
            return new GoogleLoginResult(GoogleLoginResult.Status.APPROVED, linkedUser, "Đăng nhập Google thành công!");
        }

        Optional<User> existingUserOpt = userRepository.findByEmailIgnoreCase(normalizedEmail);
        if (existingUserOpt.isPresent()) {
            User existingUser = existingUserOpt.get();
            String existingGoogleSubject = existingUser.getGoogleSubject();
            if (StringUtils.hasText(existingGoogleSubject) && !existingGoogleSubject.equals(googleUser.getSubject())) {
                throw new RuntimeException("Tài khoản này đã được liên kết với một tài khoản Google khác!");
            }

            User linkedUser = syncGoogleProfile(existingUser, googleUser, normalizedEmail);
            validateUserCanLogin(linkedUser);
            return new GoogleLoginResult(GoogleLoginResult.Status.APPROVED, linkedUser, "Đăng nhập Google thành công!");
        }

        User pendingUser = createPendingGoogleUser(googleUser, normalizedEmail);
        return new GoogleLoginResult(
                GoogleLoginResult.Status.PENDING,
                pendingUser,
                "Email Google này chưa có trong hệ thống. Tài khoản của bạn đã được tạo và đang chờ quản trị viên phê duyệt!"
        );
    }

    public User approvePendingUser(String userId, ApproveUserRequest request, String adminEmail) {
        User admin = requireAdminActor(adminEmail);
        User user = getUserById(userId);

        if (request == null) {
            throw new RuntimeException("Thiếu dữ liệu phê duyệt tài khoản!");
        }
        if (request.getRole() == null) {
            throw new RuntimeException("Vai trò không được để trống khi phê duyệt tài khoản!");
        }
        if (user.getApprovalStatus() != ApprovalStatus.PENDING) {
            throw new RuntimeException("Tài khoản này không ở trạng thái chờ phê duyệt!");
        }

        user.setRole(request.getRole());

        if (StringUtils.hasText(request.getDeptId())) {
            Department dept = departmentRepository.findById(request.getDeptId())
                    .orElseThrow(() -> new RuntimeException("Phòng ban không tồn tại!"));
            user.setDepartment(dept);
        }

        user.setApprovalStatus(ApprovalStatus.APPROVED);
        user.setActive(true);
        user.setRejectionReason(null);
        User savedUser = userRepository.save(user);

        if (savedUser.getRole() == ERole.MANAGER && savedUser.getDepartment() != null) {
            Department dept = savedUser.getDepartment();
            dept.setManager(savedUser);
            departmentRepository.save(dept);
        }

        userActivityService.record(admin, savedUser, "USER_APPROVED",
                admin.getFullName() + " đã phê duyệt tài khoản " + savedUser.getFullName(),
                Map.of(
                        "role", roleNameOrEmpty(savedUser),
                        "departmentId", savedUser.getDepartment() != null ? savedUser.getDepartment().getId() : ""
                ));

        try {
            sendApprovalEmail(savedUser);
        } catch (RuntimeException e) {
            logger.error("Failed to send approval email for {}", savedUser.getEmail(), e);
        }

        return savedUser;
    }

    public User rejectPendingUser(String userId, RejectUserRequest request, String adminEmail) {
        User admin = requireAdminActor(adminEmail);
        User user = getUserById(userId);

        if (request == null || !StringUtils.hasText(request.getReason())) {
            throw new RuntimeException("Lý do từ chối không được để trống!");
        }
        if (user.getApprovalStatus() != ApprovalStatus.PENDING) {
            throw new RuntimeException("Tài khoản này không ở trạng thái chờ phê duyệt!");
        }

        String normalizedReason = request.getReason().trim();
        user.setApprovalStatus(ApprovalStatus.REJECTED);
        user.setActive(false);
        user.setRejectionReason(normalizedReason);
        User savedUser = userRepository.save(user);

        userActivityService.record(admin, savedUser, "USER_REJECTED",
                admin.getFullName() + " đã từ chối tài khoản " + savedUser.getFullName(),
                Map.of("reason", normalizedReason));

        try {
            sendRejectionEmail(savedUser, normalizedReason);
        } catch (RuntimeException e) {
            logger.error("Failed to send rejection email for {}", savedUser.getEmail(), e);
        }

        return savedUser;
    }

    public void validateUserCanLogin(User user) {
        if (user.getApprovalStatus() == ApprovalStatus.PENDING) {
            throw new RuntimeException("Tài khoản của bạn đang chờ quản trị viên phê duyệt!");
        }

        if (user.getApprovalStatus() == ApprovalStatus.REJECTED) {
            if (StringUtils.hasText(user.getRejectionReason())) {
                throw new RuntimeException("Tài khoản của bạn đã bị từ chối: " + user.getRejectionReason());
            }
            throw new RuntimeException("Tài khoản của bạn đã bị từ chối bởi quản trị viên!");
        }

        if (user.getRole() == null) {
            throw new RuntimeException("Tài khoản chưa được gán vai trò. Vui lòng liên hệ quản trị viên!");
        }

        if (!user.isActive()) {
            throw new RuntimeException("Tài khoản của bạn đang bị khóa!");
        }
    }

    // 3. Xóa User
    public void deleteUser(String userId) {
        deleteUser(userId, null);
    }

    public void deleteUser(String userId, String actorEmail) {
        User actor = requireAdminActor(actorEmail);
        User user = userRepository.findById(userId).orElseThrow(() -> new RuntimeException("User không tồn tại!"));
        if (user.getRole() == com.projectmanagement.core_system.enums.ERole.ADMIN) {
            throw new RuntimeException("Không được phép xóa tài khoản Quản trị viên (ADMIN)!");
        }
        if (taskRepository.existsByAssignee_Id(userId)) {
            throw new RuntimeException("Không thể xóa nhân viên này vì vẫn còn công việc đang được giao!");
        }
        userActivityService.record(actor, user, "USER_DELETED",
                (actor != null ? actor.getFullName() : "Hệ thống") + " đã xóa tài khoản của " + user.getFullName(),
                Map.of("role", roleNameOrEmpty(user)));
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
            String normalizedEmail = normalizeEmail(request.getEmail());
            if (userRepository.existsByEmailIgnoreCase(normalizedEmail) && !user.getEmail().equalsIgnoreCase(normalizedEmail)) {
                throw new RuntimeException("Email '" + normalizedEmail + "' đã được sử dụng bởi tài khoản khác!");
            }
            user.setEmail(normalizedEmail);
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
                        "oldRole", oldRole != null ? oldRole.name() : "",
                        "newRole", roleNameOrEmpty(user),
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

        if (request.getActive() && user.getApprovalStatus() == ApprovalStatus.PENDING) {
            throw new RuntimeException("Không thể mở khóa tài khoản đang chờ phê duyệt. Vui lòng phê duyệt tài khoản trước!");
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

        User admin = userRepository.findByEmailIgnoreCase(normalizeEmail(adminEmail))
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

        return userRepository.findByEmailIgnoreCase(normalizeEmail(actorEmail)).orElse(null);
    }

    private String roleNameOrEmpty(User user) {
        return user.getRole() != null ? user.getRole().name() : "";
    }

    private String normalizeEmail(String email) {
        if (!StringUtils.hasText(email)) {
            throw new RuntimeException("Email không được để trống!");
        }

        return email.trim().toLowerCase();
    }

    private User syncGoogleProfile(User user, GoogleAuthenticatedUser googleUser, String normalizedEmail) {
        boolean changed = false;

        if (!normalizedEmail.equalsIgnoreCase(user.getEmail())) {
            user.setEmail(normalizedEmail);
            changed = true;
        }

        if (!StringUtils.hasText(user.getGoogleSubject())) {
            user.setGoogleSubject(googleUser.getSubject());
            changed = true;
        }

        if (!Boolean.TRUE.equals(user.getGoogleEmailVerified())) {
            user.setGoogleEmailVerified(googleUser.isEmailVerified());
            changed = true;
        }

        if (!StringUtils.hasText(user.getFullName()) && StringUtils.hasText(googleUser.getFullName())) {
            user.setFullName(googleUser.getFullName().trim());
            changed = true;
        }

        if (!StringUtils.hasText(user.getAvatarUrl()) && StringUtils.hasText(googleUser.getPictureUrl())) {
            user.setAvatarUrl(googleUser.getPictureUrl().trim());
            changed = true;
        }

        return changed ? userRepository.save(user) : user;
    }

    private User createPendingGoogleUser(GoogleAuthenticatedUser googleUser, String normalizedEmail) {
        User user = new User();
        user.setFullName(StringUtils.hasText(googleUser.getFullName()) ? googleUser.getFullName().trim() : normalizedEmail);
        user.setEmail(normalizedEmail);
        user.setPassword(passwordEncoder.encode(UUID.randomUUID().toString()));
        user.setRole(null);
        user.setDepartment(null);
        user.setApprovalStatus(ApprovalStatus.PENDING);
        user.setActive(false);
        user.setRejectionReason(null);
        user.setGoogleSubject(googleUser.getSubject());
        user.setGoogleEmailVerified(googleUser.isEmailVerified());
        if (StringUtils.hasText(googleUser.getPictureUrl())) {
            user.setAvatarUrl(googleUser.getPictureUrl().trim());
        }

        User savedUser = userRepository.save(user);
        userActivityService.record(null, savedUser, "USER_SIGNUP_PENDING_GOOGLE",
                savedUser.getFullName() + " đã đăng ký bằng Google và đang chờ phê duyệt");
        return savedUser;
    }

    private void sendApprovalEmail(User user) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setTo(user.getEmail());
        message.setFrom(senderEmail);
        message.setSubject("Tai khoan da duoc phe duyet");
        message.setText("Xin chao " + user.getFullName() + ",\n\n"
                + "Tai khoan cua ban da duoc phe duyet va co the dang nhap vao he thong.\n"
                + "Neu can ho tro them, vui long lien he quan tri vien.");
        mailSender.send(message);
    }

    private void sendRejectionEmail(User user, String reason) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setTo(user.getEmail());
        message.setFrom(senderEmail);
        message.setSubject("Tai khoan da bi tu choi phe duyet");
        message.setText("Xin chao " + user.getFullName() + ",\n\n"
                + "Yeu cau dang ky tai khoan cua ban da bi tu choi.\n"
                + "Ly do: " + reason + "\n\n"
                + "Ban co the lien he quan tri vien de duoc huong dan them.");
        mailSender.send(message);
    }
}
