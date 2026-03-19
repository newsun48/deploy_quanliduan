# 🔗 API Reference: Chức Năng Chat Nhóm Trưởng Phòng

## 📡 Danh Sách API Mới

### 1️⃣ Lấy Tin Nhắn Dự Án (Với Kiểm Tra Quyền)
```http
GET /api/project-messages/project/{projectId}/user/{userId}
```

**Mô Tả**: Lấy tất cả tin nhắn của một dự án, với kiểm tra quyền truy cập\
**Quyền**: Thành viên hoặc trưởng phòng của phòng ban\
**Status Code**:
- `200 OK` - Trả về danh sách tin nhắn
- `400 Bad Request` - Không có quyền hoặc dự án không tồn tại

**Request**:
```bash
curl http://localhost:8080/api/project-messages/project/proj-123/user/user-456
```

**Response** (200):
```json
[
    {
        "id": "msg-1",
        "content": "Xin chào mọi người",
        "sender": {
            "id": "user-456",
            "fullName": "Trần Văn A",
            "email": "tranvana@gmail.com"
        },
        "createdAt": "2026-03-15T10:30:00",
        "updatedAt": "2026-03-15T10:30:00"
    }
]
```

**Response** (400 - Không có quyền):
```
"Bạn không có quyền xem chat dự án này!"
```

---

### 2️⃣ Gửi Tin Nhắn (Cập Nhật Quyền)
```http
POST /api/project-messages/send?projectId={projectId}&userId={userId}
Content-Type: application/json

{
    "content": "Nội dung tin nhắn"
}
```

**Mô Tả**: Gửi tin nhắn mới (logic quyền đã được cập nhật)\
**Quyền**: Thành viên hoặc trưởng phòng của phòng ban\
**Status Code**:
- `200 OK` - Tin nhắn đã được gửi
- `400 Bad Request` - Không có quyền, nội dung trống, hoặc lỗi khác

**Request**:
```bash
curl -X POST "http://localhost:8080/api/project-messages/send?projectId=proj-123&userId=user-456" \
  -H "Content-Type: application/json" \
  -d '{"content":"Tin nhắn mới từ trưởng phòng"}'
```

**Response** (200):
```json
{
    "id": "msg-2",
    "content": "Tin nhắn mới từ trưởng phòng",
    "sender": {
        "id": "user-456",
        "fullName": "Nguyễn Văn Manager",
        "email": "manager@gmail.com"
    },
    "createdAt": "2026-03-15T10:35:00",
    "updatedAt": "2026-03-15T10:35:00"
}
```

**Response** (400 - Không có quyền):
```
"Bạn không có quyền tham gia chat dự án này!"
```

---

### 3️⃣ Lấy Dự Án Accessible (MỚI)
```http
GET /api/projects/accessible/{userId}
```

**Mô Tả**: Lấy danh sách tất cả dự án mà người dùng có thể truy cập\
**Bao gồm**:
- Dự án mà user là thành viên
- Dự án mà user là trưởng phòng

**Status Code**:
- `200 OK` - Trả về danh sách dự án
- `400 Bad Request` - Người dùng không tồn tại

**Request**:
```bash
curl http://localhost:8080/api/projects/accessible/user-456
```

**Response** (200):
```json
[
    {
        "id": "proj-123",
        "name": "Website Portal",
        "description": "Dự án xây dựng portal",
        "status": "OPEN",
        "deadline": "2026-12-31",
        "members": [
            {
                "id": "user-789",
                "fullName": "Trần Văn Employee",
                "email": "employee@gmail.com"
            }
        ],
        "department": {
            "id": "dept-kt",
            "name": "Kỹ Thuật"
        }
    },
    {
        "id": "proj-456",
        "name": "Mobile App",
        "description": "Ứng dụng di động",
        "status": "OPEN",
        "deadline": "2026-06-30",
        "members": [
            {
                "id": "user-111",
                "fullName": "Lê Thị Dev",
                "email": "lethibdev@gmail.com"
            }
        ],
        "department": {
            "id": "dept-kt",
            "name": "Kỹ Thuật"
        }
    }
]
```

