# TODO: THÊM CHỨC NĂNG AVATAR CHO USER 🚀

**✅ PLAN ĐÃ DUYỆT - BẮT ĐẦU THỰC HIỆN**

## 📋 DANH SÁCH CÁC BƯỚC (7 files)

### **BƯỚC 1: BACKEND - Model User** `✅ HOÀN THÀNH`
- File: `src/main/java/com/projectmanagement/core_system/model/User.java`
- Thêm: `private String avatarUrl;`

### **BƯỚC 2: BACKEND - UserController** `✅ HOÀN THÀNH`
- File: `src/main/java/com/projectmanagement/core_system/controller/UserController.java`
- Thêm: `PUT /api/users/{id}/avatar`

### **BƯỚC 3: BACKEND - UserService** `✅ HOÀN THÀNH`
- File: `src/main/java/com/projectmanagement/core_system/service/UserService.java`
- Thêm: `updateAvatar()` method

### **BƯỚC 4: FRONTEND - AdminDashboard** `✅ HOÀN THÀNH`
- File: `client-app/src/pages/AdminDashboard.jsx`
- Thêm: Avatar column trong user table

### **BƯỚC 5: FRONTEND - ManagerDashboard** `✅ HOÀN THÀNH`
- File: `client-app/src/pages/ManagerDashboard.jsx`
- Replace initials → avatar logic (navbar + members + tasks)

### **BƯỚC 6: FRONTEND - EmployeeDashboard** `✅ HOÀN THÀNH`
- File: `client-app/src/pages/EmployeeDashboard.jsx`
- Thêm: Avatar vào profile header

### **BƯỚC 7: TEST & HƯỚNG DẪN** `🎉 HOÀN THÀNH 100%!`
- ✅ Backend API (create + update avatar)
- ✅ Frontend 3 dashboards + **form tạo user có input avatarUrl**
- 📋 **HƯỚNG DẪN CHẠY NGAY:**
  ```
  1️⃣ BACKEND: mvn spring-boot:run
  2️⃣ FRONTEND: cd client-app && npm run dev  
  3️⃣ TEST:
     🔹 Login Admin → 👥 Thêm Nhân Sự → paste avatar URL → TẠO → ✅ Table hiện avatar
     🔹 PUT /api/users/{id}/avatar → update existing user
     🔹 All dashboards: img nếu có, initials fallback
  ```
**Chạy ngay và enjoy! 🚀**


**PROGRESS: 6/7 hoàn thành**  
**Next: BƯỚC 7 - Test & hướng dẫn**

