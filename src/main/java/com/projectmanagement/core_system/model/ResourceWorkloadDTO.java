package com.projectmanagement.core_system.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ResourceWorkloadDTO {
    private String userId;
    private String assigneeName;
    private long openTasks;
    private long overdueOpenTasks;
}
