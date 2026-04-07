package com.projectmanagement.core_system.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.DBRef;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.ArrayList;
import java.util.List;

@Document(collection = "department_quarterly_okrs")
public class DepartmentQuarterlyOkr {
    @Id
    private String id;

    @DBRef
    private Department department;

    private Integer year;
    private Integer quarter;
    private String objective;
    private List<DepartmentOkrKeyResult> keyResults = new ArrayList<>();
    private String reviewSummary;
    private Long createdAt = System.currentTimeMillis();
    private Long updatedAt = System.currentTimeMillis();

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public Department getDepartment() {
        return department;
    }

    public void setDepartment(Department department) {
        this.department = department;
    }

    public Integer getYear() {
        return year;
    }

    public void setYear(Integer year) {
        this.year = year;
    }

    public Integer getQuarter() {
        return quarter;
    }

    public void setQuarter(Integer quarter) {
        this.quarter = quarter;
    }

    public String getObjective() {
        return objective;
    }

    public void setObjective(String objective) {
        this.objective = objective;
    }

    public List<DepartmentOkrKeyResult> getKeyResults() {
        return keyResults;
    }

    public void setKeyResults(List<DepartmentOkrKeyResult> keyResults) {
        this.keyResults = keyResults;
    }

    public String getReviewSummary() {
        return reviewSummary;
    }

    public void setReviewSummary(String reviewSummary) {
        this.reviewSummary = reviewSummary;
    }

    public Long getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Long createdAt) {
        this.createdAt = createdAt;
    }

    public Long getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Long updatedAt) {
        this.updatedAt = updatedAt;
    }
}
