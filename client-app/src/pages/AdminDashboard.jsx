import { useEffect, useState } from 'react';
import api from '../api';
import { useNavigate } from 'react-router-dom';
import NotificationBell from '../components/NotificationBell';

const AdminDashboard = () => {
    const navigate = useNavigate();
    const currentUser = JSON.parse(localStorage.getItem('user')); 

    const [users, setUsers] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [projects, setProjects] = useState([]); 
    const [completedProjects, setCompletedProjects] = useState([]);
    const [viewingCompletedProject, setViewingCompletedProject] = useState(null); 
    const [searchTerm, setSearchTerm] = useState('');

    const [activeTab, setActiveTab] = useState('users'); 
    const [selectedDept, setSelectedDept] = useState(null); 
    const [showProjectForm, setShowProjectForm] = useState(false);

    const [newUser, setNewUser] = useState({ fullName: '', email: '', password: '', role: 'EMPLOYEE', deptId: '' });
    const [avatarPreview, setAvatarPreview] = useState(null);
    const [avatarFile, setAvatarFile] = useState(null);
    const [avatarUrl, setAvatarUrl] = useState('');
    const [newDept, setNewDept] = useState({ name: '', description: '' });
    const [newProject, setNewProject] = useState({ name: '', description: '', deadline: '', priority: 'MEDIUM' });

    const fetchData = async () => {
        try {
            const [usersRes, deptsRes, projectsRes] = await Promise.all([
                api.get('/users'),
                api.get('/departments'),
                api.get('/projects')
            ]);
            console.log("Users:", usersRes.data);
            console.log("Departments:", deptsRes.data);
            console.log("Projects:", projectsRes.data);
            setUsers(usersRes.data);
            setDepartments(deptsRes.data);
            
            const allProjects = projectsRes.data;
            setProjects(allProjects.filter(p => p.status !== 'CLOSED'));
            setCompletedProjects(allProjects.filter(p => p.status === 'CLOSED'));
        } catch (error) { console.error("Lỗi tải dữ liệu:", error); }
    };

    useEffect(() => { fetchData(); }, []);
    const handleLogout = () => { localStorage.removeItem('user'); navigate('/'); };

    const handleSearchUser = async (e) => {
        e.preventDefault();
        try {
            const res = await api.get(`/users/search?keyword=${searchTerm}`);
            setUsers(res.data);
        } catch (err) { console.error("Lỗi tìm kiếm:", err); }
    };

    const handleResetSearch = () => { setSearchTerm(''); fetchData(); };

    const handleAvatarSelect = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (!file.type.match(/image\/(png|jpeg|jpg)/)) {
                alert("Vui lòng chọn file ảnh PNG hoặc JPG!");
                return;
            }
            if (file.size > 5 * 1024 * 1024) {
                alert("Kích thước ảnh không được vượt quá 5MB!");
                return;
            }
            setAvatarFile(file);
            setAvatarUrl('');
            const reader = new FileReader();
            reader.onload = (e) => {
                setAvatarPreview(e.target.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleEditAvatar = () => {
        document.getElementById('avatarInput').click();
    };

    const handleAvatarUrlChange = (e) => {
        const url = e.target.value;
        setAvatarUrl(url);
        setAvatarFile(null);
        document.getElementById('avatarInput').value = '';
    };

    const handleLoadAvatarFromUrl = () => {
        if (!avatarUrl.trim()) {
            alert("Vui lòng nhập URL ảnh!");
            return;
        }
        const img = new Image();
        img.onload = () => {
            setAvatarPreview(avatarUrl);
            setAvatarFile(null);
        };
        img.onerror = () => {
            alert("Không thể tải ảnh từ URL này. Vui lòng kiểm tra lại!");
            setAvatarUrl('');
            setAvatarPreview(null);
        };
        img.src = avatarUrl;
    };

    const handleRemoveAvatar = () => {
        setAvatarFile(null);
        setAvatarPreview(null);
        setAvatarUrl('');
        document.getElementById('avatarInput').value = '';
    };

    const handleAddUser = async (e) => {
        e.preventDefault();
        try {
            if (avatarFile || avatarUrl) {
                const formData = new FormData();
                formData.append('fullName', newUser.fullName);
                formData.append('email', newUser.email);
                formData.append('password', newUser.password);
                formData.append('role', newUser.role);
                if (newUser.deptId) formData.append('deptId', newUser.deptId);
                if (avatarFile) {
                    formData.append('avatar', avatarFile);
                } else if (avatarUrl) {
                    formData.append('avatarUrl', avatarUrl);
                }
                
                await api.post('/users/create-with-avatar', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
            } else {
                let url = '/users';
                if (newUser.deptId) url += `?deptId=${newUser.deptId}`;
                await api.post(url, newUser);
            }
            
            alert("Thêm nhân sự thành công!"); 
            setNewUser({ fullName: '', email: '', password: '', role: 'EMPLOYEE', deptId: '' });
            setAvatarFile(null);
            setAvatarPreview(null);
            setAvatarUrl('');
            document.getElementById('avatarInput').value = '';
            await fetchData();
        } catch (err) { alert("Lỗi: " + err.message); }
    };

    const handleDeleteUser = async (id) => {
        if (!window.confirm("Xóa nhân viên này?")) return;
        try { await api.delete(`/users/${id}`); fetchData(); } catch (err) { alert("Lỗi xóa!"); }
    };

    const handleAddDept = async (e) => {
        e.preventDefault();
        try { 
            await api.post('/departments', newDept); 
            alert("Thêm phòng thành công!"); 
            setNewDept({ name: '', description: '' });
            await fetchData(); 
        } catch (err) { alert("Lỗi thêm phòng!"); }
    };

    const handleAddProject = async (e) => {
        e.preventDefault();
        if (!selectedDept) return;
        try {
            const url = `/projects/create?deptId=${selectedDept.id}&email=${currentUser.email}`;
            await api.post(url, newProject);
            alert(`Đã tạo dự án cho phòng ${selectedDept.name}!`);
            fetchData();
            setNewProject({ name: '', description: '', deadline: '', priority: 'MEDIUM' });
            setShowProjectForm(false);
        } catch (error) { alert("Lỗi tạo dự án!"); }
    };

    const getProjectsByDept = (deptId) => { return projects.filter(p => (p.deptId == deptId || p.department?.id == deptId)); };
    const getCompletedProjectsByDept = (deptId) => { return completedProjects.filter(p => (p.deptId == deptId || p.department?.id == deptId)); };

    return (
        <div className="min-vh-100 bg-light d-flex flex-column" style={{fontFamily: "'Segoe UI', sans-serif"}}>
            <nav className="navbar navbar-expand-lg navbar-light bg-white shadow-sm px-4 sticky-top border-bottom w-100">
                <div className="container-fluid">
                    <div className="d-flex align-items-center"><span className="fs-4 me-2">🚀</span><span className="navbar-brand fw-bold text-primary tracking-wide">ADMIN PORTAL</span></div>
                    <div className="ms-auto d-flex align-items-center gap-3">
                        <NotificationBell />
                        <button onClick={() => navigate('/profile')} className="btn btn-outline-primary btn-sm rounded-pill px-4 fw-bold">
                            <i className="bi bi-person-fill me-1"></i>
                            Tài khoản
                        </button>
                        <button onClick={handleLogout} className="btn btn-outline-dark btn-sm rounded-pill px-4 fw-bold">Đăng xuất</button>
                    </div>
                </div>
            </nav>
            
            <div className="container-fluid px-4 py-4 flex-grow-1">
                <div className="d-flex justify-content-center mb-4">
                    <div className="bg-white p-1 rounded-pill shadow-sm d-inline-flex">
                        <button className={`btn rounded-pill px-4 fw-bold ${activeTab === 'users' ? 'btn-primary shadow' : 'btn-light text-muted'}`} onClick={() => setActiveTab('users')}>👥 Nhân sự</button>
                        <button className={`btn rounded-pill px-4 fw-bold ms-2 ${activeTab === 'departments' ? 'btn-primary shadow' : 'btn-light text-muted'}`} onClick={() => setActiveTab('departments')}>🏢 Phòng Ban & Dự Án</button>
                        <button className={`btn rounded-pill px-4 fw-bold ms-2 ${activeTab === 'completed' ? 'btn-success shadow' : 'btn-light text-muted'}`} onClick={() => setActiveTab('completed')}>✅ Dự án Hoàn thành</button>
                        <button className="btn rounded-pill px-3 fw-bold ms-2 btn-outline-primary" onClick={fetchData} title="Tải lại dữ liệu">🔄</button>
                    </div>
                </div>

                {activeTab === 'users' && (
                    <div className="row g-4">
                        <div className="col-12 col-md-3 col-xl-2"> 
                            <div className="card border-0 shadow-sm h-100">
                                <div className="card-header bg-primary text-white fw-bold py-3">Thêm Nhân Sự Mới</div>
                                <div className="card-body bg-light">
                                    <form onSubmit={handleAddUser}>
                                        <div className="mb-3 text-center">
                                            <div className="position-relative d-inline-block">
                                                {avatarPreview ? (
                                                    <img src={avatarPreview} alt="Avatar preview" className="rounded-circle border-3 border-primary" style={{width: 100, height: 100, objectFit: 'cover'}} />
                                                ) : (
                                                    <div className="rounded-circle bg-light border-2 border-secondary d-flex align-items-center justify-content-center" style={{width: 100, height: 100}}>
                                                        <i className="bi bi-image text-muted" style={{fontSize: '2rem'}}></i>
                                                    </div>
                                                )}
                                                <input type="file" id="avatarInput" accept="image/png,image/jpeg,image/jpg" onChange={handleAvatarSelect} style={{display: 'none'}} />
                                            </div>
                                            <div className="d-flex gap-2 mt-3 justify-content-center flex-wrap">
                                                <button type="button" className="btn btn-sm btn-outline-primary fw-bold" onClick={handleEditAvatar} title="Tải file ảnh từ máy tính" disabled={avatarUrl && avatarPreview}>
                                                    <i className="bi bi-upload me-1"></i>File
                                                </button>
                                                {avatarPreview && (
                                                    <button type="button" className="btn btn-sm btn-outline-danger fw-bold" onClick={handleRemoveAvatar}>
                                                        <i className="bi bi-trash me-1"></i>Xóa
                                                    </button>
                                                )}
                                            </div>
                                            <small className="text-muted d-block mt-2">Chọn một trong hai: File hoặc URL</small>
                                            <div className="mt-3 mb-3">
                                                <div className="input-group input-group-sm">
                                                    <input 
                                                        type="url" 
                                                        className="form-control" 
                                                        placeholder="https://example.com/avatar.jpg"
                                                        value={avatarUrl}
                                                        onChange={handleAvatarUrlChange}
                                                        disabled={avatarFile}
                                                    />
                                                    <button 
                                                        type="button" 
                                                        className="btn btn-outline-success fw-bold"
                                                        onClick={handleLoadAvatarFromUrl}
                                                        title="Tải ảnh từ URL"
                                                        disabled={avatarFile}
                                                    >
                                                        <i className="bi bi-globe me-1"></i>Tải
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                        <hr />
                                        <input className="form-control mb-3" placeholder="Họ tên" required value={newUser.fullName} onChange={e => setNewUser({ ...newUser, fullName: e.target.value })} />
                                        <input className="form-control mb-3" placeholder="Email" required value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} />
                                        <input className="form-control mb-3" placeholder="Mật khẩu" required value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} />
                                        <select className="form-select mb-3" value={newUser.deptId} onChange={e => setNewUser({ ...newUser, deptId: e.target.value })}>
                                            <option value="">-- Chọn phòng ban --</option>
                                            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                        </select>
                                        <select className="form-select mb-4" value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })}>
                                            <option value="EMPLOYEE">Nhân viên</option><option value="MANAGER">Trưởng phòng</option><option value="ADMIN">Quản trị viên</option>
                                        </select>
                                        <button className="btn btn-primary w-100 fw-bold">TẠO MỚI</button>
                                    </form>
                                </div>
                            </div>
                        </div>
                        <div className="col-12 col-md-9 col-xl-10">
                            <div className="card border-0 shadow-sm h-100">
                                <div className="card-header bg-white py-3 border-bottom d-flex justify-content-between align-items-center">
                                    <h5 className="mb-0 text-primary fw-bold">Danh sách Nhân viên</h5>
                                    <form onSubmit={handleSearchUser} className="d-flex gap-2">
                                        <input className="form-control form-control-sm" placeholder="Tìm tên hoặc email..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}/>
                                        <button type="submit" className="btn btn-sm btn-primary"><i className="bi bi-search"></i></button>
                                        <button type="button" className="btn btn-sm btn-light border" onClick={handleResetSearch} title="Reset"><i className="bi bi-arrow-counterclockwise"></i></button>
                                    </form>
                                </div>
                                <div className="table-responsive">
                                    <table className="table table-hover align-middle mb-0">
                                        <thead className="table-light"><tr><th style={{width: '60px'}}>Avatar</th><th>Họ tên</th><th>Email</th><th>Phòng</th><th>Vai trò</th><th></th></tr></thead>
                                        <tbody>
                                            {users.map(u => (
                                                <tr key={u.id}>
                                                    <td className="text-center">
                                                        {u.avatar ? (
                                                            <img src={u.avatar} alt={u.fullName} className="rounded-circle" style={{width: 40, height: 40, objectFit: 'cover'}} />
                                                        ) : (
                                                            <div className="rounded-circle bg-primary d-flex align-items-center justify-content-center mx-auto" style={{width: 40, height: 40}}>
                                                                <i className="bi bi-person-fill text-white" style={{fontSize: '18px'}}></i>
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="fw-bold">{u.fullName}</td>
                                                    <td>{u.email}</td>
                                                    <td>{u.department?.name || <span className="text-muted small">--</span>}</td>
                                                    <td><span className={`badge ${u.role === 'ADMIN' ? 'bg-danger' : u.role === 'MANAGER' ? 'bg-warning text-dark' : 'bg-info text-white'}`}>{u.role}</span></td>
                                                    <td className="text-end"><button className="btn btn-sm btn-outline-danger border-0" onClick={() => handleDeleteUser(u.id)}>❌</button></td>
                                                </tr>
                                            ))}
                                            {users.length === 0 && <tr><td colSpan="6" className="text-center py-4 text-muted">Không tìm thấy nhân viên nào.</td></tr>}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                
                {activeTab === 'departments' && (
                    <div className="row g-4">
                        <div className="col-12 col-md-3 col-xl-2">
                            <div className="card border-0 shadow-sm mb-4">
                                <div className="card-header bg-primary text-white fw-bold">Tạo Phòng Ban</div>
                                <div className="card-body bg-white">
                                    <form onSubmit={handleAddDept}>
                                        <input className="form-control mb-2" placeholder="Tên phòng" required value={newDept.name} onChange={e => setNewDept({...newDept, name: e.target.value})} />
                                        <textarea className="form-control mb-3" placeholder="Mô tả" rows="2" value={newDept.description} onChange={e => setNewDept({...newDept, description: e.target.value})}></textarea>
                                        <button className="btn btn-primary w-100 fw-bold btn-sm">➕ Thêm</button>
                                    </form>
                                </div>
                            </div>
                            <div className="list-group shadow-sm">
                                {departments.map(d => (
                                    <button key={d.id} className={`list-group-item list-group-item-action py-3 d-flex justify-content-between align-items-center ${selectedDept?.id === d.id ? 'bg-blue-light border-start border-primary border-4' : ''}`} onClick={() => {setSelectedDept(d); setShowProjectForm(false);}}>
                                        <div><div className="fw-bold text-dark">{d.name}</div></div><i className="bi bi-chevron-right text-muted"></i>
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="col-12 col-md-9 col-xl-10">
                            <div className="card border-0 shadow h-100">
                                <div className="card-header bg-white py-3 d-flex justify-content-between align-items-center">
                                    {selectedDept ? (
                                        <><div><h5 className="mb-1 text-primary fw-bold">📂 Dự án: {selectedDept.name}</h5></div><button className="btn btn-sm btn-success fw-bold shadow-sm" onClick={() => setShowProjectForm(!showProjectForm)}>{showProjectForm ? 'Hủy' : '➕ Thêm Dự Án'}</button></>
                                    ) : <h5 className="text-muted mb-0">👈 Chọn phòng ban để xem dự án</h5>}
                                </div>
                                <div className="card-body bg-light">
                                    {selectedDept && showProjectForm && (
                                        <div className="card border-0 shadow-sm mb-4 bg-white"><div className="card-body"><form onSubmit={handleAddProject}><input className="form-control mb-2" placeholder="Tên dự án" required value={newProject.name} onChange={e => setNewProject({...newProject, name: e.target.value})} /><div className="row mb-2"><div className="col-6"><input type="date" className="form-control" required value={newProject.deadline} onChange={e => setNewProject({...newProject, deadline: e.target.value})} /></div><div className="col-6"><select className="form-select" value={newProject.priority} onChange={e => setNewProject({...newProject, priority: e.target.value})}><option value="MEDIUM">TB</option><option value="HIGH">Cao</option></select></div></div><textarea className="form-control mb-2" placeholder="Mô tả" value={newProject.description} onChange={e => setNewProject({...newProject, description: e.target.value})} /><button className="btn btn-success w-100 fw-bold">Lưu</button></form></div></div>
                                    )}
                                    {selectedDept && getProjectsByDept(selectedDept.id).map(p => (
                                        <div key={p.id} className="card border-0 shadow-sm p-3 mb-3"><div className="d-flex justify-content-between"><h6 className="fw-bold">{p.name}</h6><span className="badge bg-warning text-dark">{p.priority}</span></div><small className="text-muted">{p.description}</small></div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'completed' && (
                    <div className="row">
                        <div className="col-12">
                            <h4 className="fw-bold text-success mb-4"><i className="bi bi-check-all me-2"></i>Dự án đã hoàn thành (CLOSED)</h4>
                            {departments.map(dept => {
                                const deptCompletedProjects = getCompletedProjectsByDept(dept.id);
                                if (deptCompletedProjects.length === 0) return null;
                                return (
                                    <div key={dept.id} className="card border-0 shadow-sm mb-4">
                                        <div className="card-header bg-success text-white fw-bold d-flex align-items-center"><i className="bi bi-building me-2"></i>{dept.name}</div>
                                        <div className="card-body bg-light">
                                            <div className="row g-3">
                                                {deptCompletedProjects.map(p => (
                                                    <div key={p.id} className="col-md-6 col-lg-3">
                                                        <div className="card h-100 border-0 shadow-sm hover-shadow" style={{cursor: 'pointer'}} onClick={() => setViewingCompletedProject(p)}>
                                                            <div className="card-body">
                                                                <div className="d-flex justify-content-between mb-2"><span className="badge bg-secondary">🔒 CLOSED</span><small className="text-muted">{p.deadline}</small></div>
                                                                <h6 className="fw-bold text-dark">{p.name}</h6>
                                                                <p className="text-muted small text-truncate">{p.description}</p>
                                                                <div className="d-flex justify-content-between border-top pt-2"><small>{p.members?.length || 0} thành viên</small><span className="text-success small fw-bold">Xem chi tiết &rarr;</span></div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                            {completedProjects.length === 0 && <div className="text-center py-5 text-muted">Chưa có dự án nào hoàn thành.</div>}
                        </div>
                    </div>
                )}
            </div>

            {viewingCompletedProject && (
                <div className="modal-backdrop-custom">
                    <div className="card shadow-lg border-0" style={{width: 600, maxHeight: '80vh', overflowY: 'auto'}}>
                        <div className="card-header bg-success text-white fw-bold d-flex justify-content-between"><span>Chi tiết dự án: {viewingCompletedProject.name}</span><button className="btn-close btn-close-white" onClick={() => setViewingCompletedProject(null)}></button></div>
                        <div className="card-body">
                            <p className="text-muted fst-italic">{viewingCompletedProject.description}</p><hr/>
                            <h6 className="fw-bold text-success"><i className="bi bi-people-fill me-2"></i>Thành viên tham gia</h6>
                            <div className="d-flex flex-wrap gap-2 mb-4">{viewingCompletedProject.members?.map(m => (<span key={m.id} className="badge bg-light text-dark border p-2">{m.fullName}</span>))}</div>
                            <h6 className="fw-bold text-success"><i className="bi bi-list-check me-2"></i>Tổng kết</h6>
                            <div className="alert alert-light border">Dự án này đã được Manager đóng lại.<br/><strong>Ngày hết hạn:</strong> {viewingCompletedProject.deadline}</div>
                            <button className="btn btn-secondary w-100" onClick={() => setViewingCompletedProject(null)}>Đóng</button>
                        </div>
                    </div>
                </div>
            )}
            <style>{`.bg-blue-light { background-color: #e7f1ff; } .modal-backdrop-custom { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); z-index: 1050; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(5px); }`}</style>
        </div>
    );
};
export default AdminDashboard;