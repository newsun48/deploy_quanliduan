package com.projectmanagement.core_system;

import com.projectmanagement.core_system.enums.ERole;
import com.projectmanagement.core_system.enums.Priority;
import com.projectmanagement.core_system.enums.ProjectStatus;
import com.projectmanagement.core_system.enums.TaskStatus;
import com.projectmanagement.core_system.model.Department;
import com.projectmanagement.core_system.model.User;
import com.projectmanagement.core_system.model.Project;
import com.projectmanagement.core_system.model.Task;
import com.projectmanagement.core_system.repository.DepartmentRepository;
import com.projectmanagement.core_system.repository.UserRepository;
import com.projectmanagement.core_system.repository.ProjectRepository;
import com.projectmanagement.core_system.repository.TaskRepository;
import com.projectmanagement.core_system.service.SequenceGeneratorService;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.security.crypto.password.PasswordEncoder;
import java.time.LocalDate;
import java.util.Arrays;

@SpringBootApplication
public class CoreSystemApplication {

    public static void main(String[] args) {
        SpringApplication.run(CoreSystemApplication.class, args);
        
        // In thông báo khi chạy thành công
        System.out.println("\n\n===========================================================");
        System.out.println("🚀 DỰ ÁN CORE-SYSTEM ĐÃ KHỞI ĐỘNG THÀNH CÔNG! 🚀");
        System.out.println("-----------------------------------------------------------");
        System.out.println("✅ Server đang chạy tại: http://localhost:8080");
        System.out.println("===========================================================\n");
    }

    @Bean
public CommandLineRunner initData(DepartmentRepository departmentRepository, UserRepository userRepository, PasswordEncoder passwordEncoder) {
    return args -> {
        // Kiểm tra xem đã có dữ liệu chưa
        if (departmentRepository.count() == 0) {
            System.out.println("Đang khởi tạo dữ liệu mẫu...");
            
            // Tạo department mới với ID khác hoặc để MongoDB tự sinh ID
            Department dept = new Department();
            // KHÔNG set ID, để MongoDB tự tạo
            // hoặc set ID khác: dept.setId(1L);
            dept.setName("Phòng Kỹ thuật");
            dept.setDescription("Phòng ban kỹ thuật");
            departmentRepository.save(dept);
            
            System.out.println("Đã khởi tạo dữ liệu mẫu thành công");
        } else {
            System.out.println("Dữ liệu đã tồn tại, bỏ qua khởi tạo");
        }

        // Tạo tài khoản admin mẫu nếu chưa có
        if (!userRepository.existsByEmail("admin@gmail.com")) {
            User admin = new User();
            // Để MongoDB tự tạo ID (ObjectId)
            admin.setFullName("Admin");
            admin.setEmail("admin@gmail.com");
            admin.setPassword(passwordEncoder.encode("admin123"));
            admin.setRole(ERole.ADMIN);
            admin.setActive(true);
            userRepository.save(admin);
            System.out.println("✅ Tạo tài khoản admin: admin@gmail.com / admin123");
        }
    };
}
}

