package com.projectmanagement.core_system.service;

import com.projectmanagement.core_system.enums.ERole;
import com.projectmanagement.core_system.enums.Priority;
import com.projectmanagement.core_system.enums.TaskStatus;
import com.projectmanagement.core_system.model.Department;
import com.projectmanagement.core_system.model.Project;
import com.projectmanagement.core_system.model.Task;
import com.projectmanagement.core_system.model.TaskActivity;
import com.projectmanagement.core_system.model.User;
import com.projectmanagement.core_system.repository.DepartmentRepository;
import com.projectmanagement.core_system.repository.TaskActivityRepository;
import com.projectmanagement.core_system.repository.TaskRepository;
import com.projectmanagement.core_system.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.time.temporal.WeekFields;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class AnalyticsService {

    private static final int DEFAULT_RANGE_DAYS = 84;
    private static final int DEFAULT_STALLED_DAYS = 7;

    @Autowired
    private TaskRepository taskRepository;

    @Autowired
    private TaskActivityRepository taskActivityRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private DepartmentRepository departmentRepository;


    public Map<String, Object> getDeliveryAnalytics(String actorEmail, String departmentId, Integer rangeDays, Integer stalledDays) {
        User actor = requireActiveUser(actorEmail);

        int effectiveRangeDays = normalizePositive(rangeDays, DEFAULT_RANGE_DAYS);
        int effectiveStalledDays = normalizePositive(stalledDays, DEFAULT_STALLED_DAYS);
        String effectiveDepartmentId = resolveDepartmentScope(actor, departmentId);

        LocalDate today = LocalDate.now();
        LocalDate rangeStart = today.minusDays(effectiveRangeDays - 1L);

        List<Task> scopedTasks = getScopedTasks(effectiveDepartmentId);
        Map<String, Task> taskById = new HashMap<>();
        List<String> taskIds = new ArrayList<>();
        for (Task task : scopedTasks) {
            if (!StringUtils.hasText(task.getId())) {
                continue;
            }
            taskById.put(task.getId(), task);
            taskIds.add(task.getId());
        }

        Map<String, List<TaskActivity>> activitiesByTask = buildActivitiesByTask(taskIds);
        Map<String, TaskTimeline> timelineByTask = buildTimelineByTask(taskById, activitiesByTask);

        Map<String, Integer> openLoadByAssignee = buildOpenLoadByAssignee(scopedTasks);

        Map<String, Object> result = new HashMap<>();
        result.put("scope", buildScopePayload(effectiveDepartmentId, actor, effectiveRangeDays, effectiveStalledDays, rangeStart, today));
        result.put("burndown", buildBurndown(scopedTasks, timelineByTask, rangeStart, today));
        result.put("velocity", buildVelocity(timelineByTask, rangeStart, today));
        result.put("throughput", buildThroughput(scopedTasks, timelineByTask, rangeStart, today));
        result.put("leadTime", buildDurationStats(scopedTasks, timelineByTask, rangeStart, true));
        result.put("cycleTime", buildDurationStats(scopedTasks, timelineByTask, rangeStart, false));
        result.put("performanceHeatmap", buildHeatmap(scopedTasks, timelineByTask, rangeStart, today));
        result.put("bottleneck", buildBottleneck(scopedTasks, timelineByTask, activitiesByTask, effectiveStalledDays, today));
        result.put("overdueRate", buildOverdueRate(scopedTasks, today));
        result.put("workloadDistribution", buildWorkload(scopedTasks, today));
        result.put("deadlineRisk", buildDeadlineRisk(scopedTasks, timelineByTask, openLoadByAssignee, today));
        return result;
    }

    private Map<String, Object> buildScopePayload(
            String effectiveDepartmentId,
            User actor,
            int effectiveRangeDays,
            int effectiveStalledDays,
            LocalDate rangeStart,
            LocalDate today) {
        Map<String, Object> scope = new HashMap<>();
        scope.put("departmentId", effectiveDepartmentId);
        scope.put("actorRole", actor.getRole() != null ? actor.getRole().name() : null);
        scope.put("rangeDays", effectiveRangeDays);
        scope.put("stalledDays", effectiveStalledDays);
        scope.put("rangeStart", rangeStart.toString());
        scope.put("rangeEnd", today.toString());
        scope.put("generatedAt", System.currentTimeMillis());
        return scope;
    }

    private List<Task> getScopedTasks(String effectiveDepartmentId) {
        List<Task> allTasks = taskRepository.findAll();
        if (!StringUtils.hasText(effectiveDepartmentId)) {
            return allTasks;
        }

        List<Task> scoped = new ArrayList<>();
        for (Task task : allTasks) {
            if (task.getProject() == null || task.getProject().getDepartment() == null) {
                continue;
            }
            String taskDepartmentId = task.getProject().getDepartment().getId();
            if (effectiveDepartmentId.equals(taskDepartmentId)) {
                scoped.add(task);
            }
        }
        return scoped;
    }

    private Map<String, List<TaskActivity>> buildActivitiesByTask(List<String> taskIds) {
        Map<String, List<TaskActivity>> result = new HashMap<>();
        if (taskIds.isEmpty()) {
            return result;
        }

        List<TaskActivity> activities = taskActivityRepository.findByTaskIdInOrderByCreatedAtAsc(taskIds);
        for (TaskActivity activity : activities) {
            if (activity == null || !StringUtils.hasText(activity.getTaskId())) {
                continue;
            }
            result.computeIfAbsent(activity.getTaskId(), key -> new ArrayList<>()).add(activity);
        }
        return result;
    }

    private Map<String, TaskTimeline> buildTimelineByTask(Map<String, Task> taskById, Map<String, List<TaskActivity>> activitiesByTask) {
        Map<String, TaskTimeline> timelineByTask = new HashMap<>();
        for (Map.Entry<String, Task> entry : taskById.entrySet()) {
            String taskId = entry.getKey();
            Task task = entry.getValue();
            List<TaskActivity> activities = activitiesByTask.getOrDefault(taskId, List.of());
            TaskTimeline timeline = new TaskTimeline();
            timeline.createdAtMillis = inferCreatedAtMillis(task, activities);
            timeline.doneAtMillis = inferDoneAtMillis(task, activities);
            timeline.inProgressAtMillis = inferInProgressAtMillis(activities, timeline.doneAtMillis);
            timeline.lastActivityAtMillis = inferLastActivityAtMillis(activities, timeline.createdAtMillis);
            timelineByTask.put(taskId, timeline);
        }
        return timelineByTask;
    }

    private Map<String, Integer> buildOpenLoadByAssignee(List<Task> scopedTasks) {
        Map<String, Integer> openLoadByAssignee = new HashMap<>();
        for (Task task : scopedTasks) {
            if (task.getStatus() == TaskStatus.DONE) {
                continue;
            }
            if (task.getAssignee() == null || !StringUtils.hasText(task.getAssignee().getId())) {
                continue;
            }
            String assigneeId = task.getAssignee().getId();
            openLoadByAssignee.put(assigneeId, openLoadByAssignee.getOrDefault(assigneeId, 0) + 1);
        }
        return openLoadByAssignee;
    }

    private Map<String, Object> buildBurndown(
            List<Task> scopedTasks,
            Map<String, TaskTimeline> timelineByTask,
            LocalDate rangeStart,
            LocalDate today) {
        List<Map<String, Object>> daily = new ArrayList<>();
        int startRemaining = 0;
        int endRemaining = 0;

        for (LocalDate day = rangeStart; !day.isAfter(today); day = day.plusDays(1)) {
            int remaining = 0;
            int completedCumulative = 0;
            for (Task task : scopedTasks) {
                TaskTimeline timeline = timelineByTask.get(task.getId());
                LocalDate createdDay = toDate(timeline != null ? timeline.createdAtMillis : null);
                LocalDate doneDay = toDate(timeline != null ? timeline.doneAtMillis : null);

                if (createdDay != null && !createdDay.isAfter(day) && (doneDay == null || doneDay.isAfter(day))) {
                    remaining++;
                }

                if (doneDay != null && !doneDay.isAfter(day)) {
                    completedCumulative++;
                }
            }

            if (day.equals(rangeStart)) {
                startRemaining = remaining;
            }
            if (day.equals(today)) {
                endRemaining = remaining;
            }

            Map<String, Object> item = new HashMap<>();
            item.put("date", day.toString());
            item.put("remaining", remaining);
            item.put("completedCumulative", completedCumulative);
            daily.add(item);
        }

        Map<String, Object> payload = new HashMap<>();
        payload.put("daily", daily);
        payload.put("startRemaining", startRemaining);
        payload.put("endRemaining", endRemaining);
        return payload;
    }

    private Map<String, Object> buildVelocity(Map<String, TaskTimeline> timelineByTask, LocalDate rangeStart, LocalDate today) {
        Map<String, Integer> weeklyCount = new HashMap<>();

        for (TaskTimeline timeline : timelineByTask.values()) {
            LocalDate doneDate = toDate(timeline.doneAtMillis);
            if (doneDate == null || doneDate.isBefore(rangeStart) || doneDate.isAfter(today)) {
                continue;
            }
            String weekKey = toWeekKey(doneDate);
            weeklyCount.put(weekKey, weeklyCount.getOrDefault(weekKey, 0) + 1);
        }

        List<Map<String, Object>> weekly = toSortedSeries(weeklyCount);
        Map<String, Object> payload = new HashMap<>();
        payload.put("weekly", weekly);
        return payload;
    }

    private Map<String, Object> buildThroughput(
            List<Task> scopedTasks,
            Map<String, TaskTimeline> timelineByTask,
            LocalDate rangeStart,
            LocalDate today) {
        Map<String, Integer> dailyCount = new HashMap<>();
        Map<String, Integer> weeklyCount = new HashMap<>();
        Map<String, Integer> departmentCount = new HashMap<>();
        Map<String, String> departmentNames = new HashMap<>();

        for (Task task : scopedTasks) {
            TaskTimeline timeline = timelineByTask.get(task.getId());
            LocalDate doneDate = toDate(timeline != null ? timeline.doneAtMillis : null);
            if (doneDate == null || doneDate.isBefore(rangeStart) || doneDate.isAfter(today)) {
                continue;
            }

            String dayKey = doneDate.toString();
            String weekKey = toWeekKey(doneDate);
            dailyCount.put(dayKey, dailyCount.getOrDefault(dayKey, 0) + 1);
            weeklyCount.put(weekKey, weeklyCount.getOrDefault(weekKey, 0) + 1);

            if (task.getProject() != null && task.getProject().getDepartment() != null && StringUtils.hasText(task.getProject().getDepartment().getId())) {
                String deptId = task.getProject().getDepartment().getId();
                departmentCount.put(deptId, departmentCount.getOrDefault(deptId, 0) + 1);
                String deptName = task.getProject().getDepartment().getName();
                if (StringUtils.hasText(deptName)) {
                    departmentNames.put(deptId, deptName);
                }
            }
        }

        List<Map<String, Object>> byDepartment = new ArrayList<>();
        for (Map.Entry<String, Integer> entry : departmentCount.entrySet()) {
            Map<String, Object> item = new HashMap<>();
            item.put("departmentId", entry.getKey());
            item.put("departmentName", departmentNames.get(entry.getKey()));
            item.put("completed", entry.getValue());
            byDepartment.add(item);
        }
        byDepartment.sort(Comparator.comparing(item -> String.valueOf(item.get("departmentId"))));

        Map<String, Object> payload = new HashMap<>();
        payload.put("daily", toSortedSeries(dailyCount));
        payload.put("weekly", toSortedSeries(weeklyCount));
        payload.put("byDepartment", byDepartment);
        return payload;
    }

    private Map<String, Object> buildDurationStats(
            List<Task> scopedTasks,
            Map<String, TaskTimeline> timelineByTask,
            LocalDate rangeStart,
            boolean leadTime) {
        List<Long> durations = new ArrayList<>();

        for (Task task : scopedTasks) {
            TaskTimeline timeline = timelineByTask.get(task.getId());
            if (timeline == null) {
                continue;
            }
            LocalDate doneDate = toDate(timeline.doneAtMillis);
            if (doneDate == null || doneDate.isBefore(rangeStart)) {
                continue;
            }

            LocalDate startDate = leadTime ? toDate(timeline.createdAtMillis) : toDate(timeline.inProgressAtMillis != null ? timeline.inProgressAtMillis : timeline.createdAtMillis);
            if (startDate == null || startDate.isAfter(doneDate)) {
                continue;
            }

            long days = ChronoUnit.DAYS.between(startDate, doneDate);
            durations.add(days);
        }

        durations.sort(Long::compareTo);

        Map<String, Object> payload = new HashMap<>();
        payload.put("count", durations.size());
        payload.put("averageDays", roundTwo(avg(durations)));
        payload.put("p50Days", percentile(durations, 0.50));
        payload.put("p85Days", percentile(durations, 0.85));
        return payload;
    }

    private Map<String, Object> buildHeatmap(
            List<Task> scopedTasks,
            Map<String, TaskTimeline> timelineByTask,
            LocalDate rangeStart,
            LocalDate today) {
        Map<String, Map<DayOfWeek, Integer>> matrix = new HashMap<>();
        Map<String, String> assigneeNames = new HashMap<>();

        for (Task task : scopedTasks) {
            TaskTimeline timeline = timelineByTask.get(task.getId());
            LocalDate doneDate = toDate(timeline != null ? timeline.doneAtMillis : null);
            if (doneDate == null || doneDate.isBefore(rangeStart) || doneDate.isAfter(today)) {
                continue;
            }
            if (task.getAssignee() == null || !StringUtils.hasText(task.getAssignee().getId())) {
                continue;
            }

            String assigneeId = task.getAssignee().getId();
            assigneeNames.put(assigneeId, task.getAssignee().getFullName());

            Map<DayOfWeek, Integer> counts = matrix.computeIfAbsent(assigneeId, key -> initWeekdayCounter());
            DayOfWeek dayOfWeek = doneDate.getDayOfWeek();
            counts.put(dayOfWeek, counts.getOrDefault(dayOfWeek, 0) + 1);
        }

        List<Map<String, Object>> assignees = new ArrayList<>();
        for (Map.Entry<String, Map<DayOfWeek, Integer>> entry : matrix.entrySet()) {
            Map<String, Object> item = new HashMap<>();
            item.put("assigneeId", entry.getKey());
            item.put("assigneeName", assigneeNames.get(entry.getKey()));

            Map<String, Integer> byWeekday = new HashMap<>();
            for (DayOfWeek dayOfWeek : DayOfWeek.values()) {
                byWeekday.put(dayOfWeek.name(), entry.getValue().getOrDefault(dayOfWeek, 0));
            }

            item.put("byWeekday", byWeekday);
            assignees.add(item);
        }

        assignees.sort(Comparator.comparing(item -> String.valueOf(item.get("assigneeName"))));

        Map<String, Object> payload = new HashMap<>();
        payload.put("assignees", assignees);
        return payload;
    }

    private Map<String, Object> buildBottleneck(
            List<Task> scopedTasks,
            Map<String, TaskTimeline> timelineByTask,
            Map<String, List<TaskActivity>> activitiesByTask,
            int stalledDays,
            LocalDate today) {
        long todoCount = 0;
        long inProgressCount = 0;
        long reviewCount = 0;
        long overdueOpenTasks = 0;
        long stalledTasks = 0;

        for (Task task : scopedTasks) {
            if (task.getStatus() == TaskStatus.TO_DO) {
                todoCount++;
            }
            if (task.getStatus() == TaskStatus.IN_PROGRESS) {
                inProgressCount++;
            }
            if (task.getStatus() == TaskStatus.REVIEW) {
                reviewCount++;
            }

            if (task.getStatus() != TaskStatus.DONE && task.getDeadline() != null && task.getDeadline().isBefore(today)) {
                overdueOpenTasks++;
            }

            if (task.getStatus() != TaskStatus.DONE && isTaskStalled(task.getId(), timelineByTask, activitiesByTask, stalledDays, today)) {
                stalledTasks++;
            }
        }

        Map<String, Object> payload = new HashMap<>();
        payload.put("statusCounts", Map.of(
                TaskStatus.TO_DO.name(), todoCount,
                TaskStatus.IN_PROGRESS.name(), inProgressCount,
                TaskStatus.REVIEW.name(), reviewCount
        ));
        payload.put("overdueOpenTasks", overdueOpenTasks);
        payload.put("stalledTasks", stalledTasks);
        return payload;
    }

    private Map<String, Object> buildOverdueRate(List<Task> scopedTasks, LocalDate today) {
        long openTasks = 0;
        long overdueOpenTasks = 0;

        for (Task task : scopedTasks) {
            if (task.getStatus() == TaskStatus.DONE) {
                continue;
            }
            openTasks++;
            if (task.getDeadline() != null && task.getDeadline().isBefore(today)) {
                overdueOpenTasks++;
            }
        }

        double rate = openTasks == 0 ? 0d : (double) overdueOpenTasks / (double) openTasks;

        Map<String, Object> payload = new HashMap<>();
        payload.put("openTasks", openTasks);
        payload.put("overdueOpenTasks", overdueOpenTasks);
        payload.put("rate", roundTwo(rate));
        return payload;
    }

    private List<Map<String, Object>> buildWorkload(List<Task> scopedTasks, LocalDate today) {
        Map<String, Integer> openByAssignee = new HashMap<>();
        Map<String, Integer> overdueByAssignee = new HashMap<>();
        Map<String, String> assigneeNames = new HashMap<>();

        for (Task task : scopedTasks) {
            if (task.getStatus() == TaskStatus.DONE) {
                continue;
            }
            if (task.getAssignee() == null || !StringUtils.hasText(task.getAssignee().getId())) {
                continue;
            }

            String assigneeId = task.getAssignee().getId();
            assigneeNames.put(assigneeId, task.getAssignee().getFullName());
            openByAssignee.put(assigneeId, openByAssignee.getOrDefault(assigneeId, 0) + 1);

            if (task.getDeadline() != null && task.getDeadline().isBefore(today)) {
                overdueByAssignee.put(assigneeId, overdueByAssignee.getOrDefault(assigneeId, 0) + 1);
            }
        }

        List<Map<String, Object>> payload = new ArrayList<>();
        for (Map.Entry<String, Integer> entry : openByAssignee.entrySet()) {
            Map<String, Object> item = new HashMap<>();
            item.put("assigneeId", entry.getKey());
            item.put("assigneeName", assigneeNames.get(entry.getKey()));
            item.put("openTasks", entry.getValue());
            item.put("overdueOpenTasks", overdueByAssignee.getOrDefault(entry.getKey(), 0));
            payload.add(item);
        }
        payload.sort(Comparator.comparing(item -> String.valueOf(item.get("assigneeName"))));
        return payload;
    }

    private List<Map<String, Object>> buildDeadlineRisk(
            List<Task> scopedTasks,
            Map<String, TaskTimeline> timelineByTask,
            Map<String, Integer> openLoadByAssignee,
            LocalDate today) {
        List<Map<String, Object>> payload = new ArrayList<>();
        for (Task task : scopedTasks) {
            if (task.getStatus() == TaskStatus.DONE) {
                continue;
            }

            int score = 0;
            List<String> reasons = new ArrayList<>();
            Long daysToDeadline = null;

            if (task.getDeadline() != null) {
                long dtd = ChronoUnit.DAYS.between(today, task.getDeadline());
                daysToDeadline = dtd;

                if (dtd < 0) {
                    score += 45;
                    reasons.add("Task is overdue.");
                } else if (dtd <= 1) {
                    score += 25;
                    reasons.add("Deadline is within 1 day.");
                } else if (dtd <= 3) {
                    score += 18;
                    reasons.add("Deadline is within 3 days.");
                } else if (dtd <= 7) {
                    score += 10;
                    reasons.add("Deadline is within 7 days.");
                }
            }

            int progressGapScore = computeProgressGapScore(task, today, reasons);
            score += progressGapScore;

            int priorityScore = computePriorityRisk(task.getPriority(), reasons);
            score += priorityScore;

            int openLoadScore = computeAssigneeOpenLoadRisk(task, openLoadByAssignee, reasons);
            score += openLoadScore;

            int timelinePressureScore = computeProjectTimelinePressureRisk(task.getProject(), today, reasons);
            score += timelinePressureScore;

            if (score > 100) {
                score = 100;
            }

            Map<String, Object> item = new HashMap<>();
            item.put("taskId", task.getId());
            item.put("taskTitle", task.getTitle());
            item.put("status", task.getStatus() != null ? task.getStatus().name() : null);
            item.put("completionPercentage", task.getCompletionPercentage());
            item.put("deadline", task.getDeadline() != null ? task.getDeadline().toString() : null);
            item.put("daysToDeadline", daysToDeadline);
            item.put("score", score);
            item.put("reasons", reasons);

            if (task.getAssignee() != null) {
                item.put("assigneeId", task.getAssignee().getId());
                item.put("assigneeName", task.getAssignee().getFullName());
            }

            TaskTimeline timeline = timelineByTask.get(task.getId());
            item.put("createdAt", timeline != null ? timeline.createdAtMillis : null);
            item.put("inProgressAt", timeline != null ? timeline.inProgressAtMillis : null);
            payload.add(item);
        }

        payload.sort((left, right) -> {
            Integer leftScore = (Integer) left.get("score");
            Integer rightScore = (Integer) right.get("score");
            return rightScore.compareTo(leftScore);
        });
        return payload;
    }

    private int computeProgressGapScore(Task task, LocalDate today, List<String> reasons) {
        if (task.getDeadline() == null || task.getProject() == null || task.getProject().getStartDate() == null) {
            return 0;
        }

        LocalDate start = task.getProject().getStartDate();
        LocalDate end = task.getDeadline();
        if (end.isBefore(start)) {
            return 0;
        }

        long totalDays = ChronoUnit.DAYS.between(start, end);
        if (totalDays <= 0) {
            return 0;
        }

        LocalDate boundedToday = today;
        if (today.isBefore(start)) {
            boundedToday = start;
        }
        if (today.isAfter(end)) {
            boundedToday = end;
        }

        long elapsedDays = ChronoUnit.DAYS.between(start, boundedToday);
        double expectedCompletion = ((double) elapsedDays / (double) totalDays) * 100d;
        int completion = Math.max(0, Math.min(100, task.getCompletionPercentage()));
        double gap = expectedCompletion - completion;

        if (gap > 40d) {
            reasons.add("Progress is significantly behind expected timeline.");
            return 18;
        }
        if (gap > 20d) {
            reasons.add("Progress is behind expected timeline.");
            return 12;
        }
        if (gap > 10d) {
            reasons.add("Progress is slightly behind expected timeline.");
            return 6;
        }
        return 0;
    }

    private int computePriorityRisk(Priority priority, List<String> reasons) {
        if (priority == null) {
            return 0;
        }

        if (priority == Priority.CRITICAL) {
            reasons.add("Task priority is CRITICAL.");
            return 10;
        }
        if (priority == Priority.HIGH) {
            reasons.add("Task priority is HIGH.");
            return 7;
        }
        if (priority == Priority.MEDIUM) {
            reasons.add("Task priority is MEDIUM.");
            return 3;
        }
        return 0;
    }

    private int computeAssigneeOpenLoadRisk(Task task, Map<String, Integer> openLoadByAssignee, List<String> reasons) {
        if (task.getAssignee() == null || !StringUtils.hasText(task.getAssignee().getId())) {
            return 0;
        }

        int load = openLoadByAssignee.getOrDefault(task.getAssignee().getId(), 0);
        if (load >= 10) {
            reasons.add("Assignee has very high open workload.");
            return 12;
        }
        if (load >= 6) {
            reasons.add("Assignee has high open workload.");
            return 8;
        }
        if (load >= 3) {
            reasons.add("Assignee has moderate open workload.");
            return 4;
        }
        return 0;
    }

    private int computeProjectTimelinePressureRisk(Project project, LocalDate today, List<String> reasons) {
        if (project == null || project.getDeadline() == null) {
            return 0;
        }

        long daysToProjectDeadline = ChronoUnit.DAYS.between(today, project.getDeadline());
        if (daysToProjectDeadline < 0) {
            reasons.add("Project deadline has already passed.");
            return 12;
        }
        if (daysToProjectDeadline <= 3) {
            reasons.add("Project deadline is within 3 days.");
            return 10;
        }
        if (daysToProjectDeadline <= 7) {
            reasons.add("Project deadline is within 7 days.");
            return 6;
        }
        return 0;
    }

    private boolean isTaskStalled(
            String taskId,
            Map<String, TaskTimeline> timelineByTask,
            Map<String, List<TaskActivity>> activitiesByTask,
            int stalledDays,
            LocalDate today) {
        TaskTimeline timeline = timelineByTask.get(taskId);
        Long lastActivityAt = timeline != null ? timeline.lastActivityAtMillis : null;
        if (lastActivityAt == null) {
            List<TaskActivity> activities = activitiesByTask.getOrDefault(taskId, List.of());
            if (!activities.isEmpty()) {
                TaskActivity last = activities.get(activities.size() - 1);
                lastActivityAt = last.getCreatedAt();
            }
        }

        if (lastActivityAt == null) {
            return false;
        }

        LocalDate lastActivityDate = toDate(lastActivityAt);
        if (lastActivityDate == null) {
            return true;
        }

        return ChronoUnit.DAYS.between(lastActivityDate, today) >= stalledDays;
    }

    private Map<DayOfWeek, Integer> initWeekdayCounter() {
        Map<DayOfWeek, Integer> counter = new EnumMap<>(DayOfWeek.class);
        for (DayOfWeek day : DayOfWeek.values()) {
            counter.put(day, 0);
        }
        return counter;
    }

    private List<Map<String, Object>> toSortedSeries(Map<String, Integer> source) {
        List<Map<String, Object>> series = new ArrayList<>();
        List<Map.Entry<String, Integer>> entries = new ArrayList<>(source.entrySet());
        entries.sort(Map.Entry.comparingByKey());

        for (Map.Entry<String, Integer> entry : entries) {
            Map<String, Object> item = new HashMap<>();
            item.put("bucket", entry.getKey());
            item.put("count", entry.getValue());
            series.add(item);
        }

        return series;
    }

    private Long inferCreatedAtMillis(Task task, List<TaskActivity> activities) {
        if (activities.isEmpty()) {
            return task != null && task.getProject() != null ? task.getProject().getCreatedDate() : null;
        }

        for (TaskActivity activity : activities) {
            if (activity != null && "TASK_CREATED".equals(activity.getType()) && activity.getCreatedAt() != null) {
                return activity.getCreatedAt();
            }
        }

        Long earliest = null;
        for (TaskActivity activity : activities) {
            if (activity == null || activity.getCreatedAt() == null) {
                continue;
            }
            if (earliest == null || activity.getCreatedAt() < earliest) {
                earliest = activity.getCreatedAt();
            }
        }
        return earliest;
    }

    private Long inferDoneAtMillis(Task task, List<TaskActivity> activities) {
        if (task == null || task.getStatus() != TaskStatus.DONE) {
            return null;
        }

        Long latestDone = null;
        for (TaskActivity activity : activities) {
            if (activity == null || activity.getCreatedAt() == null) {
                continue;
            }
            if (!"TASK_STATUS_UPDATED".equals(activity.getType())) {
                continue;
            }

            Object metadataStatus = activity.getMetadata() != null ? activity.getMetadata().get("status") : null;
            if (TaskStatus.DONE.name().equals(String.valueOf(metadataStatus))) {
                latestDone = activity.getCreatedAt();
            }
        }
        return latestDone;
    }

    private Long inferInProgressAtMillis(List<TaskActivity> activities, Long doneAtMillis) {
        Long latestInProgress = null;
        for (TaskActivity activity : activities) {
            if (activity == null || activity.getCreatedAt() == null) {
                continue;
            }
            if (doneAtMillis != null && activity.getCreatedAt() > doneAtMillis) {
                continue;
            }
            if (!"TASK_STATUS_UPDATED".equals(activity.getType())) {
                continue;
            }
            Object metadataStatus = activity.getMetadata() != null ? activity.getMetadata().get("status") : null;
            if (TaskStatus.IN_PROGRESS.name().equals(String.valueOf(metadataStatus))) {
                latestInProgress = activity.getCreatedAt();
            }
        }
        return latestInProgress;
    }

    private Long inferLastActivityAtMillis(List<TaskActivity> activities, Long createdAtFallback) {
        Long latest = null;
        for (TaskActivity activity : activities) {
            if (activity == null || activity.getCreatedAt() == null) {
                continue;
            }
            if (latest == null || activity.getCreatedAt() > latest) {
                latest = activity.getCreatedAt();
            }
        }
        return latest != null ? latest : createdAtFallback;
    }

    private String toWeekKey(LocalDate date) {
        WeekFields weekFields = WeekFields.of(Locale.getDefault());
        int week = date.get(weekFields.weekOfWeekBasedYear());
        int year = date.get(weekFields.weekBasedYear());
        return String.format("%d-W%02d", year, week);
    }

    private LocalDate toDate(Long epochMillis) {
        if (epochMillis == null) {
            return null;
        }
        return java.time.Instant.ofEpochMilli(epochMillis)
                .atZone(ZoneId.systemDefault())
                .toLocalDate();
    }

    private double avg(List<Long> values) {
        if (values.isEmpty()) {
            return 0d;
        }

        long sum = 0L;
        for (Long value : values) {
            sum += value;
        }
        return (double) sum / (double) values.size();
    }

    private double percentile(List<Long> sortedValues, double ratio) {
        if (sortedValues.isEmpty()) {
            return 0d;
        }
        int index = (int) Math.ceil(ratio * sortedValues.size()) - 1;
        if (index < 0) {
            index = 0;
        }
        if (index >= sortedValues.size()) {
            index = sortedValues.size() - 1;
        }
        return sortedValues.get(index);
    }

    private double roundTwo(double value) {
        return Math.round(value * 100d) / 100d;
    }

    private int normalizePositive(Integer input, int fallback) {
        if (input == null || input <= 0) {
            return fallback;
        }
        return input;
    }

    private String resolveDepartmentScope(User actor, String requestedDepartmentId) {
        if (actor.getRole() == ERole.ADMIN) {
            if (StringUtils.hasText(requestedDepartmentId) && !departmentRepository.existsById(requestedDepartmentId)) {
                throw new RuntimeException("Phòng ban không tồn tại!");
            }
            return StringUtils.hasText(requestedDepartmentId) ? requestedDepartmentId : null;
        }

        if (actor.getRole() != ERole.MANAGER) {
            throw new AccessDeniedException("Bạn không có quyền xem analytics giao vận!");
        }

        String managerDepartmentId = actor.getDepartment() != null ? actor.getDepartment().getId() : null;
        if (!StringUtils.hasText(managerDepartmentId)) {
            throw new AccessDeniedException("Trưởng phòng chưa được gán phòng ban!");
        }

        if (managerDepartmentId == null) {
            throw new AccessDeniedException("ID phòng ban không hợp lệ!");
        }
        Department managedDepartment = departmentRepository.findById(managerDepartmentId)
                .orElseThrow(() -> new AccessDeniedException("Phòng ban quản lý không tồn tại!"));

        if (managedDepartment.getManager() == null
                || !StringUtils.hasText(managedDepartment.getManager().getId())
                || !managedDepartment.getManager().getId().equals(actor.getId())) {
            throw new AccessDeniedException("Bạn không phải trưởng phòng quản lý chính thức của phòng ban này!");
        }

        if (StringUtils.hasText(requestedDepartmentId) && !managerDepartmentId.equals(requestedDepartmentId)) {
            throw new AccessDeniedException("Bạn chỉ được xem analytics của phòng ban do bạn quản lý!");
        }

        return managerDepartmentId;
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

    private static class TaskTimeline {
        private Long createdAtMillis;
        private Long inProgressAtMillis;
        private Long doneAtMillis;
        private Long lastActivityAtMillis;
    }
}
