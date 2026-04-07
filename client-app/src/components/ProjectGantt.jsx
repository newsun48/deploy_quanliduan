import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';

const VIEW_MODE = {
    HOUR: 'HOUR',
    DAY: 'DAY',
    WEEK: 'WEEK',
    MONTH: 'MONTH',
};

const VIEW_OPTIONS = [
    { value: VIEW_MODE.HOUR, label: 'Giờ' },
    { value: VIEW_MODE.DAY, label: 'Ngày' },
    { value: VIEW_MODE.WEEK, label: 'Tuần' },
    { value: VIEW_MODE.MONTH, label: 'Tháng' },
];

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

const parseValidDate = (value) => {
    if (!value) return null;

    const parsed = value instanceof Date ? new Date(value.getTime()) : new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const PRIORITY_META = {
    CRITICAL: { label: 'Khẩn cấp', color: '#be123c' },
    HIGH: { label: 'Cao', color: '#ef4444' },
    MEDIUM: { label: 'Trung bình', color: '#f59e0b' },
    LOW: { label: 'Thấp', color: '#3b82f6' },
    DEFAULT: { label: 'Thấp', color: '#3b82f6' },
};

const VIEW_CONFIG = {
    [VIEW_MODE.HOUR]: {
        markerCount: 9,
        baseUnitMs: 12 * HOUR_MS,
        columnWidth: 72,
        maxWidth: 3200,
    },
    [VIEW_MODE.DAY]: {
        markerCount: 8,
        baseUnitMs: DAY_MS,
        columnWidth: 56,
        maxWidth: 2600,
    },
    [VIEW_MODE.WEEK]: {
        markerCount: 7,
        baseUnitMs: 7 * DAY_MS,
        columnWidth: 164,
        maxWidth: 2200,
    },
    [VIEW_MODE.MONTH]: {
        markerCount: 6,
        baseUnitMs: 30 * DAY_MS,
        columnWidth: 220,
        maxWidth: 1800,
    },
};

const formatDisplayDate = (value) => {
    if (!(value instanceof Date) || Number.isNaN(value.getTime())) return '--';
    return value.toLocaleDateString('vi-VN');
};

const formatDateInputValue = (value) => {
    if (!(value instanceof Date) || Number.isNaN(value.getTime())) return '';

    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const formatTimelineLabel = (date, view) => {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '--';

    if (view === VIEW_MODE.HOUR) {
        return date.toLocaleString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
            day: '2-digit',
            month: '2-digit',
        });
    }

    if (view === VIEW_MODE.MONTH) {
        return date.toLocaleDateString('vi-VN', {
            month: 'short',
            year: 'numeric',
        });
    }

    if (view === VIEW_MODE.WEEK) {
        return `Tuần ${date.toLocaleDateString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
        })}`;
    }

    return date.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
    });
};

const formatDuration = (start, end) => {
    const diff = Math.max(HOUR_MS, end.getTime() - start.getTime());
    if (diff < DAY_MS) {
        const hours = Math.max(1, Math.round(diff / HOUR_MS));
        return `${hours} giờ`;
    }

    const days = Math.max(1, Math.round(diff / DAY_MS));
    return `${days} ngày`;
};

const toRgba = (hex, alpha) => {
    const normalized = hex.replace('#', '');
    const value = normalized.length === 3
        ? normalized.split('').map((char) => char + char).join('')
        : normalized;

    const red = Number.parseInt(value.slice(0, 2), 16);
    const green = Number.parseInt(value.slice(2, 4), 16);
    const blue = Number.parseInt(value.slice(4, 6), 16);

    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};

