import React, { useEffect, useMemo, useState, useRef } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';

const VIEW_MODE = {
    DAY: 'DAY',
    WEEK: 'WEEK',
    MONTH: 'MONTH',
};

const VIEW_OPTIONS = [
    { value: VIEW_MODE.DAY, label: 'Ngày' },
    { value: VIEW_MODE.WEEK, label: 'Tuần' },
    { value: VIEW_MODE.MONTH, label: 'Tháng' },
];

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
const MONTH_MS = 30 * DAY_MS;

const parseValidDate = (value) => {
    if (!value) return null;
    const parsed = value instanceof Date ? new Date(value.getTime()) : new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const PRIORITY_META = {
    CRITICAL: { label: 'Khẩn cấp', color: '#e11d48', bg: 'rgba(225, 29, 72, 0.1)' },
    HIGH: { label: 'Cao', color: '#f43f5e', bg: 'rgba(244, 63, 94, 0.1)' },
    MEDIUM: { label: 'Trung bình', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
    LOW: { label: 'Thấp', color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' },
    DEFAULT: { label: 'Thấp', color: '#64748b', bg: 'rgba(100, 116, 139, 0.1)' },
};

const VIEW_CONFIG = {
    [VIEW_MODE.DAY]: { unitMs: DAY_MS, colWidth: 120, labelFormat: 'DD/MM' },
    [VIEW_MODE.WEEK]: { unitMs: WEEK_MS, colWidth: 180, labelFormat: 'Tuần DD/MM' },
    [VIEW_MODE.MONTH]: { unitMs: MONTH_MS, colWidth: 240, labelFormat: 'MM/YYYY' },
};

const formatDisplayDate = (date) => {
    if (!date) return '--';
    return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const formatDateInput = (date) => {
    if (!date) return '';
    try {
        const d = new Date(date);
        return d.toISOString().split('T')[0];
    } catch (e) {
        return '';
    }
};

const ProjectGantt = ({ tasks, onTaskUpdate }) => {
    const [view, setView] = useState(VIEW_MODE.DAY);
    const [editingTaskId, setEditingTaskId] = useState(null);
    const [editData, setEditData] = useState({ start: '', end: '', saving: false });
    const timelineRef = useRef(null);


    // Normalize and group tasks
    const groupedTasks = useMemo(() => {
        if (!Array.isArray(tasks)) return {};
        
        const normalized = tasks.map(t => {
            const start = parseValidDate(t.startDate) || parseValidDate(t.project?.createdDate) || new Date();
            const end = parseValidDate(t.deadline) || new Date(start.getTime() + DAY_MS);
            return {
                ...t,
                start,
                end,
                durationDays: Math.ceil((end - start) / DAY_MS),
                priorityMeta: PRIORITY_META[t.priority] || PRIORITY_META.DEFAULT
            };
        });

        const sorted = [...normalized].sort((a, b) => a.start - b.start);

        return sorted.reduce((acc, task) => {
            const projectName = task.project?.name || 'Dự án khác';
            if (!acc[projectName]) acc[projectName] = [];
            acc[projectName].push(task);
            return acc;
        }, {});
    }, [tasks]);

    // Calculate timeline bounds
    const bounds = useMemo(() => {
        const allTasks = Object.values(groupedTasks).flat();
        if (allTasks.length === 0) {
            const now = new Date();
            return { start: new Date(now.getTime() - DAY_MS), end: new Date(now.getTime() + 7 * DAY_MS) };
        }

        const minStart = new Date(Math.min(...allTasks.map(t => t.start.getTime())));
        const maxEnd = new Date(Math.max(...allTasks.map(t => t.end.getTime())));
        
        // Add padding
        const start = new Date(minStart.getTime() - 2 * DAY_MS);
        const end = new Date(maxEnd.getTime() + 5 * DAY_MS);
        return { start, end };
    }, [groupedTasks]);

    // Generate markers
    const markers = useMemo(() => {
        const list = [];
        const config = VIEW_CONFIG[view];
        let current = new Date(bounds.start);
        
        while (current <= bounds.end) {
            list.push(new Date(current));
            current = new Date(current.getTime() + config.unitMs);
        }
        return list;
    }, [bounds, view]);

    // Auto-scroll to today
    useEffect(() => {
        if (!timelineRef.current) return;
        
        const now = new Date();
        if (now >= bounds.start && now <= bounds.end) {
            const container = timelineRef.current;
            const timelineWidth = markers.length * VIEW_CONFIG[view].colWidth;
            
            // Calculate relative position of today
            const todayOffset = (now - bounds.start) / (bounds.end - bounds.start);
            const scrollPos = (todayOffset * timelineWidth) - (container.clientWidth / 2);
            
            container.scrollTo({
                left: Math.max(0, scrollPos),
                behavior: 'smooth'
            });
        }
    }, [bounds, view, markers.length]);

    const totalDuration = bounds.end - bounds.start;

    const handleEditClick = (task) => {
        setEditingTaskId(task.id);
        setEditData({
            start: formatDateInput(task.start),
            end: formatDateInput(task.end),
            saving: false
        });
    };

    const handleSave = async (taskId) => {
        try {
            setEditData(prev => ({ ...prev, saving: true }));
            const token = localStorage.getItem('token');
            await axios.put(`/api/tasks/${taskId}`, {
                startDate: editData.start,
                deadline: editData.end
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            setEditingTaskId(null);
            if (onTaskUpdate) onTaskUpdate();
            
            Swal.fire({
                icon: 'success',
                title: 'Đã cập nhật!',
                toast: true,
                position: 'top-end',
                timer: 2000,
                showConfirmButton: false
            });
        } catch (err) {
            Swal.fire({
                icon: 'error',
                title: 'Lỗi cập nhật',
                text: err.response?.data?.message || err.message
            });
        } finally {
            setEditData(prev => ({ ...prev, saving: false }));
        }
    };

    if (!tasks || tasks.length === 0) {
        return <div className="p-5 text-center text-muted">Không có dữ liệu công việc.</div>;
    }

    return (
        <div className="gantt-redesign-container">
            <style>{`
                .gantt-redesign-container {
                    --sidebar-width: 280px;
                    --header-height: 50px;
                    --row-height: 60px;
                    --border-color: #e2e8f0;
                    --primary-color: #2563eb;
                    --bg-soft: #f8fafc;
                    display: flex;
                    flex-direction: column;
                    background: white;
                    border-radius: 1rem;
                    overflow: hidden;
                    border: 1px solid var(--border-color);
                    box-shadow: 0 4px 20px rgba(0,0,0,0.05);
                    font-family: inherit;
                        margin-bottom: 2rem;
                }

                .gantt-toolbar {
                    padding: 1rem 1.5rem;
                    border-bottom: 1px solid var(--border-color);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    background: #ffffff;
                }

                .gantt-main {
                    display: flex;
                    position: relative;
                    overflow: hidden;
                    background: #fff;
                    padding-top: 30px;
                }

                .gantt-sidebar {
                    width: var(--sidebar-width);
                    flex-shrink: 0;
                    border-right: 1px solid var(--border-color);
                    background: white;
                    z-index: 10;
                    box-shadow: 4px 0 10px rgba(0,0,0,0.02);
                }

                .gantt-timeline-view {
                    flex-grow: 1;
                    overflow-x: auto;
                    position: relative;
                        background: #fff;
                }

                .gantt-header-row {
                    height: var(--header-height);
                    display: flex;
                    border-bottom: 1px solid var(--border-color);
                    background: var(--bg-soft);
                }

                .gantt-sidebar-header {
                    width: var(--sidebar-width);
                    height: var(--header-height);
                    padding: 0 1.5rem;
                    display: flex;
                    align-items: center;
                    font-weight: 700;
                    font-size: 0.8rem;
                    color: #94a3b8;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                        border-bottom: 1px solid var(--border-color);
                }

                .gantt-timeline-header {
                    position: relative;
                    height: var(--header-height);
                        background: var(--bg-soft);
                        border-bottom: 1px solid var(--border-color);
                }

                .gantt-marker {
                    position: absolute;
                    top: 0;
                    height: 100%;
                    border-left: 1px solid var(--border-color);
                    padding-left: 0.75rem;
                    display: flex;
                    align-items: center;
                    font-size: 0.75rem;
                    font-weight: 600;
                    color: #64748b;
                    white-space: nowrap;
                }

                .gantt-project-group {
                    border-bottom: 1px solid var(--border-color);
                }

                .gantt-project-header {
                    background: #f8fafc;
                    height: 36px;
                    display: flex;
                    align-items: center;
                    padding: 0 1.25rem;
                    font-weight: 800;
                    font-size: 0.75rem;
                    color: #475569;
                    border-bottom: 1px solid var(--border-color);
                        text-transform: uppercase;
                        letter-spacing: 0.02em;
                }

                .gantt-task-row {
                    height: var(--row-height);
                    display: flex;
                    border-bottom: 1px solid #f8fafc;
                    transition: background 0.15s;
                }

                .gantt-task-row:hover {
                    background: #fdfdfd;
                }

                .gantt-sidebar-cell {
                    width: var(--sidebar-width);
                    padding: 0.5rem 1.25rem;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    gap: 0.15rem;
                    overflow: hidden;
                }

                .gantt-task-title {
                    font-weight: 600;
                    font-size: 0.85rem;
                    color: #1e293b;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .gantt-task-meta {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    font-size: 0.7rem;
                    color: #94a3b8;
                }

                .gantt-timeline-cell {
                    position: relative;
                    flex-grow: 1;
                        min-height: var(--row-height);
                }

                .gantt-bar-container {
                    position: absolute;
                    top: 50%;
                    transform: translateY(-50%);
                    height: 28px;
                    border-radius: 14px;
                    display: flex;
                    align-items: center;
                    padding: 0 0.85rem;
                    color: white;
                    font-size: 0.68rem;
                    font-weight: 800;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.12);
                    cursor: pointer;
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                    overflow: visible;
                }

                .gantt-bar-container:hover {
                    transform: translateY(-50%) scale(1.03);
                    box-shadow: 0 8px 20px rgba(0,0,0,0.2);
                    z-index: 50;
                }

                .gantt-bar-progress {
                    position: absolute;
                    left: 0;
                    top: 0;
                    bottom: 0;
                    background: rgba(255, 255, 255, 0.25);
                    z-index: 1;
                    border-radius: inherit;
                    box-shadow: inset 0 1px 2px rgba(255, 255, 255, 0.3);
                }

                .gantt-bar-content {
                    position: relative;
                    z-index: 2;
                    display: flex;
                    align-items: center;
                    gap: 0.25rem;
                    width: 100%;
                    white-space: nowrap;
                }

                .gantt-today-line {
                    position: absolute;
                    top: 0;
                    bottom: 0;
                    width: 2px;
                    background: linear-gradient(to bottom, #f43f5e, rgba(244, 63, 94, 0.1));
                    z-index: 50;
                    pointer-events: none;
                }

                .gantt-today-line::after {
                    content: 'Hôm nay';
                    position: absolute;
                    top: -24px;
                    left: 50%;
                    transform: translateX(-50%);
                    background: #f43f5e;
                    color: white;
                    padding: 3px 10px;
                    border-radius: 999px;
                    font-size: 0.65rem;
                    font-weight: 800;
                    white-space: nowrap;
                    box-shadow: 0 4px 10px rgba(244, 63, 94, 0.3);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    z-index: 60;
                }

                .edit-popover {
                    position: absolute;
                    background: white;
                    border: 1px solid var(--border-color);
                    border-radius: 0.75rem;
                    padding: 1rem;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.15);
                    z-index: 1000;
                    width: 240px;
                    top: 100%;
                    left: 0;
                        margin-top: 8px;
                }

                .view-picker {
                    display: flex;
                    background: #f1f5f9;
                    padding: 2px;
                    border-radius: 6px;
                }

                .view-btn {
                    border: none;
                    background: none;
                    padding: 4px 12px;
                    border-radius: 4px;
                    font-size: 0.75rem;
                    font-weight: 700;
                    color: #94a3b8;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .view-btn.active {
                    background: white;
                    color: #0f172a;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                }

                .workflow-meta-label {
                    display: block;
                    font-size: 0.65rem;
                    font-weight: 800;
                    color: #94a3b8;
                    text-transform: uppercase;
                    margin-bottom: 2px;
                }
                    
                .modern-input {
                    font-size: 0.8rem;
                    padding: 4px 8px;
                    border-radius: 6px;
                }
            `}</style>

            <div className="gantt-toolbar">
                <div className="d-flex align-items-center gap-3">
                    <h5 className="mb-0 fw-bold text-dark" style={{ fontSize: '1rem' }}>Gantt Timeline</h5>
                    <div className="d-flex gap-2">
                        <span className="badge bg-light text-dark border rounded-pill px-3 py-1 small fw-bold">
                            {tasks.length} Công việc
                        </span>
                    </div>
                </div>
                <div className="view-picker">
                    {VIEW_OPTIONS.map(opt => (
                        <button 
                            key={opt.value}
                            className={`view-btn ${view === opt.value ? 'active' : ''}`}
                            onClick={() => setView(opt.value)}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="gantt-main">
                <div className="gantt-sidebar">
                    <div className="gantt-sidebar-header">Danh sách Công việc</div>
                    {Object.entries(groupedTasks).map(([projectName, projectTasks]) => (
                        <div key={projectName} className="gantt-project-group">
                            <div className="gantt-project-header">
                                <i className="bi bi-collection-fill me-2 opacity-50"></i>
                                {projectName}
                            </div>
                            {projectTasks.map(task => (
                                <div key={task.id} className="gantt-task-row">
                                    <div className="gantt-sidebar-cell">
                                        <div className="gantt-task-title" title={task.title}>{task.title}</div>
                                        <div className="gantt-task-meta">
                                            <span style={{ color: task.priorityMeta.color, fontWeight: 800 }}>
                                                {task.priorityMeta.label}
                                            </span>
                                            <span className="opacity-50">|</span>
                                            <span>{task.completionPercentage}%</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>

                <div className="gantt-timeline-view" ref={timelineRef}>
                    <div className="gantt-timeline-header" style={{ width: markers.length * VIEW_CONFIG[view].colWidth }}>
                        {markers.map((marker, idx) => (
                            <div 
                                key={marker.getTime()} 
                                className="gantt-marker"
                                style={{ left: idx * VIEW_CONFIG[view].colWidth, width: VIEW_CONFIG[view].colWidth }}
                            >
                                {marker.toLocaleDateString('vi-VN', { 
                                    day: view === VIEW_MODE.MONTH ? undefined : '2-digit', 
                                    month: '2-digit',
                                    year: view === VIEW_MODE.MONTH ? 'numeric' : undefined 
                                })}
                            </div>
                        ))}
                        {(() => {
                            const now = new Date();
                            if (now >= bounds.start && now <= bounds.end) {
                                const left = ((now - bounds.start) / totalDuration) * 100;
                                return <div className="gantt-today-line" style={{ left: `${left}%` }}></div>;
                            }
                            return null;
                        })()}
                    </div>

                    {Object.entries(groupedTasks).map(([projectName, projectTasks]) => (
                        <div key={`timeline-${projectName}`} className="gantt-project-group">
                            <div className="gantt-project-header" style={{ width: markers.length * VIEW_CONFIG[view].colWidth }}></div>
                            {projectTasks.map(task => {
                                const startPos = ((task.start - bounds.start) / totalDuration) * 100;
                                const width = ((task.end - task.start) / totalDuration) * 100;
                                
                                return (
                                    <div key={`track-${task.id}`} className="gantt-task-row" style={{ width: markers.length * VIEW_CONFIG[view].colWidth }}>
                                        <div className="gantt-timeline-cell w-100">
                                            {markers.map((_, idx) => (
                                                <div 
                                                    key={`grid-${idx}`} 
                                                    className="position-absolute h-100 border-start" 
                                                    style={{ left: idx * VIEW_CONFIG[view].colWidth, opacity: 0.1, borderColor: '#000' }}
                                                ></div>
                                            ))}
                                            
                                            <div 
                                                className="gantt-bar-container"
                                                style={{ 
                                                    left: `${startPos}%`, 
                                                    width: `${Math.max(1, width)}%`,
                                                    backgroundColor: task.priorityMeta.color
                                                }}
                                                onClick={() => handleEditClick(task)}
                                            >
                                                <div className="gantt-bar-progress" style={{ width: `${task.completionPercentage}%` }}></div>
                                                <div className="gantt-bar-content">
                                                    <span>{task.completionPercentage}%</span>
                                                </div>

                                                {editingTaskId === task.id && (
                                                    <div className="edit-popover" onClick={e => e.stopPropagation()}>
                                                        <div className="d-flex justify-content-between align-items-center mb-2">
                                                            <h6 className="fw-bold mb-0 small" style={{ color: '#0f172a' }}>Cập nhật hạn chót</h6>
                                                            <button className="btn-close" style={{ fontSize: '0.6rem' }} onClick={() => setEditingTaskId(null)}></button>
                                                        </div>
                                                        <div className="mb-2">
                                                            <label className="workflow-meta-label">Bắt đầu</label>
                                                            <input 
                                                                type="date" 
                                                                className="form-control form-control-sm modern-input" 
                                                                value={editData.start}
                                                                onChange={e => setEditData(prev => ({ ...prev, start: e.target.value }))}
                                                            />
                                                        </div>
                                                        <div className="mb-3">
                                                            <label className="workflow-meta-label">Deadline</label>
                                                            <input 
                                                                type="date" 
                                                                className="form-control form-control-sm modern-input" 
                                                                value={editData.end}
                                                                onChange={e => setEditData(prev => ({ ...prev, end: e.target.value }))}
                                                            />
                                                        </div>
                                                        <div className="d-flex gap-2">
                                                            <button 
                                                                className="btn btn-primary btn-sm flex-grow-1 fw-bold"
                                                                onClick={() => handleSave(task.id)}
                                                                disabled={editData.saving}
                                                                style={{ fontSize: '0.75rem' }}
                                                            >
                                                                {editData.saving ? '...' : 'Lưu'}
                                                            </button>
                                                            <button 
                                                                className="btn btn-light btn-sm border fw-bold"
                                                                onClick={() => setEditingTaskId(null)}
                                                                style={{ fontSize: '0.75rem' }}
                                                            >
                                                                Hủy
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default ProjectGantt;
