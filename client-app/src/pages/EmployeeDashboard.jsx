import { useEffect, useRef, useState } from 'react';
import SockJS from 'sockjs-client';
import { Stomp } from '@stomp/stompjs';
import api, { getWebSocketUrl, projectAPI, userAPI } from '../api';
import { useNavigate } from 'react-router-dom';
import NotificationBell from '../components/NotificationBell';
import TaskDetailModal from '../components/TaskDetailModal';
import ProjectChatPanel from '../components/ProjectChatPanel';
import PrivateChatPanel from '../components/PrivateChatPanel';

const EmployeeDashboard = () => {
    const navigate = useNavigate();
    const stompClientRef = useRef(null);
    const reconnectTimeoutRef = useRef(null);
    const [currentUser] = useState(() => {
        const userJson = localStorage.getItem('user');
        if (!userJson) return null;
        try {
            return JSON.parse(userJson);
        } catch {
            return null;
        }
    });
    const [myTasks, setMyTasks] = useState([]);
    const [filterStatus, setFilterStatus] = useState('ALL'); 
    const [editingTask, setEditingTask] = useState(null);
    const [updatePayload, setUpdatePayload] = useState({ status: '', percent: 0, submissionLink: '' });
    const [selectedTaskForDetail, setSelectedTaskForDetail] = useState(null);
    const [showProfileMenu, setShowProfileMenu] = useState(false);

    // CHAT SUPPORT
    const [activeTab, setActiveTab] = useState('TASKS'); // TASKS | CHAT
    const [chatSelection, setChatSelection] = useState({ type: null, data: null }); // type: 'PROJECT' | 'USER'
    const [chatUsers, setChatUsers] = useState([]);
    const [chatProjects, setChatProjects] = useState([]);

    const fetchMyTasks = async (userId) => {
        try {
            const res = await api.get(`/tasks/my-tasks/${userId}`);
            setMyTasks(res.data || []);
        } catch (err) { console.error(err); }
    };

    const fetchAccessibleProjects = async (userId) => {
        try {
            const res = await projectAPI.getAccessibleProjects(userId);
            setChatProjects(res.data || []);
        } catch (err) {
            console.error('Lỗi tải dự án có thể truy cập:', err);
        }
    };

    useEffect(() => {
        if (!currentUser) { navigate('/'); return; }
        const timeoutId = window.setTimeout(() => {
            Promise.all([
                fetchMyTasks(currentUser.id),
                fetchAccessibleProjects(currentUser.id),
            ]);
        }, 0);

        return () => window.clearTimeout(timeoutId);
    }, [currentUser, navigate]);

    useEffect(() => {
        if (!currentUser?.department?.id) return;

        const connectWebSocket = () => {
            const token = localStorage.getItem('token');
            if (reconnectTimeoutRef.current) {
                window.clearTimeout(reconnectTimeoutRef.current);
            }
            if (stompClientRef.current) {
                stompClientRef.current.disconnect();
            }

            const socket = new SockJS(getWebSocketUrl());
            const client = Stomp.over(() => socket);
            client.debug = () => {};

            client.connect({ Authorization: token ? `Bearer ${token}` : '' }, () => {
                console.log('✅ Employee dashboard WebSocket connected');
                client.subscribe(`/topic/department/${currentUser.department.id}/update`, async (message) => {
                    if (message.body === 'REFRESH_PROJECTS') {
                        await fetchAccessibleProjects(currentUser.id);
                    }
                });
            }, (error) => {
                console.error('❌ Employee dashboard WebSocket error:', error);
                reconnectTimeoutRef.current = window.setTimeout(connectWebSocket, 5000);
            });

            stompClientRef.current = client;
        };

        connectWebSocket();

        return () => {
            if (reconnectTimeoutRef.current) {
                window.clearTimeout(reconnectTimeoutRef.current);
            }
            if (stompClientRef.current) {
                stompClientRef.current.disconnect();
            }
        };
    }, [currentUser]);

    const fetchDepartmentUsers = async (user) => {
        try {
            const res = await userAPI.getMyDepartmentUsers();
            if (!user) return;
            const others = res.data.filter(u => u.id !== user.id && u.department?.id === user.department?.id);
            setChatUsers(others);
        } catch (err) { console.error(err); }
    };

    const handleTabChange = (tab) => {
        setActiveTab(tab);
        if (tab === 'CHAT' && chatUsers.length === 0 && currentUser) {
            fetchDepartmentUsers(currentUser);
        }
    };

    const handleUpdate = async (e) => {
        e.preventDefault();
        try {
            const normalizedPercent = parseInt(updatePayload.percent, 10);
            const normalizedStatus = normalizedPercent === 100
                ? 'DONE'
                : updatePayload.status === 'DONE'
                    ? 'IN_PROGRESS'
                    : updatePayload.status;

            await api.put(`/tasks/${editingTask.id}/status`, {
                status: normalizedStatus,
                percent: normalizedPercent,
                submissionLink: updatePayload.submissionLink
            });
            setEditingTask(null);
            fetchMyTasks(currentUser.id);
        } catch (err) { alert("Lỗi: " + (err.response?.data || err.message)); }
    };

    const handleStatusChange = (status) => {
        setUpdatePayload((prev) => ({
            ...prev,
            status,
            percent: status === 'DONE' ? 100 : (prev.percent === 100 ? 99 : prev.percent)
        }));
    };

    const handlePercentChange = (percentValue) => {
        const percent = parseInt(percentValue, 10);
        setUpdatePayload((prev) => ({
            ...prev,
            percent,
            status: percent === 100 ? 'DONE' : (prev.status === 'DONE' ? 'IN_PROGRESS' : prev.status)
        }));
    };

    const handleLogout = () => { localStorage.removeItem('user'); navigate('/'); };

    if (!currentUser) return (
        <div className="min-vh-100 d-flex align-items-center justify-content-center bg-light">
            <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
            </div>
        </div>
    );

    const filteredTasks = myTasks.filter(t => filterStatus === 'ALL' || t.status === filterStatus);
    const stats = {
        todo: myTasks.filter(t => t.status === 'TO_DO').length,
        progress: myTasks.filter(t => t.status === 'IN_PROGRESS').length,
        done: myTasks.filter(t => t.status === 'DONE').length
    };
    const activeProjectChat = chatSelection.type === 'PROJECT'
        ? chatProjects.find((project) => String(project.id) === String(chatSelection.data?.id)) || null
        : null;
    const activeChatSelection = chatSelection.type === 'PROJECT'
        ? (activeProjectChat ? { type: 'PROJECT', data: activeProjectChat } : { type: null, data: null })
        : chatSelection;

    return (
        <div className="min-vh-100 bg-light d-flex flex-column" style={{ fontFamily: "'Inter', sans-serif" }}>
            <style>{`
                .glass-header {
                    padding: 12px 24px;
                    background: rgba(255, 255, 255, 0.85);
                    backdrop-filter: blur(12px);
                    border-bottom: 1px solid rgba(226, 232, 240, 0.8);
                    z-index: 1000;
                }
                .brand-text {
                    font-family: 'Poppins', sans-serif;
                    font-weight: 800;
                    font-size: 1.25rem;
                    background: linear-gradient(135deg, #1a202c 0%, #4a5568 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    letter-spacing: -0.5px;
                }
                .top-menu-item {
                    padding: 10px 20px;
                    border: none;
                    background: transparent;
                    border-radius: 12px;
                    color: #718096;
                    font-weight: 700;
                    font-size: 0.95rem;
                    transition: all 0.2s;
                    display: flex;
                    align-items: center;
                }
                .top-menu-item:hover { color: #2d3748; background: #f7fafc; }
                .top-menu-item.active { color: #4318ff; background: #f4f7fe; }
                .top-menu-icon { margin-right: 10px; font-size: 1.1rem; }

                .admin-dashboard-container {
                    background-color: #F4F7FE;
                    min-height: calc(100vh - 70px);
                    padding: 15px 25px;
                }
                .admin-main-wrapper {
                    width: 100% !important;
                    max-width: 100% !important;
                    margin: 0;
                    background: transparent;
                    height: 100%;
                    display: flex;
                    flex-direction: column;
                }
                .modern-card {
                    background: white;
                    border-radius: 20px;
                    border: none;
                    box-shadow: 14px 17px 40px 4px rgba(112, 144, 176, 0.08);
                    transition: all 0.3s ease;
                }
                .modern-card:hover { transform: translateY(-5px); box-shadow: 14px 17px 40px 4px rgba(112, 144, 176, 0.15); }
                
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e0; border-radius: 10px; }
                .animate-fade-in { animation: fadeIn 0.4s ease-out; }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                
                .task-card-header { padding: 1.5rem; border-bottom: 1px solid #edf2f7; display: flex; justify-content: space-between; align-items: center; }
                .modern-dropdown-item:hover { background-color: #f4f7fe !important; color: #4318ff !important; }
                
                .modal-backdrop-custom {
                    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                    background: rgba(0,0,0,0.6); z-index: 1040;
                    display: flex; align-items: center; justify-content: center;
                    backdrop-filter: blur(5px);
                    pointer-events: auto;
                }
                .modal-card-custom {
                    z-index: 1050;
                    position: relative;
                }
                
                .bg-danger-light { background-color: rgba(245, 101, 101, 0.1); }
                .bg-warning-light { background-color: rgba(237, 137, 54, 0.1); }
                .bg-success-light { background-color: rgba(72, 187, 120, 0.1); }
                .line-clamp-2 {
                    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
                }
                .shadow-primary { box-shadow: 0 4px 14px 0 rgba(67, 24, 255, 0.39); }
                
                /* Explicit input interaction styles */
                .interactive-input {
                    cursor: text !important;
                    pointer-events: auto !important;
                    user-select: text !important;
                    position: relative;
                    z-index: 1060;
                }
                .input-group-container:hover {
                    border-color: #4318ff !important;
                }
            `}</style>

            {/* Unified Glass Header */}
            <div className="glass-header d-flex justify-content-between align-items-center w-100 sticky-top">
                {/* Logo */}
                <div className="d-flex align-items-center" style={{ width: '280px' }}>
                    <span className="fs-3 me-2">🚀</span>
                    <span className="brand-text d-none d-md-block">EMPLOYEE PRO</span>
                </div>

                {/* Centered Menu */}
                <div className="top-menu d-none d-xl-flex justify-content-center">
                    <button 
                        className={`top-menu-item ${activeTab === 'TASKS' ? 'active' : ''}`}
                        onClick={() => handleTabChange('TASKS')}
                    >
                        <i className={`bi bi-list-task top-menu-icon ${activeTab === 'TASKS' ? 'text-primary' : ''}`}></i> Công việc
                    </button>
                    <button 
                        className={`top-menu-item ${activeTab === 'CHAT' ? 'active' : ''}`}
                        onClick={() => handleTabChange('CHAT')}
                    >
                        <i className={`bi bi-chat-dots-fill top-menu-icon ${activeTab === 'CHAT' ? 'text-primary' : ''}`}></i> Tin nhắn
                    </button>
                </div>

                {/* Right Profile Actions */}
                <div className="d-flex align-items-center justify-content-end gap-3" style={{ width: '280px' }}>
                    <div className="d-none d-md-block"><NotificationBell currentUser={currentUser} /></div>

                    <div className="dropdown position-relative ms-1">
                        <div
                            className="d-flex align-items-center py-1 px-2 rounded-pill shadow-sm transition"
                            style={{ cursor: 'pointer', background: showProfileMenu ? '#f4f7fe' : 'transparent', border: '1px solid #e2e8f0' }}
                            onClick={() => setShowProfileMenu(!showProfileMenu)}
                        >
                            <div className="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center fw-bold shadow-sm overflow-hidden" style={{ width: 36, height: 36 }}>
                                {currentUser?.avatarUrl ? (
                                    <img src={currentUser.avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                    currentUser?.fullName ? currentUser.fullName.charAt(0).toUpperCase() : 'E'
                                )}
                            </div>
                            <div className="ms-2 me-2 d-none d-sm-block text-start">
                                <div className="fw-bold text-dark" style={{ fontSize: '0.85rem', lineHeight: '1.2' }}>{currentUser?.fullName}</div>
                                <small className="text-muted" style={{ fontSize: '0.7rem' }}>Nhân viên</small>
                            </div>
                            <i className="bi bi-chevron-down ms-1 text-muted me-2" style={{ fontSize: '0.8rem' }}></i>
                        </div>

                        {showProfileMenu && (
                            <div className="dropdown-menu show shadow border-0 position-absolute end-0 mt-2 p-2 rounded-4 animate-fade-in" style={{ minWidth: '220px', backgroundColor: '#fff', top: '100%', zIndex: 1050 }}>
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

            {/* Main Content Area */}
            <div className="admin-dashboard-container flex-grow-1 overflow-auto custom-scrollbar">
                <div className="admin-main-wrapper">
                    {/* Welcome Section & Quick Stats */}
                    <div className="row g-4 mb-5 align-items-center">
                        <div className="col-lg-6 animate-fade-in">
                            <h2 className="fw-bold text-dark mb-1">Xin chào, {currentUser.fullName} 👋</h2>
                            <p className="text-muted">Bạn có <span className="text-primary fw-bold">{myTasks.length}</span> công việc đang thực hiện.</p>
                        </div>
                        <div className="col-lg-6">
                            <div className="row g-3">
                                <div className="col-4">
                                    <div className="modern-card p-3 text-center border-bottom border-secondary border-3">
                                        <div className="fs-3 fw-bold text-secondary">{stats.todo}</div>
                                        <div className="text-muted small fw-bold">TO DO</div>
                                    </div>
                                </div>
                                <div className="col-4">
                                    <div className="modern-card p-3 text-center border-bottom border-primary border-3">
                                        <div className="fs-3 fw-bold text-primary">{stats.progress}</div>
                                        <div className="text-muted small fw-bold">DOING</div>
                                    </div>
                                </div>
                                <div className="col-4">
                                    <div className="modern-card p-3 text-center border-bottom border-success border-3">
                                        <div className="fs-3 fw-bold text-success">{stats.done}</div>
                                        <div className="text-muted small fw-bold">DONE</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {activeTab === 'TASKS' ? (
                        <div className="animate-fade-in flex-grow-1 d-flex flex-column">
                            <div className="modern-card mb-0 overflow-hidden d-flex flex-column" style={{ minHeight: 'calc(100vh - 210px)' }}>
                                <div className="task-card-header">
                                    <h5 className="fw-bold text-dark mb-0"><i className="bi bi-kanban me-2 text-primary"></i>Danh sách công việc</h5>
                                    <div className="btn-group p-1 bg-light rounded-pill border">
                                        {['ALL', 'TO_DO', 'IN_PROGRESS', 'DONE'].map(status => (
                                            <button 
                                                key={status}
                                                className={`btn btn-sm rounded-pill px-3 fw-bold transition border-0 ${filterStatus === status ? 'btn-white shadow-sm text-primary' : 'bg-transparent text-muted'}`}
                                                style={filterStatus === status ? { backgroundColor: '#fff' } : {}}
                                                onClick={() => setFilterStatus(status)}
                                            >
                                                {status === 'ALL' ? 'Tất cả' : status === 'TO_DO' ? 'Mới' : status === 'IN_PROGRESS' ? 'Đang làm' : 'Xong'}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="p-4" style={{ backgroundColor: '#fcfcfc' }}>
                                    <div className="row g-4">
                                        {filteredTasks.length > 0 ? filteredTasks.map(task => (
                                            <div key={task.id} className="col-12 col-md-6 col-xl-4">
                                                <div className="modern-card p-4 transition h-100 border border-transparent hover-border-primary">
                                                    <div className="d-flex justify-content-between align-items-start mb-3">
                                                        <div className="badge rounded-pill bg-primary bg-opacity-10 text-primary px-3 py-2 fw-bold" style={{ fontSize: '0.7rem' }}>
                                                            {task.project?.name || 'No Project'}
                                                        </div>
                                                        <span className={`badge rounded-pill px-3 py-2 ${task.priority === 'HIGH' ? 'bg-danger-light text-danger' : task.priority === 'MEDIUM' ? 'bg-warning-light text-warning' : 'bg-success-light text-success'}`}>
                                                            {task.priority}
                                                        </span>
                                                    </div>
                                                    <h6 className="fw-bold text-dark mb-2" style={{ fontSize: '1.1rem' }}>{task.title}</h6>
                                                    <p className="text-muted small mb-4 line-clamp-2" style={{ minHeight: '3rem' }}>{task.description}</p>
                                                    
                                                    <div className="mb-4">
                                                        <div className="d-flex justify-content-between mb-1">
                                                            <span className="small fw-bold text-muted">Tiến độ</span>
                                                            <span className="small fw-bold text-primary">{task.completionPercentage}%</span>
                                                        </div>
                                                        <div className="progress shadow-sm" style={{ height: 8, borderRadius: 10 }}>
                                                            <div 
                                                                className={`progress-bar progress-bar-striped progress-bar-animated ${task.status === 'DONE' ? 'bg-success' : 'bg-primary'}`} 
                                                                style={{ width: `${task.completionPercentage}%`, borderRadius: 10 }}
                                                            ></div>
                                                        </div>
                                                    </div>

                                                    <div className="d-flex justify-content-between align-items-center mt-auto border-top pt-3">
                                                        <span className={`badge ${task.status === 'DONE' ? 'bg-success' : task.status === 'IN_PROGRESS' ? 'bg-primary' : 'bg-secondary'} bg-opacity-10 text-${task.status === 'DONE' ? 'success' : task.status === 'IN_PROGRESS' ? 'primary' : 'secondary'} px-3 py-2 fw-bold`}>
                                                            {task.status.replace('_', ' ')}
                                                        </span>
                                                        <div className="d-flex gap-2">
                                                            <button className="btn btn-sm btn-light rounded-circle p-2 shadow-sm" onClick={() => setSelectedTaskForDetail(task)} title="Bình luận">
                                                                <i className="bi bi-chat-dots-fill text-primary"></i>
                                                            </button>
                                                            {task.project?.status !== 'CLOSED' ? (
                                                                <button 
                                                                    className="btn btn-sm btn-white shadow-sm border rounded-pill px-3 fw-bold"
                                                                    onClick={() => {
                                                                        setEditingTask(task);
                                                                        setUpdatePayload({status: task.status, percent: task.completionPercentage, submissionLink: task.submissionLink || ''});
                                                                    }}
                                                                >
                                                                    Cập nhật
                                                                </button>
                                                            ) : (
                                                                <span className="btn btn-sm btn-light disabled rounded-pill px-3"><i className="bi bi-lock-fill"></i> Closed</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )) : (
                                            <div className="col-12 py-5 text-center text-muted animate-fade-in">
                                                <i className="bi bi-inbox fs-1 d-block mb-3 opacity-25"></i>
                                                <p className="fw-bold">Bạn chưa có công việc nào trong danh mục này.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="modern-card overflow-hidden animate-fade-in flex-grow-1" style={{ height: 'calc(100vh - 210px)' }}>
                            <div className="row g-0 h-100">
                                {/* Sidebar Chat */}
                                <div className="col-md-4 col-lg-3 border-end bg-white d-flex flex-column h-100">
                                    <div className="p-4 border-bottom bg-light bg-opacity-50">
                                        <h6 className="fw-bold text-dark mb-0"><i className="bi bi-chat-square-text-fill me-2 text-primary"></i>Trung tâm thảo luận</h6>
                                    </div>
                                    
                                    <div className="flex-grow-1 overflow-auto custom-scrollbar p-2">
                                        <div className="text-muted small fw-bold mb-3 ps-3 mt-3 text-uppercase tracking-wider" style={{ fontSize: '0.7rem' }}>Nhóm Dự Án</div>
                                        {chatProjects.map(p => (
                                            <div 
                                                key={p.id} 
                                                className={`d-flex align-items-center p-3 mb-2 rounded-4 cursor-pointer transition ${chatSelection.data?.id === p.id && chatSelection.type === 'PROJECT' ? 'bg-primary text-white shadow-primary' : 'hover-bg-light text-dark'}`}
                                                onClick={() => setChatSelection({ type: 'PROJECT', data: p })}
                                                style={{ cursor: 'pointer' }}
                                            >
                                                <div className={`rounded-3 p-2 me-3 ${chatSelection.data?.id === p.id && chatSelection.type === 'PROJECT' ? 'bg-white bg-opacity-20' : 'bg-primary bg-opacity-10 text-primary'}`}>
                                                    <i className="bi bi-folder-fill fs-5"></i>
                                                </div>
                                                <div className="fw-bold text-truncate" style={{ fontSize: '0.9rem' }}>{p.name}</div>
                                            </div>
                                        ))}

                                        <div className="text-muted small fw-bold mb-3 ps-3 mt-4 text-uppercase tracking-wider" style={{ fontSize: '0.7rem' }}>Trò chuyện 1-1</div>
                                        {chatUsers.map(u => (
                                            <div 
                                                key={u.id} 
                                                className={`d-flex align-items-center p-3 mb-2 rounded-4 cursor-pointer transition ${chatSelection.data?.id === u.id && chatSelection.type === 'USER' ? 'bg-primary text-white shadow-primary' : 'hover-bg-light text-dark'}`}
                                                onClick={() => setChatSelection({ type: 'USER', data: u })}
                                                style={{ cursor: 'pointer' }}
                                            >
                                                <div className="position-relative me-3">
                                                    <div className={`rounded-circle text-center fw-bold shadow-sm d-flex align-items-center justify-content-center ${chatSelection.data?.id === u.id && chatSelection.type === 'USER' ? 'bg-white text-primary' : 'bg-info bg-opacity-10 text-info'}`} style={{ width: 40, height: 40, fontSize: '1rem' }}>
                                                        {u.avatarUrl ? <img src={u.avatarUrl} alt="Avatar" className="rounded-circle w-100 h-100 object-fit-cover" /> : u.fullName.charAt(0)}
                                                    </div>
                                                </div>
                                                <div className="fw-bold text-truncate" style={{ fontSize: '0.9rem' }}>{u.fullName}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                
                                {/* Main Chat Area */}
                                <div className="col-md-8 col-lg-9 bg-white p-0 d-flex flex-column h-100 position-relative">
                                    {activeChatSelection.type ? (
                                        <div className="h-100 d-flex flex-column animate-fade-in">
                                            {activeChatSelection.type === 'PROJECT' ? (
                                                <ProjectChatPanel project={activeChatSelection.data} currentUser={currentUser} />
                                            ) : (
                                                <PrivateChatPanel currentUser={currentUser} targetUser={activeChatSelection.data} />
                                            )}
                                        </div>
                                    ) : (
                                        <div className="h-100 d-flex flex-column align-items-center justify-content-center text-muted animate-fade-in px-4 text-center">
                                            <div className="rounded-circle bg-light p-5 mb-4 shadow-sm">
                                                <i className="bi bi-chat-heart opacity-25" style={{ fontSize: '5rem', color: '#4318ff' }}></i>
                                            </div>
                                            <h4 className="fw-bold text-dark">Hãy kết nối với đồng nghiệp!</h4>
                                            <p className="max-w-md mx-auto">Chọn một dự án hoặc một thành viên từ sidebar để bắt đầu thảo luận công việc.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Modals - Moved to root level for clear stacking and focus control */}
            {editingTask && (
                <div className="modal-backdrop-custom px-3">
                    <div className="modern-card modal-card-custom shadow-lg animate-fade-in" style={{ width: '100%', maxWidth: '450px', overflow: 'hidden' }}>
                        <div className="bg-dark p-4 text-white position-relative">
                            <h4 className="fw-bold mb-1 text-white">Cập nhật tiến độ</h4>
                            <p className="small mb-0 text-white-50">Cập nhật trạng thái và kết quả công việc</p>
                            <button className="btn-close btn-close-white position-absolute top-0 end-0 m-4 shadow-none" onClick={() => setEditingTask(null)}></button>
                        </div>
                        <div className="p-4 bg-white" onClick={(e) => e.stopPropagation()}>
                            <div className="mb-4">
                                <label className="form-label fw-bold text-dark small mb-2 text-uppercase tracking-wider">Tên công việc</label>
                                <div className="p-3 bg-light rounded-3 text-dark fw-bold border-0">{editingTask.title}</div>
                            </div>
                            <form onSubmit={handleUpdate}>
                                <div className="mb-4">
                                    <label className="form-label fw-bold text-dark small mb-2 text-uppercase tracking-wider">Trạng thái công việc</label>
                                    <select 
                                        className="form-select rounded-3 py-2 border-light shadow-sm" 
                                        value={updatePayload.status} 
                                        onChange={e => handleStatusChange(e.target.value)}
                                    >
                                        <option value="TO_DO">🆕 To Do (Mới nhận)</option>
                                        <option value="IN_PROGRESS">⚡ In Progress (Đang làm)</option>
                                        <option value="DONE">✅ Done (Hoàn thành)</option>
                                    </select>
                                </div>
                                <div className="mb-4">
                                    <div className="d-flex justify-content-between mb-2">
                                        <label className="form-label fw-bold text-dark small mb-0 text-uppercase tracking-wider">Tỷ lệ hoàn thành</label>
                                        <span className="badge bg-primary rounded-pill px-3">{updatePayload.percent}%</span>
                                    </div>
                                    <input 
                                        type="range" className="form-range custom-range" min="0" max="100" 
                                        value={updatePayload.percent} 
                                        onChange={e => handlePercentChange(e.target.value)} 
                                    />
                                </div>
                                <div className="mb-4">
                                    <label className="form-label fw-bold text-dark small mb-2 text-uppercase tracking-wider">Link nộp bài / Tài liệu</label>
                                    <div 
                                        className="input-group-container border rounded-3 overflow-hidden shadow-sm d-flex align-items-center bg-white" 
                                        style={{ minHeight: '50px', border: '1px solid #e2e8f0' }}
                                        onClick={() => document.getElementById('submission-link-input')?.focus()}
                                    >
                                        <div className="px-3 bg-light border-end h-100 d-flex align-items-center">
                                            <i className="bi bi-link-45deg fs-5 text-primary"></i>
                                        </div>
                                        <input 
                                            id="submission-link-input"
                                            type="text" 
                                            className="form-control border-0 interactive-input p-3" 
                                            placeholder="Dán link (Google Drive, GitHub...)" 
                                            autoFocus
                                            autoComplete="off"
                                            spellCheck="false"
                                            style={{ boxShadow: 'none' }}
                                            value={updatePayload.submissionLink || ''} 
                                            onChange={e => setUpdatePayload({...updatePayload, submissionLink: e.target.value})}
                                        />
                                    </div>
                                </div>
                                <div className="d-flex gap-3 mt-4 pt-2">
                                    <button type="button" className="btn btn-light rounded-pill px-4 fw-bold flex-grow-1" onClick={() => setEditingTask(null)}>Hủy bỏ</button>
                                    <button className="btn btn-primary rounded-pill px-4 fw-bold flex-grow-1 shadow-primary">Lưu cập nhật</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {selectedTaskForDetail && (
                <TaskDetailModal 
                    task={selectedTaskForDetail} 
                    currentUser={currentUser}
                    onClose={() => setSelectedTaskForDetail(null)}
                    onTaskUpdate={() => fetchMyTasks(currentUser.id)}
                />
            )}
        </div>
    );
};

export default EmployeeDashboard;
