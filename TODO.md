# TODO: Implement Admin Features - Soft Delete Projects & Edit Employees

## Plan Breakdown (Approved by User)

### Step 1: Backend - Project Soft Delete
- [x] Add isDeleted & deletedAt to Project.java
- [x] Add repo methods findByIsDeletedFalse() to ProjectRepository.java
- [x] Update ProjectService.java: filter getAllProjects(), search, accessible; add softDelete()
- [x] Update ProjectController.java: filter GET endpoints; add DELETE /api/projects/{id}

### Step 2: Backend - Employee Edit
- [x] Create UpdateUserRequest.java DTO
- [x] Add updateEmployee() to UserService.java
- [x] Add PATCH /api/users/{id} to UserController.java (admin check)

### Step 3: Frontend Updates
- [x] Edit AdminDashboard.jsx: Add Delete button to project cards; Add inline edit for users (email/dept/role) with PATCH

### Step 4: Verification
- [x] Backend: mvn clean compile
- [x] Test APIs manually
- [x] Frontend: Check UI changes

**Current Progress: User wants "Trash tab" for deleted projects with restore!**

### Step 5: Add Deleted Projects Tab (Admin)
- [x] Backend: Add repo/service/controller for `findByIsDeletedTrue()`, `restore(id)` set isDeleted=false
- [x] Frontend: Add "Dự án đã xóa" tab in AdminDashboard, list deleted projects, Restore button

**ALL COMPLETE ✅**


