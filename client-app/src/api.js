import axios from 'axios';

export const resolveAppUrl = (value) => {
    if (!value) return '#';

    try {
        const normalizedValue = value.startsWith('/uploads/')
            ? `/api/files/${value.slice('/uploads/'.length)}`
            : value;
        const resolvedUrl = new URL(normalizedValue, window.location.origin);
        const token = localStorage.getItem('token');

        if (token && resolvedUrl.origin === window.location.origin && resolvedUrl.pathname.startsWith('/api/files/')) {
            resolvedUrl.searchParams.set('token', token);
        }

        return resolvedUrl.toString();
    } catch {
        return value;
    }
};

export const getWebSocketUrl = () => resolveAppUrl('/ws');

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
    (error) => Promise.reject(error)
);

// Interceptor để xử lý lỗi 401 (Unauthorized)
api.interceptors.response.use(
    (response) => response,
    (error) => {
        const requestUrl = error.config?.url || '';
        const isPublicAuthRequest = requestUrl.startsWith('/auth/');

        if (error.response?.status === 401 && !isPublicAuthRequest) {
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
    login: (email, password) => api.post('/auth/login', { email, password }),
    signup: (payload) => api.post('/auth/signup', payload),
    googleLogin: (credential) => api.post('/auth/google', { credential }),
};

export const adminActivityAPI = {
    getRecentActivities: (userId, limit = 50) => api.get('/admin/user-activities', { params: { userId, limit } }),
    undoActivity: (activityId) => api.post(`/admin/user-activities/${activityId}/undo`),
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

    // Lấy user hiện tại
    getCurrentUser: () => api.get('/users/me'),

    // Lấy nhân sự cùng phòng với user hiện tại
    getMyDepartmentUsers: () => api.get('/users/my-department'),

    // Tạo user mới
    createUser: (userData, deptId) => 
        api.post('/users', userData, { params: { deptId } }),

    // Cập nhật user
    updateUser: (userId, payload) => api.patch(`/users/${userId}`, payload),

    // Phê duyệt user tự đăng ký
    approveUser: (userId, payload) => api.patch(`/users/${userId}/approve`, payload),

    // Từ chối user tự đăng ký
    rejectUser: (userId, payload) => api.patch(`/users/${userId}/reject`, payload),

    // Khóa / mở khóa user
    updateUserStatus: (userId, active) => api.patch(`/users/${userId}/status`, { active }),

    // Xóa user
    deleteUser: (userId, params = {}) => api.delete(`/users/${userId}`, { params }),
};

export const fileAPI = {
    upload: (formData) => api.post('/files/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    }),
};

export const projectAPI = {
    getAccessibleProjects: (userId) => api.get(`/projects/accessible/${userId}`),
};

export const requestAPI = {
    create: (payload) => api.post('/enterprise-requests', payload),
    getMine: () => api.get('/enterprise-requests/mine'),
    getApprovals: () => api.get('/enterprise-requests/approvals'),
    getHistory: () => api.get('/enterprise-requests/history'),
    getDetail: (requestId) => api.get(`/enterprise-requests/${requestId}`),
    decide: (requestId, payload) => api.post(`/enterprise-requests/${requestId}/decision`, payload),
};

export const projectTemplateAPI = {
    getAll: (params = {}) => api.get('/project-templates', { params }),
    create: (payload) => api.post('/project-templates', payload),
    instantiate: (templateId, payload) => api.post(`/project-templates/${templateId}/instantiate`, payload),
};

export const departmentInsightsAPI = {
    getKpis: () => api.get('/department-performance/kpis'),
    getOkrs: (departmentId, params = {}) => api.get(`/department-performance/okrs/${departmentId}`, { params }),
    upsertOkr: (payload) => api.post('/department-performance/okrs', payload),
    generateInsights: (params) => api.post('/department-performance/generate-insights', null, { params }),
    updateKeyResult: (okrId, keyResultId, payload) => api.patch(`/department-performance/okrs/${okrId}/key-results/${keyResultId}`, payload),
    updateReviewSummary: (okrId, payload) => api.patch(`/department-performance/okrs/${okrId}/review-summary`, payload),
};

export const analyticsAPI = {
    getDelivery: (params = {}) => api.get('/analytics/delivery', { params }),
};

export const taskAPI = {
    getDetail: (taskId) => api.get(`/tasks/${taskId}`),
    update: (taskId, payload) => api.put(`/tasks/${taskId}`, payload),
    delete: (taskId) => api.delete(`/tasks/${taskId}`),
    getActivity: (taskId) => api.get(`/tasks/${taskId}/activity`),
    addChecklistItem: (taskId, payload) => api.post(`/tasks/${taskId}/checklist-items`, payload),
    updateChecklistItem: (taskId, itemId, payload) => api.put(`/tasks/${taskId}/checklist-items/${itemId}`, payload),
    deleteChecklistItem: (taskId, itemId) => api.delete(`/tasks/${taskId}/checklist-items/${itemId}`),
    addAttachment: (taskId, payload) => api.post(`/tasks/${taskId}/attachments`, payload),
    deleteAttachment: (taskId, attachmentId) => api.delete(`/tasks/${taskId}/attachments/${attachmentId}`),
};

export const commentAPI = {
    getTaskComments: (taskId) => api.get(`/comments/task/${taskId}`),
    add: (taskId, _userId, payload) => api.post(`/comments/add?taskId=${taskId}`, payload),
    update: (commentId, payload) => api.put(`/comments/${commentId}`, payload),
    delete: (commentId) => api.delete(`/comments/${commentId}`),
};

export default api;
