# Hệ Thống Quản Lý Dự Án (Project Management System)

Đây là hệ thống Quản lý Dự án và Cộng tác Công việc được thiết kế nhằm giúp các doanh nghiệp tổ chức công việc, theo dõi tiến độ và giao tiếp nội bộ một cách liền mạch, trực quan theo thời gian thực (Real-time).

---

## 🌟 Tóm tắt các Chức năng Nổi bật (Features)

Hệ thống được chia và bảo mật quyền truy cập rất chặt chẽ theo **3 Vai trò (Roles)**: `Quản trị viên (Admin)`, `Trưởng phòng (Manager)`, và `Nhân viên (Employee)`. Dưới đây là danh sách các tính năng cốt lõi đã có trong project:

### 1. Phân quyền và Quản lý Tài khoản (Authentication & Authorization)
- **Đăng nhập & Đăng xuất:** Bảo mật bằng JWT/Token.
- **Hệ thống Vai trò (RBAC):** Phân chia rõ ràng tính năng và giao diện cho Admin, Manager và Employee.
- **Tài khoản cá nhân (Profile):** Theo dõi thông tin cá nhân, cập nhật thông tin và đổi mật khẩu.
- **Quản lý Ảnh đại diện (Avatar):** Hỗ trợ upload và hiển thị avatar người dùng trên hệ thống.
- **Quên Mật khẩu (Forgot Password):** Hỗ trợ khôi phục mật khẩu.

### 2. Quản trị Hệ thống (Admin Dashboard)
- **Quản lý Người dùng (User Management):** Thêm, sửa, xóa, tìm kiếm nhân viên, thiết lập phòng ban và bổ nhiệm vai trò chức vụ.
- **Quản lý Phòng ban (Department Management):** Tổ chức cơ cấu trong công ty.
- **Giám sát Tổng thể:** Admin có quyền xem danh sách và trạng thái tổng quan của tất cả dự án trong công ty.

### 3. Quản lý Dự án (Project Management)
- **Tạo và Quản lý Dự án:** Trưởng phòng có thể thêm dự án mới, cập nhật mô tả, thiết lập thời hạn và trạng thái dự án (Open/Closed).
- **Phân bổ Dự án:** Gắn dự án vào phòng ban cụ thể để dễ dàng quản lý khối lượng công việc theo team.
- **Bảng Thống kê (Dashboard Analytics):** Thống kê trực quan tiến độ tổng thể, số lượng Task (To Do, In Progress, Done) cho người quản lý.

### 4. Bảng Công việc (Task Management)
- **Giao việc (Task Assignment):** Trưởng phòng tạo công việc, thiết lập mức độ ưu tiên (High, Medium, Low) và phân công trực tiếp cho nhân viên cụ thể.
- **Theo dõi Tiến độ (Progress Tracking):** Nhân viên kéo thả/cập nhật trạng thái từng Task (Mới, Đang làm, Đã xong) kèm thanh trượt báo cáo % Hoàn thành.
- **Bình luận & Thảo luận (Comments):** Hỗ trợ trao đổi, giải đáp hoặc báo cáo tình hình trực tiếp ngay bên trong chi tiết của mỗi công việc bằng popup (Modal).

### 5. Giao tiếp & Cộng tác Thời gian thực (Real-time & WebSockets)
- **Nhắn tin Nhóm Dự án (Project Group Chat):** Mỗi dự án có một kênh chat riêng biệt. Các thành viên trong dự án tham gia thảo luận rôm rả, tin nhắn nổ ngay lập tức nhờ hệ thống WebSockets (Stomp/SockJS).
- **Nhắn tin Cá nhân (Private 1-1 Chat):** Trực tiếp trò chuyện riêng tư với đồng nghiệp trong cùng phòng ban một cách nhanh chóng.
- **Hệ thống Thông báo (Real-time Notifications):** Quả chuông thông báo (Notification Bell) reo ngay lập tức hiển thị thông báo khi có người giao việc mới, khi công việc thay đổi trạng thái, hoặc có tin nhắn đến chưa đọc.

### 6. Quản lý Tệp tin (File Upload & Assets)
- Xử lý mượt mà việc tải file, lưu trữ file tĩnh (Static file serving) để sử dụng cho Avatar và các tài liệu đính kèm (nếu có).

---

## 🛠️ Công nghệ Sử dụng (Tech Stack)
Tính năng trên được xây dựng trên một nền tảng vững chắc:
- **Frontend:** React (Vite), React Router, Axios, Bootstrap 5.
- **Backend:** Java Spring Boot, Spring Security (JWT), Spring Data MongoDB hoặc JPA.
- **Real-time:** WebSockets (`@stomp/stompjs` & `sockjs-client`).

*(File này được tạo để liệt kê nhanh những tính năng hệ thống hiện có, làm cơ sở để phát triển tiếp hoặc làm tài liệu bàn giao).*
