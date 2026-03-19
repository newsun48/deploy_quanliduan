# 🎯 Hướng Dẫn: Chức Năng Chat Nhóm Cho Trưởng Phòng

## 📋 Tổng Quan

Chức năng này cho phép **trưởng phòng (MANAGER)** tham gia chat dự án của phòng ban mình, **dù họ không phải là thành viên dự án**. Điều này giúp trưởng phòng có thể:
- 📞 Theo dõi tiến độ dự án thông qua trò chuyện
- 💬 Tương tác với nhóm làm việc
- 👥 Đưa ra chỉ dẫn hoặc hỗ trợ kịp thời

---

## 🔧 Thay Đổi Kỹ Thuật

### 1. Backend - ProjectMessageService.java

#### ✨ Thêm Helper Method
```java
// ✅ Kiểm tra xem người dùng có thể truy cập chat dự án không
private boolean canUserAccessProjectChat(String userId, Project project) {
    // 1. Kiểm tra: người dùng có phải thành viên dự án?
    boolean isMember = project.getMembers().stream()
            .anyMatch(member -> member.getId().equals(userId));
    
    if (isMember) {
        return true;
    }

    // 2. Kiểm tra: người dùng có phải trưởng phòng của phòng ban dự án?
    if (project.getDepartment() != null && project.getDepartment().getManager() != null) {
        boolean isManager = project.getDepartment().getManager().getId().equals(userId);
        return isManager;
    }

    return false;
}
```

**Logic:**
- ✅ **PASS**: Nếu user là thành viên dự án
- ✅ **PASS**: Nếu user là trưởng phòng của phòng ban chứa dự án
- ❌ **FAIL**: Không thuộc trường hợp nào

#### 📝 Cập Nhật `sendMessage()`
```java
public ProjectMessage sendMessage(String projectId, String userId, String content) {
    Project project = projectRepository.findById(projectId)
            .orElseThrow(() -> new RuntimeException("Dự án không tồn tại!"));

    User sender = userRepository.findById(userId)
            .orElseThrow(() -> new RuntimeException("Người dùng không tồn tại!"));

    // 🔥 Kiểm tra quyền: thành viên OR trưởng phòng
    if (!canUserAccessProjectChat(userId, project)) {
        throw new RuntimeException("Bạn không có quyền tham gia chat dự án này!");
    }

    // ... (phần còn lại giữ nguyên)
}
```

#### 📨 Thêm Phương Thức Mới
```java
public List<ProjectMessage> getMessagesByProjectIdWithAccess(String projectId, String userId) {
    Project project = projectRepository.findById(projectId)
            .orElseThrow(() -> new RuntimeException("Dự án không tồn tại!"));

    // Kiểm tra quyền trước khi lấy messages
    if (!canUserAccessProjectChat(userId, project)) {
        throw new RuntimeException("Bạn không có quyền xem chat dự án này!");
    }

    return projectMessageRepository.findByProjectIdOrderByCreatedAtAsc(projectId);
}
```

---

### 2. Backend - ProjectMessageController.java

#### ➕ Thêm API Endpoint Mới
```java
// Endpoint cũ: không kiểm tra quyền (hỗ trợ ngược)
@GetMapping("/project/{projectId}")
public ResponseEntity<?> getProjectMessages(@PathVariable String projectId) {
    // ...
}

// 🆕 Endpoint mới: có kiểm tra quyền truy cập
@GetMapping("/project/{projectId}/user/{userId}")
public ResponseEntity<?> getProjectMessagesWithAccess(
        @PathVariable String projectId,
        @PathVariable String userId) {
    try {
        List<ProjectMessage> messages = projectMessageService
            .getMessagesByProjectIdWithAccess(projectId, userId);
        return ResponseEntity.ok(messages);
    } catch (RuntimeException e) {
        return ResponseEntity.badRequest().body(e.getMessage());
    }
}
```

**Endpoints:**
- `GET /api/project-messages/project/{projectId}` - Lấy tất cả tin nhắn (không kiểm tra)
- `GET /api/project-messages/project/{projectId}/user/{userId}` - Lấy tin nhắn với kiểm tra quyền
- `POST /api/project-messages/send` - Gửi tin nhắn (kiểm tra quyền)

---

### 3. Frontend - ProjectChatPanel.jsx

#### 🔄 Cập Nhật `fetchMessages()`
```javascript
const fetchMessages = async () => {
    try {
        setLoading(true);
        // ✅ Sử dụng endpoint mới với kiểm soát quyền truy cập
        const res = await api.get(
            `/project-messages/project/${project.id}/user/${currentUser.id}`
        );
        setMessages(res.data || []);
    } catch (err) {
        console.error('Error fetching messages:', err);
    } finally {
        setLoading(false);
    }
};
```

---

## 🧪 Hướng Dẫn Kiểm Tra

### Trường Hợp 1: Thành Viên Dự Án
1. Đăng nhập với **EMPLOYEE** (là thành viên dự án)
2. Vào dự án
3. ✅ **Kết Quả**: Có thể xem & gửi tin nhắn

