import { useEffect, useState } from 'react';
import axios from 'axios';
import api from '../api';
import { useNavigate } from 'react-router-dom';
import NotificationBell from '../components/NotificationBell';
import TaskDetailModal from '../components/TaskDetailModal';
import ProjectChatPanel from '../components/ProjectChatPanel';
import PrivateChatPanel from '../components/PrivateChatPanel';

const EmployeeDashboard = () => {
    const navigate = useNavigate();
    const [currentUser, setCurrentUser] = useState(null);
    const [myTasks, setMyTasks] = useState([]);
    const [filterStatus, setFilterStatus] = useState('ALL'); 
    const [editingTask, setEditingTask] = useState(null);
    const [updatePayload, setUpdatePayload] = useState({ status: '', percent: 0, submissionLink: '' });
    const [selectedTaskForDetail, setSelectedTaskForDetail] = useState(null);

    // CHAT SUPPORT
    const [activeTab, setActiveTab] = useState('TASKS'); // TASKS | CHAT
    const [chatSelection, setChatSelection] = useState({ type: null, data: null }); // type: 'PROJECT' | 'USER'
    const [chatUsers, setChatUsers] = useState([]);
    const [chatProjects, setChatProjects] = useState([]);
    const fetchMyTasks = async (userId) => {
        try {
            const res = await api.get(`/tasks/my-tasks/${userId}`);
            setMyTasks(res.data);
        } catch (err) { console.error(err); }
    };

    useEffect(() => {
        const userJson = localStorage.getItem('user');
        if (!userJson) { navigate('/'); return; }
        const userObj = JSON.parse(userJson);
        // eslint-disable-next-line
        setCurrentUser(userObj);
        fetchMyTasks(userObj.id);
    }, []);

    const fetchMyTasks1 = async (userId) => {
        try {
            const res = await api.get(`/tasks/my-tasks/${userId}`);
            setMyTasks(res.data);
            
            // Extract unique projects from tasks for chat
            const projectsMap = {};
            res.data.forEach(t => {
                if (t.project) projectsMap[t.project.id] = t.project;
            });
            setChatProjects(Object.values(projectsMap));
            
        } catch (err) { console.error(err); }
    };

    const fetchDepartmentUsers = async () => {
        try {
            const res = await api.get('/users');
            // Show users in the same department (or manager)
            const others = res.data.filter(u => u.id !== currentUser.id && u.department?.id === currentUser.department?.id);
            setChatUsers(others);
        } catch (err) { console.error(err); }
    };

    // Khi mở tab CHAT, fetch users
    useEffect(() => {
        if (activeTab === 'CHAT' && chatUsers.length === 0) {
            fetchDepartmentUsers();
        }
    }, [activeTab]);

    const handleUpdate = async (e) => {
        e.preventDefault();
        try {
            await api.put(`/tasks/${editingTask.id}/status`, {
                status: updatePayload.status,
                percent: parseInt(updatePayload.percent),
                submissionLink: updatePayload.submissionLink
            });
            alert("🎉 Đã cập nhật tiến độ!");
            setEditingTask(null);
            fetchMyTasks(currentUser.id);
        } catch (err) { alert("Lỗi: " + (err.response?.data || err.message)); }
    };

    const handleLogout = () => { localStorage.removeItem('user'); navigate('/'); };
    if (!currentUser) return <div>Loading...</div>;
    const filteredTasks = myTasks.filter(t => filterStatus === 'ALL' || t.status === filterStatus);
    const stats = {
        todo: myTasks.filter(t => t.status === 'TO_DO').length,
        progress: myTasks.filter(t => t.status === 'IN_PROGRESS').length,
        done: myTasks.filter(t => t.status === 'DONE').length
    };

    return (
        <div className="min-vh-100 bg-light d-flex flex-column" style={{fontFamily: "'Segoe UI', sans-serif"}}>
            <nav className="navbar navbar-dark bg-primary px-4 shadow w-100">
                <div className="container-fluid">
                    <div className="d-flex align-items-center text-white"><i className="bi bi-person-workspace fs-4 me-2"></i><span className="fw-bold tracking-wide">EMPLOYEE ZONE</span></div>
                    <div className="d-flex align-items-center gap-3 ms-auto">
                        <button onClick={() => setActiveTab('TASKS')} className={`btn btn-sm fw-bold ${activeTab==='TASKS'?'btn-light text-primary':'btn-outline-light'}`}>
                            <i className="bi bi-list-task me-1"></i> Công việc
                        </button>
                        <button onClick={() => setActiveTab('CHAT')} className={`btn btn-sm fw-bold ${activeTab==='CHAT'?'btn-light text-primary':'btn-outline-light'}`}>
                            <i className="bi bi-chat-dots-fill me-1"></i> Tin nhắn
                        </button>
                        <NotificationBell />
                        <button onClick={() => navigate('/profile')} className="btn btn-sm btn-outline-light fw-bold">
                            <i className="bi bi-person-fill me-1"></i> Tài khoản
                        </button>
                        <button onClick={handleLogout} className="btn btn-sm btn-outline-light fw-bold">Đăng xuất</button>
                    </div>
                </div>
            </nav>

            <div className="container-fluid px-4 py-5 flex-grow-1">
                <div className="row mb-4 align-items-center justify-content-center">
                    <div className="col-lg-8 d-flex align-items-center">
                        {currentUser.avatarUrl ? (
                            <img src={currentUser.avatarUrl} alt={currentUser.fullName} className="rounded-circle me-3" style={{width: 60, height: 60, objectFit: 'cover'}} />
                        ) : (
                            <div className="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center fw-bold me-3" style={{width: 60, height: 60, fontSize: '1.8rem'}}>
                                {currentUser.fullName.charAt(0).toUpperCase()}
                            </div>
                        )}
                        <div>
                            <h3 className="fw-bold text-dark mb-0">{currentUser.fullName} 👋</h3>
                            <p className="text-muted mb-0">Đây là danh sách công việc của bạn.</p>
                        </div>
                    </div>
                    <div className="col-lg-4 text-lg-end mt-3 mt-lg-0">
                         <div className="bg-white p-2 rounded-pill shadow-sm d-inline-flex gap-2">
                             <span className="badge rounded-pill bg-secondary px-3 py-2">To Do: {stats.todo}</span>
                             <span className="badge rounded-pill bg-warning text-dark px-3 py-2">Doing: {stats.progress}</span>
                             <span className="badge rounded-pill bg-success px-3 py-2">Done: {stats.done}</span>
                         </div>
                    </div>
                    {activeTab === 'TASKS' && (
                        <div className="col-lg-4 text-lg-end mt-3 mt-lg-0">
                             <div className="bg-white p-2 rounded-pill shadow-sm d-inline-flex gap-2">
                                 <span className="badge rounded-pill bg-secondary px-3 py-2">To Do: {stats.todo}</span>
                                 <span className="badge rounded-pill bg-warning text-dark px-3 py-2">Doing: {stats.progress}</span>
                                 <span className="badge rounded-pill bg-success px-3 py-2">Done: {stats.done}</span>
                             </div>
                        </div>
                    )}
                </div>

                {activeTab === 'TASKS' ? (

                <div className="card shadow-sm border-0 mx-auto">
                    <div className="card-header bg-white py-3 border-bottom d-flex justify-content-between align-items-center">
                        <h5 className="fw-bold text-primary mb-0"><i className="bi bi-list-task me-2"></i>Công Việc Của Tôi</h5>
                        <div className="btn-group">
                            <button className={`btn btn-sm ${filterStatus==='ALL'?'btn-primary':'btn-outline-primary'}`} onClick={()=>setFilterStatus('ALL')}>Tất cả</button>
                            <button className={`btn btn-sm ${filterStatus==='TO_DO'?'btn-primary':'btn-outline-primary'}`} onClick={()=>setFilterStatus('TO_DO')}>Mới</button>
                            <button className={`btn btn-sm ${filterStatus==='IN_PROGRESS'?'btn-primary':'btn-outline-primary'}`} onClick={()=>setFilterStatus('IN_PROGRESS')}>Đang làm</button>
                            <button className={`btn btn-sm ${filterStatus==='DONE'?'btn-primary':'btn-outline-primary'}`} onClick={()=>setFilterStatus('DONE')}>Xong</button>
                        </div>
                    </div>

                    <div className="card-body bg-light p-3">
                        <div className="row g-3">
                            {filteredTasks.map(task => (
                                <div key={task.id} className="col-12 col-md-6 col-lg-4 col-xl-3">
                                    <div className="card h-100 border-0 shadow-sm task-card transition">
                                        <div className="card-body">
                                            <div className="d-flex justify-content-between mb-2">
                                                <small className="fw-bold text-primary text-uppercase" style={{fontSize: '0.75rem'}}>{task.project?.name}</small>
                                                <span className={`badge ${task.priority==='HIGH'?'bg-danger':task.priority==='MEDIUM'?'bg-warning text-dark':'bg-info'}`}>{task.priority}</span>
                                            </div>
                                            <h6 className="fw-bold mb-2">{task.title}</h6>
                                            <p className="text-muted small mb-3 text-truncate">{task.description}</p>
                                            
                                            <div className="d-flex align-items-center mb-3">
                                                <div className="progress flex-grow-1" style={{height: 6}}><div className={`progress-bar ${task.status==='DONE'?'bg-success':'bg-primary'}`} style={{width: `${task.completionPercentage}%`}}></div></div>
                                                <small className="ms-2 fw-bold">{task.completionPercentage}%</small>
                                            </div>

                                            <div className="d-flex justify-content-between align-items-end border-top pt-3 gap-2">
                                                <div className={`badge ${task.status==='DONE'?'bg-success':task.status==='IN_PROGRESS'?'bg-primary':'bg-secondary'}`}>{task.status.replace('_', ' ')}</div>
                                                <div className="d-flex gap-2">
                                                    <button className="btn btn-sm btn-success fw-bold rounded-pill px-3" onClick={()=>setSelectedTaskForDetail(task)} title="Xem chi tiết & bình luận">💬 Bình luận</button>
                                                    {task.project?.status === 'CLOSED' ? (
                                                        <button className="btn btn-sm btn-secondary disabled rounded-pill px-3" title="Dự án đã đóng" disabled>🔒</button>
                                                    ) : (
                                                        <button className="btn btn-sm btn-outline-dark fw-bold rounded-pill px-3" onClick={()=>{setEditingTask(task); setUpdatePayload({status: task.status, percent: task.completionPercentage, submissionLink: task.submissionLink || ''});}}>Cập nhật</button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {filteredTasks.length === 0 && <div className="text-center py-5 text-muted">Không tìm thấy công việc nào trong mục này.</div>}
                        </div>
                    </div>
                </div>
                ) : (
                <div className="card shadow-sm border-0 mx-auto" style={{ minHeight: '600px' }}>
                    <div className="row g-0 h-100">
                        {/* Sidebar Chat */}
                        <div className="col-md-4 col-lg-3 border-end bg-white" style={{ minHeight: '600px' }}>
                            <div className="p-3 border-bottom bg-light fw-bold text-primary">
                                <i className="bi bi-chat-left-text-fill me-2"></i> Khung Chat
                            </div>
                            
                            <div className="p-2">
                                <div className="text-muted small fw-bold mb-2 ps-2 mt-2">DỰ ÁN KHẢ DỤNG</div>
                                {chatProjects.map(p => (
                                    <div 
                                        key={p.id} 
                                        className={`p-2 mb-1 rounded cursor-pointer transition ${chatSelection.data?.id === p.id && chatSelection.type === 'PROJECT' ? 'bg-primary text-white' : 'hover-bg-light'}`}
                                        onClick={() => setChatSelection({ type: 'PROJECT', data: p })}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <div className="fw-bold">📁 {p.name}</div>
                                    </div>
                                ))}
                                {chatProjects.length === 0 && <div className="text-muted small ps-2">Chưa tham gia dự án nào</div>}

                                <div className="text-muted small fw-bold mb-2 ps-2 mt-4">INBOX 1-1 (ĐỒNG NGHIỆP)</div>
                                {chatUsers.map(u => (
                                    <div 
                                        key={u.id} 
                                        className={`d-flex align-items-center p-2 mb-1 rounded cursor-pointer transition ${chatSelection.data?.id === u.id && chatSelection.type === 'USER' ? 'bg-primary text-white' : 'hover-bg-light'}`}
                                        onClick={() => setChatSelection({ type: 'USER', data: u })}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <div className="bg-secondary bg-opacity-25 rounded-circle text-center me-2 fw-bold" style={{ width: 32, height: 32, lineHeight: '32px' }}>
                                            {u.fullName.charAt(0)}
                                        </div>
                                        <div className="fw-bold text-truncate">{u.fullName}</div>
                                    </div>
                                ))}
                                {chatUsers.length === 0 && <div className="text-muted small ps-2">Chưa có ai trong phòng ban</div>}
                            </div>
                        </div>
                        
                        {/* Main Chat Area */}
                        <div className="col-md-8 col-lg-9 bg-light p-0 position-relative" style={{ height: '600px' }}>
                            {chatSelection.type === 'PROJECT' && chatSelection.data && (
                                <ProjectChatPanel project={chatSelection.data} currentUser={currentUser} />
                            )}
                            
                            {chatSelection.type === 'USER' && chatSelection.data && (
                                <PrivateChatPanel currentUser={currentUser} targetUser={chatSelection.data} />
                            )}

                            {!chatSelection.type && (
                                <div className="h-100 d-flex flex-column align-items-center justify-content-center text-muted">
                                    <i className="bi bi-chat-dots opacity-25" style={{ fontSize: '4rem' }}></i>
                                    <h5>Chọn một đoạn chat để bắt đầu</h5>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                )}
            </div>

            {editingTask && (
                <div className="modal-backdrop-custom">
                    <div className="card shadow-lg border-0" style={{width: 400}}>
                        <div className="card-header bg-dark text-white fw-bold d-flex justify-content-between"><span>Cập nhật tiến độ</span><button className="btn-close btn-close-white" onClick={()=>setEditingTask(null)}></button></div>
                        <div className="card-body">
                            <h6 className="fw-bold text-primary mb-3">{editingTask.title}</h6>
                            <form onSubmit={handleUpdate}>
                                <div className="mb-3"><label className="form-label fw-bold small text-muted">TRẠNG THÁI</label><select className="form-select" value={updatePayload.status} onChange={e=>setUpdatePayload({...updatePayload, status: e.target.value})}><option value="TO_DO">To Do (Mới nhận)</option><option value="IN_PROGRESS">In Progress (Đang làm)</option><option value="DONE">Done (Hoàn thành)</option></select></div>
                                <div className="mb-4"><label className="form-label fw-bold small text-muted">TIẾN ĐỘ ({updatePayload.percent}%)</label><input type="range" className="form-range" min="0" max="100" value={updatePayload.percent} onChange={e=>setUpdatePayload({...updatePayload, percent: e.target.value})} /></div>
                                <div className="mb-4"><label className="form-label fw-bold small text-muted">LINK NỘP BÀI (Google Drive, GitHub...)</label><input type="text" className="form-control" placeholder="Dán link bài nộp vào đây..." value={updatePayload.submissionLink || ''} onChange={e=>setUpdatePayload({...updatePayload, submissionLink: e.target.value})} /></div>
                                <div className="d-flex gap-2"><button type="button" className="btn btn-light w-50 fw-bold" onClick={()=>setEditingTask(null)}>Hủy</button><button className="btn btn-primary w-50 fw-bold">LƯU LẠI</button></div>
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

            <style>{`.modal-backdrop-custom { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1050; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px); } .task-card:hover { transform: translateY(-5px); box-shadow: 0 10px 20px rgba(0,0,0,0.1) !important; } .transition { transition: all 0.3s ease; } .hover-bg-light:hover { background-color: #f8f9fa; }`}</style>
        </div>
    );
};
export default EmployeeDashboard;