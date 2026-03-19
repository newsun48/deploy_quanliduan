import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';

// Import các trang bạn vừa tạo trong thư mục pages
import LoginPage from './pages/LoginPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import AdminDashboard from './pages/AdminDashboard';
import ManagerDashboard from './pages/ManagerDashboard';
import EmployeeDashboard from './pages/EmployeeDashboard';
import ProfilePage from './pages/ProfilePage';

// --- HÀM BẢO VỆ (Private Route) ---
// Hàm này kiểm tra: Nếu chưa đăng nhập (không có user trong localStorage) -> Đá về trang Login
const PrivateRoute = ({ children }) => {
    // Lấy thông tin user đã lưu khi đăng nhập
    const user = JSON.parse(localStorage.getItem('user'));
    
    // Nếu có user -> Cho vào trang con (children). Nếu không -> Chuyển về trang chủ ("/")
    return user ? children : <Navigate to="/" />;
};

function App() {
    return (
        <BrowserRouter>
            <Routes>
                {/* 1. Trang mặc định là trang Đăng nhập */}
                <Route path="/" element={<LoginPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />

                {/* 2. Các trang nội bộ (Được bảo vệ bởi PrivateRoute) */}
                <Route path="/admin" element={
                    <PrivateRoute>
                        <AdminDashboard />
                    </PrivateRoute>
                } />

                <Route path="/manager" element={
                    <PrivateRoute>
                        <ManagerDashboard />
                    </PrivateRoute>
                } />

                <Route path="/employee" element={
                    <PrivateRoute>
                        <EmployeeDashboard />
                    </PrivateRoute>
                } />

                <Route path="/profile" element={
                    <PrivateRoute>
                        <ProfilePage />
                    </PrivateRoute>
                } />
            </Routes>
        </BrowserRouter>
    );
}

export default App;