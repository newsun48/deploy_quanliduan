package com.projectmanagement.core_system.service;

import com.projectmanagement.core_system.model.Notification;
import com.projectmanagement.core_system.model.Task;
import com.projectmanagement.core_system.model.User;
import com.projectmanagement.core_system.repository.NotificationRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class NotificationService {

    @Autowired
    private NotificationRepository notificationRepository;

    // Tạo thông báo mới
    public Notification createNotification(User receiver, User sender, Task task, String message, String type) {
        Notification notification = new Notification();
        notification.setReceiver(receiver);
        notification.setSender(sender);
        notification.setTask(task);
        notification.setMessage(message);
        notification.setType(type);
        notification.setRead(false);
        notification.setCreatedAt(System.currentTimeMillis());

        return notificationRepository.save(notification);
    }

    // Lấy danh sách thông báo của user (sắp xếp mới nhất trước)
    public List<Notification> getNotifications(User user) {
        return notificationRepository.findByReceiverOrderByCreatedAtDesc(user);
    }

    // Lấy số lượng thông báo chưa đọc
    public long getUnreadCount(User user) {
        return notificationRepository.countByReceiverAndReadFalse(user);
    }

    // Lấy danh sách thông báo chưa đọc
    public List<Notification> getUnreadNotifications(User user) {
        return notificationRepository.findByReceiverAndReadFalseOrderByCreatedAtDesc(user);
    }

    // Đánh dấu thong báo là đã đọc
    public Notification markAsRead(String notificationId) {
        Notification notification = notificationRepository.findById(notificationId)
                .orElseThrow(() -> new RuntimeException("Thông báo không tồn tại!"));
        notification.setRead(true);
        return notificationRepository.save(notification);
    }

    // Đánh dấu tất cả thông báo là đã đọc
    public void markAllAsRead(User user) {
        List<Notification> unread = notificationRepository.findByReceiverAndReadFalseOrderByCreatedAtDesc(user);
        unread.forEach(n -> n.setRead(true));
        notificationRepository.saveAll(unread);
    }
}
