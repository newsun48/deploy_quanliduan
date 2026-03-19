package com.projectmanagement.core_system.controller;

import com.projectmanagement.core_system.model.Department;
import com.projectmanagement.core_system.service.DepartmentService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/departments")
@CrossOrigin(origins = "http://localhost:5173") 
public class DepartmentController {

    @Autowired
    private DepartmentService departmentService;

    // 1. Lấy danh sách
    @GetMapping
    public ResponseEntity<?> getAll() {
        try {
            return ResponseEntity.ok(departmentService.getAllDepartments());
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).body("Lỗi: " + e.getMessage());
        }
    }

    // 2. Tạo mới
    @PostMapping
    public ResponseEntity<?> create(@RequestBody Department department) {
        try {
            return ResponseEntity.ok(departmentService.createDepartment(department));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // 3. Xóa
    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable String id) {
        try {
            departmentService.deleteDepartment(id);
            return ResponseEntity.ok("Xóa phòng ban thành công!");
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
}