package com.projectmanagement.core_system.service;

import com.projectmanagement.core_system.model.Notification;
import com.projectmanagement.core_system.model.User;
import com.projectmanagement.core_system.repository.NotificationRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.access.AccessDeniedException;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class NotificationServiceTest {

    @Mock
    private NotificationRepository notificationRepository;

    @Mock
    private SimpMessagingTemplate messagingTemplate;

    @InjectMocks
    private NotificationService notificationService;

    @Test
    void markAsRead_rejectsNotificationOwnedByAnotherUser() {
        User actor = new User();
        actor.setId("user-1");

        when(notificationRepository.findByIdAndReceiver("notification-1", actor)).thenReturn(Optional.empty());

        assertThrows(AccessDeniedException.class,
                () -> notificationService.markAsRead("notification-1", actor));

        verify(notificationRepository, never()).save(any(Notification.class));
    }

    @Test
    void markAsRead_marksOwnedNotificationAsRead() {
        User actor = new User();
        actor.setId("user-1");
        Notification notification = new Notification();
        notification.setId("notification-1");
        notification.setReceiver(actor);

        when(notificationRepository.findByIdAndReceiver("notification-1", actor)).thenReturn(Optional.of(notification));
        when(notificationRepository.save(notification)).thenReturn(notification);

        Notification saved = notificationService.markAsRead("notification-1", actor);

        assertSame(notification, saved);
        verify(notificationRepository).save(notification);
    }
}
