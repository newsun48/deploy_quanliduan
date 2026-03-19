import { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const EmployeeDashboard = () => {
    const navigate = useNavigate();
    const [currentUser, setCurrentUser] = useState(null);
    const [myTasks, setMyTasks] = useState([]);
    const [filterStatus, setFilterStatus] = useState('ALL'); 
    const [editingTask, setEditingTask] = useState(null);
    const [updatePayload, setUpdatePayload] = useState({ status: '', percent: 0 });

    useEffect(() => {
        const userJson = localStorage.getItem('user');
        if (!userJson) { navigate('/'); return; }
        const userObj = JSON.parse(userJson);
        setCurrentUser(userObj);
        fetchMyTasks(userObj.id);
    }, []);

    const fetchMyTasks = async (userId) => {
        try {
            const res = await axios.get(`/api/tasks/my-tasks/${userId}`);
            setMyTasks(res.data);
        } catch (err) { console.error(err); }
    };

    const handleUpdate = async (e) => {
        e.preventDefault();
        try {
            await axios.put(`/api/tasks/${editingTask.id}/status`, {
                status: updatePayload.status,
                percent: parseInt(updatePayload.percent)
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
                    <button onClick={handleLogout} className="btn btn-sm btn-light fw-bold text-primary ms-auto">Đăng xuất</button>
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
                </div>

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

                                            <div className="d-flex justify-content-between align-items-end border-top pt-3">
                                                <div className={`badge ${task.status==='DONE'?'bg-success':task.status==='IN_PROGRESS'?'bg-primary':'bg-secondary'}`}>{task.status.replace('_', ' ')}</div>
                                                {task.project?.status === 'CLOSED' ? (
                                                    <button className="btn btn-sm btn-secondary disabled rounded-pill px-3" title="Dự án đã đóng" disabled>🔒 Đã khóa</button>
                                                ) : (
                                                    <button className="btn btn-sm btn-outline-dark fw-bold rounded-pill px-3" onClick={()=>{setEditingTask(task); setUpdatePayload({status: task.status, percent: task.completionPercentage});}}>Cập nhật</button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {filteredTasks.length === 0 && <div className="text-center py-5 text-muted">Không tìm thấy công việc nào trong mục này.</div>}
                        </div>
                    </div>
                </div>
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
                                <div className="d-flex gap-2"><button type="button" className="btn btn-light w-50 fw-bold" onClick={()=>setEditingTask(null)}>Hủy</button><button className="btn btn-primary w-50 fw-bold">LƯU LẠI</button></div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
            <style>{`.modal-backdrop-custom { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1050; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px); } .task-card:hover { transform: translateY(-5px); box-shadow: 0 10px 20px rgba(0,0,0,0.1) !important; } .transition { transition: all 0.3s ease; }`}</style>
        </div>
    );
};
export default EmployeeDashboard;