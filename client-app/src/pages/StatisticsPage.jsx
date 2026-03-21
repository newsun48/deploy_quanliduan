import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import api from '../api';
import { useNavigate } from 'react-router-dom';
import NotificationBell from '../components/NotificationBell';

const COLORS_STATUS = ['#6c757d', '#0d6efd', '#198754'];
const COLORS_PRIORITY = ['#dc3545', '#ffc107', '#17a2b8'];

const StatisticsPage = () => {
    const navigate = useNavigate();
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchStatistics();
    }, []);

    const fetchStatistics = async () => {
        try {
            const res = await api.get('/tasks/statistics');
            setStats(res.data);
        } catch (err) {
            console.error("Lỗi tải thống kê:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        navigate('/');
    };

    if (loading) {
        return (
            <div className="min-vh-100 d-flex align-items-center justify-content-center bg-light">
                <div className="text-center">
                    <div className="spinner-border text-primary mb-3" role="status"></div>
                    <p>Đang tải dữ liệu...</p>
                </div>
            </div>
        );
    }

    if (!stats) {
        return (
            <div className="min-vh-100 d-flex align-items-center justify-content-center bg-light">
                <div className="alert alert-danger">Không thể tải dữ liệu thống kê</div>
            </div>
        );
    }

    const statusData = [
        { name: 'To Do', value: stats.byStatus?.TO_DO || 0, color: COLORS_STATUS[0] },
        { name: 'In Progress', value: stats.byStatus?.IN_PROGRESS || 0, color: COLORS_STATUS[1] },
        { name: 'Done', value: stats.byStatus?.DONE || 0, color: COLORS_STATUS[2] }
    ];

    const priorityData = [
        { name: 'Cao', value: stats.byPriority?.HIGH || 0, color: COLORS_PRIORITY[0] },
        { name: 'Trung bình', value: stats.byPriority?.MEDIUM || 0, color: COLORS_PRIORITY[1] },
        { name: 'Thấp', value: stats.byPriority?.LOW || 0, color: COLORS_PRIORITY[2] }
    ];

    const projectData = Object.entries(stats.byProject || {}).map(([name, value]) => ({
        name: name.length > 15 ? name.substring(0, 15) + '...' : name,
        fullName: name,
        value
    }));

    const assigneeData = Object.entries(stats.byAssignee || {}).map(([name, value]) => ({
        name: name.length > 20 ? name.substring(0, 20) + '...' : name,
        fullName: name,
        value
    }));

    return (
        <div className="min-vh-100 bg-light d-flex flex-column" style={{ fontFamily: "'Segoe UI', sans-serif" }}>
            <nav className="navbar navbar-expand-lg navbar-dark bg-primary shadow px-4 w-100">
                <div className="container-fluid">
                    <div className="d-flex align-items-center text-white">
                        <i className="bi bi-bar-chart-fill fs-4 me-2"></i>
                        <span className="fw-bold tracking-wide">THỐNG KÊ DỰ ÁN</span>
                    </div>
                    <div className="ms-auto d-flex align-items-center gap-3">
                        <NotificationBell />
                        <button onClick={() => navigate('/admin')} className="btn btn-outline-light btn-sm fw-bold rounded-pill">
                            <i className="bi bi-arrow-left me-1"></i> Quay lại
                        </button>
                        <button onClick={handleLogout} className="btn btn-outline-light btn-sm fw-bold rounded-pill">Đăng xuất</button>
                    </div>
                </div>
            </nav>

            <div className="container-fluid px-4 py-4 flex-grow-1">
                <div className="row g-4 mb-4">
                    <div className="col-md-3">
                        <div className="card border-0 shadow-sm h-100">
                            <div className="card-body text-center">
                                <div className="fs-1 fw-bold text-primary">{stats.total || 0}</div>
                                <div className="text-muted small">Tổng số Task</div>
                            </div>
                        </div>
                    </div>
                    <div className="col-md-3">
                        <div className="card border-0 shadow-sm h-100">
                            <div className="card-body text-center">
                                <div className="fs-1 fw-bold text-secondary">{statusData[0].value}</div>
                                <div className="text-muted small">Chưa làm (To Do)</div>
                            </div>
                        </div>
                    </div>
                    <div className="col-md-3">
                        <div className="card border-0 shadow-sm h-100">
                            <div className="card-body text-center">
                                <div className="fs-1 fw-bold text-primary">{statusData[1].value}</div>
                                <div className="text-muted small">Đang làm (In Progress)</div>
                            </div>
                        </div>
                    </div>
                    <div className="col-md-3">
                        <div className="card border-0 shadow-sm h-100">
                            <div className="card-body text-center">
                                <div className="fs-1 fw-bold text-success">{statusData[2].value}</div>
                                <div className="text-muted small">Hoàn thành (Done)</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="row g-4">
                    <div className="col-lg-6">
                        <div className="card border-0 shadow-sm h-100">
                            <div className="card-header bg-white py-3">
                                <h5 className="mb-0 text-primary fw-bold">
                                    <i className="bi bi-pie-chart-fill me-2"></i>Task theo Trạng thái
                                </h5>
                            </div>
                            <div className="card-body d-flex align-items-center justify-content-center">
                                {statusData.every(d => d.value === 0) ? (
                                    <div className="text-muted text-center py-5">
                                        <i className="bi bi-inbox fs-1 d-block mb-2"></i>
                                        Chưa có dữ liệu
                                    </div>
                                ) : (
                                    <ResponsiveContainer width="100%" height={300}>
                                        <PieChart>
                                            <Pie
                                                data={statusData}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={60}
                                                outerRadius={100}
                                                paddingAngle={5}
                                                dataKey="value"
                                                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                            >
                                                {statusData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                                ))}
                                            </Pie>
                                            <Tooltip formatter={(value) => `${value} task`} />
                                            <Legend />
                                        </PieChart>
                                    </ResponsiveContainer>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="col-lg-6">
                        <div className="card border-0 shadow-sm h-100">
                            <div className="card-header bg-white py-3">
                                <h5 className="mb-0 text-danger fw-bold">
                                    <i className="bi bi-pie-chart-fill me-2"></i>Task theo Độ ưu tiên
                                </h5>
                            </div>
                            <div className="card-body d-flex align-items-center justify-content-center">
                                {priorityData.every(d => d.value === 0) ? (
                                    <div className="text-muted text-center py-5">
                                        <i className="bi bi-inbox fs-1 d-block mb-2"></i>
                                        Chưa có dữ liệu
                                    </div>
                                ) : (
                                    <ResponsiveContainer width="100%" height={300}>
                                        <PieChart>
                                            <Pie
                                                data={priorityData}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={60}
                                                outerRadius={100}
                                                paddingAngle={5}
                                                dataKey="value"
                                                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                            >
                                                {priorityData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                                ))}
                                            </Pie>
                                            <Tooltip formatter={(value) => `${value} task`} />
                                            <Legend />
                                        </PieChart>
                                    </ResponsiveContainer>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="col-lg-6">
                        <div className="card border-0 shadow-sm h-100">
                            <div className="card-header bg-white py-3">
                                <h5 className="mb-0 text-info fw-bold">
                                    <i className="bi bi-bar-chart-fill me-2"></i>Task theo Dự án
                                </h5>
                            </div>
                            <div className="card-body">
                                {projectData.length === 0 ? (
                                    <div className="text-muted text-center py-5">
                                        <i className="bi bi-inbox fs-1 d-block mb-2"></i>
                                        Chưa có dữ liệu
                                    </div>
                                ) : (
                                    <ResponsiveContainer width="100%" height={350}>
                                        <BarChart data={projectData} layout="vertical">
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis type="number" />
                                            <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
                                            <Tooltip formatter={(value) => `${value} task`} />
                                            <Bar dataKey="value" fill="#0dcaf0" radius={[0, 4, 4, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="col-lg-6">
                        <div className="card border-0 shadow-sm h-100">
                            <div className="card-header bg-white py-3">
                                <h5 className="mb-0 text-warning fw-bold">
                                    <i className="bi bi-bar-chart-fill me-2"></i>Task theo Người thực hiện
                                </h5>
                            </div>
                            <div className="card-body">
                                {assigneeData.length === 0 ? (
                                    <div className="text-muted text-center py-5">
                                        <i className="bi bi-inbox fs-1 d-block mb-2"></i>
                                        Chưa có dữ liệu
                                    </div>
                                ) : (
                                    <ResponsiveContainer width="100%" height={350}>
                                        <BarChart data={assigneeData} layout="vertical">
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis type="number" />
                                            <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
                                            <Tooltip formatter={(value) => `${value} task`} />
                                            <Bar dataKey="value" fill="#ffc107" radius={[0, 4, 4, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StatisticsPage;
