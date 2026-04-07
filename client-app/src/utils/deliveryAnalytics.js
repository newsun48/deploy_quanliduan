export const DELIVERY_RANGE_OPTIONS = [
    { value: 30, label: '30 ngày' },
    { value: 60, label: '60 ngày' },
    { value: 90, label: '90 ngày' },
    { value: 180, label: '180 ngày' },
];

export const STALLED_DAY_OPTIONS = [3, 5, 7, 14];

export const WEEKDAY_LABELS = {
    MONDAY: 'T2',
    TUESDAY: 'T3',
    WEDNESDAY: 'T4',
    THURSDAY: 'T5',
    FRIDAY: 'T6',
    SATURDAY: 'T7',
    SUNDAY: 'CN',
};

export const formatDurationDays = (value) => {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return '--';
    const normalized = Number(value);
    return `${Math.round(normalized * 10) / 10} ngày`;
};

export const formatRatePercent = (value) => {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return '--';
    return `${Math.round(Number(value) * 100)}%`;
};

export const getRiskTone = (score) => {
    if (score >= 75) return { label: 'Cao', className: 'bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25' };
    if (score >= 45) return { label: 'Trung bình', className: 'bg-warning bg-opacity-10 text-warning border border-warning border-opacity-25' };
    return { label: 'Thấp', className: 'bg-success bg-opacity-10 text-success border border-success border-opacity-25' };
};

export const buildHeatmapRows = (heatmapPayload) => {
    const assignees = Array.isArray(heatmapPayload?.assignees) ? heatmapPayload.assignees : [];
    return assignees.map((assignee) => ({
        assigneeId: assignee.assigneeId,
        assigneeName: assignee.assigneeName || '--',
        cells: Object.entries(WEEKDAY_LABELS).map(([key, label]) => ({
            key,
            label,
            value: Number(assignee.byWeekday?.[key] || 0),
        })),
    }));
};

export const getHeatmapCellStyle = (value) => {
    if (value >= 5) return { background: '#1d6fa3', color: '#fff' };
    if (value >= 3) return { background: '#4f8fbd', color: '#fff' };
    if (value >= 1) return { background: '#dceaf5', color: '#1d3557' };
    return { background: '#f5f7fb', color: '#8aa2bc' };
};
