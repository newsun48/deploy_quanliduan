import React, { useState, useEffect, useRef } from 'react';
import { Gantt, ViewMode } from 'gantt-task-react';
import "gantt-task-react/dist/index.css";
import axios from 'axios';
import Swal from 'sweetalert2';

const ProjectGantt = ({ tasks, onTaskUpdate }) => {
    const [view, setView] = useState(ViewMode.Day);
    const [ganttTasks, setGanttTasks] = useState([]);
    const scrollContainerRef = useRef(null);

    useEffect(() => {
        if (tasks && tasks.length > 0) {
            const mapped = tasks.map(t => {
                // Đảm bảo có ngày bắt đầu hợp lệ
                let start = t.startDate ? new Date(t.startDate) : null;
                if (!start || isNaN(start.getTime())) {
                    if (t.project && t.project.createdDate) {
                        start = new Date(t.project.createdDate);
                    } else {
                        start = new Date();
                    }
                }

                // Đảm bảo có ngày kết thúc (deadline) hợp lệ
                let end = t.deadline ? new Date(t.deadline) : null;
                if (!end || isNaN(end.getTime())) {
                    end = new Date(start.getTime() + 86400000);
                }

                // Ràng buộc logic: start không thể sau end
                if (start.getTime() > end.getTime()) {
                    end = new Date(start.getTime() + 3600000); // +1 hour
                }

                // Chọn màu dựa trên Priority
                let barColor = "#3b82f6"; // Low (Default)
                
                if (t.priority === 'CRITICAL') { barColor = "#be123c"; }
                else if (t.priority === 'HIGH') { barColor = "#ef4444"; }
                else if (t.priority === 'MEDIUM') { barColor = "#f59e0b"; }

                return {
                    start,
                    end,
                    name: t.title || "Task không tiêu đề",
                    id: t.id,
                    type: 'task',
                    progress: t.completionPercentage || 0,
                    isDisabled: false,
                    project: t.project?.name || "N/A",
                    styles: { 
                        backgroundColor: barColor, 
                        progressColor: "rgba(255,255,255,0.3)",
                        backgroundSelectedColor: barColor,
                        progressSelectedColor: "rgba(255,255,255,0.4)",
                    },
                };
            });
            setGanttTasks(mapped);
        } else {
            setGanttTasks([]);
        }
    }, [tasks]);

    // Auto-scroll to today logic
    useEffect(() => {
        if (ganttTasks.length > 0 && scrollContainerRef.current) {
            const timer = setTimeout(() => {
                const today = new Date();
                const minStartDate = new Date(Math.min(...ganttTasks.map(t => t.start.getTime())));
                
                let colWidth = 60; // Default for Day
                let unitMs = 24 * 60 * 60 * 1000; // Default for Day

                if (view === ViewMode.Hour) {
                    colWidth = 40;
                    unitMs = 60 * 60 * 1000;
                } else if (view === ViewMode.Week) {
                    colWidth = 200;
                    unitMs = 7 * 24 * 60 * 60 * 1000;
                } else if (view === ViewMode.Month) {
                    colWidth = 100;
                    unitMs = 30 * 24 * 60 * 60 * 1000;
                }

                const diff = today.getTime() - minStartDate.getTime();
                const units = diff / unitMs;
                
                // Adjust scroll position with some padding (300px to show some previous context)
                const scrollLeft = Math.max(0, (units * colWidth) - 300);
                
                const scrollableElement = scrollContainerRef.current.querySelector('svg')?.parentElement;
                if (scrollableElement) {
                    scrollableElement.scrollLeft = scrollLeft;
                }
            }, 150); // Small delay to ensure library internal render finished
            return () => clearTimeout(timer);
        }
    }, [ganttTasks, view]);

    const handleTaskChange = async (task) => {
        const oldGanttTasks = [...ganttTasks];
        setGanttTasks(ganttTasks.map(t => (t.id === task.id ? task : t)));

        try {
            const token = localStorage.getItem('token');
            const startDateStr = task.start.toISOString().split('T')[0];
            const deadlineStr = task.end.toISOString().split('T')[0];

            await axios.put(`/api/tasks/${task.id}/timeline`, {
                startDate: startDateStr,
                deadline: deadlineStr
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (onTaskUpdate) onTaskUpdate();
            
            Swal.fire({
                icon: 'success',
                title: 'Đã cập nhật dòng thời gian!',
                toast: true,
                position: 'top-end',
                timer: 2000,
                showConfirmButton: false
            });
        } catch (error) {
            setGanttTasks(oldGanttTasks);
            Swal.fire({
                icon: 'error',
                title: 'Lỗi đồng bộ!',
                text: error.response?.data || "Không thể cập nhật dòng thời gian.",
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
        <div className="workflow-panel mb-5">
            <div className="workflow-panel-header">
                <div style={{ flex: 1 }}>
                    <h3 className="workflow-panel-title">📅 Project Gantt Timeline</h3>
                    <p className="workflow-panel-copy">
                        Quản lý lộ trình dự án trực quan. Bạn có thể kéo thả các thanh để điều chỉnh thời gian bắt đầu và kết thúc của task.
                    </p>
                </div>
                <div className="gantt-view-selector ms-3">
                    <button 
                        className={`gantt-view-btn ${view === ViewMode.Hour ? 'active' : ''}`} 
                        onClick={() => setView(ViewMode.Hour)}
                    >
                        Giờ
                    </button>
                    <button 
                        className={`gantt-view-btn ${view === ViewMode.Day ? 'active' : ''}`} 
                        onClick={() => setView(ViewMode.Day)}
                    >
                        Ngày
                    </button>
                    <button 
                        className={`gantt-view-btn ${view === ViewMode.Week ? 'active' : ''}`} 
                        onClick={() => setView(ViewMode.Week)}
                    >
                        Tuần
                    </button>
                    <button 
                        className={`gantt-view-btn ${view === ViewMode.Month ? 'active' : ''}`} 
                        onClick={() => setView(ViewMode.Month)}
                    >
                        Tháng
                    </button>
                </div>
            </div>
            
            <div className="workflow-panel-body p-0" ref={scrollContainerRef}>
                <div className="gantt-container-custom">
                    <div style={{ overflowX: 'auto' }}>
                        <Gantt 
                            tasks={ganttTasks} 
                            viewMode={view} 
                            onDateChange={handleTaskChange}
                            listCellWidth="180px"
                            columnWidth={view === ViewMode.Day ? 60 : view === ViewMode.Week ? 200 : view === ViewMode.Hour ? 40 : 100}
                            barFill={85}
                            barCornerRadius={8}
                            fontFamily="inherit"
                            fontSize="0.8rem"
                            headerHeight={50}
                            rowHeight={45}
                        />
                    </div>
                </div>
                <div className="p-3 bg-light-subtle border-top">
                    <div className="d-flex gap-4 justify-content-center">
                        <div className="d-flex align-items-center gap-2 small fw-bold">
                            <span className="rounded-circle" style={{ width: 10, height: 10, background: "#be123c" }}></span> Khẩn cấp
                        </div>
                        <div className="d-flex align-items-center gap-2 small fw-bold">
                            <span className="rounded-circle" style={{ width: 10, height: 10, background: "#ef4444" }}></span> Cao
                        </div>
                        <div className="d-flex align-items-center gap-2 small fw-bold">
                            <span className="rounded-circle" style={{ width: 10, height: 10, background: "#f59e0b" }}></span> Trung bình
                        </div>
                        <div className="d-flex align-items-center gap-2 small fw-bold">
                            <span className="rounded-circle" style={{ width: 10, height: 10, background: "#3b82f6" }}></span> Thấp
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProjectGantt;

