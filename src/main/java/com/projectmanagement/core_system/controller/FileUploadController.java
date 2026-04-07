package com.projectmanagement.core_system.controller;

import com.projectmanagement.core_system.config.JwtUtil;
import com.projectmanagement.core_system.service.TaskService;
import com.projectmanagement.core_system.model.User;
import com.projectmanagement.core_system.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@RestController
@RequestMapping("/api/files")
@CrossOrigin(origins = "http://localhost:5173")
public class FileUploadController {

    private static final String UPLOAD_DIR = "./uploads/";
    private static final Path UPLOAD_ROOT = Paths.get(UPLOAD_DIR).toAbsolutePath().normalize();
    private static final long HEADER_BYTES_TO_READ = 16;
    private static final Set<String> ALLOWED_EXTENSIONS = Set.of(
            ".png", ".jpg", ".jpeg", ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx"
    );

    @Value("${app.upload.max-file-size-bytes:10485760}")
    private long maxUploadBytes;

    @Value("${app.upload.max-total-size-bytes:104857600}")
    private long maxTotalUploadBytes;

    @Autowired
    private JwtUtil jwtUtil;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private TaskService taskService;

    @PostMapping("/upload")
    public ResponseEntity<?> uploadFile(@RequestParam("file") MultipartFile file) {
        try {
            validateUpload(file);
            ensureStorageQuota(file.getSize());

            File uploadDir = new File(UPLOAD_DIR);
            if (!uploadDir.exists()) {
                uploadDir.mkdirs();
            }

            String originalFilename = file.getOriginalFilename();
            String extension = getNormalizedExtension(originalFilename);
            String uniqueFilename = UUID.randomUUID().toString() + extension;

            Path filePath = UPLOAD_ROOT.resolve(uniqueFilename).normalize();
            file.transferTo(filePath);

            String fileUrl = "/api/files/" + uniqueFilename;
            return ResponseEntity.ok(Map.of(
                    "url", fileUrl,
                    "originalName", originalFilename != null ? originalFilename : uniqueFilename,
                    "size", file.getSize()
            ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        } catch (IOException e) {
            return ResponseEntity.badRequest().body("Lỗi upload file: " + e.getMessage());
        }
    }

    @GetMapping("/{filename:.+}")
    public ResponseEntity<?> getFile(
            @PathVariable String filename,
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader,
            @RequestParam(value = "token", required = false) String token) {
        try {
            User actor = validateAccessToken(resolveToken(authorizationHeader, token));
            taskService.ensureCanAccessAttachmentFile(filename, actor.getEmail());

            Path filePath = UPLOAD_ROOT.resolve(filename).normalize();
            if (!filePath.startsWith(UPLOAD_ROOT)) {
                return ResponseEntity.badRequest().body("Đường dẫn file không hợp lệ!");
            }

            if (!Files.exists(filePath) || !Files.isRegularFile(filePath)) {
                return ResponseEntity.notFound().build();
            }

            Resource resource = new UrlResource(filePath.toUri());
            String contentType = Files.probeContentType(filePath);
            MediaType mediaType = (contentType != null && !contentType.isBlank())
                    ? MediaType.parseMediaType(contentType)
                    : MediaType.APPLICATION_OCTET_STREAM;

            return ResponseEntity.ok()
                    .contentType(mediaType)
                    .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + resource.getFilename() + "\"")
                    .body(resource);
        } catch (AccessDeniedException e) {
            return ResponseEntity.status(403).body(e.getMessage());
        } catch (RuntimeException e) {
            return ResponseEntity.status(401).body(e.getMessage());
        } catch (IOException e) {
            return ResponseEntity.badRequest().body("Không thể đọc file: " + e.getMessage());
        }
    }

    private void validateUpload(MultipartFile file) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("File upload không được để trống!");
        }

        if (file.getSize() > maxUploadBytes) {
            throw new IllegalArgumentException("Kích thước file vượt quá giới hạn cho phép!");
        }

        String originalFilename = file.getOriginalFilename();
        String extension = getNormalizedExtension(originalFilename);
        if (!ALLOWED_EXTENSIONS.contains(extension)) {
            throw new IllegalArgumentException("Định dạng file không được hỗ trợ!");
        }

        String declaredContentType = normalizeContentType(file.getContentType());
        if (declaredContentType == null) {
            throw new IllegalArgumentException("Không xác định được MIME type của file!");
        }

