import { useEffect, useState } from 'react';
import { notificationAPI } from '../api';
import './NotificationBell.css';

const NotificationBell = () => {
    const [unreadCount, setUnreadCount] = useState(0);
    const [notifications, setNotifications] = useState([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // Fetch unread count mỗi 10 giây
    useEffect(() => {
        fetchUnreadCount();
        const interval = setInterval(fetchUnreadCount, 10000);
        return () => clearInterval(interval);
    }, []);

    const fetchUnreadCount = async () => {
        try {
            const res = await notificationAPI.getUnreadCount();
            setUnreadCount(res.data.unreadCount || 0);
        } catch (err) {
            console.error('Lỗi fetch unread count:', err);
        }
    };

    const fetchNotifications = async () => {
        setIsLoading(true);
        try {
            const res = await notificationAPI.getNotifications();
            setNotifications(res.data || []);
        } catch (err) {
            console.error('Lỗi fetch notifications:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleBellClick = () => {
        if (!showDropdown) {
            fetchNotifications();
        }
        setShowDropdown(!showDropdown);
    };

    const handleMarkAsRead = async (notificationId) => {
        try {
            await notificationAPI.markAsRead(notificationId);
            // Update notification status locally
            setNotifications(prev => 
                prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n)
            );
            await fetchUnreadCount();
        } catch (err) {
            console.error('Lỗi mark as read:', err);
        }
    };

    const handleMarkAllAsRead = async () => {
        try {
            await notificationAPI.markAllAsRead();
            setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
            setUnreadCount(0);
        } catch (err) {
            console.error('Lỗi mark all as read:', err);
        }
    };

    return (
        <div className="notification-bell-container position-relative">
            <button
                className="btn btn-link position-relative text-dark"
                onClick={handleBellClick}
                style={{ textDecoration: 'none', fontSize: '20px' }}
            >
                <i className="bi bi-bell-fill"></i>
                {unreadCount > 0 && (
                    <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {showDropdown && (
                <div className="notification-dropdown card shadow" style={{ 
                    position: 'absolute',
                    right: 0,
                    top: '100%',
                    width: '350px',
                    maxHeight: '400px',
                    overflowY: 'auto',
                    zIndex: 1000,
                    marginTop: '10px',
                    borderRadius: '8px'
                }}>
                    <div className="card-header bg-primary text-white d-flex justify-content-between align-items-center">
                        <h6 className="mb-0">Thông báo ({unreadCount} chưa đọc)</h6>
                        {unreadCount > 0 && (
                            <button
                                className="btn btn-link text-white btn-sm"
                                onClick={handleMarkAllAsRead}
                                style={{ fontSize: '12px' }}
                            >
                                Đánh dấu tất cả
                            </button>
                        )}
                    </div>

                    <div className="card-body" style={{ padding: 0 }}>
                        {isLoading && (
                            <div className="text-center py-3">
                                <div className="spinner-border spinner-border-sm" role="status"></div>
                            </div>
                        )}

                        {!isLoading && notifications.length === 0 && (
                            <div className="text-center py-4 text-muted">
                                <i className="bi bi-inbox" style={{ fontSize: '32px', opacity: 0.5 }}></i>
                                <p className="mt-2 mb-0">Không có thông báo</p>
                            </div>
                        )}

                        {!isLoading && notifications.length > 0 && (
                            <div className="list-group list-group-flush">
                                {notifications.map((notif) => (
                                    <div
                                        key={notif.id}
                                        className={`list-group-item p-3 ${
                                            notif.isRead ? '' : 'bg-light border-start border-primary border-3'
                                        }`}
                                        style={{ cursor: 'pointer' }}
                                        onClick={() => !notif.isRead && handleMarkAsRead(notif.id)}
                                    >
                                        <div className="d-flex justify-content-between align-items-start">
                                            <div className="flex-grow-1">
                                                <h6 className="mb-1 fw-bold">
                                                    {notif.type === 'TASK_ASSIGNED' ? '📋 Công việc mới' : '📢 Thông báo'}
                                                </h6>
                                                <p className="mb-1 small text-dark">{notif.message}</p>
                                                <small className="text-muted">
                                                    {new Date(notif.createdAt).toLocaleDateString('vi-VN', {
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    })}
                                                </small>
                                            </div>
                                            {!notif.isRead && (
                                                <span className="badge bg-primary rounded-pill ms-2">Mới</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {showDropdown && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        zIndex: 999
                    }}
                    onClick={() => setShowDropdown(false)}
                />
            )}
        </div>
    );
};

export default NotificationBell;
