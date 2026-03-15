# 🧪 Hướng Dẫn Kiểm Tra: Chức Năng Chat Nhóm Cho Trưởng Phòng

## 📌 Tổng Quan

Hướng dẫn chi tiết để kiểm tra chức năng chat nhóm cho trưởng phòng (manager) có thể tham gia chat dự án của phòng ban mình dù không phải thành viên.

---

## 🛠️ Chuẩn Bị

### 1. Đảm Bảo Hệ Thống Chạy
```bash
# Terminal 1: MongoDB
mongod

# Terminal 2: Backend (Java)
cd d:\QUANLYDUAN4
mvn spring-boot:run

# Terminal 3: Frontend (Node.js)
cd d:\QUANLYDUAN4\client-app
npm run dev
```

### 2. Tài Khoản Kiểm Tra

Chuẩn bị các tài khoản sau trong MongoDB:

```javascript
// Account 1: Trưởng phòng Kỹ Thuật
{
    "email": "manager-kt@gmail.com",
    "password": "password123",
    "fullName": "Nguyễn Văn Manager",
    "role": "MANAGER",
    "department": { "_id": "dept-kt-id" },
    "isActive": true
}

// Account 2: Nhân viên Kỹ Thuật
{
    "email": "employee-kt@gmail.com",
    "password": "password123",
    "fullName": "Trần Văn Employee",
    "role": "EMPLOYEE",
    "department": { "_id": "dept-kt-id" },
    "isActive": true
}

// Account 3: Nhân viên khác Phòng Ban
{
    "email": "employee-other@gmail.com",
    "password": "password123",
    "fullName": "Lê Thị Other",
    "role": "EMPLOYEE",
    "department": { "_id": "dept-other-id" },
    "isActive": true
}

// Department
{
    "_id": "dept-kt-id",
    "name": "Kỹ Thuật",
    "description": "Phòng Kỹ Thuật",
    "manager": { "_id": "manager-id" }  // ID của Nguyễn Văn Manager
}
```

---

## 🧪 Kịch Bản Kiểm Tra

### Kịch Bản 1: ✅ Thành Viên Dự Án Có Thể Chat

**Bước 1**: Tạo dự án "Website Portal" thuộc Kỹ Thuật
```javascript
POST /api/projects/create?deptId=dept-kt-id&email=admin@gmail.com
{
    "name": "Website Portal",
    "description": "Dự án xây dựng portal",
    "deadline": "2026-12-31"
}
// Response: Project ID = "project-portal-id"
```

**Bước 2**: Thêm "Trần Văn Employee" vào dự án
```javascript
POST /api/projects/project-portal-id/add-member/employee-kt-id
// Response: ✅ Thành công
```

**Bước 3**: Đăng nhập với "Trần Văn Employee"
- Email: `employee-kt@gmail.com`
- Password: `password123`

**Bước 4**: Vào dự án "Website Portal"
- Tìm và click vào dự án
- Panel chat hiển thị

**Bước 5**: Gửi tin nhắn
```javascript
POST /api/project-messages/send
?projectId=project-portal-id&userId=employee-kt-id
{
    "content": "Xin chào mọi người!"
}
```

**Kết Quả Mong Đợi**:
- ✅ Tin nhắn gửi thành công
- ✅ Tin nhắn hiển thị trong chat panel
- ✅ Không có lỗi

---

### Kịch Bản 2: ✅ Trưởng Phòng Có Thể Chat (Dù Không Phải Thành Viên)

**Bước 1-2**: Sử dụng dự án "Website Portal" từ Kịch Bản 1
- Dự án thuộc Phòng Kỹ Thuật
- Thành viên: [Trần Văn Employee]
- **Trước đó** không thêm "Nguyễn Văn Manager" vào members

**Bước 3**: Đăng nhập với "Nguyễn Văn Manager"
- Email: `manager-kt@gmail.com`
- Password: `password123`

**Bước 4**: Vào dự án "Website Portal"
- Tìm và click vào dự án
- Panel chat hiển thị

**Bước 5**: Gửi tin nhắn
```javascript
POST /api/project-messages/send
?projectId=project-portal-id&userId=manager-kt-id
{
    "content": "Dự án tiến hành tốt chứ?"
}
```

**Kết Quả Mong Đợi**:
- ✅ Tin nhắn gửi thành công
  - Manager KHÔNG phải thành viên nhưng vẫn được gửi
  - Vì Manager là trưởng phòng của phòng ban dự án
- ✅ Tin nhắn hiển thị trong chat panel
- ✅ Không có lỗi

**Kiểm Tra Quyền Đặc Biệt**:
```javascript
// API endpoint check
GET /api/project-messages/project/project-portal-id/user/manager-kt-id
// Response: ✅ Trả về danh sách tin nhắn (không lỗi)
```