const normalizeTask = (task) => {
    let start = parseValidDate(task.startDate);
    if (!start) {
        start = parseValidDate(task.project?.createdDate) || new Date();
    }

    let end = parseValidDate(task.deadline);
    if (!end) {
        end = new Date(start.getTime() + DAY_MS);
    }

    if (start.getTime() > end.getTime()) {
        end = new Date(start.getTime() + HOUR_MS);
    }

    const priorityMeta = PRIORITY_META[task.priority] || PRIORITY_META.DEFAULT;

    return {
        start,
        end,
        name: task.title || 'Task không tiêu đề',
        id: task.id,
        progress: Math.max(0, Math.min(100, Number(task.completionPercentage) || 0)),
        project: task.project?.name || 'N/A',
        priority: task.priority || 'LOW',
        priorityLabel: priorityMeta.label,
        color: priorityMeta.color,
    };
};

const buildDraftState = (items) => items.reduce((acc, item) => {
    acc[item.id] = {
        startDate: formatDateInputValue(item.start),
        deadline: formatDateInputValue(item.end),
        saving: false,
    };
    return acc;
}, {});

const buildMarkers = (start, end, view) => {
    const count = VIEW_CONFIG[view].markerCount;
    const duration = Math.max(HOUR_MS, end.getTime() - start.getTime());

    return Array.from({ length: count }, (_, index) => {
        const ratio = count === 1 ? 0 : index / (count - 1);
        const markerDate = new Date(start.getTime() + (duration * ratio));

        return {
            key: `${view}-${markerDate.getTime()}-${index}`,
            left: `${ratio * 100}%`,
            label: formatTimelineLabel(markerDate, view),
        };
    });
};

