package com.projectmanagement.core_system.service;

import com.projectmanagement.core_system.enums.ERole;
import com.projectmanagement.core_system.enums.ProjectStatus;
import com.projectmanagement.core_system.enums.TaskStatus;
import com.projectmanagement.core_system.model.Department;
import com.projectmanagement.core_system.model.DepartmentOkrKeyResult;
import com.projectmanagement.core_system.model.DepartmentQuarterlyOkr;
import com.projectmanagement.core_system.model.Project;
import com.projectmanagement.core_system.model.Task;
import com.projectmanagement.core_system.model.TaskActivity;
import com.projectmanagement.core_system.model.UpdateOkrKeyResultRequest;
import com.projectmanagement.core_system.model.UpdateOkrReviewSummaryRequest;
import com.projectmanagement.core_system.model.UpsertDepartmentOkrRequest;
import com.projectmanagement.core_system.model.User;
import com.projectmanagement.core_system.model.UserActivity;
import com.projectmanagement.core_system.repository.DepartmentQuarterlyOkrRepository;
import com.projectmanagement.core_system.repository.DepartmentRepository;
import com.projectmanagement.core_system.repository.ProjectRepository;
import com.projectmanagement.core_system.repository.TaskActivityRepository;
import com.projectmanagement.core_system.repository.TaskRepository;
import com.projectmanagement.core_system.repository.UserActivityRepository;
import com.projectmanagement.core_system.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class DepartmentPerformanceService {

    @Autowired
    private DepartmentRepository departmentRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ProjectRepository projectRepository;

    @Autowired
    private TaskRepository taskRepository;

    @Autowired
    private TaskActivityRepository taskActivityRepository;

    @Autowired
    private UserActivityRepository userActivityRepository;

    @Autowired
    private DepartmentQuarterlyOkrRepository departmentQuarterlyOkrRepository;

    @Autowired
    private UserActivityService userActivityService;

    public List<Map<String, Object>> getDepartmentKpis(String actorEmail) {
        User actor = requireActiveUser(actorEmail);

        List<Department> departments = departmentRepository.findAll();
        List<User> users = userRepository.findAll();
        List<Project> projects = projectRepository.findByIsDeletedFalse();
        List<Task> tasks = taskRepository.findAll();
        List<TaskActivity> taskActivities = taskActivityRepository.findAll();
        List<UserActivity> userActivities = userActivityRepository.findAll();

        Map<String, List<User>> usersByDepartment = new HashMap<>();
        for (User user : users) {
            if (user.getDepartment() == null || !StringUtils.hasText(user.getDepartment().getId())) {
                continue;
            }
            usersByDepartment.computeIfAbsent(user.getDepartment().getId(), key -> new ArrayList<>()).add(user);
        }

        Map<String, List<Project>> projectsByDepartment = new HashMap<>();
        for (Project project : projects) {
            if (project.getDepartment() == null || !StringUtils.hasText(project.getDepartment().getId())) {
                continue;
            }
            projectsByDepartment.computeIfAbsent(project.getDepartment().getId(), key -> new ArrayList<>())
                    .add(project);
        }

        Map<String, List<Task>> tasksByDepartment = new HashMap<>();
        for (Task task : tasks) {
            if (task.getProject() == null || task.getProject().getDepartment() == null
                    || !StringUtils.hasText(task.getProject().getDepartment().getId())) {
                continue;
            }
            tasksByDepartment.computeIfAbsent(task.getProject().getDepartment().getId(), key -> new ArrayList<>())
                    .add(task);
        }

        Map<String, List<TaskActivity>> taskActivitiesByDepartment = new HashMap<>();
        for (TaskActivity taskActivity : taskActivities) {
            Task activityTask = findTaskById(tasks, taskActivity.getTaskId());
            if (activityTask == null || activityTask.getProject() == null
                    || activityTask.getProject().getDepartment() == null) {
                continue;
            }
            String departmentId = activityTask.getProject().getDepartment().getId();
            if (!StringUtils.hasText(departmentId)) {
                continue;
            }
            taskActivitiesByDepartment.computeIfAbsent(departmentId, key -> new ArrayList<>()).add(taskActivity);
        }

        Map<String, List<UserActivity>> userActivitiesByDepartment = new HashMap<>();
        for (Department department : departments) {
            List<User> departmentUsers = usersByDepartment.getOrDefault(department.getId(), List.of());
            Set<String> userIds = new HashSet<>();
            for (User user : departmentUsers) {
                userIds.add(user.getId());
            }

            List<UserActivity> matchedActivities = new ArrayList<>();
            for (UserActivity activity : userActivities) {
                if ((activity.getActorId() != null && userIds.contains(activity.getActorId()))
                        || (activity.getTargetUserId() != null && userIds.contains(activity.getTargetUserId()))) {
                    matchedActivities.add(activity);
                }
            }
            userActivitiesByDepartment.put(department.getId(), matchedActivities);
        }

        List<Map<String, Object>> result = new ArrayList<>();
        for (Department department : departments) {
            if (!canViewDepartment(actor, department)) {
                continue;
            }
            List<User> departmentUsers = usersByDepartment.getOrDefault(department.getId(), List.of());
            List<Project> departmentProjects = projectsByDepartment.getOrDefault(department.getId(), List.of());
            List<Task> departmentTasks = tasksByDepartment.getOrDefault(department.getId(), List.of());

            long activeUsers = departmentUsers.stream().filter(User::isActive).count();
            long openProjects = departmentProjects.stream().filter(project -> project.getStatus() == ProjectStatus.OPEN)
                    .count();
            long closedProjects = departmentProjects.stream()
                    .filter(project -> project.getStatus() == ProjectStatus.CLOSED).count();
            long todoTasks = departmentTasks.stream().filter(task -> task.getStatus() == TaskStatus.TO_DO).count();
            long inProgressTasks = departmentTasks.stream().filter(task -> task.getStatus() == TaskStatus.IN_PROGRESS)
                    .count();
            long doneTasks = departmentTasks.stream().filter(task -> task.getStatus() == TaskStatus.DONE).count();
            long overdueTasks = departmentTasks.stream()
                    .filter(task -> task.getDeadline() != null)
                    .filter(task -> task.getDeadline().isBefore(LocalDate.now()))
                    .filter(task -> task.getStatus() != TaskStatus.DONE)
                    .count();

            double completionRate = departmentTasks.isEmpty()
                    ? 0d
                    : (double) doneTasks * 100d / departmentTasks.size();
            double avgTaskProgress = departmentTasks.isEmpty()
                    ? 0d
                    : departmentTasks.stream().mapToInt(Task::getCompletionPercentage).average().orElse(0d);

            Map<String, Object> departmentKpi = new HashMap<>();
            departmentKpi.put("departmentId", department.getId());
            departmentKpi.put("departmentName", department.getName());
            departmentKpi.put("totalUsers", departmentUsers.size());
            departmentKpi.put("activeUsers", activeUsers);
            departmentKpi.put("totalProjects", departmentProjects.size());
            departmentKpi.put("openProjects", openProjects);
            departmentKpi.put("closedProjects", closedProjects);
            departmentKpi.put("totalTasks", departmentTasks.size());
            departmentKpi.put("todoTasks", todoTasks);
            departmentKpi.put("inProgressTasks", inProgressTasks);
            departmentKpi.put("doneTasks", doneTasks);
            departmentKpi.put("overdueTasks", overdueTasks);
            departmentKpi.put("completionRate", completionRate);
            departmentKpi.put("averageTaskProgress", avgTaskProgress);
            departmentKpi.put("taskActivityCount",
                    taskActivitiesByDepartment.getOrDefault(department.getId(), List.of()).size());
            departmentKpi.put("userActivityCount",
                    userActivitiesByDepartment.getOrDefault(department.getId(), List.of()).size());
            result.add(departmentKpi);
        }

        return result;
    }

    public DepartmentQuarterlyOkr upsertQuarterlyOkr(UpsertDepartmentOkrRequest request, String actorEmail) {
        User actor = requireActiveUser(actorEmail);
        if (request == null || !StringUtils.hasText(request.getDepartmentId())) {
            throw new RuntimeException("departmentId không được để trống!");
        }
        if (request.getYear() == null || request.getQuarter() == null) {
            throw new RuntimeException("year và quarter không được để trống!");
        }
        if (request.getQuarter() < 1 || request.getQuarter() > 4) {
            throw new RuntimeException("quarter phải nằm trong khoảng 1-4!");
        }

        Department department = departmentRepository.findById(request.getDepartmentId())
                .orElseThrow(() -> new RuntimeException("Phòng ban không tồn tại!"));
        ensureCanManageDepartment(actor, department);

        DepartmentQuarterlyOkr okr = departmentQuarterlyOkrRepository
                .findByDepartment_IdAndYearAndQuarter(department.getId(), request.getYear(), request.getQuarter())
                .orElseGet(DepartmentQuarterlyOkr::new);

        if (okr.getId() == null) {
            okr.setCreatedAt(System.currentTimeMillis());
        }

        okr.setDepartment(department);
        okr.setYear(request.getYear());
        okr.setQuarter(request.getQuarter());
        okr.setObjective(request.getObjective() != null ? request.getObjective().trim() : null);
        okr.setKeyResults(normalizeKeyResults(request.getKeyResults()));
        okr.setUpdatedAt(System.currentTimeMillis());

        DepartmentQuarterlyOkr saved = departmentQuarterlyOkrRepository.save(okr);
        userActivityService.record(actor, actor, "DEPARTMENT_OKR_UPSERTED",
                actor.getFullName() + " đã cập nhật OKR quý " + saved.getQuarter() + "/" + saved.getYear()
                        + " cho phòng ban " + department.getName(),
                Map.of(
                        "departmentId", department.getId(),
                        "okrId", saved.getId()));
        return saved;
    }

    public DepartmentQuarterlyOkr updateKeyResultProgress(String okrId, String keyResultId,
            UpdateOkrKeyResultRequest request, String actorEmail) {
        User actor = requireActiveUser(actorEmail);
        DepartmentQuarterlyOkr okr = departmentQuarterlyOkrRepository.findById(okrId)
                .orElseThrow(() -> new RuntimeException("OKR không tồn tại!"));
        ensureCanManageDepartment(actor, okr.getDepartment());

        if (request == null || request.getCurrentValue() == null) {
            throw new RuntimeException("currentValue không được để trống!");
        }

        DepartmentOkrKeyResult keyResult = okr.getKeyResults().stream()
                .filter(item -> keyResultId.equals(item.getId()))
                .findFirst()
                .orElseThrow(() -> new RuntimeException("Key result không tồn tại!"));

        keyResult.setCurrentValue(request.getCurrentValue());
        okr.setUpdatedAt(System.currentTimeMillis());

        DepartmentQuarterlyOkr saved = departmentQuarterlyOkrRepository.save(okr);
        userActivityService.record(actor, actor, "DEPARTMENT_OKR_KEY_RESULT_UPDATED",
                actor.getFullName() + " đã cập nhật tiến độ key result " + keyResult.getName(),
                Map.of("okrId", saved.getId(), "keyResultId", keyResultId));
        return saved;
    }

    public DepartmentQuarterlyOkr updateReviewSummary(String okrId, UpdateOkrReviewSummaryRequest request,
            String actorEmail) {
        User actor = requireActiveUser(actorEmail);
        DepartmentQuarterlyOkr okr = departmentQuarterlyOkrRepository.findById(okrId)
                .orElseThrow(() -> new RuntimeException("OKR không tồn tại!"));
        ensureCanManageDepartment(actor, okr.getDepartment());

        okr.setReviewSummary(request != null ? request.getReviewSummary() : null);
        okr.setUpdatedAt(System.currentTimeMillis());

        DepartmentQuarterlyOkr saved = departmentQuarterlyOkrRepository.save(okr);
        userActivityService.record(actor, actor, "DEPARTMENT_OKR_REVIEW_UPDATED",
                actor.getFullName() + " đã cập nhật tổng kết quý cho OKR", Map.of("okrId", saved.getId()));
        return saved;
    }

    public DepartmentQuarterlyOkr generateQuarterlyInsights(String departmentId, Integer year, Integer quarter,
            String actorEmail) {
        User actor = requireActiveUser(actorEmail);
        Department department = departmentRepository.findById(departmentId)
                .orElseThrow(() -> new RuntimeException("Phòng ban không tồn tại!"));
        ensureCanManageDepartment(actor, department);

        // 1. Thu thập dữ liệu thực tế của phòng ban
        List<Project> projects = projectRepository.findByIsDeletedFalse().stream()
                .filter(p -> p.getDepartment() != null && departmentId.equals(p.getDepartment().getId()))
                .toList();

        List<Task> tasks = taskRepository.findAll().stream()
                .filter(t -> t.getProject() != null && t.getProject().getDepartment() != null
                        && departmentId.equals(t.getProject().getDepartment().getId()))
                .toList();

        long doneTasks = tasks.stream().filter(t -> t.getStatus() == TaskStatus.DONE).count();
        long totalTasks = tasks.size();
        double completionRate = totalTasks == 0 ? 0 : (double) doneTasks * 100 / totalTasks;
        long overdueTasks = tasks.stream()
                .filter(t -> t.getDeadline() != null && t.getDeadline().isBefore(LocalDate.now())
                        && t.getStatus() != TaskStatus.DONE)
                .count();

        // 2. Tạo hoặc lấy OKR hiện tại
        DepartmentQuarterlyOkr okr = departmentQuarterlyOkrRepository
                .findByDepartment_IdAndYearAndQuarter(departmentId, year, quarter)
                .orElseGet(DepartmentQuarterlyOkr::new);

        if (okr.getId() == null) {
            okr.setCreatedAt(System.currentTimeMillis());
            okr.setDepartment(department);
            okr.setYear(year);
            okr.setQuarter(quarter);
        }

        // 3. Tự động thiết lập Objective và Key Results
        okr.setObjective("Nâng cao hiệu suất vận hành và hoàn thành danh mục dự án Quý " + quarter + "/" + year);

        List<DepartmentOkrKeyResult> krs = new ArrayList<>();

        // KR 1: Tỷ lệ hoàn thành task
        krs.add(new DepartmentOkrKeyResult(UUID.randomUUID().toString(),
                "Đạt tỷ lệ hoàn thành công việc tổng thể trên 85%", 85.0, completionRate, "%"));

        // KR 2: Kiểm soát deadline
        krs.add(new DepartmentOkrKeyResult(UUID.randomUUID().toString(), "Giảm số lượng task quá hạn xuống dưới 5", 5.0,
                (double) overdueTasks, "tasks"));

        // KR 3: Tiến độ dự án
        long openProjects = projects.stream().filter(p -> p.getStatus() == ProjectStatus.OPEN).count();
        krs.add(new DepartmentOkrKeyResult(UUID.randomUUID().toString(),
                "Đẩy nhanh tiến độ " + openProjects + " dự án đang mở", (double) openProjects,
                (double) projects.stream().filter(p -> p.getStatus() == ProjectStatus.CLOSED).count(), "projects"));

        okr.setKeyResults(krs);

        // 4. Viết Review Summary tự động (AI-Style)
        StringBuilder summary = new StringBuilder();
        summary.append("Dựa trên phân tích thực tế: ");
        summary.append("Phòng ban ").append(department.getName()).append(" đang có ").append(totalTasks)
                .append(" tasks. ");
        summary.append("Hiệu suất hiện tại đạt ").append(String.format("%.1f", completionRate)).append("%, ");
        if (overdueTasks > 0) {
            summary.append("cần chú ý xử lý gấp ").append(overdueTasks)
                    .append(" task đang quá hạn để đảm bảo uy tín deadline. ");
        } else {
            summary.append("đang kiểm soát deadline rất tốt với 0 task quá hạn. ");
        }
        summary.append("Mục tiêu trọng tâm tiếp theo là tập trung giải phóng ").append(openProjects)
                .append(" dự án đang vận hành.");

        okr.setReviewSummary(summary.toString());
        okr.setUpdatedAt(System.currentTimeMillis());

        DepartmentQuarterlyOkr saved = departmentQuarterlyOkrRepository.save(okr);
        userActivityService.record(actor, actor, "DEPARTMENT_OKR_AUTO_GENERATED",
                actor.getFullName() + " đã yêu cầu hệ thống phân tích & tự động tạo OKR Quý " + quarter,
                Map.of("departmentId", departmentId, "okrId", saved.getId()));

        return saved;
    }

    public List<DepartmentQuarterlyOkr> getDepartmentOkrs(String departmentId, Integer year, Integer quarter,
            String actorEmail) {
        User actor = requireActiveUser(actorEmail);
        Department department = departmentRepository.findById(departmentId)
                .orElseThrow(() -> new RuntimeException("Phòng ban không tồn tại!"));
        ensureCanViewDepartment(actor, department);
        if (year != null && quarter != null) {
            return departmentQuarterlyOkrRepository
                    .findByDepartment_IdAndYearAndQuarterOrderByYearDescQuarterDesc(departmentId, year, quarter);
        }
        return departmentQuarterlyOkrRepository.findByDepartment_IdOrderByYearDescQuarterDesc(departmentId);
    }

    private boolean canViewDepartment(User actor, Department department) {
        try {
            ensureCanViewDepartment(actor, department);
            return true;
        } catch (AccessDeniedException e) {
            return false;
        }
    }

    private Task findTaskById(List<Task> tasks, String taskId) {
        if (!StringUtils.hasText(taskId)) {
            return null;
        }
        for (Task task : tasks) {
            if (taskId.equals(task.getId())) {
                return task;
            }
        }
        return null;
    }

    private List<DepartmentOkrKeyResult> normalizeKeyResults(List<DepartmentOkrKeyResult> keyResults) {
        List<DepartmentOkrKeyResult> normalized = new ArrayList<>();
        if (keyResults == null) {
            return normalized;
        }

        for (DepartmentOkrKeyResult input : keyResults) {
            if (input == null || !StringUtils.hasText(input.getName())) {
                continue;
            }
            DepartmentOkrKeyResult item = new DepartmentOkrKeyResult();
            item.setId(StringUtils.hasText(input.getId()) ? input.getId() : UUID.randomUUID().toString());
            item.setName(input.getName().trim());
            item.setTargetValue(input.getTargetValue());
            item.setCurrentValue(input.getCurrentValue() != null ? input.getCurrentValue() : 0d);
            item.setUnit(input.getUnit());
            normalized.add(item);
        }

        return normalized;
    }

    private void ensureCanManageDepartment(User actor, Department department) {
        if (actor.getRole() == ERole.ADMIN) {
            return;
        }

        // Trường hợp 1: Người dùng là Manager được gán đích danh làm Trưởng phòng
        if (actor.getRole() == ERole.MANAGER
                && department.getManager() != null
                && StringUtils.hasText(department.getManager().getId())
                && department.getManager().getId().equals(actor.getId())) {
            return;
        }

        // Trường hợp 2: Người dùng có vai trò MANAGER và thuộc đúng phòng ban này
        if (actor.getRole() == ERole.MANAGER
                && actor.getDepartment() != null
                && StringUtils.hasText(actor.getDepartment().getId())
                && actor.getDepartment().getId().equals(department.getId())) {
            return;
        }

        throw new AccessDeniedException("Bạn không có quyền cập nhật OKR của phòng ban này!");
    }

    private void ensureCanViewDepartment(User actor, Department department) {
        if (actor.getRole() == ERole.ADMIN) {
            return;
        }

        if (actor.getRole() == ERole.MANAGER
                && department.getManager() != null
                && StringUtils.hasText(department.getManager().getId())
                && department.getManager().getId().equals(actor.getId())) {
            return;
        }

        if (actor.getDepartment() != null
                && StringUtils.hasText(actor.getDepartment().getId())
                && actor.getDepartment().getId().equals(department.getId())) {
            return;
        }

        throw new AccessDeniedException("Bạn không có quyền xem OKR của phòng ban này!");
    }

    private User requireActiveUser(String email) {
        if (!StringUtils.hasText(email)) {
            throw new AccessDeniedException("Thiếu thông tin người dùng thực hiện!");
        }

        User actor = userRepository.findByEmailIgnoreCase(email.trim().toLowerCase())
                .orElseThrow(() -> new AccessDeniedException("Người dùng thực hiện không tồn tại!"));

        if (!actor.isActive()) {
            throw new AccessDeniedException("Tài khoản của bạn đang bị khóa!");
        }

        return actor;
    }
}