---

### Kịch Bản 3: ❌ Người Khác Không Thể Chat

**Bước 1**: Sử dụng dự án "Website Portal" từ Kịch Bản 1

**Bước 2**: Đăng nhập với "Lê Thị Other"
- Email: `employee-other@gmail.com`
- Password: `password123`
- Phòng ban: Khác (không phải Kỹ Thuật)

**Bước 3**: Cố gắng vào dự án "Website Portal"
- Không thấy dự án trong danh sách (nếu sử dụng endpoint `/projects/accessible/{userId}`)
- **Hoặc** dự án hiển thị nhưng không thể gửi tin nhắn

**Bước 4**: Cố gắng gửi tin nhắn
```javascript
POST /api/project-messages/send
?projectId=project-portal-id&userId=other-id
{
    "content": "Xin chào"
}
```

**Kết Quả Mong Đợi**:
- ❌ Lỗi: "Bạn không có quyền tham gia chat dự án này!"
- ❌ Tin nhắn không được gửi

---

### Kịch Bản 4: 📊 Lấy Danh Sách Dự Án Accessible

**Test Endpoint**: `GET /api/projects/accessible/{userId}`

**Test 1**: Với Nhân Viên
```javascript
GET /api/projects/accessible/employee-kt-id
// Response:
[
    {
        "id": "project-portal-id",
        "name": "Website Portal",
        "status": "OPEN",
        "reason": "Là thành viên"
    }
]
```

**Test 2**: Với Trưởng Phòng
```javascript
GET /api/projects/accessible/manager-kt-id
// Response:
[
    {
        "id": "project-portal-id",
        "name": "Website Portal",
        "status": "OPEN",
        "reason": "Là trưởng phòng của phòng ban"
    }
]
```

---

## 🔍 Kiểm Tra Chi Tiết

### Test API Trực Tiếp (Postman / Curl)

#### 1. Gửi Tin Nhắn - Thành Viên
```bash
curl -X POST "http://localhost:8080/api/project-messages/send?projectId=project-portal-id&userId=employee-kt-id" \
  -H "Content-Type: application/json" \
  -d '{"content":"Tin nhắn từ nhân viên"}'

# ✅ Response 200: 
{
    "id": "msg-123",
    "content": "Tin nhắn từ nhân viên",
    "sender": { "id": "employee-kt-id", "fullName": "Trần Văn Employee" },
    "createdAt": "2026-03-15T10:30:00"
}
```

#### 2. Gửi Tin Nhắn - Trưởng Phòng
```bash
curl -X POST "http://localhost:8080/api/project-messages/send?projectId=project-portal-id&userId=manager-kt-id" \
  -H "Content-Type: application/json" \
  -d '{"content":"Tin nhắn từ trưởng phòng"}'

# ✅ Response 200:
{
    "id": "msg-124",
    "content": "Tin nhắn từ trưởng phòng",
    "sender": { "id": "manager-kt-id", "fullName": "Nguyễn Văn Manager" },
    "createdAt": "2026-03-15T10:32:00"
}
```

#### 3. Gửi Tin Nhắn - Người Khác
```bash
curl -X POST "http://localhost:8080/api/project-messages/send?projectId=project-portal-id&userId=other-id" \
  -H "Content-Type: application/json" \
  -d '{"content":"Tin nhắn từ người khác"}'

# ❌ Response 400:
"Bạn không có quyền tham gia chat dự án này!"
```

#### 4. Lấy Tin Nhắn - Với Kiểm Tra Quyền
```bash
curl "http://localhost:8080/api/project-messages/project/project-portal-id/user/manager-kt-id"

# ✅ Response 200:
[
    { "id": "msg-123", "content": "Tin nhắn từ nhân viên", ... },
    { "id": "msg-124", "content": "Tin nhắn từ trưởng phòng", ... }
]
```

#### 5. Lấy Danh Sách Dự Án Accessible
```bash
curl "http://localhost:8080/api/projects/accessible/manager-kt-id"

# ✅ Response 200:
[
    {
        "id": "project-portal-id",
        "name": "Website Portal",
        "members": [
            { "id": "employee-kt-id", "fullName": "Trần Văn Employee" }
        ],
        "department": { "id": "dept-kt-id", "name": "Kỹ Thuật" }
    }
]
```

---

## 🔐 Kiểm Tra Quyền Truy Cập

### Bảng Kiểm Tra Quyền

