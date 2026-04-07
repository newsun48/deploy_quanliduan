package com.projectmanagement.core_system.config;

import com.projectmanagement.core_system.model.Project;
import com.projectmanagement.core_system.model.User;
import com.projectmanagement.core_system.repository.ProjectRepository;
import com.projectmanagement.core_system.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.util.StringUtils;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

import java.util.Map;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Autowired
    private JwtUtil jwtUtil;

    @Autowired
    private UserDetailsService userDetailsService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ProjectRepository projectRepository;

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        // /topic: group chat broadcast
        // /queue: private chat (user-specific)
        config.enableSimpleBroker("/topic", "/queue");

        // Prefix cho message từ client gửi lên server
        config.setApplicationDestinationPrefixes("/app");

        // Prefix cho user-specific messages (dùng với convertAndSendToUser)
        config.setUserDestinationPrefix("/user");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        // Endpoint WebSocket với SockJS fallback
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns("*")
                .withSockJS();
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(new ChannelInterceptor() {
            @Override
            public Message<?> preSend(Message<?> message, MessageChannel channel) {
                StompHeaderAccessor accessor = StompHeaderAccessor.wrap(message);

                if (StompCommand.CONNECT.equals(accessor.getCommand())) {
                    String authHeader = accessor.getFirstNativeHeader("Authorization");
                    if (authHeader == null || !authHeader.startsWith("Bearer ")) {
                        throw new IllegalArgumentException("Thiếu Authorization token cho WebSocket!");
                    }

                    String token = authHeader.substring(7);
                    String userEmail = jwtUtil.extractEmail(token);
                    User user = userRepository.findByEmailIgnoreCase(userEmail)
                            .orElseThrow(() -> new IllegalArgumentException("Người dùng không tồn tại!"));
                    UserDetails userDetails = userDetailsService.loadUserByUsername(userEmail);

                    if (!jwtUtil.validateToken(token, user) || !userDetails.isEnabled()) {
                        throw new IllegalArgumentException("WebSocket token không hợp lệ!");
                    }

                    UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                            userDetails,
                            null,
                            userDetails.getAuthorities()
                    );
                    Map<String, Object> sessionAttributes = accessor.getSessionAttributes();
                    if (sessionAttributes != null) {
                        sessionAttributes.put("authToken", token);
                        sessionAttributes.put("authEmail", userEmail);
                    }
                    accessor.setUser(authentication);
                } else if (requiresAuthentication(accessor.getCommand())) {
                    Map<String, Object> sessionAttributes = accessor.getSessionAttributes();
                    if (sessionAttributes == null) {
                        throw new IllegalArgumentException("Thiếu thông tin phiên WebSocket!");
                    }

                    String token = (String) sessionAttributes.get("authToken");
                    String userEmail = (String) sessionAttributes.get("authEmail");
                    if (token == null || userEmail == null) {
                        throw new IllegalArgumentException("Phiên WebSocket không còn hợp lệ!");
                    }

                    User user = userRepository.findByEmailIgnoreCase(userEmail)
                            .orElseThrow(() -> new IllegalArgumentException("Người dùng không tồn tại!"));
                    UserDetails userDetails = userDetailsService.loadUserByUsername(userEmail);

                    if (!jwtUtil.validateToken(token, user) || !userDetails.isEnabled()) {
                        throw new IllegalArgumentException("Phiên WebSocket đã hết hiệu lực. Vui lòng đăng nhập lại!");
                    }

                    if (StompCommand.SUBSCRIBE.equals(accessor.getCommand())) {
                        validateSubscriptionAccess(accessor, user);
                    }
                }

                return message;
            }
        });
    }

    private boolean requiresAuthentication(StompCommand command) {
        return command == StompCommand.SEND
                || command == StompCommand.SUBSCRIBE
                || command == StompCommand.UNSUBSCRIBE
                || command == StompCommand.MESSAGE;
    }

    private void validateSubscriptionAccess(StompHeaderAccessor accessor, User user) {
        String destination = accessor.getDestination();
        if (!StringUtils.hasText(destination) || !destination.startsWith("/topic/project/")) {
            return;
        }

        String projectId = destination.substring("/topic/project/".length()).trim();
        if (!StringUtils.hasText(projectId)) {
            throw new IllegalArgumentException("Thiếu thông tin dự án cho kênh chat!");
        }

        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new IllegalArgumentException("Dự án không tồn tại!"));

        if (!canAccessProjectTopic(user, project)) {
            throw new IllegalArgumentException("Bạn không có quyền subscribe chat của dự án này!");
        }
    }

    private boolean canAccessProjectTopic(User user, Project project) {
        if (user == null || project == null) {
            return false;
        }

        if (project.getMembers() != null && project.getMembers().stream()
                .filter(member -> member != null && StringUtils.hasText(member.getId()))
                .anyMatch(member -> member.getId().equals(user.getId()))) {
            return true;
        }

        return project.getDepartment() != null
                && project.getDepartment().getManager() != null
                && StringUtils.hasText(project.getDepartment().getManager().getId())
                && project.getDepartment().getManager().getId().equals(user.getId());
    }
}
