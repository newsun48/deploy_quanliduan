# 🧪 Hướng Dẫn Test Các Tính Năng Mới

## 📋 Chuẩn Bị

### Chạy Backend
```bash
cd c:\Users\Tan\QUANLYDUAN
mvn spring-boot:run
# Backend chạy tại http://localhost:8080
```

### Chạy Frontend
```bash
cd c:\Users\Tan\QUANLYDUAN\client-app
npm run dev
# Frontend chạy tại http://localhost:5173
```

---

## 🔐 Test 1: Đổi Mật Khẩu (Change Password)

### Bước 1: Đăng Nhập
1. Mở http://localhost:5173
2. Login với account (ví dụ: admin/123456)
3. Bạn sẽ chuyển sang dashboard

### Bước 2: Vào Trang Cá Nhân
1. Ở navbar trên cùng, click nút "Tài khoản" (có icon người)
2. Hoặc truy cập trực tiếp: http://localhost:5173/profile

### Bước 3: Chuyển Sang Tab "Đổi Mật Khẩu"
1. Ở phía trái, bạn sẽ thấy sidebar với thông tin cá nhân
2. Ở giữa, click tab "Đổi Mật Khẩu" (có icon chìa khóa)

### Bước 4: Test Các Case

#### Case 1: Đổi mật khẩu thành công
- Mật khẩu cũ: `123456`
- Mật khẩu mới: `newpass123`
- Xác nhận: `newpass123`
- Click "Đổi Mật Khẩu"
- **Expected:** Message xanh ✅ "Đã đổi mật khẩu thành công!"

#### Case 2: Mật khẩu cũ sai
- Mật khẩu cũ: `wrongpass`
- Mật khẩu mới: `newpass123`
- Xác nhận: `newpass123`
- Click "Đổi Mật Khẩu"
- **Expected:** Message đỏ ❌ "Mật khẩu cũ không chính xác!"

#### Case 3: Mật khẩu mới < 6 ký tự
- Mật khẩu cũ: `123456`
- Mật khẩu mới: `abc123` (6 ký tự - OK)
- Xác nhận: `abc123`
- **Expected:** Cho phép submit

#### Case 4: Mật khẩu xác nhận không khớp
- Mật khẩu cũ: `123456`
- Mật khẩu mới: `newpass123`
- Xác nhận: `wrongconfirm`
- Click "Đổi Mật Khẩu"
- **Expected:** Message đỏ "Mật khẩu xác nhận không khớp"

#### Case 5: Mật khẩu mới = mật khẩu cũ
- Mật khẩu cũ: `123456`
- Mật khẩu mới: `123456`
- Xác nhận: `123456`
- Click "Đổi Mật Khẩu"
- **Expected:** Message đỏ "Mật khẩu mới phải khác mật khẩu cũ"

#### Case 6: Toggle show/hide password
- Click icon mắt bên cạnh input mật khẩu
- **Expected:** Password thay đổi từ `•••••` → `password`

### Bước 5: Verify Mật Khẩu Đá Được Đổi
1. Logout
2. Login với mật khẩu mới vừa set
3. **Expected:** Đăng nhập thành công

---

## 📢 Test 2: Hệ Thống Thông Báo (Notifications)

### Phần A: Verify UI

#### Test 2.1: Icon Chuông Hiển Thị
1. Ở mọi dashboard (Admin, Manager, Employee)
2. Ở navbar trên cùng, bạn sẽ thấy icon chuông (🔔)
3. **Expected:** Icon chuông visible

#### Test 2.2: Badge Counter
1. Nếu có thông báo chưa đọc → **Expected:** Badge màu đỏ với số (eg: "5")
2. Nếu không → **Expected:** Không hiển thị badge

#### Test 2.3: Click Icon Chuông
1. Click icon chuông
2. **Expected:** Dropdown xuất hiện bên phải
3. **Expected:** Header "Thông báo (X chưa đọc)"
4. **Expected:** Danh sách thông báo được listing

#### Test 2.4: Dropdown UI
- Thông báo mới có: nền xanh nhạt + border xanh left
- Thông báo cũ có: nền trắng
- Mỗi thông báo hiển thị:
  - Icon + Title (📋 Công việc mới)
  - Message (Nội dung thông báo)
  - Timestamp (Ngày giờ)
  - Badge "Mới" (nếu chưa đọc)

#### Test 2.5: Click Ngoài Dropdown
1. Dropdown mở
2. Click ở ngoài dropdown (vào trang)
3. **Expected:** Dropdown đóng lại

### Phần B: Tạo Thông Báo (Manager Dashboard)

#### Test 2.6: Tạo Task → Auto-Create Notification

**Setup:**
1. Login với Manager account
2. Chuyển sang ManagerDashboard
3. Chọn một project đang chạy
4. Click "Thêm Công Việc"

**Điền form:**
- Title: "Review Code"
- Description: "Review PR từ developer"
- Deadline: Chọn ngày hôm nay hoặc ngày mai
- Priority: MEDIUM
- Giao cho: Chọn một Employee

**Submit:**
1. Click "Giao Việc"
2. **Expected:** Message xanh "Giao việc thành công!"