| Người Dùng | Vai Trò | Phòng Ban | Là Member | Có Thể Gửi Tin Nhắn | Có Thể Xem Tin Nhắn | Ghi Chú |
|-----------|------|---------|----------|-------------------|-----------------|-----------|
| Trần Văn E. | EMPLOYEE | Kỹ Thuật | ✅ | ✅ | ✅ | Thành viên |
| Nguyễn Văn M. | MANAGER | Kỹ Thuật | ❌ | ✅ | ✅ | Trưởng phòng |
| Lê Thị O. | EMPLOYEE | Khác | ❌ | ❌ | ❌ | Không có quyền |
| Admin | ADMIN | - | ❌ | ❓ | ❓ | Cần quy định |

---

## 🐛 Kiểm Tra Lỗi Tiềm Ẩn

### Tình Huống 1: Thay Đổi Trưởng Phòng
```javascript
// Lúc đầu:
dept.manager = manager-a-id
// User A có thể chat

// Sau khi thay đổi:
dept.manager = manager-b-id
// User A không thể chat nữa (✅ đúng)
// User B có thể chat (✅ đúng)
```

### Tình Huống 2: Thêm Member Sau
```javascript
// Lúc đầu: manager không là member
// manager có thể chat ✅

// Sau khi thêm manager vào members
// manager vẫn có thể chat ✅ (được phép 2 lần)
```

### Tình Huống 3: XÓA Phòng Ban
```javascript
// Nếu project.department = null
// manager không thể chat ❓ (cần quy định)
```

---

## 📝 Test Cases - Checklist

- [ ] **TC1**: Thành viên có thể gửi tin nhắn
- [ ] **TC2**: Trưởng phòng có thể gửi tin nhắn (không phải membr)
- [ ] **TC3**: Người khác không thể gửi tin nhắn
- [ ] **TC4**: Thành viên có thể xem tin nhắn
- [ ] **TC5**: Trưởng phòng có thể xem tin nhắn
- [ ] **TC6**: Người khác không thể xem tin nhắn
- [ ] **TC7**: Endpoint accessible projects hoạt động đúng
- [ ] **TC8**: Xoá tin nhắn (chỉ người gửi)
- [ ] **TC9**: Sửa tin nhắn (chỉ người gửi)
- [ ] **TC10**: Polling tin nhắn mới hoạt động

---

## 🎯 Các Lệnh Hữu Ích

### Xem Dữ Liệu MongoDB

```javascript
// Kết nối MongoDB
mongo

// Xem tất cả users
db.users.find().pretty()

// Xem tất cả projects
db.projects.find().pretty()

// Xem tất cả tin nhắn
db.project_messages.find().pretty()

// Xem tin nhắn của một dự án
db.project_messages.find({ "project._id": ObjectId("project-id") }).pretty()

// Kiểm tra cấu trúc project
db.projects.findOne({ "_id": ObjectId("project-portal-id") }).pretty()
```

### Kiểm Tra Log Backend

```bash
# Backend sẽ in ra:
# 🔵 [DEBUG] Sending message...
# ✅ [DEBUG] User has access to chat
# ✅ [DEBUG] Message sent successfully
```

---

## ✅ Tiêu Chí Thành Công

Chức năng được coi là hoàn thành nếu:
1. ✅ Thành viên có thể gửi tin nhắn
2. ✅ Trưởng phòng có thể gửi tin nhắn (dù không phải member)
3. ✅ Người khác không thể gửi tin nhắn
4. ✅ Tất cả các API endpoints hoạt động đúng
5. ✅ Không có lỗi trong console / backend logs
6. ✅ UI hiển thị tin nhắn đúng thứ tự và đúng người
7. ✅ Lỗi được thông báo rõ ràng cho user

---

## 💡 Mẹo Gỡ Lỗi

### 1. Log Chi Tiết
Thêm logs trong ProjectMessageService:
```java
System.out.println("🔍 Checking access for user: " + userId);
System.out.println("🔍 Project department: " + project.getDepartment().getName());
System.out.println("🔍 Department manager: " + project.getDepartment().getManager().getFullName());
System.out.println("✅ Access granted!");
```

### 2. Kiểm Tra Database
```javascript
// XEM Project Structure
db.projects.findOne().pretty()

// XEM User Role
db.users.findOne({ email: "manager@gmail.com" }).pretty()

// XEM Department Manager
db.departments.findOne().pretty()
```

### 3. Xóa Dữ Liệu Test
```javascript
// Xóa toàn bộ tin nhắn
db.project_messages.deleteMany({})

// Xóa toàn bộ dự án
db.projects.deleteMany({})

// Reset MongoDB
db.dropDatabase()
```

---

## 🎓 Tài Liệu Tham Khảo

- [GROUP_CHAT_DEPARTMENT_MANAGER_GUIDE.md](./GROUP_CHAT_DEPARTMENT_MANAGER_GUIDE.md)
- [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md)
