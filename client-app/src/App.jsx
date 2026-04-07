import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';

// Import các trang bạn vừa tạo trong thư mục pages
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import AdminDashboard from './pages/AdminDashboard';
import ManagerDashboard from './pages/ManagerDashboard';
import EmployeeDashboard from './pages/EmployeeDashboard';
import ProfilePage from './pages/ProfilePage';
import StatisticsPage from './pages/StatisticsPage';

// --- HÀM BẢO VỆ (Private Route) ---
// Hàm này kiểm tra: Nếu chưa đăng nhập (không có user trong localStorage) -> Đá về trang Login
const PrivateRoute = ({ children, allowedRoles }) => {
    const user = JSON.parse(localStorage.getItem('user'));

    if (!user) {
        return <Navigate to="/" />;
    }

    if (allowedRoles && !allowedRoles.includes(user.role)) {
        if (user.role === 'ADMIN') return <Navigate to="/admin" />;
        if (user.role === 'MANAGER') return <Navigate to="/manager" />;
        return <Navigate to="/employee" />;
    }

    return children;
};

function App() {
    return (
        <BrowserRouter>
            <Routes>
                {/* 1. Trang mặc định là trang Đăng nhập */}
                <Route path="/" element={<LoginPage />} />
                <Route path="/signup" element={<SignupPage />} />

                {/* 2. Các trang nội bộ (Được bảo vệ bởi PrivateRoute) */}
                <Route path="/admin" element={
                    <PrivateRoute allowedRoles={['ADMIN']}>
                        <AdminDashboard />
                    </PrivateRoute>
                } />

                <Route path="/manager" element={
                    <PrivateRoute allowedRoles={['MANAGER']}>
                        <ManagerDashboard />
                    </PrivateRoute>
                } />

                <Route path="/employee" element={
                    <PrivateRoute allowedRoles={['EMPLOYEE', 'QA']}>
                        <EmployeeDashboard />
                    </PrivateRoute>
                } />

                <Route path="/profile" element={
                    <PrivateRoute allowedRoles={['ADMIN', 'MANAGER', 'EMPLOYEE', 'QA']}>
                        <ProfilePage />
                    </PrivateRoute>
                } />

                <Route path="/admin/statistics" element={
                    <PrivateRoute allowedRoles={['ADMIN']}>
                        <StatisticsPage />
                    </PrivateRoute>
                } />

                <Route path="/manager/statistics" element={
                    <PrivateRoute allowedRoles={['MANAGER']}>
                        <StatisticsPage />
                    </PrivateRoute>
                } />
            </Routes>
        </BrowserRouter>
    );
}

export default App;
