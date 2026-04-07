package com.projectmanagement.core_system.service;

import com.projectmanagement.core_system.enums.ApprovalStatus;
import com.projectmanagement.core_system.enums.ProjectStatus;
import com.projectmanagement.core_system.model.Department;
import com.projectmanagement.core_system.model.ApproveUserRequest;
import com.projectmanagement.core_system.model.GoogleAuthenticatedUser;
import com.projectmanagement.core_system.model.GoogleLoginResult;
import com.projectmanagement.core_system.model.Project;
import com.projectmanagement.core_system.model.RejectUserRequest;
import com.projectmanagement.core_system.model.SignupRequest;
import com.projectmanagement.core_system.model.UpdateUserStatusRequest;
import com.projectmanagement.core_system.model.User;
import com.projectmanagement.core_system.repository.DepartmentRepository;
import com.projectmanagement.core_system.repository.ProjectRepository;
import com.projectmanagement.core_system.repository.TaskRepository;
import com.projectmanagement.core_system.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;
import java.io.ByteArrayOutputStream;
import java.util.Base64;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.Optional;
import java.util.Map;
import java.util.UUID;

import java.util.List;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.Inet4Address;
import java.net.Inet6Address;
import java.net.InetAddress;
import java.net.URI;
import java.net.URL;
import com.projectmanagement.core_system.model.UpdateUserRequest;
import com.projectmanagement.core_system.enums.ERole;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Service
public class UserService {

    private static final Logger logger = LoggerFactory.getLogger(UserService.class);
    private static final int AVATAR_BUFFER_SIZE = 8192;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private DepartmentRepository departmentRepository;

    @Autowired
    private ProjectRepository projectRepository;

    @Autowired
    private TaskRepository taskRepository;

    private static final EnumSet<ProjectStatus> OPEN_PROJECT_STATUSES = EnumSet.of(ProjectStatus.DRAFT, ProjectStatus.OPEN);
    private static final EnumSet<com.projectmanagement.core_system.enums.TaskStatus> OPEN_TASK_STATUSES = EnumSet.of(
            com.projectmanagement.core_system.enums.TaskStatus.TO_DO,
            com.projectmanagement.core_system.enums.TaskStatus.IN_PROGRESS,
            com.projectmanagement.core_system.enums.TaskStatus.REVIEW
    );

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private GoogleTokenVerifierService googleTokenVerifierService;

    @Autowired
    private UserActivityService userActivityService;

    @Autowired
    private EmailDeliveryService emailDeliveryService;

    @Value("${app.avatar.max-download-bytes:5242880}")
    private long maxAvatarDownloadBytes;

    @Value("${app.avatar.connect-timeout-ms:5000}")
    private int avatarConnectTimeoutMs;

    @Value("${app.avatar.read-timeout-ms:5000}")
    private int avatarReadTimeoutMs;

    @Value("${app.avatar.max-redirects:3}")
    private int maxAvatarRedirects;

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
        user.setAuthVersion((user.getAuthVersion() != null ? user.getAuthVersion() : 0L) + 1L);
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
            URI targetUri = validateExternalImageUri(imageUrl);
            HttpURLConnection connection = openValidatedImageConnection(targetUri);
            String contentType = normalizeRemoteContentType(connection.getContentType());
            if (!isAllowedRemoteImageContentType(contentType)) {
                throw new IllegalArgumentException("URL không chỉ tới một file ảnh PNG hoặc JPG hợp lệ!");
            }

            long declaredLength = connection.getContentLengthLong();
            if (declaredLength > maxAvatarDownloadBytes) {
                throw new IllegalArgumentException("Kích thước ảnh từ URL không được vượt quá 5MB!");
            }

            byte[] imageBytes;
            try (InputStream inputStream = connection.getInputStream()) {
                imageBytes = readWithLimit(inputStream, maxAvatarDownloadBytes);
            } finally {
                connection.disconnect();
            }