#### Test 2.7: Verify Notification Created
1. Logout ra
2. Login với Employee account (người vừa được giao việc)
3. Vào dashboard của Employee
4. **Expected:** Icon chuông có badge "1" hoặc số nào đó
5. Click chuông
6. **Expected:** Thấy thông báo mới:
   - Title: "📋 Công việc mới"
   - Message: "Bạn được giao công việc mới: Review Code từ dự án: [project name]"
   - Timestamp: Vừa mới tạo
   - Badge "Mới" (màu xanh)

### Phần C: Đánh Dấu Thông Báo

#### Test 2.8: Đánh Dấu 1 Thông Báo
1. Dropdown mở, có thông báo chưa đọc
2. Click vào thông báo
3. **Expected:** 
   - Badge "Mới" biến mất
   - Nền từ xanh nhạt → trắng
   - Unread count giảm

#### Test 2.9: Đánh Dấu Tất Cả
1. Dropdown mở
2. Click nút "Đánh dấu tất cả"
3. **Expected:**
   - Tất cả thông báo từ xanh nhạt → trắng
   - Tất cả badge "Mới" biến mất
   - Unread count → 0
   - Badge chuông biến mất

#### Test 2.10: Auto-Refresh Counter
1. Có 3 thông báo chưa đọc
2. Mở dropdown lần 1 (đếm được 3)
3. Đóng dropdown
4. Chờ ~10 giây
5. **Expected:** Counter update (nếu có thông báo mới hoặc đằng khác)

### Phần D: Multi-User Test

#### Test 2.11: Manager giao việc cho 2 người
1. Login Manager
2. Gm giao việc cho Employee A
3. Giao việc cho Employee B
4. Logout

**Employee A:**
1. Login Employee A
2. Check thông báo → Should see 1 notification ✓

**Employee B:**
1. Login Employee B
2. Check thông báo → Should see 1 notification ✓

**Expected:** Mỗi người chỉ thấy thông báo của mình

---

## 🔍 Monitoring & Debugging

### Xem Console Browser (F12)
- Network tab: Kiểm tra API calls
  - `/api/users/change-password` - POST
  - `/api/notifications` - GET
  - `/api/notifications/unread-count` - GET

### Xem Server Logs
```bash
# Backend logs
# Kiểm tra logs ở terminal chạy spring-boot
# Looking for: "Tạo thông báo", compilation errors, etc.
```

### Xem Database (MongoDB)
```bash
# Nếu có MongoDB client (e.g., MongoDB Compass)
# Database: projectmanagement
# Collections:
#   - notifications (kiểm tra records)
#   - users (verify password hash changed)
```

---

## ✅ Checklist Test Hoàn Chỉnh

### Change Password
- [ ] ✅ Form hiển thị đúng
- [ ] ✅ Toggle show/hide password
- [ ] ✅ Validation client-side
- [ ] ✅ Đổi mật khẩu thành công
- [ ] ✅ Mật khẩu cũ sai → error
- [ ] ✅ Mật khẩu xác nhận sai → error
- [ ] ✅ Login lại với mật khẩu mới

### Notifications
- [ ] ✅ Icon chuông visible
- [ ] ✅ Badge counter
- [ ] ✅ Dropdown list
- [ ] ✅ Timestamp format
- [ ] ✅ Auto-create on task assign
- [ ] ✅ Mark single as read
- [ ] ✅ Mark all as read
- [ ] ✅ Auto-refresh mỗi 10s
- [ ] ✅ Multi-user isolation
- [ ] ✅ Notification persisted in DB

---

## 🐛 Troubleshooting Common Issues

### Issue 1: Icon Chuông Không Hiển Thị
```
Solution:
1. Clear browser cache (Ctrl+Shift+Del)
2. Hard refresh (Ctrl+Shift+R)
3. Verify NotificationBell imported in dashboard
4. Check browser console for errors (F12)
```

### Issue 2: Notification Không Tạo
```
Solution:
1. Check backend logs - verify createNotification called
2. Verify assignee ID correct
3. Check MongoDB notifications collection
4. Verify NotificationService auto-wired in TaskService
```

### Issue 3: Change Password Form Không Submit
```
Solution:
1. Check if localStorage has token
2. Verify token not expired
3. Network tab (F12) - check request/response
4. Check backend endpoint exists
```

### Issue 4: Badge Counter Không Update
```
Solution:
1. Check if API /api/notifications/unread-count accessible
2. Verify token valid in header
3. Wait 10+ seconds for auto-refresh
4. Manual refresh page (F5)
```

---

## 📊 Test Scenarios

### Scenario A: New Employee Gets Task
```
1. Manager creates task assigned to Employee
2. Employee sees notification badge
3. Employee marks as read
4. Badge disappears
5. Employee can still view in list as "read"
```

### Scenario B: Bulk Task Assignment
```
1. Manager assigns 5 tasks to Employee
2. Employee sees badge "5"
3. Employee clicks "Mark all as read"
4. All 5 marked as read
5. Badge disappears
```

### Scenario C: Password Security
```
1. Employee changes password
2. Old password cannot login
3. New password can login
4. Session continues after password change
```

---

**Useful Tips:**
- Use multiple browser tabs/windows for testing multi-user
- Monitor Network tab (F12 → Network) for API calls
- Check Application tab for localStorage token
- Use MongoDB client to verify data persistence

**Happy Testing! 🚀**
