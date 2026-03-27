package com.projectmanagement.core_system.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class AttachmentInfo {
    private String id;
    private String url;
    private String originalName;
    private long size;
    private String uploadedById;
    private String uploadedByName;
    private Long uploadedAt;
}
