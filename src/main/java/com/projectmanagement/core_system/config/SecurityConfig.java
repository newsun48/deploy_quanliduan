package com.projectmanagement.core_system.config;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.Customizer;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.util.Arrays;
import java.util.List;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private static final Logger logger = LoggerFactory.getLogger(SecurityConfig.class);

    @Autowired
    private JwtAuthenticationFilter jwtAuthenticationFilter;

    // Bean này dùng để mã hóa mật khẩu (Inject vào UserService)
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(Arrays.asList(
            "http://localhost:5173", 
            "http://127.0.0.1:5173", 
            "http://localhost:5174", 
            "http://127.0.0.1:5174",
            "https://deployquanliduan-production.up.railway.app"
        ));
        configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"));
        configuration.setAllowedHeaders(Arrays.asList("Authorization", "Content-Type", "X-Requested-With", "Accept", "Origin", "Access-Control-Request-Method", "Access-Control-Request-Headers"));
        configuration.setExposedHeaders(Arrays.asList("Access-Control-Allow-Origin", "Access-Control-Allow-Credentials"));
        configuration.setAllowCredentials(true);
        configuration.setMaxAge(3600L);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }

    // Cấu hình bảo mật với JWT
    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .cors(Customizer.withDefaults()) // Cho phép CORS
            .csrf(AbstractHttpConfigurer::disable) // Tắt CSRF
            .sessionManagement(sess -> sess.sessionCreationPolicy(SessionCreationPolicy.STATELESS)) // Stateless
            .authorizeHttpRequests(auth -> auth
                .requestMatchers(org.springframework.http.HttpMethod.OPTIONS, "/**").permitAll() // Cho phép tất cả OPTIONS
                .requestMatchers(
                    "/",
                    "/index.html",
                    "/assets/**",
                    "/favicon.ico",
                    "/vite.svg",
                    "/manifest.json",
                    "/robots.txt",
                    "/**/*.js",
                    "/**/*.css",
                    "/**/*.map",
                    "/**/*.json",
                    "/**/*.png",
                    "/**/*.jpg",
                    "/**/*.jpeg",
                    "/**/*.svg",
                    "/**/*.webp",
                    "/**/*.gif",
                    "/**/*.ico"
                ).permitAll()
                .requestMatchers("/api/auth/login", "/api/auth/signup", "/api/auth/google").permitAll()
                .requestMatchers("/api/admin/**").hasRole("ADMIN")
                .requestMatchers(org.springframework.http.HttpMethod.GET, "/api/users/me").authenticated()
                .requestMatchers(org.springframework.http.HttpMethod.GET, "/api/users/my-department").authenticated()
                .requestMatchers(org.springframework.http.HttpMethod.GET, "/api/tasks/statistics").hasRole("ADMIN")
                .requestMatchers(org.springframework.http.HttpMethod.GET, "/api/users", "/api/users/search", "/api/users/fix-active").hasRole("ADMIN")
                .requestMatchers(org.springframework.http.HttpMethod.POST, "/api/users", "/api/users/create-with-avatar").hasRole("ADMIN")
                .requestMatchers(org.springframework.http.HttpMethod.DELETE, "/api/users/*").hasRole("ADMIN")
                .requestMatchers(org.springframework.http.HttpMethod.PATCH, "/api/users/*", "/api/users/*/status").hasRole("ADMIN")
                .requestMatchers(org.springframework.http.HttpMethod.PATCH, "/api/users/*/approve").hasRole("ADMIN")
                .requestMatchers(org.springframework.http.HttpMethod.PATCH, "/api/users/*/reject").hasRole("ADMIN")
                .requestMatchers(org.springframework.http.HttpMethod.PATCH, "/api/users/bulk-update-dept").hasRole("ADMIN")
                .requestMatchers("/error").permitAll() // Quan trọng: Cho phép xem nội dung lỗi
                .requestMatchers(org.springframework.http.HttpMethod.GET, "/api/files/**").authenticated()
                .requestMatchers("/api/files/**").authenticated()
                .requestMatchers("/ws/**").permitAll()       // WebSocket handshake
                .requestMatchers("/uploads/**").denyAll()
                .requestMatchers("/api/**").authenticated()
                .anyRequest().authenticated()
            )
            .exceptionHandling(ex -> ex
                .authenticationEntryPoint((request, response, authException) -> {
                    logger.warn("Unauthorized request path={}", request.getRequestURI());
                    response.sendError(jakarta.servlet.http.HttpServletResponse.SC_UNAUTHORIZED, authException.getMessage());
                })
                .accessDeniedHandler((request, response, accessDeniedException) -> {
                    logger.warn("Forbidden request path={}", request.getRequestURI());
                    response.sendError(jakarta.servlet.http.HttpServletResponse.SC_FORBIDDEN, accessDeniedException.getMessage());
                })
            )
            .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class); // Thêm JWT filter

        return http.build();
    }
}
