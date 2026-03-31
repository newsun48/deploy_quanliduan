package com.projectmanagement.core_system.service;

import com.projectmanagement.core_system.model.Department;
import com.projectmanagement.core_system.model.ProjectMessage;
import com.projectmanagement.core_system.model.User;
import com.projectmanagement.core_system.repository.ProjectMessageRepository;
import com.projectmanagement.core_system.repository.ProjectRepository;
import com.projectmanagement.core_system.repository.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProjectMessageServiceTest {

    @Mock
    private ProjectMessageRepository projectMessageRepository;

    @Mock
    private ProjectRepository projectRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private SimpMessagingTemplate messagingTemplate;

    @InjectMocks
    private ProjectMessageService projectMessageService;

    @AfterEach
    void cleanupSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void getPrivateMessages_returnsHistoryForAuthorizedSameDepartmentUsers() {
        User user1 = buildUser("user-1", "user1@example.com", "dept-1");
        User user2 = buildUser("user-2", "user2@example.com", "dept-1");
        ProjectMessage message = new ProjectMessage();
        message.setId("msg-1");

        authenticate("user1@example.com");
        when(userRepository.findByEmailIgnoreCase("user1@example.com")).thenReturn(Optional.of(user1));
        when(userRepository.findById("user-1")).thenReturn(Optional.of(user1));
        when(userRepository.findById("user-2")).thenReturn(Optional.of(user2));
        ProjectMessage unrelated = new ProjectMessage();
        unrelated.setId("msg-2");
        unrelated.setSender(buildUser("user-3", "user3@example.com", "dept-1"));
        unrelated.setReceiver(buildUser("user-4", "user4@example.com", "dept-1"));

        message.setSender(user1);
        message.setReceiver(user2);

        when(projectMessageRepository.findByReceiverIsNotNullOrderByCreatedAtAsc())
                .thenReturn(List.of(unrelated, message));

        List<ProjectMessage> result = projectMessageService.getPrivateMessages("user-1", "user-2");

        assertEquals(1, result.size());
        assertEquals("msg-1", result.get(0).getId());
        verify(projectMessageRepository).findByReceiverIsNotNullOrderByCreatedAtAsc();
    }

    @Test
    void getPrivateMessages_rejectsCrossDepartmentAccess() {
        User user1 = buildUser("user-1", "user1@example.com", "dept-1");
        User user2 = buildUser("user-2", "user2@example.com", "dept-2");

        authenticate("user1@example.com");
        when(userRepository.findByEmailIgnoreCase("user1@example.com")).thenReturn(Optional.of(user1));
        when(userRepository.findById("user-1")).thenReturn(Optional.of(user1));
        when(userRepository.findById("user-2")).thenReturn(Optional.of(user2));

        RuntimeException error = assertThrows(RuntimeException.class,
                () -> projectMessageService.getPrivateMessages("user-1", "user-2"));

        assertEquals("Chỉ có thể nhắn tin riêng với người cùng phòng ban!", error.getMessage());
        verify(projectMessageRepository, never()).findByReceiverIsNotNullOrderByCreatedAtAsc();
    }

    @Test
    void sendMessage_privateChat_rejectsSenderSpoofing() {
        User authenticatedUser = buildUser("user-1", "user1@example.com", "dept-1");

        authenticate("user1@example.com");
        when(userRepository.findByEmailIgnoreCase("user1@example.com")).thenReturn(Optional.of(authenticatedUser));

        RuntimeException error = assertThrows(RuntimeException.class,
                () -> projectMessageService.sendMessage(Map.of(
                        "senderId", "spoofed-user",
                        "receiverId", "user-2",
                        "content", "hello"
                )));

        assertEquals("Bạn không có quyền gửi tin nhắn dưới danh nghĩa người dùng khác!", error.getMessage());
        verify(projectMessageRepository, never()).save(any(ProjectMessage.class));
    }

    @Test
    void sendMessage_privateChat_rejectsCrossDepartmentReceiver() {
        User authenticatedUser = buildUser("user-1", "user1@example.com", "dept-1");
        User receiver = buildUser("user-2", "user2@example.com", "dept-2");

        authenticate("user1@example.com");
        when(userRepository.findByEmailIgnoreCase("user1@example.com")).thenReturn(Optional.of(authenticatedUser));
        when(userRepository.findById("user-2")).thenReturn(Optional.of(receiver));

        RuntimeException error = assertThrows(RuntimeException.class,
                () -> projectMessageService.sendMessage(Map.of(
                        "senderId", "user-1",
                        "receiverId", "user-2",
                        "content", "hello"
                )));

        assertEquals("Chỉ có thể nhắn tin riêng với người cùng phòng ban!", error.getMessage());
        verify(projectMessageRepository, never()).save(any(ProjectMessage.class));
    }

    @Test
    void sendMessage_privateChat_sameDepartment_savesAndBroadcasts() {
        User authenticatedUser = buildUser("user-1", "user1@example.com", "dept-1");
        User receiver = buildUser("user-2", "user2@example.com", "dept-1");

        ProjectMessage savedMessage = new ProjectMessage();
        savedMessage.setId("msg-1");
        savedMessage.setSender(authenticatedUser);
        savedMessage.setReceiver(receiver);
        savedMessage.setCreatedAt(LocalDateTime.now());

        authenticate("user1@example.com");
        when(userRepository.findByEmailIgnoreCase("user1@example.com")).thenReturn(Optional.of(authenticatedUser));
        when(userRepository.findById("user-2")).thenReturn(Optional.of(receiver));
        when(projectMessageRepository.save(any(ProjectMessage.class))).thenReturn(savedMessage);

        ProjectMessage result = projectMessageService.sendMessage(Map.of(
                "senderId", "user-1",
                "receiverId", "user-2",
                "content", "hello"
        ));

        assertEquals("msg-1", result.getId());
        verify(projectMessageRepository).save(any(ProjectMessage.class));
        verify(messagingTemplate).convertAndSendToUser(eq("user2@example.com"), eq("/queue/messages"), eq(savedMessage));
        verify(messagingTemplate).convertAndSendToUser(eq("user1@example.com"), eq("/queue/messages"), eq(savedMessage));
    }

    private void authenticate(String email) {
        SecurityContextHolder.getContext().setAuthentication(new TestingAuthenticationToken(email, null));
    }

    private User buildUser(String id, String email, String departmentId) {
        Department department = new Department();
        department.setId(departmentId);

        User user = new User();
        user.setId(id);
        user.setEmail(email);
        user.setDepartment(department);
        return user;
    }
}
