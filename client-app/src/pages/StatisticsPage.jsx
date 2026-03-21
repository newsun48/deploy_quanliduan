import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import api from '../api';
import { useNavigate } from 'react-router-dom';
import NotificationBell from '../components/NotificationBell';
import './AdminDashboard.css';

const COLORS_STATUS = ['#6c757d', '#4318ff', '#05cd99']; // Modern colors
const COLORS_PRIORITY = ['#ee5d50', '#ffb547', '#01b574'];

const StatisticsPage = () => {
    const navigate = useNavigate();
    const currentUser = JSON.parse(localStorage.getItem('user'));
    
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showProfileMenu, setShowProfileMenu] = useState(false);

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
                    <p className="fw-bold text-primary-dark">Đang tải dữ liệu...</p>
                </div>
            </div>
        );
    }

    if (!stats) {
        return (
            <div className="min-vh-100 d-flex align-items-center justify-content-center bg-light">
                <div className="alert alert-danger px-5 rounded-4 shadow-sm fw-bold">Không thể tải dữ liệu thống kê</div>
            </div>
        );
    }

    const statusData = [
        { name: 'To Do', value: stats.byStatus?.TO_DO || 0, color: COLORS_STATUS[0] },
        { name: 'In Progress', value: stats.byStatus?.IN_PROGRESS || 0, color: COLORS_STATUS[1] },
        { name: 'Done', value: stats.byStatus?.DONE || 0, color: COLORS_STATUS[2] }
    ];

    const projectStatusData = [
        { name: 'Đang mở', value: stats.projectStatus?.OPEN || 0, color: '#4318ff' },
        { name: 'Đã đóng', value: stats.projectStatus?.CLOSED || 0, color: '#05cd99' },
        { name: 'Bản nháp', value: stats.projectStatus?.DRAFT || 0, color: '#f6ad55' }
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
    })).sort((a, b) => b.value - a.value);

    const userDeptData = Object.entries(stats.userDept || {}).map(([name, value]) => ({
        name: name.length > 15 ? name.substring(0, 15) + '...' : name,
        fullName: name,
        value
    })).sort((a, b) => b.value - a.value);

    const assigneeData = Object.entries(stats.byAssignee || {}).map(([name, value]) => ({
        name: name.length > 20 ? name.substring(0, 20) + '...' : name,
        fullName: name,
        value
    })).sort((a, b) => b.value - a.value);

    return (
        <div className="min-vh-100 bg-light d-flex flex-column" style={{ fontFamily: "'Inter', sans-serif" }}>
            {/* Unified Glass Header */}
            <div className="glass-header d-flex justify-content-between align-items-center w-100 sticky-top">
                {/* Logo */}
                <div className="d-flex align-items-center" style={{ width: '280px' }}>
                    <span className="fs-3 me-2">🚀</span>
                    <span className="brand-text d-none d-md-block">ADMIN PRO</span>
                </div>

                {/* Centered Menu */}
                <div className="top-menu d-none d-xl-flex justify-content-center">
                    <button className="top-menu-item" onClick={() => navigate('/admin')}>
                        <i className="bi bi-people-fill top-menu-icon" style={{ color: '#a3aed1' }}></i> Nhân sự
                    </button>
                    <button className="top-menu-item" onClick={() => navigate('/admin')}>
                        <i className="bi bi-building top-menu-icon" style={{ color: '#a3aed1' }}></i> Phòng Ban
                    </button>
                    <button className="top-menu-item" onClick={() => navigate('/admin')}>
                        <i className="bi bi-folder-fill top-menu-icon" style={{ color: '#a3aed1' }}></i> Dự Án
                    </button>
                    <button className="top-menu-item" onClick={() => navigate('/admin')}>
                        <i className="bi bi-check-circle-fill top-menu-icon" style={{ color: '#a3aed1' }}></i> Đã Hoàn Thành
                    </button>
                    <button className="top-menu-item active">
                        <i className="bi bi-bar-chart-fill top-menu-icon" style={{ color: '#4318ff' }}></i> Thống kê
                    </button>
                </div>

                {/* Right Profile Actions */}
                <div className="d-flex align-items-center justify-content-end gap-3" style={{ width: '280px' }}>
                    <div className="d-none d-md-block"><NotificationBell /></div>

                    <div className="dropdown position-relative ms-1">
                        <div
                            className="d-flex align-items-center py-1 px-2 rounded-pill shadow-sm"
                            style={{ cursor: 'pointer', background: showProfileMenu ? '#f4f7fe' : 'transparent', transition: 'all 0.2s', border: '1px solid #e2e8f0' }}
                            onClick={() => setShowProfileMenu(!showProfileMenu)}
                        >
                            <div className="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center fw-bold shadow-sm overflow-hidden" style={{ width: 36, height: 36 }}>
                                {currentUser?.avatarUrl ? (
                                    <img src={currentUser.avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                    currentUser?.fullName ? currentUser.fullName.charAt(0).toUpperCase() : 'A'
                                )}
                            </div>
                            <div className="ms-2 me-2 d-none d-sm-block text-start">
                                <div className="fw-bold text-dark" style={{ fontSize: '0.85rem', lineHeight: '1.2' }}>{currentUser?.fullName}</div>
                                <small className="text-muted" style={{ fontSize: '0.7rem' }}>Administrator</small>
                            </div>
                            <i className="bi bi-chevron-down ms-1 text-muted me-2" style={{ fontSize: '0.8rem' }}></i>
                        </div>

                        {showProfileMenu && (
                            <div className="dropdown-menu show shadow border-0 position-absolute end-0 mt-2 p-2 rounded-4" style={{ minWidth: '220px', backgroundColor: '#fff', top: '100%', zIndex: 1050 }}>
                                <div className="px-3 py-2 mb-1 d-sm-none border-bottom">
                                    <div className="fw-bold text-dark">{currentUser?.fullName}</div>
                                    <small className="text-muted">Administrator</small>
                                </div>
                                <button className="dropdown-item rounded-3 py-2 fw-bold text-dark mb-1 d-flex align-items-center modern-dropdown-item" onClick={() => { setShowProfileMenu(false); navigate('/profile'); }}>
                                    <i className="bi bi-person-fill me-2 fs-5 text-primary"></i> Tài khoản của tôi
                                </button>
                                <button className="dropdown-item rounded-3 py-2 fw-bold text-dark mb-1 d-flex align-items-center modern-dropdown-item" onClick={() => { setShowProfileMenu(false); navigate('/admin'); }}>
                                    <i className="bi bi-trash-fill me-2 fs-5 text-danger"></i> Thùng rác
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
                <style>{`
                    .section-header {
                        font-size: 0.9rem;
                        font-weight: 800;
                        color: #4A5568;
                        text-transform: uppercase;
                        letter-spacing: 0.05em;
                        margin-bottom: 1.5rem;
                        display: flex;
                        align-items: center;
                        gap: 10px;
                        margin-top: 1rem;
                    }
                    .section-header::after {
                        content: "";
                        flex: 1;
                        height: 1px;
                        background: linear-gradient(to right, #e2e8f0, transparent);
                    }
                    .stat-icon {
                        width: 48px;
                        height: 48px;
                        border-radius: 12px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 1.5rem;
                        margin-bottom: 1rem;
                    }
                    .modern-card {
                        transition: all 0.3s ease;
                    }
                    .modern-card:hover {
                        transform: translateY(-5px);
                        box-shadow: 0 10px 20px rgba(0,0,0,0.05) !important;
                    }
                `}</style>
                <div className="admin-main-wrapper">
                    <div className="p-4 p-md-5 animate-fade-in content-inner">
                        <div className="d-flex justify-content-between align-items-center mb-5">
                            <div>
                                <h1 className="fw-bold text-dark mb-1" style={{ fontSize: '1.75rem' }}>Báo cáo Thống kê Hiện tại</h1>
                                <p className="text-muted small mb-0">Hệ thống phân tích dữ liệu dự án thời gian thực</p>
                            </div>
                            <button onClick={() => navigate('/admin')} className="btn btn-white shadow-sm rounded-pill px-4 fw-bold">
                                <i className="bi bi-arrow-left me-2"></i> Dashboard
                            </button>
                        </div>

                        {/* Summary Cards */}
                        <div className="row g-4 mb-5">
                            <div className="col-md-3">
                                <div className="modern-card p-4 border-bottom-primary">
                                    <div className="stat-icon bg-primary-light text-primary">
                                        <i className="bi bi-list-check"></i>
                                    </div>
                                    <div className="text-muted mb-1 small fw-bold text-uppercase">Công việc</div>
                                    <div className="fs-2 fw-bold text-dark">{stats.totalTasks || 0}</div>
                                </div>
                            </div>
                            <div className="col-md-3">
                                <div className="modern-card p-4 border-bottom-success">
                                    <div className="stat-icon bg-success-light text-success">
                                        <i className="bi bi-folder2-open"></i>
                                    </div>
                                    <div className="text-muted mb-1 small fw-bold text-uppercase">Dự án</div>
                                    <div className="fs-2 fw-bold text-dark">{stats.totalProjects || 0}</div>
                                </div>
                            </div>
                            <div className="col-md-3">
                                <div className="modern-card p-4 border-bottom-info">
                                    <div className="stat-icon bg-info-light text-info">
                                        <i className="bi bi-people"></i>
                                    </div>
                                    <div className="text-muted mb-1 small fw-bold text-uppercase">Nhân sự</div>
                                    <div className="fs-2 fw-bold text-dark">{stats.totalUsers || 0}</div>
                                </div>
                            </div>
                            <div className="col-md-3">
                                <div className="modern-card p-4 border-bottom-warning">
                                    <div className="stat-icon bg-warning-light text-warning">
                                        <i className="bi bi-building"></i>
                                    </div>
                                    <div className="text-muted mb-1 small fw-bold text-uppercase">Phòng ban</div>
                                    <div className="fs-2 fw-bold text-dark">{stats.totalDepts || 0}</div>
                                </div>
                            </div>
                        </div>

                        {/* Analysis Sections */}
                        <div className="section-header">
                            <i className="bi bi-graph-up-arrow"></i> Phân phối Công việc
                        </div>
                        <div className="row g-4 mb-5">
                            <div className="col-lg-6">
                                <div className="modern-card h-100">
                                    <div className="modern-card-header">
                                        Trạng thái Công việc
                                    </div>
                                    <div className="card-body p-4 d-flex align-items-center justify-content-center">
                                        <ResponsiveContainer width="100%" height={280}>
                                            <PieChart>
                                                <Pie
                                                    data={statusData}
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={60}
                                                    outerRadius={100}
                                                    paddingAngle={5}
                                                    minAngle={15}
                                                    dataKey="value"
                                                    label={({ name, percent, value }) => value > 0 ? `${name}: ${(percent * 100).toFixed(0)}%` : null}
                                                >
                                                    {statusData.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                                    ))}
                                                </Pie>
                                                <Tooltip cornerRadius={10} borderStyle={{ borderRadius: '10px' }} />
                                                <Legend />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>
                            <div className="col-lg-6">
                                <div className="modern-card h-100">
                                    <div className="modern-card-header">
                                        Độ ưu tiên hàng đầu
                                    </div>
                                    <div className="card-body p-4 d-flex align-items-center justify-content-center">
                                        <ResponsiveContainer width="100%" height={280}>
                                            <PieChart>
                                                <Pie
                                                    data={priorityData}
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={60}
                                                    outerRadius={100}
                                                    paddingAngle={5}
                                                    minAngle={15}
                                                    dataKey="value"
                                                    label={({ name, percent, value }) => value > 0 ? `${name}: ${(percent * 100).toFixed(0)}%` : null}
                                                >
                                                    {priorityData.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                                    ))}
                                                </Pie>
                                                <Tooltip cornerRadius={10} />
                                                <Legend />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="section-header">
                            <i className="bi bi-briefcase"></i> Dự án & Phòng ban
                        </div>
                        <div className="row g-4 mb-5">
                            <div className="col-lg-5">
                                <div className="modern-card h-100">
                                    <div className="modern-card-header">
                                        Trạng thái Dự án Tổng quát
                                    </div>
                                    <div className="card-body p-4 d-flex align-items-center justify-content-center">
                                        <ResponsiveContainer width="100%" height={320}>
                                            <PieChart>
                                                <Pie
                                                    data={projectStatusData}
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={60}
                                                    outerRadius={100}
                                                    paddingAngle={5}
                                                    minAngle={15}
                                                    dataKey="value"
                                                    label={({ name, percent, value }) => value > 0 ? `${name}: ${(percent * 100).toFixed(0)}%` : null}
                                                >
                                                    {projectStatusData.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                                    ))}
                                                </Pie>
                                                <Tooltip cornerRadius={10} />
                                                <Legend />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>
                            <div className="col-lg-7">
                                <div className="modern-card h-100">
                                    <div className="modern-card-header">
                                        Phân bổ khối lượng theo Dự án
                                    </div>
                                    <div className="card-body p-4">
                                        <ResponsiveContainer width="100%" height={320}>
                                            <BarChart data={projectData} layout="vertical">
                                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f1f1" />
                                                <XAxis type="number" hide />
                                                <YAxis type="category" dataKey="name" width={100} tick={{ fill: '#a3aed1', fontSize: 11 }} axisLine={false} tickLine={false} />
                                                <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} />
                                                <Bar dataKey="value" fill="#4318ff" radius={[0, 10, 10, 0]} barSize={20} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="section-header">
                            <i className="bi bi-person-badge"></i> Nhân sự & Hiệu suất
                        </div>
                        <div className="row g-4 mb-4">
                            <div className="col-lg-6">
                                <div className="modern-card h-100">
                                    <div className="modern-card-header">
                                        Phòng ban & Lực lượng nhân sự
                                    </div>
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
                                <div className="modern-card h-100">
                                    <div className="modern-card-header">
                                        Xếp hạng Hiệu suất Làm việc
                                    </div>
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
