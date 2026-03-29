import axios from 'axios';

export const resolveAppUrl = (value) => {
    if (!value) return '#';

    try {
        return new URL(value, window.location.origin).toString();
    } catch {
        return value;
    }
};

// Tạo axios instance với base URL
const api = axios.create({
    baseURL: '/api',
});

// Interceptor để tự động thêm token vào header
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        console.log('🔍 [Request Interceptor] URL:', config.url);
        console.log('🔍 [Request Interceptor] Token in localStorage:', token ? 'EXISTS' : 'NULL');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
            console.log('🔍 [Request Interceptor] Authorization header set:', config.headers.Authorization);
        } else {
            console.log('🔍 [Request Interceptor] No token found, skipping Authorization header');
        }
        return config;
    },
    (error) => {
        console.error('🔍 [Request Interceptor] Error:', error);
        return Promise.reject(error);
    }
);

// Interceptor để xử lý lỗi 401 (Unauthorized)
api.interceptors.response.use(
    (response) => {
        console.log('✅ [Response Interceptor] Success:', response.config.url);
        return response;
    },
    (error) => {
        console.error('❌ [Response Interceptor] Error:', error.config?.url);
        console.error('❌ [Response Interceptor] Status:', error.response?.status);
        console.error('❌ [Response Interceptor] Headers:', error.response?.headers);
        if (error.response?.status === 401) {
            console.error("⛔ Unauthorized access - clearing localStorage and redirecting");
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

export const authAPI = {
    forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
    validateResetToken: (token) => api.get('/auth/reset-password/validate', { params: { token } }),
    resetPassword: (token, newPassword) => api.post('/auth/reset-password', { token, newPassword }),
};

export const adminActivityAPI = {
    getRecentActivities: (userId, limit = 50) => api.get('/admin/user-activities', { params: { userId, limit } }),
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

    // Cập nhật user
    updateUser: (userId, payload) => api.patch(`/users/${userId}`, payload),

    // Khóa / mở khóa user
    updateUserStatus: (userId, active) => api.patch(`/users/${userId}/status`, { active }),

    // Xóa user
    deleteUser: (userId) => api.delete(`/users/${userId}`),
};

export const fileAPI = {
    upload: (formData) => api.post('/files/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    }),
};

export const taskAPI = {
    getDetail: (taskId) => api.get(`/tasks/${taskId}`),
    getActivity: (taskId) => api.get(`/tasks/${taskId}/activity`),
    addChecklistItem: (taskId, payload) => api.post(`/tasks/${taskId}/checklist-items`, payload),
    updateChecklistItem: (taskId, itemId, payload) => api.put(`/tasks/${taskId}/checklist-items/${itemId}`, payload),
    deleteChecklistItem: (taskId, itemId, actorId) => api.delete(`/tasks/${taskId}/checklist-items/${itemId}`, { params: { actorId } }),
    addAttachment: (taskId, payload) => api.post(`/tasks/${taskId}/attachments`, payload),
    deleteAttachment: (taskId, attachmentId, actorId) => api.delete(`/tasks/${taskId}/attachments/${attachmentId}`, { params: { actorId } }),
};

export const commentAPI = {
    getTaskComments: (taskId) => api.get(`/comments/task/${taskId}`),
    add: (taskId, userId, payload) => api.post(`/comments/add?taskId=${taskId}&userId=${userId}`, payload),
    update: (commentId, payload) => api.put(`/comments/${commentId}`, payload),
    delete: (commentId) => api.delete(`/comments/${commentId}`),
};

export default api;
