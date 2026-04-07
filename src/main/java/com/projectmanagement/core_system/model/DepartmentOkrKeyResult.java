package com.projectmanagement.core_system.model;

public class DepartmentOkrKeyResult {
    private String id;
    private String name;
    private Double targetValue;
    private Double currentValue;
    private String unit;

    public DepartmentOkrKeyResult() {}

    public DepartmentOkrKeyResult(String id, String name, Double targetValue, Double currentValue, String unit) {
        this.id = id;
        this.name = name;
        this.targetValue = targetValue;
        this.currentValue = currentValue;
        this.unit = unit;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public Double getTargetValue() {
        return targetValue;
    }

    public void setTargetValue(Double targetValue) {
        this.targetValue = targetValue;
    }

    public Double getCurrentValue() {
        return currentValue;
    }

    public void setCurrentValue(Double currentValue) {
        this.currentValue = currentValue;
    }

    public String getUnit() {
        return unit;
    }

    public void setUnit(String unit) {
        this.unit = unit;
    }
}
