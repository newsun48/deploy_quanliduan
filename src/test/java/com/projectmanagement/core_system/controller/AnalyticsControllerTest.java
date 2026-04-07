package com.projectmanagement.core_system.controller;

import com.projectmanagement.core_system.service.AnalyticsService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AnalyticsControllerTest {

    @Mock
    private AnalyticsService analyticsService;

    @InjectMocks
    private AnalyticsController analyticsController;

    @Test
    void getDeliveryAnalytics_usesAuthenticatedEmailAndParams() {
        Authentication authentication = mock(Authentication.class);
        when(authentication.getName()).thenReturn("admin@example.com");
        when(analyticsService.getDeliveryAnalytics("admin@example.com", "dept-1", 30, 5))
                .thenReturn(Map.of("ok", true));

        ResponseEntity<?> response = analyticsController.getDeliveryAnalytics(authentication, "dept-1", 30, 5);

        assertEquals(200, response.getStatusCode().value());
        verify(analyticsService).getDeliveryAnalytics("admin@example.com", "dept-1", 30, 5);
    }

    @Test
    void getDeliveryAnalytics_returnsForbiddenOnAccessDenied() {
        Authentication authentication = mock(Authentication.class);
        when(authentication.getName()).thenReturn("manager@example.com");
        when(analyticsService.getDeliveryAnalytics("manager@example.com", "dept-2", 84, 7))
                .thenThrow(new AccessDeniedException("Bạn chỉ được xem analytics của phòng ban do bạn quản lý!"));

        ResponseEntity<?> response = analyticsController.getDeliveryAnalytics(authentication, "dept-2", 84, 7);

        assertEquals(403, response.getStatusCode().value());
        assertEquals("Bạn chỉ được xem analytics của phòng ban do bạn quản lý!", response.getBody());
    }
}
