import axios from 'axios';

// Tạo axios instance với base URL
const api = axios.create({
    baseURL: '/api',
});

// Interceptor để tự động thêm token vào header
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Interceptor để xử lý lỗi 401 (Unauthorized)
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            // Token hết hạn hoặc không hợp lệ, xóa localStorage và chuyển về login
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/';
        }
        return Promise.reject(error);
    }
);

// ========== NOTIFICATION API ==========
export const notificationAPI = {
    // Lấy danh sách thông báo
    getNotifications: () => api.get('/notifications'),

    // Lấy số lượng thông báo chưa đọc
    getUnreadCount: () => api.get('/notifications/unread-count'),

    // Lấy danh sách thông báo chưa đọc
    getUnreadNotifications: () => api.get('/notifications/unread'),

    // Đánh dấu thông báo là đã đọc
    markAsRead: (notificationId) => api.post(`/notifications/${notificationId}/mark-as-read`),

    // Đánh dấu tất cả thông báo là đã đọc
    markAllAsRead: () => api.post('/notifications/mark-all-as-read'),
};

// ========== USER API ==========
export const userAPI = {
    // Đổi mật khẩu
    changePassword: (oldPassword, newPassword) => 
        api.post('/users/change-password', {
            oldPassword,
            newPassword
        }),

    // Tìm kiếm user
    searchUsers: (keyword) => api.get('/users/search', { params: { keyword } }),

    // Lấy tất cả user
    getAllUsers: () => api.get('/users'),

    // Tạo user mới
    createUser: (userData, deptId) => 
        api.post('/users', userData, { params: { deptId } }),

    // Xóa user
    deleteUser: (userId) => api.delete(`/users/${userId}`),
};

export default api;