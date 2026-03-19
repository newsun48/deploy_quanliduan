# Hướng Dẫn Thực Hiện Chức Năng

## 1. Quên Mật Khẩu

### Backend (Java)
✅ **Đã thực hiện:**
- Thêm API endpoint `/api/auth/forgot-password` trong [AuthController.java](src/main/java/com/projectmanagement/core_system/controller/AuthController.java)
- API nhận email → reset mật khẩu về "123456" (mã hóa) → trả về thông báo thành công

**Cách sử dụng:**
```bash
POST http://localhost:8080/api/auth/forgot-password
Content-Type: application/json

{
  "email": "user@example.com"
}
```

**Response:**
```json
"Mật khẩu đã được reset về 123456. Vui lòng đăng nhập và đổi mật khẩu mới!"
```

---

### Frontend (React)
✅ **Đã thực hiện:**
- Tạo trang [ForgotPasswordPage.jsx](client-app/src/pages/ForgotPasswordPage.jsx)
- Form nhập Email để reset mật khẩu
- Thêm route `/forgot-password` trong [App.jsx](client-app/src/App.jsx)
- Thêm link "Quên mật khẩu?" trên trang [LoginPage.jsx](client-app/src/pages/LoginPage.jsx)

---

## 2. Bảo Mật API với JWT

### Backend (Java)
✅ **Đã thực hiện:**

1. **Thêm thư viện JJWT** trong [pom.xml](pom.xml)
   ```xml
   <dependency>
       <groupId>io.jsonwebtoken</groupId>
       <artifactId>jjwt-api</artifactId>
       <version>0.11.5</version>
   </dependency>
   ```

2. **Tạo JwtUtil** ([JwtUtil.java](src/main/java/com/projectmanagement/core_system/config/JwtUtil.java))
   - `generateToken(email, role)` → Tạo JWT token
   - `extractEmail(token)` → Lấy email từ token
   - `validateToken(token, email)` → Kiểm tra token hợp lệ

3. **Tạo JWT Filter** ([JwtAuthenticationFilter.java](src/main/java/com/projectmanagement/core_system/config/JwtAuthenticationFilter.java))
   - Kiểm tra Authorization header
   - Xác thực token tự động

4. **Tạo UserDetailsService** ([CustomUserDetailsService.java](src/main/java/com/projectmanagement/core_system/config/CustomUserDetailsService.java))
   - Load user từ email

5. **Cập nhật SecurityConfig** ([SecurityConfig.java](src/main/java/com/projectmanagement/core_system/config/SecurityConfig.java))
   - Thêm JWT filter vào chain
   - Stateless session
   - Cho phép `/api/auth/login` và `/api/auth/forgot-password`

6. **Cập nhật AuthController** ([AuthController.java](src/main/java/com/projectmanagement/core_system/controller/AuthController.java))
   - Tạo token khi login thành công
   - Trả về token + user info

**Response Login:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiJ9...",
  "user": {
    "id": "123",
    "email": "user@example.com",
    "role": "ADMIN"
  }
}
```

---

### Frontend (React)
✅ **Đã thực hiện:**

1. **Tạo API Instance** ([api.js](client-app/src/api.js))
   - Tự động thêm token vào Authorization header
   - Xử lý lỗi 401 (token hết hạn)

2. **Cập nhật LoginPage.jsx**
   - Lưu token vào localStorage
   - Sử dụng api instance (thay axios)

3. **Cập nhật tất cả Pages**
   - Thay `axios` bằng `api` import
   - Thay `/api/` bằng `/` (vì api instance đã set baseURL)

**Ví dụ:**
```javascript
// Trước
axios.get('/api/users') 

// Sau
api.get('/users')
```

---

## 3. Hướng Dẫn Test

### 1. Build Backend
```bash
cd c:\Users\Tan\QUANLYDUAN
mvn clean compile
mvn spring-boot:run
```
Backend chạy tại: `http://localhost:8080`

### 2. Test Forgot Password (Postman)
```
POST http://localhost:8080/api/auth/forgot-password
Content-Type: application/json

{
  "email": "admin@example.com"
}
```

### 3. Test Login với JWT
```
POST http://localhost:8080/api/auth/login
Content-Type: application/json

{
  "email": "admin@example.com",
  "password": "123456"
}
```

Response sẽ gồm:
- `token` (JWT token)
- `user` (thông tin user)

### 4. Test API được bảo vệ
```
GET http://localhost:8080/api/users
Authorization: Bearer <TOKEN_TỪ_LOGIN>
```

### 5. Start Frontend
```bash
cd c:\Users\Tan\QUANLYDUAN\client-app
npm run dev
```
Frontend chạy tại: `http://localhost:5173`

---

## 4. Các File Đã Tạo/Sửa

### Backend
- ✅ [pom.xml](pom.xml) - Thêm JJWT
- ✅ [JwtUtil.java](src/main/java/com/projectmanagement/core_system/config/JwtUtil.java) - **Tạo mới**
- ✅ [JwtAuthenticationFilter.java](src/main/java/com/projectmanagement/core_system/config/JwtAuthenticationFilter.java) - **Tạo mới**
- ✅ [CustomUserDetailsService.java](src/main/java/com/projectmanagement/core_system/config/CustomUserDetailsService.java) - **Tạo mới**
- ✅ [SecurityConfig.java](src/main/java/com/projectmanagement/core_system/config/SecurityConfig.java) - Sửa
- ✅ [AuthController.java](src/main/java/com/projectmanagement/core_system/controller/AuthController.java) - Sửa

### Frontend
- ✅ [api.js](client-app/src/api.js) - **Tạo mới**
- ✅ [App.jsx](client-app/src/App.jsx) - Sửa (thêm route `/forgot-password`)
- ✅ [LoginPage.jsx](client-app/src/pages/LoginPage.jsx) - Sửa
- ✅ [ForgotPasswordPage.jsx](client-app/src/pages/ForgotPasswordPage.jsx) - **Tạo mới**
- ✅ [AdminDashboard.jsx](client-app/src/pages/AdminDashboard.jsx) - Sửa (thay axios → api)
- ✅ [ManagerDashboard.jsx](client-app/src/pages/ManagerDashboard.jsx) - Sửa (thay axios → api)
- ✅ [EmployeeDashboard.jsx](client-app/src/pages/EmployeeDashboard.jsx) - Sửa (thay axios → api)

---

## 5. Lưu Ý Bảo Mật

⚠️ **Trước production:**
- Thay `SECRET_KEY` trong [JwtUtil.java](src/main/java/com/projectmanagement/core_system/config/JwtUtil.java) bằng key mạnh hơn
- Lưu SECRET_KEY trong environment variables, không hardcode
- Bật HTTPS
- Thêm CORS chính xác (không dùng `*`)
- Thêm refresh token mechanism
- Hash password mặc định (không dùng 123456 trong production)

---

## 6. Troubleshoot
gi
### Lỗi 401 Unauthorized
- Kiểm tra token có được gửi trong header không
- Kiểm tra token có hết hạn không
- Kiểm tra email trong token có matchAlt không

### Token không được lưu
- Bật DevTools → Application → LocalStorage
- Kiểm tra `localStorage.getItem('token')`

### CORS error
- Kiểm tra `@CrossOrigin` trong controller
- Frontend URL phải match với `origins` value

---

✅ **Tất cả chức năng đã hoàn thành và không có lỗi!**