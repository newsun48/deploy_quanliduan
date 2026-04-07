import { useEffect, useMemo, useState } from 'react';
import {
    PieChart,
    Pie,
    Cell,
    BarChart,
    Bar,
    LineChart,
    Line,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from 'recharts';
import api, { analyticsAPI, departmentInsightsAPI } from '../api';
import { useNavigate } from 'react-router-dom';
import NotificationBell from '../components/NotificationBell';
import ProjectGantt from '../components/ProjectGantt';
import HeatmapGrid from '../components/HeatmapGrid';
import '../components/EnterpriseWorkflow.css';
import './AdminDashboard.css';
import {
    extractItems,
    formatDepartmentName,
    formatQuarterLabel,
    formatWorkflowDate,
    getCurrentQuarterKey,
    getQuarterOptions,
    getReviewStatusMeta,
} from '../utils/enterpriseWorkflow';
import {
    buildHeatmapRows,
    DELIVERY_RANGE_OPTIONS,
    formatDurationDays,
    formatRatePercent,
    getHeatmapCellStyle,
    getRiskTone,
    STALLED_DAY_OPTIONS,
} from '../utils/deliveryAnalytics';

const COLORS_STATUS = ['#94a3b8', '#1d6fa3', '#2b8a5d'];
const COLORS_PRIORITY = ['#d05f45', '#d79a31', '#2b8a5d'];

const createEmptyOkrKeyResult = () => ({
    name: '',
    targetValue: '',
    currentValue: '',
    unit: '',
});

const createOkrModalState = (departmentId = '') => ({
    departmentId,
    objective: '',
    keyResults: [createEmptyOkrKeyResult()],
    errors: {},
    submitError: '',
    submitting: false,
});

const createKeyResultModalState = () => ({
    objectiveId: '',
    keyResultId: '',
    objectiveTitle: '',
    keyResultName: '',
    departmentName: '',
    currentValue: '',
    targetValue: '',
    unit: '',
    errors: {},
    submitError: '',
    submitting: false,
});

const createReviewModalState = () => ({
    reviewId: '',
    reviewTitle: '',
    departmentName: '',
    summary: '',
    errors: {},
    submitError: '',
    submitting: false,
});

const parseStoredUser = () => {
    try {
        return JSON.parse(localStorage.getItem('user') || 'null');
    } catch {
        return null;
    }
};

const parseQuarterKey = (value) => {
    const match = /^([0-9]{4})-Q([1-4])$/.exec(String(value || ''));
    if (!match) return { year: null, quarter: null };
    return { year: Number(match[1]), quarter: Number(match[2]) };
};

const toDisplayValue = (value, suffix = '') => {
    if (value === null || value === undefined || value === '') return '--';
    if (typeof value === 'number') {
        if (suffix === '%') return `${Math.round(value)}%`;
        return value.toLocaleString('vi-VN');
    }
    return `${value}${suffix}`;
};

const toPercent = (value) => {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return 0;
    const normalized = Number(value);
    if (normalized <= 1) return Math.round(normalized * 100);
    return Math.max(0, Math.min(100, Math.round(normalized)));
};

const aggregateKpis = (items) => {
    const list = Array.isArray(items) ? items : [];
    return list.reduce((acc, item) => ({
        totalUsers: acc.totalUsers + Number(item.totalUsers || 0),
        activeUsers: acc.activeUsers + Number(item.activeUsers || 0),
        totalProjects: acc.totalProjects + Number(item.totalProjects || 0),
        openProjects: acc.openProjects + Number(item.openProjects || 0),
        closedProjects: acc.closedProjects + Number(item.closedProjects || 0),
        totalTasks: acc.totalTasks + Number(item.totalTasks || 0),
        doneTasks: acc.doneTasks + Number(item.doneTasks || 0),
        overdueTasks: acc.overdueTasks + Number(item.overdueTasks || 0),
        averageTaskProgressSum: acc.averageTaskProgressSum + Number(item.averageTaskProgress || 0),
        completionRateSum: acc.completionRateSum + Number(item.completionRate || 0),
        departments: acc.departments + 1,
    }), {
        totalUsers: 0,
        activeUsers: 0,
        totalProjects: 0,
        openProjects: 0,
        closedProjects: 0,
        totalTasks: 0,
        doneTasks: 0,
        overdueTasks: 0,
        averageTaskProgressSum: 0,
        completionRateSum: 0,
        departments: 0,
    });
};

const normalizeKpiCards = (kpiItems, scopeLabel) => {
    const summary = aggregateKpis(kpiItems);
    const avgCompletion = summary.departments ? summary.completionRateSum / summary.departments : 0;
    const avgProgress = summary.departments ? summary.averageTaskProgressSum / summary.departments : 0;

    return [
        {
            label: `Tổng nhân sự ${scopeLabel}`,
            value: toDisplayValue(summary.totalUsers),
            note: `${toDisplayValue(summary.activeUsers)} tài khoản đang hoạt động.`,
        },
        {
            label: 'Dự án đang mở',
            value: toDisplayValue(summary.openProjects),
            note: `${toDisplayValue(summary.closedProjects)} dự án đã đóng.`,
        },
        {
            label: 'Tiến độ task trung bình',
            value: toDisplayValue(avgProgress, '%'),
            note: `${toDisplayValue(summary.doneTasks)} / ${toDisplayValue(summary.totalTasks)} task đã hoàn tất.`,
        },
        {
            label: 'Task quá hạn',
            value: toDisplayValue(summary.overdueTasks),
            note: `Tỷ lệ hoàn thành trung bình ${toDisplayValue(avgCompletion, '%')}.`,
        },
    ];
};

const normalizeObjectives = (payload) => {
    const objectiveSource = extractItems(payload);
    return objectiveSource.map((item, index) => {
        const keyResults = extractItems(item.keyResults || []);
        const averageProgress = keyResults.length
            ? keyResults.reduce((sum, keyResult) => {
                const target = Number(keyResult.targetValue || 0);
                const current = Number(keyResult.currentValue || 0);
                if (!target) return sum;
                return sum + Math.min(100, Math.round((current / target) * 100));
            }, 0) / keyResults.length
            : 0;

        return {
            id: item.id || item.objectiveId || item._id || `objective-${index}`,
            title: item.title || item.name || item.objective || 'Mục tiêu KPI/OKR',
            owner: item.department?.name || item.departmentName || '--',
            description: item.reviewSummary || '',
            progress: toPercent(averageProgress),
            keyResults,
            departmentId: item.department?.id || item.departmentId || '',
            year: item.year,
            quarter: item.quarter,
        };
    });
};

const normalizeQuarterlyReviews = (payload) => {
    return extractItems(payload).map((item, index) => ({
        id: item.id || item.reviewId || item._id || `review-${index}`,
        title: item.department?.name || item.departmentName || item.name || 'Báo cáo quý',
        departmentName: item.department?.name || item.departmentName || item.name || 'Báo cáo quý',
        status: item.reviewSummary ? 'COMPLETED' : 'AT_RISK',
        score: extractItems(item.keyResults || []).length,
        summary: item.reviewSummary || '',
        actionItems: extractItems(item.keyResults || []).map((keyResult) => `${keyResult.name}: ${toDisplayValue(keyResult.currentValue)} / ${toDisplayValue(keyResult.targetValue)} ${keyResult.unit || ''}`.trim()),
        reviewDate: item.updatedAt || item.createdAt,
        departmentId: item.department?.id || item.departmentId || '',
        year: item.year,
        quarter: item.quarter,
    }));
};

const StatisticsPage = () => {
    const navigate = useNavigate();
    const currentUser = useMemo(() => parseStoredUser(), []);
    const isAdmin = currentUser?.role === 'ADMIN';
    const roleBasePath = isAdmin ? '/admin' : '/manager';
    const roleLabel = isAdmin ? 'Quản trị viên' : `Trưởng ${formatDepartmentName(currentUser?.department?.name || 'Phòng')}`;
    const brandLabel = isAdmin ? 'ADMIN PRO' : 'MANAGER PRO';

    const [stats, setStats] = useState(null);
    const [statsLoading, setStatsLoading] = useState(isAdmin);
    const [statsError, setStatsError] = useState('');
    const [departments, setDepartments] = useState([]);
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const [insightsLoading, setInsightsLoading] = useState(true);
    const [insightsError, setInsightsError] = useState('');
    const [deliveryLoading, setDeliveryLoading] = useState(true);
    const [deliveryError, setDeliveryError] = useState('');
    const [deliveryAnalytics, setDeliveryAnalytics] = useState(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [resourceWorkload, setResourceWorkload] = useState([]);
    const [resourceWorkloadLoading, setResourceWorkloadLoading] = useState(true);
    const [kpiCards, setKpiCards] = useState([]);
    const [okrObjectives, setOkrObjectives] = useState([]);
    const [quarterlyReviews, setQuarterlyReviews] = useState([]);
    const [scopedTasks, setScopedTasks] = useState([]);
    const [scopedTasksLoading, setScopedTasksLoading] = useState(false);
    const [filters, setFilters] = useState(() => ({
        quarter: getCurrentQuarterKey(),
        departmentId: isAdmin ? 'ALL' : (currentUser?.department?.id || ''),
    }));
    const [deliveryFilters, setDeliveryFilters] = useState({
        rangeDays: 90,
        stalledDays: 7,
    });
    const [timelineRefreshKey, setTimelineRefreshKey] = useState(0);
    const [insightsRefreshKey, setInsightsRefreshKey] = useState(0);
    const [activeModal, setActiveModal] = useState(null);
    const [okrModal, setOkrModal] = useState(() => createOkrModalState());
    const [keyResultModal, setKeyResultModal] = useState(() => createKeyResultModalState());
    const [reviewModal, setReviewModal] = useState(() => createReviewModalState());

    useEffect(() => {
        if (!currentUser) {
            navigate('/');
            return;
        }

        const loadStatistics = async () => {
            if (!isAdmin) {
                setStatsLoading(false);
                return;
            }

            try {
                setStatsLoading(true);
                setStatsError('');
                const res = await api.get('/tasks/statistics');
                setStats(res.data);
            } catch (err) {
                console.error('Lỗi tải thống kê tổng quan:', err);
                setStatsError(typeof err.response?.data === 'string' ? err.response.data : (err.response?.data?.message || err.message));
            } finally {
                setStatsLoading(false);
            }
        };

        const loadDepartments = async () => {
            if (!isAdmin) return;

            try {
                const res = await api.get('/departments');
                setDepartments(res.data || []);
            } catch (err) {
                console.error('Lỗi tải danh sách phòng ban:', err);
            }
        };

        loadStatistics();
        loadDepartments();
    }, [currentUser, isAdmin, navigate]);

    useEffect(() => {
        if (!currentUser) return;

        const loadDeliveryAnalytics = async () => {
            try {
                setDeliveryLoading(true);
                setDeliveryError('');

                const params = {
                    rangeDays: deliveryFilters.rangeDays,
                    stalledDays: deliveryFilters.stalledDays,
                };

                if (filters.departmentId && filters.departmentId !== 'ALL') {
                    params.departmentId = filters.departmentId;
                }

                const response = await analyticsAPI.getDelivery(params);
                setDeliveryAnalytics(response.data);
            } catch (err) {
                console.error('Lỗi tải delivery analytics:', err);
                setDeliveryError(typeof err.response?.data === 'string' ? err.response.data : (err.response?.data?.message || err.message));
            } finally {
                setDeliveryLoading(false);
            }
        };

        loadDeliveryAnalytics();
    }, [currentUser, deliveryFilters.rangeDays, deliveryFilters.stalledDays, filters.departmentId, timelineRefreshKey]);

    useEffect(() => {
        if (!currentUser) return;
        
        const fetchWorkload = async () => {
            try {
                setResourceWorkloadLoading(true);
                const res = await api.get('/tasks/stats/workload');
                setResourceWorkload(res.data || []);
            } catch (err) {
                console.error("Lỗi tải bản đồ nhiệt:", err);
            } finally {
                setResourceWorkloadLoading(false);
            }
        };
        fetchWorkload();
    }, [currentUser, filters.departmentId]); // Reload when dept changes

    useEffect(() => {
        if (!currentUser) return;

        const loadScopedTasks = async () => {
            try {
                setScopedTasksLoading(true);
                const deptId = (filters.departmentId && filters.departmentId !== 'ALL') ? filters.departmentId : 'all';
                // Note: I added a 'getTasksByDepartment' endpoint to the backend earlier
                const res = await api.get(`/tasks/department/${deptId}`);
                setScopedTasks(res.data || []);
            } catch (err) {
                console.error('Lỗi tải tasks cho Gantt:', err);
                setScopedTasks([]);
            } finally {
                setScopedTasksLoading(false);
            }
        };

        loadScopedTasks();
    }, [currentUser, filters.departmentId, timelineRefreshKey]);

    useEffect(() => {
        if (!currentUser) return;

        const loadInsights = async () => {
            try {
                setInsightsLoading(true);
                setInsightsError('');
                const params = {
                    quarter: filters.quarter,
                    scope: isAdmin && filters.departmentId === 'ALL' ? 'ORGANIZATION' : 'DEPARTMENT',
                };

                if (filters.departmentId && filters.departmentId !== 'ALL') {
                    params.departmentId = filters.departmentId;
                } else if (!isAdmin && currentUser.department?.id) {
                    params.departmentId = currentUser.department.id;
                }

                const [kpiRes, okrRes, reviewRes] = await Promise.all([
                    departmentInsightsAPI.getKpis(),
                    (async () => {
                        const { year, quarter } = parseQuarterKey(filters.quarter);
                        const targetDepartmentIds = isAdmin
                            ? (filters.departmentId === 'ALL'
                                ? departments.map((department) => department.id)
                                : [filters.departmentId])
                            : [currentUser.department?.id].filter(Boolean);

                        const responses = await Promise.all(targetDepartmentIds.map((departmentId) => departmentInsightsAPI.getOkrs(departmentId, { year, quarter })));
                        return responses.flatMap((response) => response.data || []);
                    })(),
                    (async () => {
                        const { year, quarter } = parseQuarterKey(filters.quarter);
                        const targetDepartmentIds = isAdmin
                            ? (filters.departmentId === 'ALL'
                                ? departments.map((department) => department.id)
                                : [filters.departmentId])
                            : [currentUser.department?.id].filter(Boolean);

                        const responses = await Promise.all(targetDepartmentIds.map((departmentId) => departmentInsightsAPI.getOkrs(departmentId, { year, quarter })));
                        return responses.flatMap((response) => response.data || []);
                    })(),
                ]);

                const filteredKpis = (kpiRes.data || []).filter((item) => !params.departmentId || item.departmentId === params.departmentId);
                const scopeLabel = params.scope === 'ORGANIZATION' ? 'toàn công ty' : 'phòng ban';
                setKpiCards(normalizeKpiCards(filteredKpis, scopeLabel));
                setOkrObjectives(normalizeObjectives(okrRes));
                setQuarterlyReviews(normalizeQuarterlyReviews(reviewRes));
            } catch (err) {
                console.error('Lỗi tải KPI / OKR / review:', err);
                setInsightsError(typeof err.response?.data === 'string' ? err.response.data : (err.response?.data?.message || err.message));
            } finally {
                setInsightsLoading(false);
            }
        };

        if (isAdmin && filters.departmentId === 'ALL' && departments.length === 0) {
            return;
        }

        loadInsights();
    }, [currentUser, departments, filters.departmentId, filters.quarter, insightsRefreshKey, isAdmin]);

    const handleLogout = () => {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        navigate('/');
    };

    const canManagePerformance = isAdmin || currentUser?.role === 'MANAGER';
    const selectedDepartmentName = isAdmin
        ? (filters.departmentId === 'ALL'
            ? 'Toàn công ty'
            : formatDepartmentName(departments.find((department) => department.id === filters.departmentId)?.name || '--'))
        : formatDepartmentName(currentUser?.department?.name || '--');
    const modalDepartmentName = okrModal.departmentId
        ? formatDepartmentName(departments.find((department) => department.id === okrModal.departmentId)?.name || '')
        : '';
    const isModalSubmitting = activeModal === 'okr'
        ? okrModal.submitting
        : activeModal === 'keyResult'
            ? keyResultModal.submitting
            : activeModal === 'review'
                ? reviewModal.submitting
                : false;

    useEffect(() => {
        if (!activeModal) return undefined;

        const previousOverflow = document.body.style.overflow;
        const handleKeyDown = (event) => {
            if (event.key === 'Escape' && !isModalSubmitting) {
                setActiveModal(null);
            }
        };

        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [activeModal, isModalSubmitting]);

    const triggerInsightsRefresh = () => {
        setInsightsError('');
        setInsightsLoading(true);
        setInsightsRefreshKey((prev) => prev + 1);
    };

    const closeActiveModal = () => {
        if (isModalSubmitting) return;
        setActiveModal(null);
    };

    const handleGenerateInsights = async () => {
        const departmentId = isAdmin
            ? (filters.departmentId === 'ALL' ? (departments[0]?.id || '') : filters.departmentId)
            : currentUser?.department?.id;

        if (!departmentId || departmentId === 'all') {
            alert('Vui lòng chọn một phòng ban cụ thể để phân tích Insights!');
            return;
        }

        const { year, quarter } = parseQuarterKey(filters.quarter);

        try {
            setIsGenerating(true);
            await departmentInsightsAPI.generateInsights({
                departmentId,
                year,
                quarter
            });
            alert('Đã phân tích và cập nhật Insights thành công!');
            triggerInsightsRefresh();
        } catch (err) {
            console.error('Lỗi khi tạo insights:', err);
            const message = typeof err.response?.data === 'string' ? err.response.data : (err.response?.data?.message || err.message);
            alert(`Lỗi: ${message}`);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleUpsertOkr = () => {
        const departmentId = isAdmin
            ? (filters.departmentId === 'ALL' ? '' : filters.departmentId)
            : (currentUser?.department?.id || '');

        setOkrModal(createOkrModalState(departmentId));
        setActiveModal('okr');
    };

    const handleUpdateKeyResult = (objective, keyResult) => {
        setKeyResultModal({
            objectiveId: objective.id,
            keyResultId: keyResult.id,
            objectiveTitle: objective.title,
            keyResultName: keyResult.title || keyResult.name || 'Kết quả then chốt',
            departmentName: objective.owner,
            currentValue: String(keyResult.currentValue ?? 0),
            targetValue: String(keyResult.targetValue ?? 0),
            unit: keyResult.unit || '',
            errors: {},
            submitError: '',
            submitting: false,
        });
        setActiveModal('keyResult');
    };

    const handleUpdateReviewSummary = (review) => {
        setReviewModal({
            reviewId: review.id,
            reviewTitle: review.title,
            departmentName: formatDepartmentName(review.departmentName || review.title || ''),
            summary: review.summary || '',
            errors: {},
            submitError: '',
            submitting: false,
        });
        setActiveModal('review');
    };

    const handleOkrFieldChange = (field, value) => {
        setOkrModal((prev) => ({
            ...prev,
            [field]: value,
            submitError: '',
            errors: {
                ...prev.errors,
                [field]: '',
            },
        }));
    };

    const handleOkrKeyResultChange = (index, field, value) => {
        setOkrModal((prev) => {
            const nextKeyResults = prev.keyResults.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item);
            const nextKeyResultErrors = Array.isArray(prev.errors.keyResults)
                ? prev.errors.keyResults.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: '' } : item)
                : prev.errors.keyResults;

            return {
                ...prev,
                keyResults: nextKeyResults,
                submitError: '',
                errors: {
                    ...prev.errors,
                    keyResults: nextKeyResultErrors,
                },
            };
        });
    };

    const handleAddOkrKeyResult = () => {
        setOkrModal((prev) => ({
            ...prev,
            keyResults: [...prev.keyResults, createEmptyOkrKeyResult()],
            submitError: '',
        }));
    };

    const handleRemoveOkrKeyResult = (index) => {
        setOkrModal((prev) => {
            if (prev.keyResults.length === 1) return prev;

            const nextKeyResults = prev.keyResults.filter((_, itemIndex) => itemIndex !== index);
            const nextKeyResultErrors = Array.isArray(prev.errors.keyResults)
                ? prev.errors.keyResults.filter((_, itemIndex) => itemIndex !== index)
                : prev.errors.keyResults;

            return {
                ...prev,
                keyResults: nextKeyResults,
                submitError: '',
                errors: {
                    ...prev.errors,
                    keyResults: nextKeyResultErrors,
                },
            };
        });
    };

    const submitOkrModal = async (event) => {
        event.preventDefault();

        const errors = {};
        const normalizedObjective = okrModal.objective.trim();
        const keyResultErrors = okrModal.keyResults.map((item) => {
            const itemErrors = {};

            if (!item.name.trim()) itemErrors.name = 'Vui lòng nhập tên ket qua then chot.';
            if (item.targetValue === '' || Number.isNaN(Number(item.targetValue))) {
                itemErrors.targetValue = 'Vui lòng nhập mục tiêu hợp lệ.';
            } else if (Number(item.targetValue) < 0) {
                itemErrors.targetValue = 'Mục tiêu không được nhỏ hơn 0.';
            }

            if (item.currentValue !== '' && Number.isNaN(Number(item.currentValue))) {
                itemErrors.currentValue = 'Giá trị hiện tại không hợp lệ.';
            } else if (item.currentValue !== '' && Number(item.currentValue) < 0) {
                itemErrors.currentValue = 'Giá trị hiện tại không được nhỏ hơn 0.';
            }

            return itemErrors;
        });

        if (isAdmin && filters.departmentId === 'ALL' && !okrModal.departmentId) {
            errors.departmentId = 'Vui lòng chọn phòng ban cần cập nhật.';
        }
        if (!normalizedObjective) {
            errors.objective = 'Vui lòng nhập mục tiêu chính.';
        }
        if (!okrModal.keyResults.length) {
            errors.keyResults = 'Can it nhat mot ket qua then chot.';
        } else if (keyResultErrors.some((item) => Object.keys(item).length > 0)) {
            errors.keyResults = keyResultErrors;
        }

        if (Object.keys(errors).length > 0) {
            setOkrModal((prev) => ({
                ...prev,
                errors,
                submitError: '',
            }));
            return;
        }

        const { year, quarter } = parseQuarterKey(filters.quarter);
        const payload = {
            departmentId: okrModal.departmentId || currentUser?.department?.id || '',
            year,
            quarter,
            objective: normalizedObjective,
            keyResults: okrModal.keyResults.map((item) => ({
                name: item.name.trim(),
                targetValue: Number(item.targetValue || 0),
                currentValue: Number(item.currentValue || 0),
                unit: item.unit.trim(),
            })),
        };

        try {
            setOkrModal((prev) => ({
                ...prev,
                submitting: true,
                submitError: '',
            }));
            await departmentInsightsAPI.upsertOkr(payload);
            setActiveModal(null);
            setOkrModal(createOkrModalState(payload.departmentId));
            triggerInsightsRefresh();
        } catch (err) {
            const message = typeof err.response?.data === 'string' ? err.response.data : (err.response?.data?.message || err.message);
            setOkrModal((prev) => ({
                ...prev,
                submitting: false,
                submitError: message,
            }));
            setInsightsLoading(false);
        }
    };

    const handleKeyResultValueChange = (value) => {
        setKeyResultModal((prev) => ({
            ...prev,
            currentValue: value,
            submitError: '',
            errors: {
                ...prev.errors,
                currentValue: '',
            },
        }));
    };

    const submitKeyResultModal = async (event) => {
        event.preventDefault();

        if (keyResultModal.currentValue === '' || Number.isNaN(Number(keyResultModal.currentValue))) {
            setKeyResultModal((prev) => ({
                ...prev,
                errors: {
                    ...prev.errors,
                    currentValue: 'Vui lòng nhập giá trị hiện tại hợp lệ.',
                },
            }));
            return;
        }

        try {
            setKeyResultModal((prev) => ({
                ...prev,
                submitting: true,
                submitError: '',
            }));
            await departmentInsightsAPI.updateKeyResult(keyResultModal.objectiveId, keyResultModal.keyResultId, {
                currentValue: Number(keyResultModal.currentValue),
            });
            setActiveModal(null);
            setKeyResultModal(createKeyResultModalState());
            triggerInsightsRefresh();
        } catch (err) {
            const message = typeof err.response?.data === 'string' ? err.response.data : (err.response?.data?.message || err.message);
            setKeyResultModal((prev) => ({
                ...prev,
                submitting: false,
                submitError: message,
            }));
            setInsightsLoading(false);
        }
    };

    const handleReviewSummaryChange = (value) => {
        setReviewModal((prev) => ({
            ...prev,
            summary: value,
            submitError: '',
            errors: {
                ...prev.errors,
                summary: '',
            },
        }));
    };

    const submitReviewSummaryModal = async (event) => {
        event.preventDefault();

        if (!reviewModal.summary.trim()) {
            setReviewModal((prev) => ({
                ...prev,
                errors: {
                    ...prev.errors,
                    summary: 'Vui lòng nhập nội dung tổng kết quý.',
                },
            }));
            return;
        }

        try {
            setReviewModal((prev) => ({
                ...prev,
                submitting: true,
                submitError: '',
            }));
            await departmentInsightsAPI.updateReviewSummary(reviewModal.reviewId, {
                reviewSummary: reviewModal.summary.trim(),
            });
            setActiveModal(null);
            setReviewModal(createReviewModalState());
            triggerInsightsRefresh();
        } catch (err) {
            const message = typeof err.response?.data === 'string' ? err.response.data : (err.response?.data?.message || err.message);
            setReviewModal((prev) => ({
                ...prev,
                submitting: false,
                submitError: message,
            }));
            setInsightsLoading(false);
        }
    };

    const statusData = useMemo(() => {
        if (!stats) return [];

        return [
            { name: 'Cần làm', value: stats.byStatus?.TO_DO || 0, color: COLORS_STATUS[0] },
            { name: 'Đang thực hiện', value: stats.byStatus?.IN_PROGRESS || 0, color: COLORS_STATUS[1] },
            { name: 'Hoàn thành', value: stats.byStatus?.DONE || 0, color: COLORS_STATUS[2] },
        ];
    }, [stats]);

    const projectStatusData = useMemo(() => {
        if (!stats) return [];

        return [
            { name: 'Đang mở', value: stats.projectStatus?.OPEN || 0, color: '#1d6fa3' },
            { name: 'Đã đóng', value: stats.projectStatus?.CLOSED || 0, color: '#2b8a5d' },
            { name: 'Bản nháp', value: stats.projectStatus?.DRAFT || 0, color: '#d79a31' },
        ];
    }, [stats]);

    const priorityData = useMemo(() => {
        if (!stats) return [];

        return [
            { name: 'Cao', value: stats.byPriority?.HIGH || 0, color: COLORS_PRIORITY[0] },
            { name: 'Trung bình', value: stats.byPriority?.MEDIUM || 0, color: COLORS_PRIORITY[1] },
            { name: 'Thấp', value: stats.byPriority?.LOW || 0, color: COLORS_PRIORITY[2] },
        ];
    }, [stats]);

    const projectData = useMemo(() => {
        if (!stats) return [];

        return Object.entries(stats.byProject || {}).map(([name, value]) => ({
            name: name.length > 15 ? `${name.substring(0, 15)}...` : name,
            fullName: name,
            value,
        })).sort((a, b) => b.value - a.value);
    }, [stats]);

    const userDeptData = useMemo(() => {
        if (!stats) return [];

        return Object.entries(stats.userDept || {}).map(([name, value]) => ({
            name: name.length > 15 ? `${name.substring(0, 15)}...` : name,
            fullName: name,
            value,
        })).sort((a, b) => b.value - a.value);
    }, [stats]);

    const assigneeData = useMemo(() => {
        if (!stats) return [];

        return Object.entries(stats.byAssignee || {}).map(([name, value]) => ({
            name: name.length > 20 ? `${name.substring(0, 20)}...` : name,
            fullName: name,
            value,
        })).sort((a, b) => b.value - a.value);
    }, [stats]);

    const deliverySummaryCards = useMemo(() => {
        if (!deliveryAnalytics) return [];

        const riskList = Array.isArray(deliveryAnalytics.deadlineRisk) ? deliveryAnalytics.deadlineRisk : [];
        const highRiskCount = riskList.filter((item) => Number(item.score || 0) >= 75).length;
        const bottleneck = deliveryAnalytics.bottleneck || {};

        return [
            {
                label: 'Thành công (Lead time TB)',
                value: formatDurationDays(deliveryAnalytics.leadTime?.averageDays),
                note: `${deliveryAnalytics.leadTime?.count || 0} task có dữ liệu hợp lệ.`,
            },
            {
                label: 'Cycle time TB',
                value: formatDurationDays(deliveryAnalytics.cycleTime?.averageDays),
                note: `P85 ${formatDurationDays(deliveryAnalytics.cycleTime?.p85Days)}.`,
            },
            {
                label: 'Tỷ lệ task trễ hạn',
                value: formatRatePercent(deliveryAnalytics.overdueRate?.rate),
                note: `${deliveryAnalytics.overdueRate?.overdueOpenTasks || 0}/${deliveryAnalytics.overdueRate?.openTasks || 0} task đang mở bị trễ.`,
            },
            {
                label: 'Task risk cao',
                value: highRiskCount,
                note: `${bottleneck.stalledTasks || 0} task đang stalled.`,
            },
        ];
    }, [deliveryAnalytics]);

    const burndownData = useMemo(() => deliveryAnalytics?.burndown?.daily || [], [deliveryAnalytics]);
    const velocityData = useMemo(() => deliveryAnalytics?.velocity?.weekly || [], [deliveryAnalytics]);
    const throughputWeekly = useMemo(() => deliveryAnalytics?.throughput?.weekly || [], [deliveryAnalytics]);
    const throughputByDepartment = useMemo(() => deliveryAnalytics?.throughput?.byDepartment || [], [deliveryAnalytics]);
    const workloadDistribution = useMemo(() => deliveryAnalytics?.workloadDistribution || [], [deliveryAnalytics]);
    const deadlineRiskList = useMemo(() => (deliveryAnalytics?.deadlineRisk || []).slice(0, 8), [deliveryAnalytics]);
    const heatmapRows = useMemo(() => buildHeatmapRows(deliveryAnalytics?.performanceHeatmap), [deliveryAnalytics]);
    const bottleneckData = useMemo(() => {
        const statusCounts = deliveryAnalytics?.bottleneck?.statusCounts || {};
        return [
            { name: 'Cần làm', value: statusCounts.TO_DO || 0 },
            { name: 'Đang thực hiện', value: statusCounts.IN_PROGRESS || 0 },
            { name: 'Đang kiểm tra', value: statusCounts.REVIEW || 0 },
        ];
    }, [deliveryAnalytics]);

    const quarterOptions = useMemo(() => getQuarterOptions(), []);

    if (!currentUser) return null;

    return (
        <div className="admin-page statistics-page min-vh-100 d-flex flex-column">
            <div className="glass-header d-flex justify-content-between align-items-center w-100 sticky-top">
                <div className="admin-header-slot admin-header-brand d-flex align-items-center">
                    <span className="fs-3 me-2">🚀</span>
                    <span className="brand-text d-none d-md-block">{brandLabel}</span>
                </div>

                <div className="top-menu admin-top-menu d-none d-xl-flex justify-content-center">
                    <button className="top-menu-item" onClick={() => navigate(roleBasePath)}>
                        <i className="bi bi-grid-fill top-menu-icon" style={{ color: '#8aa2bc' }}></i> Tổng quan
                    </button>
                    <button className="top-menu-item active">
                        <i className="bi bi-bar-chart-fill top-menu-icon" style={{ color: '#1d6fa3' }}></i> KPI / OKR
                    </button>
                </div>

                <div className="admin-header-slot admin-header-actions d-flex align-items-center justify-content-end gap-3">
                    <div className="d-none d-md-block"><NotificationBell currentUser={currentUser} /></div>

                    <div className="dropdown position-relative ms-1">
                        <div
                            className="admin-profile-toggle d-flex align-items-center py-1 px-2 rounded-pill shadow-sm"
                            onClick={() => setShowProfileMenu(!showProfileMenu)}
                        >
                            <div className="admin-profile-avatar rounded-circle bg-primary text-white d-flex align-items-center justify-content-center fw-bold shadow-sm overflow-hidden">
                                {currentUser?.avatarUrl ? (
                                    <img src={currentUser.avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                    currentUser?.fullName ? currentUser.fullName.charAt(0).toUpperCase() : 'U'
                                )}
                            </div>
                            <div className="ms-2 me-2 d-none d-sm-block text-start">
                                <div className="fw-bold text-dark" style={{ fontSize: '0.85rem', lineHeight: '1.2' }}>{currentUser?.fullName}</div>
                                <small className="text-muted" style={{ fontSize: '0.7rem' }}>{roleLabel}</small>
                            </div>
                            <i className="bi bi-chevron-down ms-1 text-muted me-2" style={{ fontSize: '0.8rem' }}></i>
                        </div>

                        {showProfileMenu && (
                            <div className="dropdown-menu show shadow border-0 position-absolute end-0 mt-2 p-2 rounded-4" style={{ minWidth: '220px', backgroundColor: '#fff', top: '100%', zIndex: 1050 }}>
                                <button className="dropdown-item rounded-3 py-2 fw-bold text-dark mb-1 d-flex align-items-center modern-dropdown-item" onClick={() => { setShowProfileMenu(false); navigate('/profile'); }}>
                                    <i className="bi bi-person-fill me-2 fs-5 text-primary"></i> Tài khoản của tôi
                                </button>
                                <div className="dropdown-divider my-1 border-light"></div>
                                <button className="dropdown-item rounded-3 py-2 fw-bold text-danger d-flex align-items-center modern-dropdown-item" onClick={() => { setShowProfileMenu(false); handleLogout(); }}>
                                    <i className="bi bi-box-arrow-right me-2 fs-5"></i> Đăng xuất
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="admin-dashboard-container flex-grow-1">
                <div className="admin-main-wrapper">
                    <div className="p-4 p-md-5 animate-fade-in content-inner">
                        <div className="d-flex justify-content-between align-items-center mb-4 d-xl-none bg-white p-3 rounded-4 shadow-sm">
                            <h4 className="page-title mb-0 fs-5">KPI / OKR / Reviews</h4>
                            <select className="form-select modern-input w-auto fw-bold text-primary-dark shadow-sm py-1" value="statistics" onChange={(e) => { if (e.target.value === 'dashboard') navigate(roleBasePath); }}>
                                <option value="dashboard">Tổng quan</option>
                                <option value="statistics">KPI / OKR</option>
                            </select>
                        </div>


                        {isAdmin && (
                            <>
                                <div className="row g-4 mb-5">
                                    <div className="col-md-3">
                                        <div className="modern-card p-4 border-bottom-primary h-100 statistics-summary-card">
                                            <div className="stat-icon bg-primary-light text-primary">
                                                <i className="bi bi-list-task"></i>
                                            </div>
                                            <div className="text-muted mb-1 small fw-bold text-uppercase">Tổng số task</div>
                                            <div className="fs-1 fw-bold text-dark">{statsLoading ? '--' : (stats?.totalTasks || 0)}</div>
                                        </div>
                                    </div>
                                    <div className="col-md-3">
                                        <div className="modern-card p-4 border-bottom-secondary h-100 statistics-summary-card">
                                            <div className="stat-icon bg-secondary-light text-secondary">
                                                <i className="bi bi-clock-history"></i>
                                            </div>
                                            <div className="text-muted mb-1 small fw-bold text-uppercase">Cần làm</div>
                                            <div className="fs-1 fw-bold text-secondary">{statsLoading ? '--' : (statusData[0]?.value || 0)}</div>
                                        </div>
                                    </div>
                                    <div className="col-md-3">
                                        <div className="modern-card p-4 border-bottom-primary h-100 statistics-summary-card">
                                            <div className="stat-icon bg-primary-light text-primary statistics-summary-icon statistics-summary-icon-accent">
                                                <i className="bi bi-play-fill"></i>
                                            </div>
                                            <div className="text-muted mb-1 small fw-bold text-uppercase">Đang thực hiện</div>
                                            <div className="fs-1 fw-bold text-primary">{statsLoading ? '--' : (statusData[1]?.value || 0)}</div>
                                        </div>
                                    </div>
                                    <div className="col-md-3">
                                        <div className="modern-card p-4 border-bottom-success h-100 statistics-summary-card">
                                            <div className="stat-icon bg-success-light text-success">
                                                <i className="bi bi-check-all"></i>
                                            </div>
                                            <div className="text-muted mb-1 small fw-bold text-uppercase">Hoàn thành</div>
                                            <div className="fs-1 fw-bold text-success">{statsLoading ? '--' : (statusData[2]?.value || 0)}</div>
                                        </div>
                                    </div>
                                </div>

                                {statsError ? <div className="workflow-error mb-5">{statsError}</div> : null}

                                {!statsLoading && stats && (
                                    <>
                                        <div className="statistics-section-header">
                                            <i className="bi bi-graph-up-arrow"></i> Thống kê vận hành hiện tại
                                        </div>
                                        <div className="row g-4 mb-5">
                                            <div className="col-lg-6">
                                                <div className="modern-card h-100 statistics-chart-card">
                                                    <div className="modern-card-header">Trạng thái công việc</div>
                                                    <div className="card-body p-4 d-flex align-items-center justify-content-center">
                                                        <ResponsiveContainer width="100%" height={280}>
                                                            <PieChart>
                                                                <Pie data={statusData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} minAngle={15} dataKey="value">
                                                                    {statusData.map((entry, index) => <Cell key={`status-${entry.name}-${index}`} fill={entry.color} />)}
                                                                </Pie>
                                                                <Tooltip cornerRadius={10} borderStyle={{ borderRadius: '10px' }} />
                                                                <Legend />
                                                            </PieChart>
                                                        </ResponsiveContainer>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="col-lg-6">
                                                <div className="modern-card h-100 statistics-chart-card">
                                                    <div className="modern-card-header">Độ ưu tiên</div>
                                                    <div className="card-body p-4 d-flex align-items-center justify-content-center">
                                                        <ResponsiveContainer width="100%" height={280}>
                                                            <PieChart>
                                                                <Pie data={priorityData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} minAngle={15} dataKey="value">
                                                                    {priorityData.map((entry, index) => <Cell key={`priority-${entry.name}-${index}`} fill={entry.color} />)}
                                                                </Pie>
                                                                <Tooltip cornerRadius={10} />
                                                                <Legend />
                                                            </PieChart>
                                                        </ResponsiveContainer>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="row g-4 mb-5">
                                            <div className="col-lg-5">
                                                <div className="modern-card h-100 statistics-chart-card">
                                                    <div className="modern-card-header">Trạng thái dự án</div>
                                                    <div className="card-body p-4 d-flex align-items-center justify-content-center">
                                                        <ResponsiveContainer width="100%" height={320}>
                                                            <PieChart>
                                                                <Pie data={projectStatusData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} minAngle={15} dataKey="value">
                                                                    {projectStatusData.map((entry, index) => <Cell key={`project-status-${entry.name}-${index}`} fill={entry.color} />)}
                                                                </Pie>
                                                                <Tooltip cornerRadius={10} />
                                                                <Legend />
                                                            </PieChart>
                                                        </ResponsiveContainer>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="col-lg-7">
                                                <div className="modern-card h-100 statistics-chart-card">
                                                    <div className="modern-card-header">Phân bổ khối lượng theo dự án</div>
                                                    <div className="card-body p-4">
                                                        <ResponsiveContainer width="100%" height={320}>
                                                            <BarChart data={projectData} layout="vertical">
                                                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f1f1" />
                                                                <XAxis type="number" hide />
                                                                <YAxis type="category" dataKey="name" width={100} tick={{ fill: '#a3aed1', fontSize: 11 }} axisLine={false} tickLine={false} />
                                                                <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} />
                                                                <Bar dataKey="value" fill="#1d6fa3" radius={[0, 10, 10, 0]} barSize={20} />
                                                            </BarChart>
                                                        </ResponsiveContainer>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="row g-4 mb-5">
                                            <div className="col-lg-6">
                                                <div className="modern-card h-100 statistics-chart-card">
                                                    <div className="modern-card-header">Phòng ban & lực lượng nhân sự</div>
                                                    <div className="card-body p-4">
                                                        <ResponsiveContainer width="100%" height={320}>
                                                            <BarChart data={userDeptData} layout="vertical">
                                                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f1f1" />
                                                                <XAxis type="number" hide />
                                                                <YAxis type="category" dataKey="name" width={120} tick={{ fill: '#a3aed1', fontSize: 11 }} axisLine={false} tickLine={false} />
                                                                <Tooltip cursor={{ fill: 'transparent' }} />
                                                                <Bar dataKey="value" fill="#ffb547" radius={[0, 10, 10, 0]} barSize={20} />
                                                            </BarChart>
                                                        </ResponsiveContainer>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="col-lg-6">
                                                <div className="modern-card h-100 statistics-chart-card">
                                                    <div className="modern-card-header">Xếp hạng hiệu suất nhân sự</div>
                                                    <div className="card-body p-4">
                                                        <ResponsiveContainer width="100%" height={320}>
                                                            <BarChart data={assigneeData} layout="vertical">
                                                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f1f1" />
                                                                <XAxis type="number" hide />
                                                                <YAxis type="category" dataKey="name" width={120} tick={{ fill: '#a3aed1', fontSize: 11 }} axisLine={false} tickLine={false} />
                                                                <Tooltip cursor={{ fill: 'transparent' }} />
                                                                <Bar dataKey="value" fill="#01b574" radius={[0, 10, 10, 0]} barSize={20} />
                                                            </BarChart>
                                                        </ResponsiveContainer>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </>
                        )}

                        <div className="statistics-section-header">
                            <i className="bi bi-activity"></i> Phân tích delivery
                        </div>

                        <div className="workflow-panel mb-4">
                            <div className="workflow-panel-body">
                                <div className="workflow-filter-bar">
                                    <div>
                                        <span className="workflow-meta-label">Khoảng dữ liệu</span>
                                        <select className="form-select modern-input mt-2" value={deliveryFilters.rangeDays} onChange={(e) => setDeliveryFilters((prev) => ({ ...prev, rangeDays: Number(e.target.value) }))}>
                                            {DELIVERY_RANGE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <span className="workflow-meta-label">Ngưỡng stalled</span>
                                        <select className="form-select modern-input mt-2" value={deliveryFilters.stalledDays} onChange={(e) => setDeliveryFilters((prev) => ({ ...prev, stalledDays: Number(e.target.value) }))}>
                                            {STALLED_DAY_OPTIONS.map((value) => <option key={value} value={value}>{value} ngày</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <span className="workflow-meta-label">Phạm vi analytics</span>
                                        <div className="workflow-meta-value mt-2">{isAdmin ? (filters.departmentId === 'ALL' ? 'Toàn công ty' : formatDepartmentName(departments.find((department) => department.id === filters.departmentId)?.name || '--')) : formatDepartmentName(currentUser.department?.name || '--')}</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {deliveryError ? <div className="workflow-error mb-4">{deliveryError}</div> : null}

                        {deliveryLoading ? (
                            <div className="workflow-empty mb-5">Đang tải phân tích delivery...</div>
                        ) : deliveryAnalytics ? (
                            <>
                                <div className="workflow-summary-grid mb-4">
                                    {deliverySummaryCards.map((card, index) => (
                                        <div key={`${card.label}-${index}`} className="workflow-summary-card">
                                            <span className="workflow-summary-label">{card.label}</span>
                                            <div className="workflow-summary-value">{card.value}</div>
                                            <div className="workflow-summary-note">{card.note}</div>
                                        </div>
                                    ))}
                                </div>

                                <div className="row g-4 mb-4">
                                    <div className="col-xl-7">
                                        <div className="modern-card h-100 statistics-chart-card">
                                            <div className="modern-card-header">Xu hướng Burn-down</div>
                                            <div className="card-body p-4">
                                                <ResponsiveContainer width="100%" height={320}>
                                                    <AreaChart data={burndownData}>
                                                        <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                                                        <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={24} />
                                                        <YAxis />
                                                        <Tooltip />
                                                        <Legend />
                                                        <Area type="monotone" dataKey="remaining" stroke="#d05f45" fill="#f7d7cf" name="Còn lại" />
                                                        <Line type="monotone" dataKey="completedCumulative" stroke="#2b8a5d" strokeWidth={2} dot={false} name="Lũy kế hoàn tất" />
                                                    </AreaChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="col-xl-5">
                                        <div className="modern-card h-100 statistics-chart-card">
                                            <div className="modern-card-header">Vận tốc (Velocity) theo tuần</div>
                                            <div className="card-body p-4">
                                                <ResponsiveContainer width="100%" height={320}>
                                                    <BarChart data={velocityData}>
                                                        <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                                                        <XAxis dataKey="bucket" tick={{ fontSize: 11 }} minTickGap={18} />
                                                        <YAxis allowDecimals={false} />
                                                        <Tooltip />
                                                        <Bar dataKey="count" fill="#1d6fa3" radius={[8, 8, 0, 0]} name="Task xong" />
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="row g-4 mb-4">
                                    <div className="col-xl-6">
                                        <div className="modern-card h-100 statistics-chart-card">
                                            <div className="modern-card-header">Năng suất (Throughput) theo tuần</div>
                                            <div className="card-body p-4">
                                                <ResponsiveContainer width="100%" height={300}>
                                                    <LineChart data={throughputWeekly}>
                                                        <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                                                        <XAxis dataKey="bucket" tick={{ fontSize: 11 }} minTickGap={18} />
                                                        <YAxis allowDecimals={false} />
                                                        <Tooltip />
                                                        <Line type="monotone" dataKey="count" stroke="#ffb547" strokeWidth={3} dot={{ r: 3 }} name="Hoàn tất" />
                                                    </LineChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="col-xl-6">
                                        <div className="modern-card h-100 statistics-chart-card">
                                            <div className="modern-card-header">Năng suất (Throughput) theo phòng ban</div>
                                            <div className="card-body p-4">
                                                <ResponsiveContainer width="100%" height={300}>
                                                    <BarChart data={throughputByDepartment.length ? throughputByDepartment : [{ departmentName: 'Current', completed: 0 }]} layout="vertical">
                                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#eef2f7" />
                                                        <XAxis type="number" allowDecimals={false} />
                                                        <YAxis type="category" dataKey="departmentName" width={120} tick={{ fontSize: 11 }} />
                                                        <Tooltip />
                                                        <Bar dataKey="completed" fill="#6f42c1" radius={[0, 10, 10, 0]} name="Hoàn thành" />
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="row g-4 mb-4">
                                    <div className="col-xl-6">
                                        <div className="modern-card h-100 statistics-chart-card">
                                            <div className="modern-card-header">Tóm tắt điểm nghẽn (Bottlenecks)</div>
                                            <div className="card-body p-4">
                                                <ResponsiveContainer width="100%" height={260}>
                                                    <BarChart data={bottleneckData}>
                                                        <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                                                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                                                        <YAxis allowDecimals={false} />
                                                        <Tooltip />
                                                        <Bar dataKey="value" fill="#d05f45" radius={[10, 10, 0, 0]} />
                                                    </BarChart>
                                                </ResponsiveContainer>
                                                <div className="row g-3 mt-2">
                                                    <div className="col-6">
                                                        <div className="workflow-summary-card h-100">
                                                            <span className="workflow-summary-label">Quá hạn đang mở</span>
                                                            <div className="workflow-summary-value">{deliveryAnalytics?.bottleneck?.overdueOpenTasks || 0}</div>
                                                        </div>
                                                    </div>
                                                    <div className="col-6">
                                                        <div className="workflow-summary-card h-100">
                                                            <span className="workflow-summary-label">Đang đình trệ (Stalled)</span>
                                                            <div className="workflow-summary-value">{deliveryAnalytics?.bottleneck?.stalledTasks || 0}</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="col-xl-6">
                                        <div className="modern-card h-100 statistics-chart-card">
                                            <div className="modern-card-header">Phân bổ khối lượng công việc</div>
                                            <div className="card-body p-4">
                                                <ResponsiveContainer width="100%" height={320}>
                                                    <BarChart data={workloadDistribution} layout="vertical">
                                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#eef2f7" />
                                                        <XAxis type="number" allowDecimals={false} />
                                                        <YAxis type="category" dataKey="assigneeName" width={120} tick={{ fontSize: 11 }} />
                                                        <Tooltip />
                                                        <Legend />
                                                        <Bar dataKey="openTasks" fill="#1d6fa3" radius={[0, 10, 10, 0]} name="Đang mở" />
                                                        <Bar dataKey="overdueOpenTasks" fill="#d05f45" radius={[0, 10, 10, 0]} name="Trễ hạn" />
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="workflow-panel mb-5">
                                    <div className="workflow-panel-header">
                                        <div className="d-flex justify-content-between align-items-center w-100">
                                            <div>
                                                <h3 className="workflow-panel-title">🔥 Bản đồ nhiệt Tải trọng Nhân sự</h3>
                                                <p className="workflow-panel-copy">Giám sát mức độ bận rộn và rủi ro quá tải của nhân sự trong thời gian thực.</p>
                                            </div>
                                            {resourceWorkloadLoading && <div className="spinner-border spinner-border-sm text-primary"></div>}
                                        </div>
                                    </div>
                                    <div className="workflow-panel-body">
                                        <HeatmapGrid data={resourceWorkload} />
                                    </div>
                                </div>

                                <div className="workflow-panel mb-4">
                                    <div className="workflow-panel-header">
                                        <div>
                                            <h3 className="workflow-panel-title">Bản đồ nhiệt Hiệu suất</h3>
                                            <p className="workflow-panel-copy">Số task hoàn tất theo nhân sự và ngày trong tuần trong khoảng dữ liệu đã chọn.</p>
                                        </div>
                                    </div>
                                    <div className="workflow-panel-body">
                                        {heatmapRows.length === 0 ? (
                                                    <div className="workflow-empty">Chưa có dữ liệu heatmap trong khoảng đã chọn.</div>
                                        ) : (
                                            <div className="table-responsive">
                                                <table className="table align-middle">
                                                    <thead>
                                                        <tr>
                                                            <th>Nhân sự</th>
                                                            {heatmapRows[0].cells.map((cell) => <th key={cell.key} className="text-center">{cell.label}</th>)}
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {heatmapRows.map((row) => (
                                                            <tr key={row.assigneeId}>
                                                                <td className="fw-semibold">{row.assigneeName}</td>
                                                                {row.cells.map((cell) => (
                                                                    <td key={`${row.assigneeId}-${cell.key}`} className="text-center">
                                                                        <span className="d-inline-flex align-items-center justify-content-center rounded-3 fw-bold" style={{ width: '44px', height: '36px', ...getHeatmapCellStyle(cell.value) }}>
                                                                            {cell.value}
                                                                        </span>
                                                                    </td>
                                                                ))}
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="workflow-panel mb-5">
                                    <div className="workflow-panel-header">
                                        <div>
                                            <h3 className="workflow-panel-title">Giám sát Rủi ro Hạn chót (Radar)</h3>
                                            <p className="workflow-panel-copy">Danh sách task có nguy cơ trễ hạn cao nhất, sử dụng rule-based scoring từ tiến độ, deadline, mức độ ưu tiên và tải hiện tại.</p>
                                        </div>
                                    </div>
                                    <div className="workflow-panel-body">
                                        {deadlineRiskList.length === 0 ? (
                                                    <div className="workflow-empty">Không có task mở nào trong phạm vi đã chọn.</div>
                                        ) : (
                                            <div className="table-responsive">
                                                <table className="table align-middle">
                                                    <thead>
                                                        <tr>
                                                            <th>Công việc</th>
                                                            <th>Người thực hiện</th>
                                                            <th>Trạng thái</th>
                                                            <th>Rủi ro</th>
                                                            <th>Hạn chót</th>
                                                            <th>Lý do</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {deadlineRiskList.map((item) => {
                                                            const riskTone = getRiskTone(Number(item.score || 0));
                                                            return (
                                                                <tr key={item.taskId}>
                                                                    <td>
                                                                        <div className="fw-semibold">{item.taskTitle}</div>
                                                                        <small className="text-muted">Tiến độ {item.completionPercentage || 0}%</small>
                                                                    </td>
                                                                    <td>{item.assigneeName || '--'}</td>
                                                                    <td>{item.status || '--'}</td>
                                                                    <td>
                                                                        <span className={`workflow-pill ${riskTone.className}`}>{riskTone.label} - {item.score}</span>
                                                                    </td>
                                                                    <td>{item.deadline || '--'}</td>
                                                                    <td>
                                                                    <div className="small text-muted">{Array.isArray(item.reasons) && item.reasons.length ? item.reasons.slice(0, 2).join(' ') : 'Không có cảnh báo.'}</div>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="workflow-panel mb-5">
                                    <div className="workflow-panel-header">
                                        <div>
                                            <h3 className="workflow-panel-title">📅 Project Gantt Timeline</h3>
                                            <p className="workflow-panel-copy">Trực quan hóa lộ trình công việc theo thời gian. Cập nhật ngày bắt đầu và deadline trực tiếp trong từng dòng công việc.</p>
                                        </div>
                                    </div>
                                    <div className="workflow-panel-body">
                                        {scopedTasksLoading ? (
                                            <div className="text-center py-5">
                                                <div className="spinner-border text-primary" role="status"></div>
                                                <div className="mt-2 text-muted">Đang chuẩn bị dữ liệu Gantt...</div>
                                            </div>
                                        ) : (
                                            <ProjectGantt 
                                                tasks={scopedTasks} 
                                                onTaskUpdate={() => {
                                                    setTimelineRefreshKey((prev) => prev + 1);
                                                }} 
                                            />
                                        )}
                                    </div>
                                </div>
                            </>
                        ) : null}

                        <div className="workflow-hero mb-4">
                            <div>
                                <span className="admin-section-kicker">Báo cáo chiến lược</span>
                                <h1 className="workflow-hero-title">{isAdmin ? 'Góc nhìn KPI / OKR toàn tổ chức' : 'Báo cáo KPI / OKR phòng ban'} cho {formatQuarterLabel(filters.quarter)}</h1>
                                <p className="workflow-hero-copy">
                                    Theo dõi KPI, tiến độ OKR và kết quả đánh giá hàng quý trong một màn hình, đồng bộ với luồng phê duyệt và vận hành dự án hiện có.
                                </p>
                            </div>
                        </div>

                        <div className="workflow-panel mb-4">
                            <div className="workflow-panel-body">
                                <div className="workflow-filter-bar">
                                    <div>
                                        <span className="workflow-meta-label">Quý báo cáo</span>
                                        <select className="form-select modern-input mt-2" value={filters.quarter} onChange={(e) => setFilters((prev) => ({ ...prev, quarter: e.target.value }))}>
                                            {quarterOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                                        </select>
                                    </div>

                                    {isAdmin ? (
                                        <div>
                                            <span className="workflow-meta-label">Phạm vi đơn vị</span>
                                            <select className="form-select modern-input mt-2" value={filters.departmentId} onChange={(e) => setFilters((prev) => ({ ...prev, departmentId: e.target.value }))}>
                                                <option value="ALL">Toàn công ty</option>
                                                {departments.map((department) => <option key={department.id} value={department.id}>{formatDepartmentName(department.name)}</option>)}
                                            </select>
                                        </div>
                                    ) : (
                                        <div>
                                            <span className="workflow-meta-label">Phòng ban</span>
                                            <div className="workflow-meta-value mt-2">{formatDepartmentName(currentUser.department?.name || '--')}</div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="statistics-section-header">
                            <i className="bi bi-bullseye"></i> KPI / OKR / Quarterly review
                        </div>

                        {insightsError ? <div className="workflow-error mb-4">{insightsError}</div> : null}

                        {insightsLoading ? (
                                    <div className="workflow-empty">Đang tải báo cáo KPI / OKR / báo cáo định kỳ...</div>
                        ) : (
                            <div className="workflow-shell">
                                <div className="workflow-summary-grid">
                                    {kpiCards.map((card, index) => (
                                        <div key={`${card.label}-${index}`} className="workflow-summary-card">
                                            <span className="workflow-summary-label">{card.label}</span>
                                            <div className="workflow-summary-value">{card.value}</div>
                                            <div className="workflow-summary-note">{card.note}</div>
                                        </div>
                                        ))}
                                    </div>

                                    {canManagePerformance ? (
                                        <div className="statistics-manage-actions mt-3">
                                            <button 
                                                className="btn statistics-manage-btn statistics-manage-btn-secondary" 
                                                onClick={handleGenerateInsights}
                                                disabled={isGenerating || !filters.departmentId || filters.departmentId === 'ALL'}
                                            >
                                                {isGenerating ? (
                                                    <><span className="spinner-border spinner-border-sm me-2"></span>Đang phân tích...</>
                                                ) : (
                                                    <><i className="bi bi-magic me-2"></i>🚀 Đồng bộ & Phân tích Insights</>
                                                )}
                                            </button>
                                            <button className="btn statistics-manage-btn statistics-manage-btn-primary" onClick={handleUpsertOkr}>
                                                <i className="bi bi-plus-circle me-2"></i>Cập nhật OKR quý này
                                            </button>
                                        </div>
                                    ) : null}

                                <div className="workflow-panel">
                                    <div className="workflow-panel-header">
                                        <div>
                                            <h3 className="workflow-panel-title">Mục tiêu và kết quả then chốt (Key Results)</h3>
                                            <p className="workflow-panel-copy">Danh sách OKR, hiển thị tiến độ và các kết quả then chốt nổi bật trong quý được chọn.</p>
                                        </div>
                                    </div>
                                    <div className="workflow-panel-body">
                                        {okrObjectives.length === 0 ? (
                                            <div className="workflow-empty">Chưa có OKR nào trong quý được chọn.</div>
                                        ) : (
                                            <div className="workflow-objective-grid">
                                                {okrObjectives.map((objective) => (
                                                    <article key={objective.id} className="workflow-objective-card">
                                                        <div className="workflow-item-head">
                                                            <div style={{ flex: 1 }}>
                                                                <h4 className="workflow-objective-title">{objective.title}</h4>
                                                                <p className="workflow-objective-copy">{objective.description || 'Không có mô tả chi tiết.'}</p>
                                                                <div className="workflow-meta-value mt-2">
                                                                    <span className="badge bg-light text-dark border rounded-pill px-3 py-1">Phụ trách: {objective.owner}</span>
                                                                </div>
                                                            </div>
                                                            <div className="circular-progress-container ms-3">
                                                                <div className="circular-progress" style={{ '--progress': `${(objective.progress / 100) * 360}deg` }}>
                                                                    <div className="circular-progress-inner">
                                                                        {objective.progress}%
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        
                                                        {objective.keyResults.length > 0 ? (
                                                            <div className="mt-4">
                                                                <h6 className="text-uppercase small fw-bold text-muted mb-3" style={{ letterSpacing: '0.05em' }}>Key Results</h6>
                                                                {objective.keyResults.slice(0, 4).map((keyResult, index) => {
                                                                    const isObj = typeof keyResult !== 'string';
                                                                    const krPercentage = isObj && keyResult.targetValue ? Math.min(100, Math.round((keyResult.currentValue / keyResult.targetValue) * 100)) : 0;
                                                                    
                                                                    return (
                                                                        <div key={`${objective.id}-kr-${index}`} className="kr-item">
                                                                            <div className="kr-title-row">
                                                                                <span>{isObj ? (keyResult.title || keyResult.name) : keyResult}</span>
                                                                                {isObj && <span className="text-primary">{toDisplayValue(keyResult.currentValue)} / {toDisplayValue(keyResult.targetValue)} {keyResult.unit || ''}</span>}
                                                                            </div>
                                                                            {isObj && (
                                                                                <div className="workflow-progress-track kr-progress-mini mt-1">
                                                                                    <div className="workflow-progress-bar" style={{ width: `${krPercentage}%` }}></div>
                                                                                </div>
                                                                            )}
                                                                            {canManagePerformance && isObj && keyResult.id && (
                                                                                <div className="mt-2 d-flex justify-content-end">
                                                                                    <button className="btn btn-sm statistics-inline-action" onClick={() => handleUpdateKeyResult(objective, keyResult)}>
                                                                                        Cập nhật kết quả
                                                                                    </button>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        ) : null}
                                                    </article>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="workflow-panel">
                                    <div className="workflow-panel-header">
                                        <div>
                                            <h3 className="workflow-panel-title">Đánh giá hàng quý (Quarterly reviews)</h3>
                                            <p className="workflow-panel-copy">Tổng hợp kết quả đánh giá, tình trạng sức khỏe và các hành động tiếp theo cho từng đơn vị hoặc mục tiêu.</p>
                                        </div>
                                    </div>
                                    <div className="workflow-panel-body">
                                        {quarterlyReviews.length === 0 ? (
                                            <div className="workflow-empty">Chưa có đánh giá quý nào cho bộ lọc hiện tại.</div>
                                        ) : (
                                            <div className="workflow-review-grid">
                                                {quarterlyReviews.map((review) => {
                                                    const statusMeta = getReviewStatusMeta(review.status);
                                                    const score = Number(review.score || 0);
                                                    const scoreClass = score >= 8 ? 'excellent' : score >= 6 ? 'good' : score >= 4 ? 'average' : 'poor';

                                                    return (
                                                        <article key={review.id} className="workflow-review-card">
                                                            <div className="workflow-review-head mb-3">
                                                                <div style={{ flex: 1 }}>
                                                                    <h4 className="workflow-review-title">{review.title}</h4>
                                                                    <span className={`workflow-pill mt-2 ${statusMeta.className}`}>{statusMeta.label}</span>
                                                                </div>
                                                                <div className={`workflow-review-score ${scoreClass}`}>
                                                                    {review.score}
                                                                </div>
                                                            </div>
                                                            
                                                            <div className="workflow-review-copy py-2 px-3 bg-light rounded-3 mb-3 border-start border-4 border-primary">
                                                                <i className="bi bi-quote me-2 opacity-50"></i>
                                                                {review.summary || 'Không có tóm tắt cho đợt review này.'}
                                                            </div>

                                                            <div className="workflow-meta-grid mb-3">
                                                                <div>
                                                                    <span className="workflow-meta-label">Ngày review</span>
                                                                    <div className="workflow-meta-value fw-bold">{formatWorkflowDate(review.reviewDate)}</div>
                                                                </div>
                                                                <div>
                                                                    <span className="workflow-meta-label">Phòng ban</span>
                                                                    <div className="workflow-meta-value fw-bold">{formatDepartmentName(review.departmentName || review.title || '---')}</div>
                                                                </div>
                                                            </div>

                                                            {review.actionItems.length > 0 ? (
                                                                <div className="mt-3">
                                                                    <h6 className="text-uppercase small fw-bold text-muted mb-2" style={{ letterSpacing: '0.05em' }}>Hành động cần thực hiện</h6>
                                                                    <ul className="list-unstyled mb-0">
                                                                        {review.actionItems.slice(0, 4).map((action, index) => (
                                                                            <li key={`${review.id}-action-${index}`} className="d-flex align-items-center gap-2 mb-1 small text-muted">
                                                                                <i className="bi bi-check2-circle text-primary"></i>
                                                                                {typeof action === 'string' ? action : (action.title || action.name)}
                                                                            </li>
                                                                        ))}
                                                                    </ul>
                                                                </div>
                                                            ) : null}

                                                            {canManagePerformance ? (
                                                                <div className="mt-3 pt-3 border-top d-flex justify-content-end">
                                                                    <button className="btn btn-sm statistics-inline-action" onClick={() => handleUpdateReviewSummary(review)}>
                                                                        Chỉnh sửa báo cáo
                                                                    </button>
                                                                </div>
                                                            ) : null}
                                                        </article>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {activeModal ? (
                <div
                    className="statistics-modal-overlay"
                    role="presentation"
                    onClick={(event) => {
                        if (event.target === event.currentTarget) {
                            closeActiveModal();
                        }
                    }}
                >
                    {activeModal === 'okr' ? (
                        <div className="statistics-modal statistics-modal-wide" role="dialog" aria-modal="true" aria-labelledby="statistics-okr-modal-title" onClick={(event) => event.stopPropagation()}>
                            <form onSubmit={submitOkrModal} className="statistics-modal-shell">
                                <div className="statistics-modal-header">
                                    <div>
                                        <span className="statistics-modal-kicker">Cap nhat OKR</span>
                                        <h2 id="statistics-okr-modal-title" className="statistics-modal-title">Tao moi hoac cap nhat OKR cho {formatQuarterLabel(filters.quarter)}</h2>
                                        <p className="statistics-modal-copy">Nhap muc tieu va ket qua then chot ngay tren dashboard de dong bo du lieu quy hien tai ma khong roi khoi man hinh.</p>
                                    </div>
                                    <button type="button" className="statistics-modal-dismiss" onClick={closeActiveModal} aria-label="Dong form">
                                        <i className="bi bi-x-lg"></i>
                                    </button>
                                </div>

                                <div className="statistics-modal-body">
                                    <div className="statistics-modal-meta-card">
                                        <div>
                                            <span className="workflow-meta-label">Pham vi hien tai</span>
                                            <div className="workflow-meta-value fw-bold">{selectedDepartmentName}</div>
                                        </div>
                                        <div>
                                            <span className="workflow-meta-label">Quy du lieu</span>
                                            <div className="workflow-meta-value fw-bold">{formatQuarterLabel(filters.quarter)}</div>
                                        </div>
                                    </div>

                                    {isAdmin && filters.departmentId === 'ALL' ? (
                                        <div className="statistics-modal-field">
                                            <label className="statistics-modal-label" htmlFor="statistics-okr-department">Phòng ban</label>
                                            <select
                                                id="statistics-okr-department"
                                                className={`form-select modern-input ${okrModal.errors.departmentId ? 'is-invalid' : ''}`}
                                                value={okrModal.departmentId}
                                                onChange={(event) => handleOkrFieldChange('departmentId', event.target.value)}
                                            >
                                                <option value="">Chọn phòng ban cần cập nhật</option>
                                                {departments.map((department) => (
                                                    <option key={department.id} value={department.id}>{formatDepartmentName(department.name)}</option>
                                                ))}
                                            </select>
                                            {okrModal.errors.departmentId ? <div className="statistics-modal-error">{okrModal.errors.departmentId}</div> : null}
                                        </div>
                                    ) : (
                                        <div className="statistics-modal-field">
                                            <span className="statistics-modal-label">Đơn vị áp dụng</span>
                                            <div className="statistics-modal-static">{modalDepartmentName || selectedDepartmentName}</div>
                                        </div>
                                    )}

                                    <div className="statistics-modal-field">
                                        <label className="statistics-modal-label" htmlFor="statistics-okr-objective">Mục tiêu quý</label>
                                        <input
                                            id="statistics-okr-objective"
                                            type="text"
                                            className={`form-control modern-input ${okrModal.errors.objective ? 'is-invalid' : ''}`}
                                            placeholder="Ví dụ: Nâng cao chất lượng giao hàng dự án"
                                            value={okrModal.objective}
                                            onChange={(event) => handleOkrFieldChange('objective', event.target.value)}
                                        />
                                        {okrModal.errors.objective ? <div className="statistics-modal-error">{okrModal.errors.objective}</div> : null}
                                    </div>

                                    <div className="statistics-modal-section-head">
                                        <div>
                                            <h3 className="statistics-modal-section-title">Danh sách kết quả then chốt</h3>
                                            <p className="statistics-modal-section-copy">Bổ sung nhiều KR, điều chỉnh mục tiêu và giá trị hiện tại ngay trong cùng một biểu mẫu.</p>
                                        </div>
                                        <button type="button" className="btn statistics-mini-action" onClick={handleAddOkrKeyResult}>
                                            <i className="bi bi-plus-lg me-1"></i>Thêm KR
                                        </button>
                                    </div>

                                    <div className="statistics-kr-list">
                                        {okrModal.keyResults.map((item, index) => {
                                            const rowErrors = Array.isArray(okrModal.errors.keyResults) ? (okrModal.errors.keyResults[index] || {}) : {};

                                            return (
                                                <div key={`okr-key-result-${index}`} className="statistics-kr-card">
                                                    <div className="statistics-kr-card-head">
                                                        <span className="statistics-kr-index">KR {index + 1}</span>
                                                        <button
                                                            type="button"
                                                            className="btn statistics-kr-remove"
                                                            onClick={() => handleRemoveOkrKeyResult(index)}
                                                            disabled={okrModal.keyResults.length === 1}
                                                        >
                                                            <i className="bi bi-trash3 me-1"></i>Xoa
                                                        </button>
                                                    </div>

                                                    <div className="statistics-modal-field">
                                                        <label className="statistics-modal-label" htmlFor={`statistics-okr-name-${index}`}>Tên kết quả then chốt</label>
                                                        <input
                                                            id={`statistics-okr-name-${index}`}
                                                            type="text"
                                                            className={`form-control modern-input ${rowErrors.name ? 'is-invalid' : ''}`}
                                                            placeholder="Ví dụ: Giảm lỗi nghiêm trọng xuống dưới 5 lỗi"
                                                            value={item.name}
                                                            onChange={(event) => handleOkrKeyResultChange(index, 'name', event.target.value)}
                                                        />
                                                        {rowErrors.name ? <div className="statistics-modal-error">{rowErrors.name}</div> : null}
                                                    </div>

                                                    <div className="statistics-modal-grid">
                                                        <div className="statistics-modal-field">
                                                            <label className="statistics-modal-label" htmlFor={`statistics-okr-target-${index}`}>Mục tiêu</label>
                                                            <input
                                                                id={`statistics-okr-target-${index}`}
                                                                type="number"
                                                                step="any"
                                                                min="0"
                                                                className={`form-control modern-input ${rowErrors.targetValue ? 'is-invalid' : ''}`}
                                                                placeholder="100"
                                                                value={item.targetValue}
                                                                onChange={(event) => handleOkrKeyResultChange(index, 'targetValue', event.target.value)}
                                                            />
                                                            {rowErrors.targetValue ? <div className="statistics-modal-error">{rowErrors.targetValue}</div> : null}
                                                        </div>
                                                        <div className="statistics-modal-field">
                                                            <label className="statistics-modal-label" htmlFor={`statistics-okr-current-${index}`}>Hiện tại</label>
                                                            <input
                                                                id={`statistics-okr-current-${index}`}
                                                                type="number"
                                                                step="any"
                                                                min="0"
                                                                className={`form-control modern-input ${rowErrors.currentValue ? 'is-invalid' : ''}`}
                                                                placeholder="0"
                                                                value={item.currentValue}
                                                                onChange={(event) => handleOkrKeyResultChange(index, 'currentValue', event.target.value)}
                                                            />
                                                            {rowErrors.currentValue ? <div className="statistics-modal-error">{rowErrors.currentValue}</div> : null}
                                                        </div>
                                                        <div className="statistics-modal-field">
                                                            <label className="statistics-modal-label" htmlFor={`statistics-okr-unit-${index}`}>Đơn vị</label>
                                                            <input
                                                                id={`statistics-okr-unit-${index}`}
                                                                type="text"
                                                                className="form-control modern-input"
                                                                placeholder="%, bug, task..."
                                                                value={item.unit}
                                                                onChange={(event) => handleOkrKeyResultChange(index, 'unit', event.target.value)}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {typeof okrModal.errors.keyResults === 'string' ? <div className="statistics-modal-error">{okrModal.errors.keyResults}</div> : null}
                                    {okrModal.submitError ? <div className="workflow-error mb-0">{okrModal.submitError}</div> : null}
                                </div>

                                <div className="statistics-modal-footer">
                                    <button type="button" className="btn statistics-modal-btn statistics-modal-btn-secondary" onClick={closeActiveModal}>Đóng</button>
                                    <button type="submit" className="btn statistics-modal-btn statistics-modal-btn-primary" disabled={okrModal.submitting}>
                                        {okrModal.submitting ? <><span className="spinner-border spinner-border-sm me-2"></span>Đang lưu OKR...</> : 'Lưu OKR quý này'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    ) : null}

                    {activeModal === 'keyResult' ? (
                        <div className="statistics-modal" role="dialog" aria-modal="true" aria-labelledby="statistics-kr-modal-title" onClick={(event) => event.stopPropagation()}>
                            <form onSubmit={submitKeyResultModal} className="statistics-modal-shell">
                                <div className="statistics-modal-header">
                                    <div>
                                        <span className="statistics-modal-kicker">Cập nhật kết quả then chốt</span>
                                        <h2 id="statistics-kr-modal-title" className="statistics-modal-title">Điều chỉnh giá trị thực hiện</h2>
                                        <p className="statistics-modal-copy">Cập nhật tiến độ KR ngay trong trang KPI/OKR và giữ nguyên luồng đồng bộ dữ liệu hiện tại.</p>
                                    </div>
                                    <button type="button" className="statistics-modal-dismiss" onClick={closeActiveModal} aria-label="Đóng form">
                                        <i className="bi bi-x-lg"></i>
                                    </button>
                                </div>

                                <div className="statistics-modal-body">
                                    <div className="statistics-modal-meta-card">
                                        <div>
                                            <span className="workflow-meta-label">Mục tiêu</span>
                                            <div className="workflow-meta-value fw-bold">{keyResultModal.objectiveTitle}</div>
                                        </div>
                                        <div>
                                            <span className="workflow-meta-label">Phòng ban</span>
                                            <div className="workflow-meta-value fw-bold">{keyResultModal.departmentName}</div>
                                        </div>
                                    </div>

                                    <div className="statistics-modal-field">
                                        <span className="statistics-modal-label">Kết quả then chốt</span>
                                        <div className="statistics-modal-static">{keyResultModal.keyResultName}</div>
                                    </div>

                                    <div className="statistics-modal-grid statistics-modal-grid-compact">
                                        <div className="statistics-modal-field">
                                            <span className="statistics-modal-label">Mục tiêu</span>
                                            <div className="statistics-modal-static">{toDisplayValue(keyResultModal.targetValue)} {keyResultModal.unit}</div>
                                        </div>
                                        <div className="statistics-modal-field">
                                            <label className="statistics-modal-label" htmlFor="statistics-key-result-value">Giá trị hiện tại</label>
                                            <input
                                                id="statistics-key-result-value"
                                                type="number"
                                                step="any"
                                                className={`form-control modern-input ${keyResultModal.errors.currentValue ? 'is-invalid' : ''}`}
                                                placeholder="Nhập giá trị mới"
                                                value={keyResultModal.currentValue}
                                                onChange={(event) => handleKeyResultValueChange(event.target.value)}
                                            />
                                            {keyResultModal.errors.currentValue ? <div className="statistics-modal-error">{keyResultModal.errors.currentValue}</div> : null}
                                        </div>
                                    </div>

                                    {keyResultModal.submitError ? <div className="workflow-error mb-0">{keyResultModal.submitError}</div> : null}
                                </div>

                                <div className="statistics-modal-footer">
                                    <button type="button" className="btn statistics-modal-btn statistics-modal-btn-secondary" onClick={closeActiveModal}>Đóng</button>
                                    <button type="submit" className="btn statistics-modal-btn statistics-modal-btn-primary" disabled={keyResultModal.submitting}>
                                        {keyResultModal.submitting ? <><span className="spinner-border spinner-border-sm me-2"></span>Đang cập nhật...</> : 'Lưu giá trị mới'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    ) : null}

                    {activeModal === 'review' ? (
                        <div className="statistics-modal" role="dialog" aria-modal="true" aria-labelledby="statistics-review-modal-title" onClick={(event) => event.stopPropagation()}>
                            <form onSubmit={submitReviewSummaryModal} className="statistics-modal-shell">
                                <div className="statistics-modal-header">
                                    <div>
                                        <span className="statistics-modal-kicker">Tổng kết quý</span>
                                        <h2 id="statistics-review-modal-title" className="statistics-modal-title">Cập nhật tổng kết quý</h2>
                                        <p className="statistics-modal-copy">Hoàn thiện nhận xét tổng quan, điểm nhấn và hướng hành động tiếp theo cho đơn vị đang được theo dõi.</p>
                                    </div>
                                    <button type="button" className="statistics-modal-dismiss" onClick={closeActiveModal} aria-label="Đóng form">
                                        <i className="bi bi-x-lg"></i>
                                    </button>
                                </div>

                                <div className="statistics-modal-body">
                                    <div className="statistics-modal-meta-card">
                                        <div>
                                            <span className="workflow-meta-label">Đơn vị</span>
                                            <div className="workflow-meta-value fw-bold">{reviewModal.departmentName}</div>
                                        </div>
                                        <div>
                                            <span className="workflow-meta-label">Quý dữ liệu</span>
                                            <div className="workflow-meta-value fw-bold">{formatQuarterLabel(filters.quarter)}</div>
                                        </div>
                                    </div>

                                    <div className="statistics-modal-field">
                                        <span className="statistics-modal-label">Báo cáo</span>
                                        <div className="statistics-modal-static">{reviewModal.reviewTitle}</div>
                                    </div>

                                    <div className="statistics-modal-field">
                                        <label className="statistics-modal-label" htmlFor="statistics-review-summary">Nội dung tổng kết</label>
                                        <textarea
                                            id="statistics-review-summary"
                                            rows="6"
                                            className={`form-control modern-input statistics-modal-textarea ${reviewModal.errors.summary ? 'is-invalid' : ''}`}
                                            placeholder="Tóm tắt kết quả đạt được, rủi ro cần xử lý và bước tiếp theo của quý này..."
                                            value={reviewModal.summary}
                                            onChange={(event) => handleReviewSummaryChange(event.target.value)}
                                        />
                                        {reviewModal.errors.summary ? <div className="statistics-modal-error">{reviewModal.errors.summary}</div> : null}
                                    </div>

                                    {reviewModal.submitError ? <div className="workflow-error mb-0">{reviewModal.submitError}</div> : null}
                                </div>

                                <div className="statistics-modal-footer">
                                    <button type="button" className="btn statistics-modal-btn statistics-modal-btn-secondary" onClick={closeActiveModal}>Đóng</button>
                                    <button type="submit" className="btn statistics-modal-btn statistics-modal-btn-primary" disabled={reviewModal.submitting}>
                                        {reviewModal.submitting ? <><span className="spinner-border spinner-border-sm me-2"></span>Đang cập nhật...</> : 'Lưu tổng kết quý'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
};

export default StatisticsPage;
