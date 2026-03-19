# 📋 Tài Liệu Thực Hiện Các Tính Năng Mới

## ✅ Tính Năng 1: Đổi Mật Khẩu (Change Password)

### Backend Implementation

#### 1. **Model - ChangePasswordRequest.java**
```java
- Vị trí: src/main/java/com/projectmanagement/core_system/model/ChangePasswordRequest.java
- Chứa: oldPassword, newPassword
```

#### 2. **UserService.java - Thêm method `changePassword()`**
```java
public User changePassword(String userId, String oldPassword, String newPassword) {
    // Verify old password
    // Validate new password (min 6 characters)
    // Update password
}
```

#### 3. **UserController.java - Thêm endpoint**
```java
POST /api/users/change-password
- Header: Authorization: Bearer <token>
- Body: { "oldPassword": "", "newPassword": "" }
- Response: "Đã đổi mật khẩu thành công!"
```

**Validation:**
- ✅ Mật khẩu cũ phải chính xác
- ✅ Mật khẩu mới phải ≥ 6 ký tự
- ✅ Mật khẩu mới phải khác mật khẩu cũ

### Frontend Implementation

#### 1. **ChangePasswordForm Component**
```javascript
- Vị trí: client-app/src/components/ChangePasswordForm.jsx
- Tính năng:
  ✅ Form nhập mật khẩu cũ, mới, xác nhận
  ✅ Toggle show/hide passwords
  ✅ Validation form toàn bộ
  ✅ Hiển thị error/success messages
```

#### 2. **ProfilePage Component**
```javascript
- Vị trí: client-app/src/pages/ProfilePage.jsx
- Tabs:
  ✅ Thông Tin Cá Nhân (xem thông tin account)
  ✅ Đổi Mật Khẩu (form đổi password)
```

#### 3. **API Functions**
```javascript
- client-app/src/api.js
  userAPI.changePassword(oldPassword, newPassword)
```

#### 4. **Route**
```javascript
- Path: /profile
- Protected by PrivateRoute
```

### Cách Sử Dụng

1. **Đi đến trang cá nhân:**
   - Click nút "Tài khoản" ở navbar → Đi đến `/profile`

2. **Chuyển sang tab "Đổi Mật Khẩu"**

3. **Điền thông tin:**
   - Mật khẩu cũ
   - Mật khẩu mới (≥ 6 ký tự)
   - Xác nhận mật khẩu mới

4. **Click "Đổi Mật Khẩu"**
   - Nếu thành công → Message xanh lá
   - Nếu lỗi → Message đỏ

---

## 📢 Tính Năng 2: Những Thông Báo (Notifications)

### Backend Implementation

#### 1. **Model - Notification.java**
```java
- Vị trí: src/main/java/com/projectmanagement/core_system/model/Notification.java
- Fields:
  ✅ receiver (User) - Người nhận
  ✅ sender (User) - Người gửi
  ✅ task (Task) - Task liên quan
  ✅ message (String) - Nội dung
  ✅ type (String) - Loại (e.g., TASK_ASSIGNED)
  ✅ read (boolean) - Đã đọc?
  ✅ createdAt (Long) - Thời gian tạo
```

#### 2. **NotificationRepository.java**
```java
- Methods:
  ✅ findByReceiverOrderByCreatedAtDesc() - Lấy tất cả
  ✅ countByReceiverAndReadFalse() - Đếm chưa đọc
  ✅ findByReceiverAndReadFalseOrderByCreatedAtDesc() - Lấy chưa đọc
```

#### 3. **NotificationService.java**
```java
- Methods:
  ✅ createNotification() - Tạo thông báo
  ✅ getNotifications() - Lấy tất cả
  ✅ getUnreadCount() - Đếm chưa đọc
  ✅ getUnreadNotifications() - Lấy chưa đọc
  ✅ markAsRead() - Đánh dấu 1 thông báo
  ✅ markAllAsRead() - Đánh dấu tất cả
```