---

### 4️⃣ API Hiện Tại (Không Sửa)
```http
GET /api/projects
```
Lấy tất cả dự án (không kiểm tra quyền)\
Vẫn sử dụng được như cũ.

```http
POST /api/projects/{projectId}/add-member/{userId}
```
Thêm thành viên vào dự án\
Vẫn hoạt động như cũ.

---

## 🔒 Quyền Truy Cập

### Ma Trận Quyền

| Hành Động | Thành Viên | Trưởng Phòng | Người Khác |
|----------|-----------|-------------|-----------|
| Gửi tin nhắn | ✅ | ✅ | ❌ |
| Xem tin nhắn | ✅ | ✅ | ❌ |
| Sửa tin nhắn* | ✅ (own) | ✅ (own) | ❌ |
| Xóa tin nhắn* | ✅ (own) | ✅ (own) | ❌ |

*Chỉ người gửi mới có thể sửa/xóa

---

## 💻 Ví Dụ Sử Dụng

### JavaScript/Fetch
```javascript
// 1. Lấy tin nhắn với kiểm tra quyền
const messages = await fetch(
    `/api/project-messages/project/proj-123/user/user-456`
).then(r => r.json());

// 2. Gửi tin nhắn
const response = await fetch(
    `/api/project-messages/send?projectId=proj-123&userId=user-456`,
    {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: "Xin chào!" })
    }
).then(r => r.json());

// 3. Lấy dự án accessible
const accessibleProjects = await fetch(
    `/api/projects/accessible/user-456`
).then(r => r.json());
```

### React
```jsx
import { useState, useEffect } from 'react';

function ProjectChat({ projectId, userId }) {
    const [messages, setMessages] = useState([]);

    useEffect(() => {
        // Sử dụng endpoint mới (tự động kiểm tra quyền)
        fetch(`/api/project-messages/project/${projectId}/user/${userId}`)
            .then(r => r.json())
            .then(data => setMessages(data))
            .catch(err => console.error("Không có quyền:", err));
    }, [projectId, userId]);

    return (
        <div>
            {messages.map(msg => (
                <div key={msg.id}>
                    <strong>{msg.sender.fullName}</strong>: {msg.content}
                </div>
            ))}
        </div>
    );
}
```

### Python/Requests
```python
import requests

BASE_URL = "http://localhost:8080/api"
PROJECT_ID = "proj-123"
USER_ID = "user-456"

# 1. Lấy tin nhắn
response = requests.get(
    f"{BASE_URL}/project-messages/project/{PROJECT_ID}/user/{USER_ID}"
)
messages = response.json()

# 2. Gửi tin nhắn
response = requests.post(
    f"{BASE_URL}/project-messages/send",
    params={
        "projectId": PROJECT_ID,
        "userId": USER_ID
    },
    json={"content": "Tin nhắn mới"}
)

# 3. Lấy accessible projects
response = requests.get(f"{BASE_URL}/projects/accessible/{USER_ID}")
projects = response.json()
```

---

## 📋 Status Codes & Lỗi

### 200 OK
Yêu cầu thành công, trả về dữ liệu mong muốn

### 400 Bad Request
Các lỗi phổ biến:
- `"Dự án không tồn tại!"` - projectId không hợp lệ
- `"Người dùng không tồn tại!"` - userId không hợp lệ
- `"Bạn không có quyền tham gia chat dự án này!"` - Không có quyền
- `"Bạn không có quyền xem chat dự án này!"` - Không có quyền xem
- `"Nội dung tin nhắn không được trống!"` - Content trống

### 500 Internal Server Error
Lỗi server (hiếm gặp), kiểm tra logs backend

---

## 🔍 Kiểm Tra Nhanh

### 1. Kiểm Tra Backend Chạy
```bash
curl http://localhost:8080/api/projects
# Kỳ vọng: HTTP 200, danh sách projects
```

### 2. Lấy Accessible Projects
```bash
curl http://localhost:8080/api/projects/accessible/manager-id-123
# Kỳ vọng: HTTP 200, danh sách projects
```

