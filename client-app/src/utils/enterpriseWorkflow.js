const REQUEST_STATUS_META = {
    PENDING: { label: 'Chờ duyệt', className: 'bg-warning bg-opacity-10 text-warning border border-warning border-opacity-25' },
    APPROVED: { label: 'Đã duyệt', className: 'bg-success bg-opacity-10 text-success border border-success border-opacity-25' },
    REJECTED: { label: 'Từ chối', className: 'bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25' },
};

const TEMPLATE_STATUS_META = {
    ARCHIVED: { label: 'Lưu trữ', className: 'bg-dark bg-opacity-10 text-dark border border-dark border-opacity-25' },
    ACTIVE: { label: 'Đang sử dụng', className: 'bg-success bg-opacity-10 text-success border border-success border-opacity-25' },
};

const REVIEW_STATUS_META = {
    ON_TRACK: { label: 'On track', className: 'bg-success bg-opacity-10 text-success border border-success border-opacity-25' },
    AT_RISK: { label: 'Cần chú ý', className: 'bg-warning bg-opacity-10 text-warning border border-warning border-opacity-25' },
    OFF_TRACK: { label: 'Trễ mục tiêu', className: 'bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25' },
    COMPLETED: { label: 'Hoàn tất', className: 'bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25' },
};

export const REQUEST_TYPE_OPTIONS = [
    { value: 'LEAVE_REQUEST', label: 'Nghỉ phép' },
    { value: 'BUDGET_REQUEST', label: 'Ngân sách' },
    { value: 'SCOPE_CHANGE', label: 'Đổi scope' },
    { value: 'PROJECT_CLOSE', label: 'Đóng dự án' },
];

export const REQUEST_PRIORITY_OPTIONS = [
    { value: 'LOW', label: 'Thấp' },
    { value: 'MEDIUM', label: 'Trung bình' },
    { value: 'HIGH', label: 'Cao' },
    { value: 'CRITICAL', label: 'Khẩn cấp' },
];

export const TEMPLATE_PRIORITY_OPTIONS = [
    { value: 'LOW', label: 'Low' },
    { value: 'MEDIUM', label: 'Medium' },
    { value: 'HIGH', label: 'High' },
];

export const extractItems = (payload) => {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.items)) return payload.items;
    if (Array.isArray(payload?.content)) return payload.content;
    if (Array.isArray(payload?.data)) return payload.data;
    return [];
};

export const formatWorkflowDate = (value) => {
    if (!value) return '--';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '--';
    return date.toLocaleDateString('vi-VN');
};

export const formatWorkflowDateTime = (value) => {
    if (!value) return '--';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '--';
    return date.toLocaleString('vi-VN');
};

export const getCurrentQuarterKey = (referenceDate = new Date()) => {
    const year = referenceDate.getFullYear();
    const quarter = Math.floor(referenceDate.getMonth() / 3) + 1;
    return `${year}-Q${quarter}`;
};

export const formatQuarterLabel = (value) => {
    if (!value) return '--';
    const [year, quarter] = String(value).split('-');
    return quarter ? `${quarter} / ${year}` : value;
};

export const getQuarterOptions = (count = 6, referenceDate = new Date()) => {
    const options = [];
    const currentQuarter = Math.floor(referenceDate.getMonth() / 3);
    const base = new Date(referenceDate.getFullYear(), currentQuarter * 3, 1);

    for (let index = 0; index < count; index += 1) {
        const optionDate = new Date(base.getFullYear(), base.getMonth() - index * 3, 1);
        const year = optionDate.getFullYear();
        const quarter = Math.floor(optionDate.getMonth() / 3) + 1;
        const value = `${year}-Q${quarter}`;
        options.push({ value, label: formatQuarterLabel(value) });
    }

    return options;
};

export const formatDepartmentName = (name) => {
    if (!name) return '--';
    return String(name).replace(/^phong\s+/i, 'Phòng ').replace(/^ban\s+/i, 'Phòng ');
};