        byte[] headerBytes = readHeaderBytes(file);
        String detectedType = detectFileType(headerBytes);
        if (detectedType == null || !isSupportedUpload(extension, declaredContentType, detectedType)) {
            throw new IllegalArgumentException("Nội dung file không khớp với định dạng được phép!");
        }
    }

    private void ensureStorageQuota(long incomingFileBytes) throws IOException {
        long currentUsage = 0L;
        if (Files.exists(UPLOAD_ROOT)) {
            try (var paths = Files.walk(UPLOAD_ROOT)) {
                currentUsage = paths
                        .filter(Files::isRegularFile)
                        .mapToLong(path -> {
                            try {
                                return Files.size(path);
                            } catch (IOException e) {
                                return 0L;
                            }
                        })
                        .sum();
            }
        }

        if (currentUsage + incomingFileBytes > maxTotalUploadBytes) {
            throw new IllegalArgumentException("Dung lượng lưu trữ file tạm thời đã đạt giới hạn!");
        }
    }

    private String getNormalizedExtension(String filename) {
        if (filename == null || !filename.contains(".")) {
            throw new IllegalArgumentException("Tên file không hợp lệ!");
        }

        return filename.substring(filename.lastIndexOf('.')).toLowerCase(Locale.ROOT);
    }

    private String normalizeContentType(String contentType) {
        if (contentType == null || contentType.isBlank()) {
            return null;
        }

        return contentType.toLowerCase(Locale.ROOT).split(";")[0].trim();
    }

    private byte[] readHeaderBytes(MultipartFile file) throws IOException {
        try (InputStream inputStream = file.getInputStream()) {
            return inputStream.readNBytes((int) HEADER_BYTES_TO_READ);
        }
    }

    private String detectFileType(byte[] headerBytes) {
        if (headerBytes.length >= 8
                && (headerBytes[0] & 0xFF) == 0x89
                && headerBytes[1] == 0x50
                && headerBytes[2] == 0x4E
                && headerBytes[3] == 0x47
                && headerBytes[4] == 0x0D
                && headerBytes[5] == 0x0A
                && headerBytes[6] == 0x1A
                && headerBytes[7] == 0x0A) {
            return "png";
        }

        if (headerBytes.length >= 3
                && (headerBytes[0] & 0xFF) == 0xFF
                && (headerBytes[1] & 0xFF) == 0xD8
                && (headerBytes[2] & 0xFF) == 0xFF) {
            return "jpeg";
        }

        if (headerBytes.length >= 5
                && headerBytes[0] == 0x25
                && headerBytes[1] == 0x50
                && headerBytes[2] == 0x44
                && headerBytes[3] == 0x46
                && headerBytes[4] == 0x2D) {
            return "pdf";
        }

        if (headerBytes.length >= 8
                && (headerBytes[0] & 0xFF) == 0xD0
                && (headerBytes[1] & 0xFF) == 0xCF
                && headerBytes[2] == 0x11
                && (headerBytes[3] & 0xFF) == 0xE0
                && (headerBytes[4] & 0xFF) == 0xA1
                && (headerBytes[5] & 0xFF) == 0xB1
                && headerBytes[6] == 0x1A
                && (headerBytes[7] & 0xFF) == 0xE1) {
            return "ole2";
        }

        if (headerBytes.length >= 4
                && headerBytes[0] == 0x50
                && headerBytes[1] == 0x4B
                && (headerBytes[2] == 0x03 || headerBytes[2] == 0x05 || headerBytes[2] == 0x07)
                && (headerBytes[3] == 0x04 || headerBytes[3] == 0x06 || headerBytes[3] == 0x08)) {
            return "zip";
        }

        return null;
    }

    private boolean isSupportedUpload(String extension, String declaredContentType, String detectedType) {
        return switch (detectedType) {
            case "png" -> extension.equals(".png") && declaredContentType.equals("image/png");
            case "jpeg" -> (extension.equals(".jpg") || extension.equals(".jpeg")) && declaredContentType.equals("image/jpeg");
            case "pdf" -> extension.equals(".pdf") && declaredContentType.equals("application/pdf");
            case "zip" -> switch (extension) {
                case ".docx" -> declaredContentType.equals("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
                case ".xlsx" -> declaredContentType.equals("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
                case ".pptx" -> declaredContentType.equals("application/vnd.openxmlformats-officedocument.presentationml.presentation");
                default -> false;
            };
            case "ole2" -> switch (extension) {
                case ".doc" -> declaredContentType.equals("application/msword");
                case ".xls" -> declaredContentType.equals("application/vnd.ms-excel");
                case ".ppt" -> declaredContentType.equals("application/vnd.ms-powerpoint");
                default -> false;
            };
            default -> false;
        };
    }

    private String resolveToken(String authorizationHeader, String queryToken) {
        if (authorizationHeader != null && authorizationHeader.startsWith("Bearer ")) {
            return authorizationHeader.substring(7);
        }

        if (queryToken != null && !queryToken.isBlank()) {
            return queryToken.trim();
        }

        throw new IllegalArgumentException("Thiếu token truy cập file!");
    }

    private User validateAccessToken(String token) {
        String userEmail = jwtUtil.extractEmail(token);
        User user = userRepository.findByEmailIgnoreCase(userEmail)
                .orElseThrow(() -> new IllegalArgumentException("Người dùng không tồn tại!"));

        if (!jwtUtil.validateToken(token, user)) {
            throw new IllegalArgumentException("Token truy cập file không hợp lệ!");
        }

        return user;
    }
}
