package com.projectmanagement.core_system.repository;

import com.projectmanagement.core_system.model.Notification;
import com.projectmanagement.core_system.model.User;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface NotificationRepository extends MongoRepository<Notification, String> {
    // Lấy danh sách thông báo của một user (sắp xếp mới nhất trước)
    List<Notification> findByReceiverOrderByCreatedAtDesc(User receiver);

    // Đếm số thông báo chưa đọc
    long countByReceiverAndReadFalse(User receiver);

    // Lấy danh sách thông báo chưa đọc
    List<Notification> findByReceiverAndReadFalseOrderByCreatedAtDesc(User receiver);
}
