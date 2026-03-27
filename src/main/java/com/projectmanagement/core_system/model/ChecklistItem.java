package com.projectmanagement.core_system.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ChecklistItem {
    private String id;
    private String title;
    private boolean completed;
    private int position;
    private String createdById;
    private String createdByName;
    private Long createdAt;
    private Long updatedAt;
}