            String detectedContentType = detectAvatarContentType(imageBytes);
            if (detectedContentType == null || !detectedContentType.equals(contentType)) {
                throw new IllegalArgumentException("Nội dung ảnh không khớp với định dạng PNG hoặc JPG hợp lệ!");
            }

            String base64 = Base64.getEncoder().encodeToString(imageBytes);
            return "data:" + detectedContentType + ";base64," + base64;
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (java.net.MalformedURLException | java.net.URISyntaxException e) {
            throw new IllegalArgumentException("URL không hợp lệ!");
        } catch (java.net.SocketTimeoutException e) {
            throw new IllegalArgumentException("Timeout khi tải ảnh từ URL!");
        } catch (IOException e) {
            throw new IOException("Lỗi khi tải ảnh từ URL: " + e.getMessage());
        }
    }

    private URI validateExternalImageUri(String imageUrl) throws java.net.URISyntaxException, IOException {
        URI uri = new URI(imageUrl.trim());
        if (!uri.isAbsolute()) {
            throw new IllegalArgumentException("URL ảnh phải là URL tuyệt đối!");
        }

        String scheme = uri.getScheme();
        if (scheme == null || (!scheme.equalsIgnoreCase("http") && !scheme.equalsIgnoreCase("https"))) {
            throw new IllegalArgumentException("Chỉ chấp nhận URL ảnh qua HTTP hoặc HTTPS!");
        }

        if (!StringUtils.hasText(uri.getHost())) {
            throw new IllegalArgumentException("URL ảnh không hợp lệ!");
        }

        if (uri.getUserInfo() != null) {
            throw new IllegalArgumentException("URL ảnh không hợp lệ!");
        }

        ensureHostIsPublic(uri.getHost());
        return uri;
    }

    private HttpURLConnection openValidatedImageConnection(URI initialUri) throws IOException, java.net.URISyntaxException {
        URI currentUri = initialUri;
        int redirects = 0;

        while (true) {
            URL url = currentUri.toURL();
            HttpURLConnection connection = (HttpURLConnection) url.openConnection();
            connection.setConnectTimeout(avatarConnectTimeoutMs);
            connection.setReadTimeout(avatarReadTimeoutMs);
            connection.setInstanceFollowRedirects(false);
            connection.setRequestProperty("User-Agent", "ProjectManagementAvatarFetcher/1.0");
            connection.setRequestProperty("Accept", "image/png,image/jpeg");

            int status = connection.getResponseCode();
            if (!isRedirectStatus(status)) {
                if (status >= 400) {
                    connection.disconnect();
                    throw new IllegalArgumentException("Không thể tải ảnh từ URL đã cung cấp!");
                }
                return connection;
            }

            if (redirects >= maxAvatarRedirects) {
                connection.disconnect();
                throw new IllegalArgumentException("URL ảnh chuyển hướng quá nhiều lần!");
            }

            String location = connection.getHeaderField("Location");
            connection.disconnect();
            if (!StringUtils.hasText(location)) {
                throw new IllegalArgumentException("URL ảnh chuyển hướng không hợp lệ!");
            }

            currentUri = validateExternalImageUri(currentUri.resolve(location).toString());
            redirects++;
        }
    }

    private boolean isRedirectStatus(int status) {
        return status == HttpURLConnection.HTTP_MOVED_PERM
                || status == HttpURLConnection.HTTP_MOVED_TEMP
                || status == HttpURLConnection.HTTP_SEE_OTHER
                || status == 307
                || status == 308;
    }

    private void ensureHostIsPublic(String host) throws IOException {
        String normalizedHost = host.trim().toLowerCase();
        if (normalizedHost.equals("localhost") || normalizedHost.endsWith(".localhost") || normalizedHost.endsWith(".local")) {
            throw new IllegalArgumentException("URL ảnh không được trỏ tới host nội bộ!");
        }

        InetAddress[] addresses = InetAddress.getAllByName(host);
        for (InetAddress address : addresses) {
            if (isBlockedAddress(address)) {
                throw new IllegalArgumentException("URL ảnh không được trỏ tới địa chỉ mạng nội bộ!");
            }
        }
    }

    private boolean isBlockedAddress(InetAddress address) {
        if (address.isAnyLocalAddress()
                || address.isLoopbackAddress()
                || address.isLinkLocalAddress()
                || address.isSiteLocalAddress()
                || address.isMulticastAddress()) {
            return true;
        }

        byte[] raw = address.getAddress();
        if (address instanceof Inet4Address && raw.length == 4) {
            int first = raw[0] & 0xFF;
            int second = raw[1] & 0xFF;
            if (first == 0 || first == 10 || first == 127) {
                return true;
            }
            if (first == 169 && second == 254) {
                return true;
            }
            if (first == 172 && second >= 16 && second <= 31) {
                return true;
            }
            if (first == 192 && second == 168) {
                return true;
            }
            if (first == 100 && second >= 64 && second <= 127) {
                return true;
            }
        }

        if (address instanceof Inet6Address && raw.length == 16) {
            int first = raw[0] & 0xFF;
            int second = raw[1] & 0xFF;
            if ((first & 0xFE) == 0xFC) {
                return true;
            }
            return first == 0xFE && (second & 0xC0) == 0x80;
        }

        return false;
    }

    private String normalizeRemoteContentType(String contentType) {
        if (contentType == null || contentType.isBlank()) {
            return null;
        }

        return contentType.toLowerCase().split(";")[0].trim();
    }

    private boolean isAllowedRemoteImageContentType(String contentType) {
        return "image/png".equals(contentType) || "image/jpeg".equals(contentType);
    }

    private byte[] readWithLimit(InputStream inputStream, long maxBytes) throws IOException {
        ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
        byte[] buffer = new byte[AVATAR_BUFFER_SIZE];
        long totalBytes = 0L;
        int read;
        while ((read = inputStream.read(buffer)) != -1) {
            totalBytes += read;
            if (totalBytes > maxBytes) {
                throw new IllegalArgumentException("Kích thước ảnh từ URL không được vượt quá 5MB!");
            }
            outputStream.write(buffer, 0, read);
        }
        return outputStream.toByteArray();
    }

    private String detectAvatarContentType(byte[] imageBytes) {
        if (imageBytes.length >= 8
                && (imageBytes[0] & 0xFF) == 0x89
                && imageBytes[1] == 0x50
                && imageBytes[2] == 0x4E
                && imageBytes[3] == 0x47
                && imageBytes[4] == 0x0D
                && imageBytes[5] == 0x0A
                && imageBytes[6] == 0x1A
                && imageBytes[7] == 0x0A) {
            return "image/png";
        }

        if (imageBytes.length >= 3
                && (imageBytes[0] & 0xFF) == 0xFF
                && (imageBytes[1] & 0xFF) == 0xD8
                && (imageBytes[2] & 0xFF) == 0xFF) {
            return "image/jpeg";
        }

        return null;
    }

    // 11. Admin update employee info (email, department, role)
    @Transactional
    public User updateEmployee(String userId, UpdateUserRequest request, String adminEmail) {
        if (request == null) {
            throw new RuntimeException("Thiếu dữ liệu cập nhật người dùng!");
        }

        User admin = requireAdminActor(adminEmail);
        User user = getUserById(userId);

        if (user.getRole() == com.projectmanagement.core_system.enums.ERole.ADMIN) {
            throw new RuntimeException("Không được phép chỉnh sửa thông tin của Quản trị viên (ADMIN)!");
        }

        String oldEmail = user.getEmail();
        Department oldDepartment = user.getDepartment();
        com.projectmanagement.core_system.enums.ERole oldRole = user.getRole();

        Department requestedDepartment = oldDepartment;
        String requestedDeptId = StringUtils.hasText(request.getDeptId()) ? request.getDeptId().trim() : null;
        if (requestedDeptId != null) {
            requestedDepartment = departmentRepository.findById(requestedDeptId)
                    .orElseThrow(() -> new RuntimeException("Phòng ban không tồn tại!"));
        }

        ERole requestedRole = request.getRole() != null ? request.getRole() : oldRole;
        boolean roleChanged = request.getRole() != null && oldRole != request.getRole();
        boolean deptChanged = requestedDeptId != null
                && (oldDepartment == null || !oldDepartment.getId().equals(requestedDeptId));
        boolean relinquishingManagedDepartment = isRelinquishingManagedDepartment(user, oldDepartment, requestedRole, deptChanged);

        User handoffManager = null;
        DepartmentWorkSummary workSummary = DepartmentWorkSummary.empty();
        if (relinquishingManagedDepartment) {
            workSummary = inspectDepartmentWorkload(oldDepartment);
            handoffManager = resolveHandoffManager(request, oldDepartment, user.getId(), workSummary);
            oldDepartment.setManager(handoffManager);
            departmentRepository.save(oldDepartment);
        }

        // Optional fields only
        if (request.getEmail() != null && !request.getEmail().isEmpty()) {
            String normalizedEmail = normalizeEmail(request.getEmail());
            if (userRepository.existsByEmailIgnoreCase(normalizedEmail) && !user.getEmail().equalsIgnoreCase(normalizedEmail)) {
                throw new RuntimeException("Email '" + normalizedEmail + "' đã được sử dụng bởi tài khoản khác!");
            }
            user.setEmail(normalizedEmail);
        }

        if (requestedDeptId != null) {
            user.setDepartment(requestedDepartment);
        }

        if (request.getRole() != null) {
            user.setRole(request.getRole());
            if (request.getRole() == ERole.ADMIN) {
                user.setActive(true);
            }
        }

        user = userRepository.save(user);

        // Bidirectional Manager Sync
        if (user.getRole() == com.projectmanagement.core_system.enums.ERole.MANAGER && (roleChanged || deptChanged)) {
            if (user.getDepartment() != null) {
                Department currentDept = user.getDepartment();
                currentDept.setManager(user);
                departmentRepository.save(currentDept);
            }
        }

        Map<String, Object> auditMetadata = new HashMap<>();
        auditMetadata.put("oldEmail", oldEmail);
        auditMetadata.put("newEmail", user.getEmail());
        auditMetadata.put("oldRole", oldRole != null ? oldRole.name() : "");
        auditMetadata.put("newRole", roleNameOrEmpty(user));
        auditMetadata.put("oldDepartmentId", oldDepartment != null ? oldDepartment.getId() : "");
        auditMetadata.put("newDepartmentId", user.getDepartment() != null ? user.getDepartment().getId() : "");
        auditMetadata.put("handoffManagerId", handoffManager != null ? handoffManager.getId() : "");
        auditMetadata.put("handoffNote", StringUtils.hasText(request.getHandoffNote()) ? request.getHandoffNote().trim() : "");
        auditMetadata.put("hadOpenProjects", workSummary.hasOpenProjects());
        auditMetadata.put("hadOpenTasks", workSummary.hasOpenTasks());

        String activityType = relinquishingManagedDepartment ? "MANAGER_HANDOFF_COMPLETED" : "USER_UPDATED";
        String activityMessage = relinquishingManagedDepartment
                ? admin.getFullName() + " đã chuyển giao quyền quản lý của " + user.getFullName()
                : admin.getFullName() + " đã cập nhật thông tin của " + user.getFullName();

        userActivityService.record(admin, user, activityType, activityMessage, auditMetadata);

        return user;
    }

    private boolean isRelinquishingManagedDepartment(User user,
                                                     Department oldDepartment,
                                                     ERole requestedRole,
                                                     boolean deptChanged) {
        if (oldDepartment == null || oldDepartment.getManager() == null) {
            return false;
        }

        if (!user.getId().equals(oldDepartment.getManager().getId())) {
            return false;
        }

        return requestedRole != ERole.MANAGER || deptChanged;
    }

    private DepartmentWorkSummary inspectDepartmentWorkload(Department department) {
        if (department == null || !StringUtils.hasText(department.getId())) {
            return DepartmentWorkSummary.empty();
        }

        boolean hasOpenProjects = projectRepository.existsByDepartment_IdAndIsDeletedFalseAndStatusIn(department.getId(), OPEN_PROJECT_STATUSES);
        List<Project> departmentProjects = projectRepository.findByIsDeletedFalseAndDepartment_Id(department.getId());
        boolean hasOpenTasks = !departmentProjects.isEmpty()
                && taskRepository.existsByProjectInAndStatusIn(departmentProjects, OPEN_TASK_STATUSES);

        return new DepartmentWorkSummary(hasOpenProjects, hasOpenTasks);
    }

    private User resolveHandoffManager(UpdateUserRequest request,
                                       Department oldDepartment,
                                       String currentManagerId,
                                       DepartmentWorkSummary workSummary) {
        String handoffManagerId = request != null && StringUtils.hasText(request.getHandoffManagerId())
                ? request.getHandoffManagerId().trim()
                : null;

        String requirementMessage = workSummary.hasOpenProjects() || workSummary.hasOpenTasks()
                ? "Không thể hạ quyền trưởng phòng khi phòng ban vẫn còn dự án hoặc công việc đang mở. Vui lòng chuyển giao manager trước."
                : "Không thể thay đổi vai trò hoặc phòng ban của trưởng phòng khi chưa chuyển giao manager trước.";

        if (!StringUtils.hasText(handoffManagerId)) {
            throw new RuntimeException(requirementMessage);
        }

        User successor = getUserById(handoffManagerId);
        if (successor.getId().equals(currentManagerId)) {
            throw new RuntimeException("Người nhận bàn giao phải khác trưởng phòng hiện tại!");
        }
        if (successor.getRole() != ERole.MANAGER) {
            throw new RuntimeException("Người nhận bàn giao phải là MANAGER. Vui lòng bổ nhiệm người thay thế trước khi downgrade.");
        }
        if (successor.getApprovalStatus() != ApprovalStatus.APPROVED || !successor.isActive()) {
            throw new RuntimeException("Người nhận bàn giao phải là tài khoản MANAGER đang hoạt động!");
        }
        if (successor.getDepartment() == null || !oldDepartment.getId().equals(successor.getDepartment().getId())) {
            throw new RuntimeException("Người nhận bàn giao phải thuộc cùng phòng ban với trưởng phòng hiện tại!");
        }

        return successor;
    }

    private record DepartmentWorkSummary(boolean hasOpenProjects, boolean hasOpenTasks) {
        private static DepartmentWorkSummary empty() {
            return new DepartmentWorkSummary(false, false);
        }
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
        String message = "Xin chao " + user.getFullName() + ",\n\n"
                + "Tai khoan cua ban da duoc phe duyet va co the dang nhap vao he thong.\n"
                + "Neu can ho tro them, vui long lien he quan tri vien.";
        emailDeliveryService.sendEmail(user.getEmail(), "Tai khoan da duoc phe duyet", message, null);
    }

    private void sendRejectionEmail(User user, String reason) {
        String message = "Xin chao " + user.getFullName() + ",\n\n"
                + "Yeu cau dang ky tai khoan cua ban da bi tu choi.\n"
                + "Ly do: " + reason + "\n\n"
                + "Ban co the lien he quan tri vien de duoc huong dan them.";
        emailDeliveryService.sendEmail(user.getEmail(), "Tai khoan da bi tu choi phe duyet", message, null);
    }
}