export const getPriorityMeta = (value) => {
    const normalized = String(value || 'MEDIUM').toUpperCase();

    if (normalized === 'CRITICAL') {
        return { label: 'Khẩn cấp', className: 'bg-danger text-white' };
    }
    if (normalized === 'HIGH') {
        return { label: 'Cao', className: 'bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25' };
    }
    if (normalized === 'LOW') {
        return { label: 'Thấp', className: 'bg-info bg-opacity-10 text-info border border-info border-opacity-25' };
    }
    return { label: 'Trung bình', className: 'bg-warning bg-opacity-10 text-warning border border-warning border-opacity-25' };
};

export const getRequestStatusMeta = (status) => {
    const normalized = String(status || 'PENDING').toUpperCase();
    return REQUEST_STATUS_META[normalized] || REQUEST_STATUS_META.PENDING;
};

export const getTemplateStatusMeta = (status) => {
    const normalized = String(status || 'ACTIVE').toUpperCase();
    return TEMPLATE_STATUS_META[normalized] || TEMPLATE_STATUS_META.ACTIVE;
};

export const getReviewStatusMeta = (status) => {
    const normalized = String(status || 'ON_TRACK').toUpperCase();
    return REVIEW_STATUS_META[normalized] || REVIEW_STATUS_META.ON_TRACK;
};

export const normalizeRequestItem = (request = {}) => ({
    id: request.id || request.requestId || request._id,
    title: request.title || request.subject || request.name || 'Yêu cầu công việc',
    type: request.type || request.category || request.requestType || 'LEAVE_REQUEST',
    priority: request.priority || 'MEDIUM',
    status: request.status || 'PENDING',
    summary: request.reason || request.summary || request.description || '',
    details: request.reason || request.details || '',
    createdAt: request.createdAt || request.submittedAt || request.requestedAt,
    targetDate: request.targetDate || request.neededByDate || request.deadline || null,
    requesterName: request.requesterName || request.requester?.fullName || request.createdByName || '--',
    requesterEmail: request.requesterEmail || request.requester?.email || request.createdByEmail || '--',
    departmentName: request.departmentName || request.department?.name || request.requesterDepartmentName || request.requesterDepartmentId || '--',
    approverName: request.approverName
        || request.currentApprover?.fullName
        || request.approvalSteps?.[request.activeStepIndex]?.approverName
        || request.decisionHistory?.[request.decisionHistory.length - 1]?.approverName
        || '--',
    escalationLevel: request.escalationLevel || request.stage || request.level || null,
    latestNote: request.latestNote
        || request.decisionHistory?.[request.decisionHistory.length - 1]?.comment
        || request.reason
        || '',
    updatedAt: request.updatedAt || request.modifiedAt || request.createdAt,
    resolvedAt: request.resolvedAt || null,
    projectId: request.projectId || null,
});

export const normalizeTemplateItem = (template = {}) => ({
    id: template.id || template.templateId || template._id,
    name: template.name || template.title || 'Project template',
    summary: template.description || template.summary || '',
    status: template.archived ? 'ARCHIVED' : 'ACTIVE',
    priority: template.taskTemplates?.[0]?.priority || template.priority || 'MEDIUM',
    estimatedDurationWeeks: template.estimatedDurationWeeks || template.durationWeeks || template.defaultDurationWeeks || 0,
    checklist: (template.taskTemplates || []).flatMap((taskTemplate) => extractItems(taskTemplate.checklistTemplates || [])),
    objectives: extractItems(template.taskTemplates || []),
    updatedAt: template.updatedAt || template.modifiedAt || template.createdAt,
    ownerName: template.ownerName || template.createdByName || template.owner?.fullName || '--',
    templateGroupType: template.templateGroupType || 'OTHER',
    taskTemplates: extractItems(template.taskTemplates || []),
});