#### 4. **NotificationController.java**
```java
Endpoints:
- GET /api/notifications - Lấy tất cả thông báo
- GET /api/notifications/unread-count - Lấy số chưa đọc
- GET /api/notifications/unread - Lấy danh sách chưa đọc
- POST /api/notifications/{id}/mark-as-read - Đánh dấu 1
- POST /api/notifications/mark-all-as-read - Đánh dấu tất cả
```

#### 5. **TaskService.java - Tạo thông báo khi giao việc**
```java
public Task createTask() {
    // ... existing code ...
    Task savedTask = taskRepository.save(task);
    
    // ✅ TẠO THÔNG BÁO
    String message = "Bạn được giao công việc mới: [title] từ dự án: [name]";
    notificationService.createNotification(
        assignee,      // receiver
        assignee,      // sender (có thể thay đổi)
        savedTask,     // task
        message,       // message
        "TASK_ASSIGNED" // type
    );
    return savedTask;
}
```

### Frontend Implementation

#### 1. **NotificationBell Component**
```javascript
- Vị trí: client-app/src/components/NotificationBell.jsx
- Tính năng:
  ✅ Hiển thị chuông với badge số lượng chưa đọc
  ✅ Dropdown list thông báo (max 350px width)
  ✅ Tự động refresh mỗi 10 giây
  ✅ Click thông báo → Mark as read
  ✅ Nút "Đánh dấu tất cả" → Mark all as read
  ✅ Auto-close dropdown khi click ngoài
```

#### 2. **API Functions**
```javascript
- client-app/src/api.js
  notificationAPI.getNotifications()
  notificationAPI.getUnreadCount()
  notificationAPI.getUnreadNotifications()
  notificationAPI.markAsRead(id)
  notificationAPI.markAllAsRead()
```

#### 3. **Navbar Integration**
```javascript
- Tất cả 3 dashboards (Admin, Manager, Employee):
  ✅ Import NotificationBell component
  ✅ Thêm vào navbar
  ✅ Thêm link "Tài khoản" → /profile
```

### Cách Sử Dụng

#### Tạo Thông Báo (Backend - khi Manager giao việc)
1. Manager tạo task → Task được gán cho Employee
2. System tự động tạo thông báo TASK_ASSIGNED
3. Thông báo được save vào DB

#### Xem Thông Báo (Frontend)
1. Nhìn vào icon chuông ở navbar
2. Hiển thị số lượng thông báo chưa đọc ở badge
3. Click chuông → Mở dropdown
4. Danh sách thông báo được sắp xếp mới nhất trước
5. Thông báo chưa đọc có nền xanh nhạt
6. Click thông báo → Đánh dấu là đã đọc

#### Đánh Dấu Tất Cả
- Click "Đánh dấu tất cả" ở header dropdown
- Tất cả thông báo trong dropdown sẽ chuyển thành "Đã đọc"

---

## 📁 Danh Sách File Được Tạo/Sửa

### Backend Files
```
✅ NEW: Notification.java
✅ NEW: ChangePasswordRequest.java
✅ NEW: NotificationRepository.java
✅ NEW: NotificationService.java
✅ NEW: NotificationController.java
✅ UPDATED: UserService.java (thêm changePassword method)
✅ UPDATED: UserController.java (thêm changePassword endpoint)
✅ UPDATED: TaskService.java (thêm notification creation)
```

### Frontend Files
```
✅ NEW: client-app/src/components/NotificationBell.jsx
✅ NEW: client-app/src/components/NotificationBell.css
✅ NEW: client-app/src/components/ChangePasswordForm.jsx
✅ NEW: client-app/src/components/ChangePasswordForm.css
✅ NEW: client-app/src/pages/ProfilePage.jsx
✅ NEW: client-app/src/pages/ProfilePage.css
✅ UPDATED: client-app/src/api.js (thêm API functions)
✅ UPDATED: client-app/src/App.jsx (thêm /profile route)
✅ UPDATED: client-app/src/pages/AdminDashboard.jsx (thêm NotificationBell)
✅ UPDATED: client-app/src/pages/ManagerDashboard.jsx (thêm NotificationBell)
✅ UPDATED: client-app/src/pages/EmployeeDashboard.jsx (thêm NotificationBell)
```

---

## 🏗️ Architecture Overview

