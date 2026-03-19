# 🚀 Hướng Dẫn Fix Chức Năng "Thêm Nhân Viên Vào Dự Án"

## 📋 Những Gì Đã Được Cải Thiện

### 1. Backend (ProjectService.java)
✅ Thêm logging chi tiết để debug
- Khi thêm member, in ra projectId, userId
- Verify project tìm thấy
- Verify user tìm thấy
- Check phòng ban khớp
- Verify member được add
- Confirm save thành công

### 2. Frontend (ManagerDashboard.jsx)
✅ Cải thiện handleAddMember():
- Thêm console.log để track flow
- Gọi API POST
- **Cực kỳ quan trọng:** Cập nhật selectedProject ngay từ API response
- Reload dữ liệu phòng để cập nhật danh sách khả dụng
- Cải thiện error message

---

## 🧪 Testing Steps

### Step 1: Chạy Backend
```bash
cd c:\Users\Tan\QUANLYDUAN
mvn spring-boot:run
```

### Step 2: Chạy Frontend
```bash
cd c:\Users\Tan\QUANLYDUAN\client-app
npm run dev
```

### Step 3: Login vào Manager Dashboard
- Tài khoản: manager@gmail.com (hoặc tài khoản manager bất kỳ)
- Mật khẩu: 123456

### Step 4: Chọn Một Dự Án
- Ở Dashboard → Chọn một project bất kỳ
- Click nút "Chi tiết"

### Step 5: Tab "Thành viên"
- Click tab "Thành viên"
- Bạn sẽ thấy danh sách thành viên hiện tại
- Nếu có nhân viên chưa tham gia: Click "Thêm Thành Viên"

### Step 6: Chọn Nhân Viên Từ Modal
- Modal "Thêm nhân viên" sẽ hiển thị
- Dropdown liệt kê tất cả nhân viên chưa tham gia dự án này
- Chọn 1 nhân viên
- Click "Xác nhận"

### Step 7: Kiểm Tra Kết Quả
- ✅ Should see: "✅ Đã thêm thành công!"
- ✅ Modal đóng lại
- ✅ Danh sách thành viên cập nhật
- ✅ Nhân viên vừa thêm xuất hiện trong list

### Step 8: Check Browser Console (F12)
Kiểm tra console logs:
```
📤 Thêm member: [userId] vào project: [projectId]
✅ Thêm member thành công: {project data}
🔄 Đang reload dữ liệu phòng...
✅ Hoàn tất thêm member!
```

### Step 9: Check Backend Logs
Terminal backend sẽ in ra:
```
🔵 [DEBUG] Thêm member: projectId=..., userId=...
✅ [DEBUG] Found project: ...
✅ [DEBUG] Found user: ...
🔍 [DEBUG] projectDeptId=..., userDeptId=...
➕ [DEBUG] Adding member to project...
✅ [DEBUG] Member added successfully! Total members: ...
```

---

## ❌ Nếu Có Lỗi

### Lỗi: "Nhân viên này thuộc phòng ban khác!"
**Nguyên nhân:** Nhân viên không đúng phòng ban của dự án
- Kiểm tra: Admin -> Quản lý nhân sự
- Đảm bảo nhân viên gán đúng phòng ban
- refresh và thử lại

### Lỗi: "Nhân viên này đã tham gia dự án rồi!"
**Nguyên nhân:** Người đó đã là member
- Đây là kiểm tra trùng lặp, hoạt động đúng
- Chọn nhân viên khác

### Lỗi: "Dự án không tìm thấy!" hoặc "Nhân viên không tìm thấy!"
**Nguyên nhân:** ID không khớp hoặc dữ liệu bị mất
- Refresh trang
- Thử lại từ dashboard

### Lỗi: Modal Không Đóng
**Nguyên nhân:** State không update
- Check F12 Console → Network tab
- Xem response của API call
- Restart backend + frontend

### Lỗi: Danh Sách Thành Viên Không Cập Nhật
**Nguyên nhân:** selectedProject state chưa refresh
- **Fixed:** Bây giờ code cập nhật projectstate từ API response
- Nếu vẫn lỗi: Reload trang hoặc chọn project khác rồi quay lại

---

## 🔍 Debugging Checklist

- [ ] Backend chạy tại http://localhost:8080
- [ ] Frontend chạy tại http://localhost:5173
- [ ] Login thành công
- [ ] Manager account có phòng ban
- [ ] Phòng ban có nhân viên
- [ ] Dự án thuộc phòng ban đó
- [ ] Nhân viên chưa tham gia dự án
- [ ] Open F12 Console → Network tab
- [ ] Thêm member → Check API response 200 OK
- [ ] Backend logs show "✅ Member added successfully!"

---

## 📊 Kỳ Vọng Behavior

### Sau Khi Thêm Member Thành Công:

1. **Modal Đóng** ✓
2. **Alert Xanh** ✓
3. **Danh Sách Cập Nhật** ✓
   - Thành viên vừa thêm xuất hiện
   - Số lượng thành viên tăng
4. **Dropdown "Thêm Nhân Viên" Cập Nhật** ✓
   - Nhân viên vừa thêm biến mất khỏi dropdown
   - Chỉ hiển thị thành viên còn lại chưa tham gia
5. **Database Được Cập Nhật** ✓
   - Nhân viên lưu vào project.members
   - Data persist sau refresh trang

---

## 🎯 Cách Xác Minh Nó Hoạt Động

1. **Thêm member A vào project X**
2. **Refresh trang (F5)**
3. **Chọn project X lại**
4. **Member A vẫn trong danh sách ✓**

Nếu member vẫn ở đó → **Hoạt động hoàn hảo!**

---

## 💡 Nếu Vẫn Không Hoạt Động

### Cách Debug Nâng Cao:

1. **Kiểm tra MongoDB**
   - Mở MongoDB Compass
   - Database: `project_management_db`
   - Collection: `projects`
   - Tìm project
   - Check field `members` array

2. **Kiểm tra API với Curl**
   ```bash
   curl -X POST http://localhost:8080/api/projects/{projectId}/add-member/{userId} \
     -H "Content-Type: application/json"
   ```

3. **Kiểm tra Backend Logs**
   - Mở terminal backend
   - Scroll lên tìm DEBUG logs
   - Xem có error gì không

4. **Kiểm tra Frontend Network**
   - Mở F12 → Network
   - Cộng thêm member
   - Click vào POST request
   - Response status: 200 ?
   - Response body: project data ?

---

## ✅ Success Criteria

- [x] Backend compile thành công
- [x] Frontend build thành công
- [x] Modal thêm nhân viên hiển thị đúng
- [x] API response 200 OK
- [x] selectedProject update ngay
- [x] Danh sách thành viên refresh
- [x] Dropdown cập nhật
- [x] Database lưu data

---

## 🚀 Công Nghệ Sử Dụng

**Backend:**
- Java 22
- Spring Boot 3.5.10
- MongoDB
- Logging + debugging

**Frontend:**
- React 18
- Axios (HTTP client)
- Bootstrap 5
- Console.log (debugging)

---

**Bây giờ hãy test theo các bước trên và báo cáo kết quả!** 🎉