### Trường Hợp 2: Trưởng Phòng (Không Là Thành Viên)
1. Đảm bảo MANAGER không trong `project.members`
2. Đảm bảo MANAGER là `department.manager` của phòng ban dự án
3. Đăng nhập với MANAGER account
4. Vào dự án
5. ✅ **Kết Quả**: 
   - Có thể xem tin nhắn
   - Có thể gửi tin nhắn
   - Thông báo: "Tham gia dưới tư cách trưởng phòng"

### Trường Hợp 3: Người Khác (Không Có Quyền)
1. Đăng nhập với EMPLOYEE (khác phòng ban, không là thành viên)
2. Cố gắng truy cập dự án
3. ❌ **Kết Quả**: Lỗi "Bạn không có quyền tham gia chat dự án này!"

---

## 📊 Sơ Đồ Quyền Truy Cập

```
┌─────────────────────────────────────────────┐
│ User muốn truy cập chat dự án               │
└─────────────┬───────────────────────────────┘
              │
              ├─ Là thành viên dự án? ──YES──> ✅ ALLOW
              │
              └─ Là trưởng phòng của 
                 phòng ban dự án? ──YES──> ✅ ALLOW
                 │
                 └─ ELSE ──────────────> ❌ DENY
```

---

## 🗂️ Ảnh Hưởng Đến Các Model

### Project.java
```
┌─────────────────┐
│     Project     │
├─────────────────┤
│ - id            │
│ - name          │
│ - members []    │◄────── Thành viên dự án
│ - department    │◄──┐
│ - ...           │   │
└─────────────────┘   │
                      │
         ┌────────────┘
         │
    ┌────▼────────────────┐
    │  Department         │
    ├─────────────────────┤
    │ - id                │
    │ - name              │
    │ - manager           │◄─── Trưởng phòng
    │ - ...               │
    └─────────────────────┘
```

### Quyền Truy Cập Được Xác Định Bởi:
1. **`project.members[]`** chứa user ID ✅
2. **`project.department.manager.id`** = user ID ✅

---

## 🔔 Thông Báo & Feedback

### Gửi Tin Nhắn
- ✅ **Thành công**: "Tin nhắn đã gửi"
- ❌ **Lỗi**: "Bạn không có quyền tham gia chat dự án này!"

### Lấy Tin Nhắn
- ✅ **Thành công**: Hiển thị danh sách tin nhắn
- ❌ **Lỗi**: "Bạn không có quyền xem chat dự án này!"

---

## 🚀 Lợi Ích

| Tính Năng | Lợi Ích |
|-----------|---------|
| Trưởng phòng có quyền chat | 👁️ Giám sát tiến độ, 💬 Hỗ trợ kịp thời |
| Không cần thêm thành viên dự án | ⚡ Nhanh gọn, không làm phức tạp danh sách members |
| Kiểm soát quyền chặt chẽ | 🔒 Bảo mật, tránh truy cập trái phép |
| Cải thiện giao tiếp | 🤝 Dễ dàng kết nối và hợp tác |

---

## ⚠️ Lưu Ý

1. **Quyền Sửa/Xóa**: Hiện tại, chỉ người gửi tin nhắn mới có thể sửa/xóa
2. **Vai Trò**: Chỉ áp dụng cho vai trò MANAGER, không áp dụng cho ADMIN
3. **Thay Đổi Phòng Ban**: Nếu trưởng phòng thay đổi, quyền truy cập cũng thay đổi tự động

---

## 📝 Cách Cấu Hình

### 1. Đảm Bảo Database Có Dữ Liệu Chính Xác
```javascript
// Kiểm tra cấu trúc trong MongoDB
db.projects.findOne({
    _id: "project-id"
}).pretty()

// Kết quả mong đợi:
{
    "_id": "project-id",
    "name": "Dự án A",
    "members": ["user1-id", "user2-id"],  // Danh sách members
    "department": {
        "ref": "ObjectId",
        "_id": "dept-id",
        "name": "Kỹ Thuật",
        "manager": {
            "ref": "ObjectId", 
            "_id": "manager-id"  // Trưởng phòng
        }
    }
}
```

### 2. Kiểm Tra Endpoint
```bash
# Lấy tin nhắn với kiểm tra quyền
GET http://localhost:8080/api/project-messages/project/PROJECT-ID/user/USER-ID

# Gửi tin nhắn
POST http://localhost:8080/api/project-messages/send?projectId=PROJECT-ID&userId=USER-ID
Content-Type: application/json

{ "content": "Xin chào!" }
```

---

## 🎓 Thực Hành

### Demo Script
1. **Tạo phòng ban**: "Kỹ Thuật" với trưởng phòng = "Nguyễn Văn A"
2. **Tạo dự án**: "Website A" thuộc phòng ban "Kỹ Thuật"
3. **Thêm thành viên**: "Trần Văn B" (nhân viên)
4. **Kiểm tra quyền**:
   - ✅ Nguyễn Văn A (trưởng phòng) - có thể chat dù không là member
   - ✅ Trần Văn B (thành viên) - có thể chat
   - ❌ Lê Thị C (khác phòng) - không thể chat

---

## 🔗 Liên Quan Đến

- [PROJECT_STRUCTURE.md](./IMPLEMENTATION_GUIDE.md)
- [Authentication & Authorization](./SETUP_GUIDE.md)
- [Project Management Model](./src/main/java/com/projectmanagement/core_system/model/)