const ProjectGantt = ({ tasks, onTaskUpdate }) => {
    const [view, setView] = useState(VIEW_MODE.DAY);
    const [ganttTasks, setGanttTasks] = useState([]);
    const [drafts, setDrafts] = useState({});

    const sourceTasksById = useMemo(() => (
        Array.isArray(tasks)
            ? tasks.reduce((acc, task) => {
                acc[task.id] = task;
                return acc;
            }, {})
            : {}
    ), [tasks]);

    useEffect(() => {
        if (tasks && tasks.length > 0) {
            const mapped = tasks.map(normalizeTask);
            setGanttTasks(mapped);
            setDrafts(buildDraftState(mapped));
            return;
        }

        setGanttTasks([]);
        setDrafts({});
    }, [tasks]);

    const timelineBounds = useMemo(() => {
        if (!ganttTasks.length) {
            const now = new Date();
            return {
                start: new Date(now.getTime() - DAY_MS),
                end: new Date(now.getTime() + DAY_MS),
            };
        }

        const minStart = Math.min(...ganttTasks.map((task) => task.start.getTime()));
        const maxEnd = Math.max(...ganttTasks.map((task) => task.end.getTime()));
        const padding = Math.max(DAY_MS, Math.round((maxEnd - minStart) * 0.08));

        return {
            start: new Date(minStart - padding),
            end: new Date(maxEnd + padding),
        };
    }, [ganttTasks]);

    const markers = useMemo(() => buildMarkers(timelineBounds.start, timelineBounds.end, view), [timelineBounds, view]);

    const trackWidth = useMemo(() => {
        const config = VIEW_CONFIG[view];
        const units = Math.max(1, (timelineBounds.end.getTime() - timelineBounds.start.getTime()) / config.baseUnitMs);
        return Math.max(700, Math.min(config.maxWidth, Math.round(units * config.columnWidth)));
    }, [timelineBounds, view]);

    const todayLeft = useMemo(() => {
        const total = Math.max(HOUR_MS, timelineBounds.end.getTime() - timelineBounds.start.getTime());
        const offset = (Date.now() - timelineBounds.start.getTime()) / total;
        if (offset < 0 || offset > 1) return null;
        return `${offset * 100}%`;
    }, [timelineBounds]);

    const handleDraftChange = (taskId, field, value) => {
        setDrafts((prev) => ({
            ...prev,
            [taskId]: {
                ...(prev[taskId] || {}),
                [field]: value,
            },
        }));
    };

    const handleDraftReset = (taskId) => {
        const targetTask = ganttTasks.find((item) => item.id === taskId);
        if (!targetTask) return;

        setDrafts((prev) => ({
            ...prev,
            [taskId]: {
                startDate: formatDateInputValue(targetTask.start),
                deadline: formatDateInputValue(targetTask.end),
                saving: false,
            },
        }));
    };

    const handleTaskSave = async (taskId) => {
        const draft = drafts[taskId];
        const sourceTask = sourceTasksById[taskId];
        const currentTask = ganttTasks.find((item) => item.id === taskId);

        if (!draft || !sourceTask || !currentTask) return;

        if (!draft.startDate || !draft.deadline) {
            Swal.fire({
                icon: 'warning',
                title: 'Thiếu mốc thời gian',
                text: 'Vui lòng nhập đầy đủ ngày bắt đầu và ngày kết thúc.',
            });
            return;
        }

        const parsedStartDate = parseValidDate(draft.startDate);
        const parsedDeadline = parseValidDate(draft.deadline);

        if (!parsedStartDate || !parsedDeadline) {
            Swal.fire({
                icon: 'warning',
                title: 'Mốc thời gian chưa hợp lệ',
                text: 'Ngày bắt đầu hoặc ngày kết thúc không đúng định dạng.',
            });
            return;
        }

        if (parsedStartDate.getTime() > parsedDeadline.getTime()) {
            Swal.fire({
                icon: 'warning',
                title: 'Mốc thời gian chưa hợp lệ',
                text: 'Ngày bắt đầu không được sau ngày kết thúc.',
            });
            return;
        }

        const previousTasks = [...ganttTasks];
        const updatedTask = normalizeTask({
            ...sourceTask,
            startDate: draft.startDate,
            deadline: draft.deadline,
        });

        setDrafts((prev) => ({
            ...prev,
            [taskId]: {
                ...prev[taskId],
                saving: true,
            },
        }));
        setGanttTasks((prev) => prev.map((item) => (item.id === taskId ? updatedTask : item)));

        try {
            const token = localStorage.getItem('token');

            await axios.put(`/api/tasks/${taskId}/timeline`, {
                startDate: draft.startDate,
                deadline: draft.deadline,
            }, {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (onTaskUpdate) onTaskUpdate();

            setDrafts((prev) => ({
                ...prev,
                [taskId]: {
                    startDate: draft.startDate,
                    deadline: draft.deadline,
                    saving: false,
                },
            }));

            Swal.fire({
                icon: 'success',
                title: 'Đã cập nhật dòng thời gian!',
                toast: true,
                position: 'top-end',
                timer: 2000,
                showConfirmButton: false,
            });
        } catch (error) {
            setGanttTasks(previousTasks);
            setDrafts((prev) => ({
                ...prev,
                [taskId]: {
                    ...(prev[taskId] || {}),
                    saving: false,
                },
            }));

            Swal.fire({
                icon: 'error',
                title: 'Lỗi đồng bộ!',
                text: error.response?.data || 'Không thể cập nhật dòng thời gian.',
            });
        }
    };

    if (!ganttTasks || ganttTasks.length === 0) {
        return (
            <div className="workflow-empty mb-4">
                <i className="bi bi-calendar-x fs-2 d-block mb-2"></i>
                Không có dữ liệu công việc để hiển thị Gantt Chart.
            </div>
        );
    }

    return (
        <>
            <style>{`
                .gantt-fallback-toolbar {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 16px;
                    flex-wrap: wrap;
                }

                .gantt-fallback-overview {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 10px 16px;
                    color: #6c7f95;
                    font-size: 0.86rem;
                }

                .gantt-fallback-viewport {
                    overflow-x: auto;
                    padding-bottom: 8px;
                }

                .gantt-fallback-viewport::-webkit-scrollbar {
                    height: 8px;
                }

                .gantt-fallback-viewport::-webkit-scrollbar-thumb {
                    background: #c7d3df;
                    border-radius: 999px;
                }

                .gantt-fallback-canvas {
                    min-width: fit-content;
                }

                .gantt-fallback-header,
                .gantt-fallback-item {
                    display: grid;
                    grid-template-columns: minmax(280px, 340px) auto;
                    gap: 16px;
                }

                .gantt-fallback-header {
                    align-items: end;
                    margin-bottom: 12px;
                }

                .gantt-fallback-side-label {
                    color: #6c7f95;
                    font-size: 0.72rem;
                    font-weight: 800;
                    letter-spacing: 0.08em;
                    text-transform: uppercase;
                }

                .gantt-fallback-ruler,
                .gantt-fallback-track {
                    position: relative;
                    width: 100%;
                    overflow: hidden;
                    border-radius: 18px;
                    border: 1px solid rgba(217, 227, 238, 0.92);
                    background: linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(244, 248, 252, 0.96) 100%);
                }

                .gantt-fallback-ruler {
                    height: 60px;
                }

                .gantt-fallback-track {
                    min-height: 132px;
                }

                .gantt-fallback-grid-line {
                    position: absolute;
                    top: 0;
                    bottom: 0;
                    width: 1px;
                    background: rgba(199, 211, 223, 0.85);
                }

                .gantt-fallback-grid-line:first-child {
                    left: 0 !important;
                }

                .gantt-fallback-marker {
                    position: absolute;
                    top: 10px;
                    transform: translateX(-50%);
                    color: #6c7f95;
                    font-size: 0.72rem;
                    font-weight: 700;
                    white-space: nowrap;
                }

                .gantt-fallback-today {
                    position: absolute;
                    top: 0;
                    bottom: 0;
                    width: 2px;
                    background: rgba(29, 111, 163, 0.45);
                    box-shadow: 0 0 0 1px rgba(29, 111, 163, 0.08);
                }

                .gantt-fallback-today-chip {
                    position: absolute;
                    top: 8px;
                    transform: translateX(-50%);
                    padding: 4px 8px;
                    border-radius: 999px;
                    background: #1d6fa3;
                    color: #ffffff;
                    font-size: 0.68rem;
                    font-weight: 800;
                    letter-spacing: 0.04em;
                    box-shadow: 0 6px 18px rgba(29, 111, 163, 0.2);
                }

                .gantt-fallback-track-fill {
                    position: absolute;
                    top: 50%;
                    transform: translateY(-50%);
                    height: 18px;
                    min-width: 12px;
                    border-radius: 999px;
                    box-shadow: 0 10px 20px rgba(15, 37, 64, 0.16);
                }

                .gantt-fallback-track-fill::after {
                    content: '';
                    position: absolute;
                    inset: 0;
                    border-radius: inherit;
                    background: linear-gradient(90deg, rgba(255, 255, 255, 0.16) 0%, rgba(255, 255, 255, 0.02) 100%);
                }

                .gantt-fallback-track-label {
                    position: absolute;
                    left: 12px;
                    bottom: 12px;
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    color: #4f6278;
                    font-size: 0.78rem;
                    font-weight: 700;
                }

                .gantt-fallback-color-dot {
                    width: 10px;
                    height: 10px;
                    border-radius: 999px;
                    flex: 0 0 auto;
                }

                .gantt-fallback-progress {
                    background: linear-gradient(135deg, #1d6fa3 0%, #2a9df4 100%);
                }

                .gantt-fallback-form {
                    display: grid;
                    grid-template-columns: repeat(2, minmax(0, 1fr)) auto auto;
                    gap: 10px;
                    align-items: end;
                    margin-top: 14px;
                }

                .gantt-fallback-field {
                    min-width: 0;
                }

                .gantt-fallback-field input {
                    min-width: 0;
                }

                .gantt-fallback-legend {
                    display: flex;
                    justify-content: center;
                    flex-wrap: wrap;
                    gap: 14px 22px;
                    padding-top: 2px;
                }

                .gantt-fallback-legend-item {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    color: #4f6278;
                    font-size: 0.8rem;
                    font-weight: 700;
                }

                @media (max-width: 991.98px) {
                    .gantt-fallback-header,
                    .gantt-fallback-item {
                        grid-template-columns: 1fr;
                    }

                    .gantt-fallback-track {
                        min-height: 96px;
                    }
                }

                @media (max-width: 767.98px) {
                    .gantt-fallback-form {
                        grid-template-columns: 1fr;
                    }
                }
            `}</style>

            <div className="workflow-stack">
                <div className="gantt-fallback-toolbar">
                    <div className="gantt-fallback-overview">
                        <span><strong>{ganttTasks.length}</strong> công việc trong dòng thời gian</span>
                        <span>{formatDisplayDate(timelineBounds.start)} - {formatDisplayDate(timelineBounds.end)}</span>
                        <span>Cập nhật mốc bằng ngày bắt đầu và deadline rõ ràng</span>
                    </div>

                    <div className="gantt-view-selector" aria-label="Chế độ xem dòng thời gian">
                        {VIEW_OPTIONS.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                className={`gantt-view-btn ${view === option.value ? 'active' : ''}`}
                                onClick={() => setView(option.value)}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="gantt-container-custom">
                    <div className="workflow-panel-body p-3 p-md-4">
                        <div className="gantt-fallback-viewport">
                            <div className="gantt-fallback-canvas" style={{ minWidth: `${trackWidth + 356}px` }}>
                                <div className="gantt-fallback-header">
                                    <div className="gantt-fallback-side-label">Danh sách công việc</div>

                                    <div className="gantt-fallback-ruler" style={{ width: `${trackWidth}px` }}>
                                        {markers.map((marker) => (
                                            <React.Fragment key={marker.key}>
                                                <span className="gantt-fallback-grid-line" style={{ left: marker.left }}></span>
                                                <span className="gantt-fallback-marker" style={{ left: marker.left }}>{marker.label}</span>
                                            </React.Fragment>
                                        ))}
                                        {todayLeft ? (
                                            <>
                                                <span className="gantt-fallback-today" style={{ left: todayLeft }}></span>
                                                <span className="gantt-fallback-today-chip" style={{ left: todayLeft }}>Hôm nay</span>
                                            </>
                                        ) : null}
                                    </div>
                                </div>

                                <div className="workflow-list">
                                    {ganttTasks.map((task) => {
                                        const totalDuration = Math.max(HOUR_MS, timelineBounds.end.getTime() - timelineBounds.start.getTime());
                                        const left = ((task.start.getTime() - timelineBounds.start.getTime()) / totalDuration) * 100;
                                        const width = Math.max(1.5, ((task.end.getTime() - task.start.getTime()) / totalDuration) * 100);
                                        const draft = drafts[task.id] || { startDate: '', deadline: '', saving: false };
                                        const isDirty = draft.startDate !== formatDateInputValue(task.start) || draft.deadline !== formatDateInputValue(task.end);

                                        return (
                                            <article key={task.id} className="workflow-item gantt-fallback-item">
                                                <div>
                                                    <div className="workflow-item-head">
                                                        <div style={{ flex: 1 }}>
                                                            <h4 className="workflow-item-title">{task.name}</h4>
                                                            <p className="workflow-item-copy">{task.project}</p>
                                                        </div>

                                                        <span
                                                            className="workflow-pill"
                                                            style={{
                                                                color: task.color,
                                                                background: toRgba(task.color, 0.12),
                                                                border: `1px solid ${toRgba(task.color, 0.2)}`,
                                                            }}
                                                        >
                                                            {task.priorityLabel}
                                                        </span>
                                                    </div>

                                                        <div className="workflow-meta-grid">
                                                            <div>
                                                                <span className="workflow-meta-label">Bắt đầu</span>
                                                                <div className="workflow-meta-value">{formatDisplayDate(task.start)}</div>
                                                            </div>
                                                            <div>
                                                                <span className="workflow-meta-label">Kết thúc</span>
                                                                <div className="workflow-meta-value">{formatDisplayDate(task.end)}</div>
                                                            </div>
                                                            <div>
                                                                <span className="workflow-meta-label">Thời lượng</span>
                                                                <div className="workflow-meta-value">{formatDuration(task.start, task.end)}</div>
                                                            </div>
                                                            <div>
                                                                <span className="workflow-meta-label">Tiến độ</span>
                                                                <div className="workflow-meta-value">{task.progress}%</div>
                                                            </div>
                                                        </div>

                                                    <div className="workflow-progress-track">
                                                        <div className="workflow-progress-bar gantt-fallback-progress" style={{ width: `${task.progress}%` }}></div>
                                                    </div>

                                                    <div className="gantt-fallback-form">
                                                        <label className="gantt-fallback-field">
                                                            <span className="workflow-meta-label">Ngày bắt đầu</span>
                                                            <input
                                                                type="date"
                                                                className="form-control modern-input mt-2"
                                                                value={draft.startDate}
                                                                onChange={(event) => handleDraftChange(task.id, 'startDate', event.target.value)}
                                                            />
                                                        </label>

                                                        <label className="gantt-fallback-field">
                                                            <span className="workflow-meta-label">Deadline</span>
                                                            <input
                                                                type="date"
                                                                className="form-control modern-input mt-2"
                                                                value={draft.deadline}
                                                                onChange={(event) => handleDraftChange(task.id, 'deadline', event.target.value)}
                                                            />
                                                        </label>

                                                        <button
                                                            type="button"
                                                            className="btn btn-primary btn-sm"
                                                            disabled={draft.saving || !isDirty}
                                                            onClick={() => handleTaskSave(task.id)}
                                                        >
                                                            {draft.saving ? 'Đang lưu...' : 'Lưu mốc'}
                                                        </button>

                                                        <button
                                                            type="button"
                                                            className="btn btn-light btn-sm border"
                                                            disabled={draft.saving || !isDirty}
                                                            onClick={() => handleDraftReset(task.id)}
                                                        >
                                                            Đặt lại
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="gantt-fallback-track" style={{ width: `${trackWidth}px` }}>
                                                    {markers.map((marker) => (
                                                        <span key={`line-${task.id}-${marker.key}`} className="gantt-fallback-grid-line" style={{ left: marker.left }}></span>
                                                    ))}

                                                    {todayLeft ? <span className="gantt-fallback-today" style={{ left: todayLeft }}></span> : null}

                                                    <span
                                                        className="gantt-fallback-track-fill"
                                                        style={{
                                                            left: `${left}%`,
                                                            width: `${width}%`,
                                                            background: `linear-gradient(135deg, ${task.color} 0%, ${toRgba(task.color, 0.78)} 100%)`,
                                                        }}
                                                    ></span>

                                                    <div className="gantt-fallback-track-label">
                                                        <span className="gantt-fallback-color-dot" style={{ background: task.color }}></span>
                                                        <span>{formatDisplayDate(task.start)} - {formatDisplayDate(task.end)}</span>
                                                    </div>
                                                </div>
                                            </article>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="gantt-fallback-legend">
                    {Object.values({
                        CRITICAL: PRIORITY_META.CRITICAL,
                        HIGH: PRIORITY_META.HIGH,
                        MEDIUM: PRIORITY_META.MEDIUM,
                        LOW: PRIORITY_META.LOW,
                    }).map((item) => (
                        <div key={item.label} className="gantt-fallback-legend-item">
                            <span className="gantt-fallback-color-dot" style={{ background: item.color }}></span>
                            <span>{item.label}</span>
                        </div>
                    ))}
                </div>
            </div>
        </>
    );
};

export default ProjectGantt;
