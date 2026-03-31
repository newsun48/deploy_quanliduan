import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import api from '../api';
import { useNavigate } from 'react-router-dom';
import NotificationBell from '../components/NotificationBell';
import './AdminDashboard.css';

const COLORS_STATUS = ['#94a3b8', '#1d6fa3', '#2b8a5d'];
const COLORS_PRIORITY = ['#d05f45', '#d79a31', '#2b8a5d'];

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
        { name: 'Đang mở', value: stats.projectStatus?.OPEN || 0, color: '#1d6fa3' },
        { name: 'Đã đóng', value: stats.projectStatus?.CLOSED || 0, color: '#2b8a5d' },
        { name: 'Bản nháp', value: stats.projectStatus?.DRAFT || 0, color: '#d79a31' }
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
        <div className="admin-page statistics-page min-vh-100 d-flex flex-column">
            <div className="glass-header d-flex justify-content-between align-items-center w-100 sticky-top">
                <div className="admin-header-slot admin-header-brand d-flex align-items-center">
                    <span className="fs-3 me-2">🚀</span>
                    <span className="brand-text d-none d-md-block">ADMIN PRO</span>
                </div>

                <div className="top-menu admin-top-menu d-none d-xl-flex justify-content-center">
                    <button className="top-menu-item" onClick={() => navigate('/admin')}>
                        <i className="bi bi-people-fill top-menu-icon" style={{ color: '#8aa2bc' }}></i> Nhân sự
                    </button>
                    <button className="top-menu-item" onClick={() => navigate('/admin')}>
                        <i className="bi bi-building top-menu-icon" style={{ color: '#8aa2bc' }}></i> Phòng Ban
                    </button>
                    <button className="top-menu-item" onClick={() => navigate('/admin')}>
                        <i className="bi bi-folder-fill top-menu-icon" style={{ color: '#8aa2bc' }}></i> Dự Án
                    </button>
                    <button className="top-menu-item" onClick={() => navigate('/admin')}>
                        <i className="bi bi-check-circle-fill top-menu-icon" style={{ color: '#8aa2bc' }}></i> Đã Hoàn Thành
                    </button>
                    <button className="top-menu-item" onClick={() => navigate('/admin')}>
                        <i className="bi bi-clock-history top-menu-icon" style={{ color: '#8aa2bc' }}></i> Hoạt động
                    </button>
                    <button className="top-menu-item active">
                        <i className="bi bi-bar-chart-fill top-menu-icon" style={{ color: '#1d6fa3' }}></i> Thống kê
                    </button>
                </div>

                <div className="admin-header-slot admin-header-actions d-flex align-items-center justify-content-end gap-3">
                    <div className="d-none d-md-block"><NotificationBell /></div>

                    <div className="dropdown position-relative ms-1">
                        <div
                            className="admin-profile-toggle d-flex align-items-center py-1 px-2 rounded-pill shadow-sm"
                            onClick={() => setShowProfileMenu(!showProfileMenu)}
                        >
                            <div className="admin-profile-avatar rounded-circle bg-primary text-white d-flex align-items-center justify-content-center fw-bold shadow-sm overflow-hidden">
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
                <div className="admin-main-wrapper">
                    <div className="p-4 p-md-5 animate-fade-in content-inner">
                        <div className="d-flex justify-content-between align-items-center mb-4 d-xl-none bg-white p-3 rounded-4 shadow-sm">
                            <h4 className="page-title mb-0 fs-5">Báo cáo thống kê</h4>
                            <select className="form-select modern-input w-auto fw-bold text-primary-dark shadow-sm py-1" value="statistics" onChange={(e) => { if (e.target.value === 'dashboard') navigate('/admin'); }}>
                                <option value="dashboard">Dashboard</option>
                                <option value="statistics">Thống kê</option>
                            </select>
                        </div>

                        <div className="statistics-hero d-flex justify-content-between align-items-center gap-3 mb-5">
                            <div>
                                <span className="admin-section-kicker">Tổng quan dữ liệu</span>
                                <h1 className="statistics-page-title fw-bold text-dark mb-1">Báo cáo thống kê hiện tại</h1>
                                <p className="text-muted small mb-0">Theo dõi tiến độ công việc, phân bổ dự án và lực lượng nhân sự trong cùng một bảng điều phối.</p>
                            </div>
                            <button onClick={() => navigate('/admin')} className="btn btn-white shadow-sm rounded-pill px-4 fw-bold statistics-back-btn">
                                <i className="bi bi-arrow-left me-2"></i> Dashboard
                            </button>
                        </div>

                        <div className="row g-4 mb-5">
                            <div className="col-md-3">
                                <div className="modern-card p-4 border-bottom-primary h-100 statistics-summary-card">
                                    <div className="stat-icon bg-primary-light text-primary">
                                        <i className="bi bi-list-task"></i>
                                    </div>
                                    <div className="text-muted mb-1 small fw-bold text-uppercase">Tổng số TASK</div>
                                    <div className="fs-1 fw-bold text-dark">{stats.totalTasks || 0}</div>
                                </div>
                            </div>
                            <div className="col-md-3">
                                <div className="modern-card p-4 border-bottom-secondary h-100 statistics-summary-card">
                                    <div className="stat-icon bg-secondary-light text-secondary">
                                        <i className="bi bi-clock-history"></i>
                                    </div>
                                    <div className="text-muted mb-1 small fw-bold text-uppercase">Chưa làm (To Do)</div>
                                    <div className="fs-1 fw-bold text-secondary">{statusData[0].value}</div>
                                </div>
                            </div>
                            <div className="col-md-3">
                                <div className="modern-card p-4 border-bottom-primary h-100 statistics-summary-card">
                                    <div className="stat-icon bg-primary-light text-primary statistics-summary-icon statistics-summary-icon-accent">
                                        <i className="bi bi-play-fill"></i>
                                    </div>
                                    <div className="text-muted mb-1 small fw-bold text-uppercase">Đang làm (In Progress)</div>
                                    <div className="fs-1 fw-bold text-primary">{statusData[1].value}</div>
                                </div>
                            </div>
                            <div className="col-md-3">
                                <div className="modern-card p-4 border-bottom-success h-100 statistics-summary-card">
                                    <div className="stat-icon bg-success-light text-success">
                                        <i className="bi bi-check-all"></i>
                                    </div>
                                    <div className="text-muted mb-1 small fw-bold text-uppercase">Hoàn thành (Done)</div>
                                    <div className="fs-1 fw-bold text-success">{statusData[2].value}</div>
                                </div>
                            </div>
                        </div>

                        <div className="statistics-section-header">
                            <i className="bi bi-graph-up-arrow"></i> Phân phối Công việc
                        </div>
                        <div className="row g-4 mb-5">
                            <div className="col-lg-6">
                                <div className="modern-card h-100 statistics-chart-card">
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
                                <div className="modern-card h-100 statistics-chart-card">
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

                        <div className="statistics-section-header">
                            <i className="bi bi-briefcase"></i> Dự án & Phòng ban
                        </div>
                        <div className="row g-4 mb-5">
                            <div className="col-lg-5">
                                <div className="modern-card h-100 statistics-chart-card">
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
                                <div className="modern-card h-100 statistics-chart-card">
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
                                                    <Bar dataKey="value" fill="#1d6fa3" radius={[0, 10, 10, 0]} barSize={20} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                </div>
                            </div>
                        </div>

                        <div className="statistics-section-header">
                            <i className="bi bi-person-badge"></i> Nhân sự & Hiệu suất
                        </div>
                        <div className="row g-4 mb-4">
                            <div className="col-lg-6">
                                <div className="modern-card h-100 statistics-chart-card">
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
                                <div className="modern-card h-100 statistics-chart-card">
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
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StatisticsPage;