### 3. Gửi Tin Nhắn - Thành Viên
```bash
curl -X POST "http://localhost:8080/api/project-messages/send?projectId=proj-123&userId=member-id" \
  -H "Content-Type: application/json" \
  -d '{"content":"Test"}'
# Kỳ vọng: HTTP 200, message object
```

### 4. Gửi Tin Nhắn - Trưởng Phòng
```bash
curl -X POST "http://localhost:8080/api/project-messages/send?projectId=proj-123&userId=manager-id" \
  -H "Content-Type: application/json" \
  -d '{"content":"Test từ manager"}'
# Kỳ vọng: HTTP 200, message object (dù không phải member!)
```

### 5. Gửi Tin Nhắn - Người Khác
```bash
curl -X POST "http://localhost:8080/api/project-messages/send?projectId=proj-123&userId=other-id" \
  -H "Content-Type: application/json" \
  -d '{"content":"Test"}'
# Kỳ vọng: HTTP 400, "Bạn không có quyền..."
```

---

## 📚 Tương Quan Với Model

### Domain Model
```
User
├── id: String
├── fullName: String
├── email: String
├── role: ERole (ADMIN, MANAGER, EMPLOYEE, QA)
├── department: Department (DBRef)
└── ...

Department
├── id: String
├── name: String
├── manager: User (DBRef) ← Trưởng phòng
└── ...

Project
├── id: String
├── name: String
├── members: List<User> ← Danh sách member
├── department: Department (DBRef)
└── ...

ProjectMessage
├── id: String
├── content: String
├── sender: User (DBRef)
├── project: Project (DBRef)
├── createdAt: LocalDateTime
└── ...
```

---

## 🎯 Trường Hợp Sử Dụng

### Scenario 1: Nhân Viên Gửi Tin Nhắn
```
1. Nhân viên login
2. Vào dự án (là member)
3. Nhân viên gửi: "Progress 50%"
4. API: POST /send?projectId=X&userId=Y
5. Logic: Y ∈ project.members ✅
6. Response: ✅ Message saved
```

### Scenario 2: Trưởng Phòng Gửi Tin Nhắn
```
1. Trưởng phòng login
2. Vào dự án (phòng ban của họ, NHƯ NHƯ KHÔ MEMBER)
3. Trưởng phòng: "Cần hoàn thành ngày hôm nay"
4. API: POST /send?projectId=X&userId=M
5. Logic:
   - M ∈ project.members? ❌
   - M == project.department.manager? ✅
6. Response: ✅ Message saved
```

### Scenario 3: Người Khác Cố Gửi Tin Nhắn
```
1. Nhân viên khác login
2. Vào dự án (của phòng khác)
3. Cố gắng gửi tin nhắn
4. API: POST /send?projectId=X&userId=Z
5. Logic:
   - Z ∈ project.members? ❌
   - Z == project.department.manager? ❌ (Z khác phòng)
6. Response: ❌ 400 "Bạn không có quyền..."
```

---

## 🚀 Deployment Checklist

- [ ] Cập nhật ProjectMessageService.java
- [ ] Cập nhật ProjectMessageController.java
- [ ] Cập nhật ProjectService.java
- [ ] Cập nhật ProjectController.java
- [ ] Cập nhật ProjectChatPanel.jsx
- [ ] Compile backend: `mvn clean install`
- [ ] Build frontend: `npm run build`
- [ ] Test APIs với Postman
- [ ] Kiểm tra MongoDB data
- [ ] Deploy & monitor

---

## 📞 Support

Nếu gặp vấn đề:
1. Kiểm tra logs backend: `Console output`
2. Kiểm tra MongoDB: `db.projects.findOne()`
3. Kiểm tra role/department: `db.users.findOne({email: "..."})`
4. Xem documentation: [GROUP_CHAT_DEPARTMENT_MANAGER_GUIDE.md](./GROUP_CHAT_DEPARTMENT_MANAGER_GUIDE.md)
5. Chạy test cases: [TESTING_GROUP_CHAT_FEATURE.md](./TESTING_GROUP_CHAT_FEATURE.md)

