# 📋 Danh Sách Chức Năng Cần Test (Dự Án Quản Lý Dự Án)

Dưới đây là tổng hợp các chức năng chính đã được hiện thực trong hệ thống. Bạn có thể dựa vào danh sách này để tiến hành test toàn diện.

## 1. 🔐 Chức Năng Xác Thực & Tài Khoản (Authentication & Profile)
- **Đăng nhập / Đăng xuất**: Của Admin, Manager và Employee.
- **Đổi mật khẩu**:
  - Xác thực mật khẩu cũ.
  - Cập nhật mật khẩu mới (có validate độ dài, khác mật khẩu cũ).
  - Nút đóng/mở mắt ẩn mật khẩu trong form.
- **Cập nhật Avatar**: Upload, hiển thị và thay đổi ảnh đại diện cá nhân trên thanh điều hướng (navbar).

## 2. 🗂️ Quản Lý Dự Án & Công Việc (Project & Task Management)
**(Dành cho Admin & Manager)**
- **Tạo Mới Dự Án**: Nhập chi tiết, ngày bắt đầu, deadline.
- **Chỉnh Sửa Dự Án**: Edit thông tin tên dự án, mô tả, deadline sau khi đã tạo.
- **Phân Công Trưởng Phòng**: Gán Manager cho dự án cụ thể.
- **Giao Việc (Assign Task)**: Manager tạo task và gán cho Employee.
- **Theo Dõi Tiến Độ**: Kanban board hoặc danh sách liệt kê các trạng thái.

**(Dành cho Employee)**
- **Xem Công Việc Được Giao**: Xem chi tiết mô tả, deadline, độ ưu tiên.
- **Trạng Thái Task**: Cập nhật tiến độ task (TODO, IN PROGRESS, DONE).
- **Thêm Link Nộp Bài (Submission Link)**: Nhân viên thêm link nộp kết quả công việc vào task (Google Drive, GitHub repo, v.v.).

## 3. 📢 Hệ Thống Thông Báo (Notifications)
- **Thông báo Real-time (Polling)**: Icon chuông trên Navbar có badge đếm số lượng chưa đọc.
- **Tự động tạo thông báo khi giao việc**: Employee nhận được thông báo khi Manager gán task mới.
- **Đánh dấu đã đọc trên từng thông báo**: Click vào từng thông báo để chuyển trạng thái sang "Đã đọc".
- **Đánh dấu tất cả**: Có nút "Đánh dấu tất cả đã đọc" trên dropdown thông báo.

## 4. 💬 Chat / Giải Đáp Thắc Mắc (Chat Feature)
- **Nhắn tin 1-1 (Private Chat)**: Giao tiếp trực tiếp giữa các thành viên sử dụng WebSocket.
- **Icon thông báo có tin nhắn mới**.

## 5. 👥 Chat Nhóm / Thảo Luận Dự Án (Group Chat)
- **Tự động liên kết**: Mỗi Project/Nhóm có một Group Chat tương ứng.
- **Quản lý Thành Viên**: Trưởng phòng (Manager) có quyền kiểm soát thêm hoặc kích thành viên (Employee) ra khỏi nhóm.
- **Gửi và Nhận Tin Nhắn Nhóm**: Tương tác trực tiếp qua group.
- **Hiển thị Avatar trong khung chat**: Giúp nhận diện người gửi tin nhắn dễ dàng.

## 6. 🛡 Lỗi & Validation Form
- Thử nhập các trường dự án, công việc bị bỏ trống xem hệ thống có báo lỗi đỏ hợp lệ không.
- Gửi link nộp bài bằng các URL không hợp lệ.

---
**💡 Lời khuyên khi Test:**
- **Mở cùng lúc hai trình duyệt (hoặc 1 tab Chrome thường + 1 tab Ẩn danh):** Để đăng nhập cùng lúc 2 tài khoản (VD: một tab là Manager, một tab là Employee).
- Nhờ vậy, bạn có thể **vừa giao task/ nhắn tin ở tab Manager** và **thấy thông báo nảy lên ngay lập tức ở tab Employee**.
- Để xem hướng dẫn test chi tiết hơn cho từng tính năng, bạn có thể mở các file đã có trong thư mục như `TESTING_GUIDE.md` và `TESTING_GROUP_CHAT_FEATURE.md`.