### Notification Flow
```
Manager tạo Task
    ↓
TaskService.createTask() được gọi
    ↓
Notification được tạo bởi NotificationService
    ↓
Thông báo lưu vào MongoDB collection "notifications"
    ↓
Frontend poll API mỗi 10 giây
    ↓
NotificationBell component cập nhật unread count
    ↓
Employee thấy badge + icon chuông
    ↓
Employee click → Xem danh sách + Mark as read
```

### Change Password Flow
```
Employee click "Tài khoản" → /profile
    ↓
Chọn tab "Đổi Mật Khẩu"
    ↓
Điền oldPassword + newPassword
    ↓
Click "Đổi Mật Khẩu" → POST /api/users/change-password
    ↓
Backend verify oldPassword + validate newPassword
    ↓
Update password trong DB (bcrypt hashed)
    ↓
Response thành công/lỗi
    ↓
Frontend hiển thị success/error message
```

---

## ✨ Features Highlights

### Change Password
- ✅ Mã hóa bcrypt (PasswordEncoder)
- ✅ Xác thực JWT token
- ✅ Validation server-side
- ✅ Hiển thị/ẩn mật khẩu bằng icon
- ✅ Xác nhận mật khẩu
- ✅ Gợi ý bảo mật

### Notifications
- ✅ Real-time-like (poll mỗi 10s)
- ✅ Mark single/all as read
- ✅ Automatic creation on task assignment
- ✅ User-friendly UI
- ✅ Scrollable dropdown
- ✅ Badge counter
- ✅ Timestamp formatting

---

## 🔧 Troubleshooting

### Backend Compilation Issues
```bash
# Nếu có lỗi compilation:
mvn clean compile -DskipTests

# Nếu vẫn lỗi:
- Check Import statements
- Verify Lombok annotations
- Check MongoDB repository methods
```

### Frontend Build Issues
```bash
# Nếu có lỗi build:
cd client-app
npm install
npm run build

# Nếu vẫn lỗi:
- Check import paths
- Verify CSS files
- Check component structure
```

### Notification Not Showing
```
1. Verify NotificationBell imported in dashboard
2. Check API endpoint alive
3. Check MongoDB notifications collection exists
4. Verify unreadCount > 0
5. Check localStorage token valid
```

---

## 📝 API Testing Guide

### Test Đổi Mật Khẩu
```bash
curl -X POST http://localhost:8080/api/users/change-password \
  -H "Authorization: Bearer <your-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "oldPassword": "123456",
    "newPassword": "newpass123"
  }'
```

### Test Lấy Số Thông Báo Chưa Đọc
```bash
curl -X GET http://localhost:8080/api/notifications/unread-count \
  -H "Authorization: Bearer <your-jwt-token>"
```

### Test Lấy Danh Sách Thông Báo
```bash
curl -X GET http://localhost:8080/api/notifications \
  -H "Authorization: Bearer <your-jwt-token>"
```

### Test Đánh Dấu Tất Cả Là Đã Đọc
```bash
curl -X POST http://localhost:8080/api/notifications/mark-all-as-read \
  -H "Authorization: Bearer <your-jwt-token>"
```

---

## 🎯 Next Steps (Optional Enhancements)

1. **WebSocket Integration** - Real-time notifications (thay vì poll)
2. **Notification Preferences** - User có thể chọn loại thông báo
3. **Email Notifications** - Gửi email khi có task mới
4. **Delete Notification** - Xóa thông báo cũ
5. **Notification History** - Archive/History page
6. **Update Task Status Notification** - Thông báo khi task được update

---

## ✅ Verification Checklist

- [x] Backend compilation successful
- [x] Frontend build successful
- [x] All files created/updated
- [x] API endpoints tested
- [x] Components imported correctly
- [x] Routes added to App.jsx
- [x] NotificationBell added to all dashboards
- [x] Profile page route protected
- [x] Change password endpoint secured with JWT
- [x] Notifications auto-created on task assignment

---

**Ngày hoàn thành:** March 14, 2026
**Trạng thái:** ✅ COMPLETE - Sẵn sàng sử dụng
