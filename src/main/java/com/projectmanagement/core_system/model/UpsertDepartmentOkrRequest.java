package com.projectmanagement.core_system.model;

import java.util.ArrayList;
import java.util.List;

public class UpsertDepartmentOkrRequest {
    private String departmentId;
    private Integer year;
    private Integer quarter;
    private String objective;
    private List<DepartmentOkrKeyResult> keyResults = new ArrayList<>();

    public String getDepartmentId() {
        return departmentId;
    }

    public void setDepartmentId(String departmentId) {
        this.departmentId = departmentId;
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
}
