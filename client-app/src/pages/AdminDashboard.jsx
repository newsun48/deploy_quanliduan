import React, { useState, useEffect } from 'react';
import axios from 'axios';
import api from '../api';
import { useNavigate } from 'react-router-dom';
import { askConfirm } from '../utils/confirm';
import NotificationBell from '../components/NotificationBell';
import Swal from 'sweetalert2';
import './AdminDashboard.css';

const getProjectTimeStatus = (p) => {
    if (p.status === 'CLOSED') return { text: 'Đã hoàn thành', color: 'bg-success text-white' };
    if (!p.startDate || !p.deadline) return { text: 'Chưa xác định', color: 'bg-secondary text-white' };
    const now = new Date();
    const start = new Date(p.startDate);
    const end = new Date(p.deadline);
    now.setHours(0,0,0,0);
    start.setHours(0,0,0,0);
    end.setHours(0,0,0,0);
    
    if (now < start) return { text: 'Chưa bắt đầu', color: 'bg-info text-dark' };
    if (now > end) return { text: 'Quá hạn', color: 'bg-danger text-white' };
    return { text: 'Đang thực hiện', color: 'bg-primary text-white' };
};

const formatDeptName = (name) => {
    if (!name) return '';
    let cleanName = name.trim();
    if (cleanName.toLowerCase().startsWith('phòng ')) {
        cleanName = cleanName.substring(6).trim();
    } else if (cleanName.toLowerCase().startsWith('ban ')) {
        cleanName = cleanName.substring(4).trim();
    }
    return `Phòng ${cleanName}`;
};

const AdminDashboard = () => {
    const navigate = useNavigate();
    const currentUser = JSON.parse(localStorage.getItem('user')); 

    const [users, setUsers] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [projects, setProjects] = useState([]); 
    const [completedProjects, setCompletedProjects] = useState([]);
    const [deletedProjects, setDeletedProjects] = useState([]);
    const [viewingCompletedProject, setViewingCompletedProject] = useState(null); 
    const [searchTerm, setSearchTerm] = useState('');

    const [activeTab, setActiveTab] = useState('users'); 
    const [selectedDept, setSelectedDept] = useState(null); 
    const [showProjectForm, setShowProjectForm] = useState(false);
    const [showProfileMenu, setShowProfileMenu] = useState(false);

    const [newUser, setNewUser] = useState({ fullName: '', email: '', password: '', role: 'EMPLOYEE', deptId: '' });
    const [avatarFile, setAvatarFile] = useState(null);
    const [avatarPreview, setAvatarPreview] = useState(null);
    const [avatarUrl, setAvatarUrl] = useState('');
    const [newDept, setNewDept] = useState({ name: '', description: '' });
    const [newProject, setNewProject] = useState({ name: '', description: '', startDate: '', deadline: '', priority: 'MEDIUM' });
    const [projectViewMode, setProjectViewMode] = useState('grid');
    const [showMemberModal, setShowMemberModal] = useState(false);
    const [selectedProjectForMember, setSelectedProjectForMember] = useState(null);
    const [availableMembers, setAvailableMembers] = useState([]);
    const [selectedMembersToAdd, setSelectedMembersToAdd] = useState([]);
    const [showDeptMemberModal, setShowDeptMemberModal] = useState(false);
    const [selectedDeptForMember, setSelectedDeptForMember] = useState(null);
    const [availableDeptMembers, setAvailableDeptMembers] = useState([]);
    const [selectedDeptMembersToAdd, setSelectedDeptMembersToAdd] = useState([]);

    const fetchData = async () => {
        try {
            const [usersRes, deptsRes, projectsRes, deletedRes] = await Promise.all([
                api.get('/users'),
                api.get('/departments'),
                api.get('/projects'),
                api.get(`/projects/deleted?adminEmail=${currentUser.email}`)
            ]);
            console.log("Users:", usersRes.data);
            console.log("Departments:", deptsRes.data);
            console.log("Projects:", projectsRes.data);
            console.log("Deleted Projects:", deletedRes.data);
            
            setUsers(usersRes.data);
            setDepartments(deptsRes.data);
            setProjects(projectsRes.data.filter(p => !p.isDeleted));
            setCompletedProjects(projectsRes.data.filter(p => p.status === 'CLOSED'));
            setDeletedProjects(deletedRes.data);
        } catch (error) { console.error("Lỗi tải dữ liệu:", error); }
    };

    useEffect(() => { 
        // eslint-disable-next-line
        fetchData(); 
    }, []);
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
        if (!(await askConfirm("Xóa nhân viên này?"))) return;
        try { await api.delete(`/users/${id}`); fetchData(); } catch (err) { console.error(err); alert("Lỗi xóa!"); }
    };

    const [editingUserId, setEditingUserId] = useState(null);
    const [editEmail, setEditEmail] = useState('');
    const [editDeptId, setEditDeptId] = useState('');
    const [editRole, setEditRole] = useState('');

    const handleEditUser = (id) => {
        const user = users.find(u => u.id === id);
        setEditingUserId(id);
        setEditEmail(user.email);
        setEditDeptId(user.department?.id || '');
        setEditRole(user.role);
    };

    const handleSaveEdit = async () => {
        try {
            await api.patch(`/users/${editingUserId}`, {
                email: editEmail,
                deptId: editDeptId,
                role: editRole
            }, {
                params: {
                    adminEmail: currentUser.email
                }
            });
            alert('Cập nhật thành công!');
            fetchData();
            setEditingUserId(null);
        } catch (err) {
            const errorData = err.response?.data;
            const message = typeof errorData === 'string' ? errorData : (errorData?.message || err.message);
            alert('Lỗi: ' + message);
        }
    };

    const handleCancelEdit = () => {
        setEditingUserId(null);
    };

    const handleAddDept = async (e) => {
        e.preventDefault();
        try { 
            await api.post('/departments', newDept); 
            alert("Thêm phòng thành công!"); 
            setNewDept({ name: '', description: '' });
            await fetchData(); 
        } catch (err) { console.error(err); alert("Lỗi thêm phòng!"); }
    };

    const handleEditDepartment = async (dept) => {
        let availableManagers = users.filter(u => u.role === 'MANAGER');
        
        const { value: formValues } = await Swal.fire({
            title: 'Sửa Thông Tin Phòng Ban',
            html: `
                <div class="text-start">
                    <label class="form-label fw-bold small text-muted">Tên Phòng Ban</label>
                    <input id="swal-edit-dname" class="form-control mb-3" value="${formatDeptName(dept.name).replace('Phòng ', '')}">
                    
                    <label class="form-label fw-bold small text-muted">Mô Tả</label>
                    <textarea id="swal-edit-ddesc" class="form-control mb-3" rows="4">${dept.description || ''}</textarea>

                    <label class="form-label fw-bold small text-muted">Trưởng Phòng</label>
                    <select id="swal-edit-dmanager" class="form-select mb-3">
                        <option value="">-- Chưa có --</option>
                        ${availableManagers.map(m => `<option value="${m.id}" ${(dept.manager?.id === m.id) ? 'selected' : ''}>${m.fullName} (${m.email})</option>`).join('')}
                    </select>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'Lưu',
            cancelButtonText: 'Hủy',
            preConfirm: () => {
                const name = document.getElementById('swal-edit-dname').value.trim();
                const description = document.getElementById('swal-edit-ddesc').value.trim();
                const managerId = document.getElementById('swal-edit-dmanager').value;
                if (!name) {
                    Swal.showValidationMessage('Tên phòng ban không được để trống!');
                    return false;
                }
                return { name, description, managerId };
            }
        });

        if (formValues) {
            try {
                const updatedPayload = { 
                    ...dept, 
                    name: formValues.name, 
                    description: formValues.description 
                };
                if (formValues.managerId) {
                    updatedPayload.manager = { id: formValues.managerId };
                } else {
                    updatedPayload.manager = null;
                }

                await api.put(`/departments/${dept.id}`, updatedPayload);
                await Swal.fire('Thành công', 'Đã cập nhật phòng ban', 'success');
                fetchData();
                if (selectedDept && selectedDept.id === dept.id) {
                    setSelectedDept({ ...selectedDept, name: formValues.name, description: formValues.description });
                }
            } catch (error) {
                Swal.fire("Lỗi", error.response?.data || error.message, "error");
            }
        }
    };

    const handleOpenDeptMemberModal = (dept) => {
        setSelectedDeptForMember(dept);
        let allEmployees = users.filter(u => u.role === 'EMPLOYEE' || u.role === 'QA');
        const available = allEmployees.filter(u => !u.department || u.department.id !== dept.id);
        setAvailableDeptMembers(available);
        setSelectedDeptMembersToAdd([]);
        setShowDeptMemberModal(true);
    };

    const handleAddMemberToDept = async () => {
        if (selectedDeptMembersToAdd.length === 0) {
            alert("Vui lòng chọn ít nhất một nhân viên!");
            return;
        }
        try {
            await api.patch(`/users/bulk-update-dept`, selectedDeptMembersToAdd, {
                params: { 
                    deptId: selectedDeptForMember.id,
                    adminEmail: currentUser.email 
                }
            });
            alert(`✅ Đã thêm ${selectedDeptMembersToAdd.length} nhân viên vào phòng ban!`);
            setShowDeptMemberModal(false);
            setSelectedDeptMembersToAdd([]);
            fetchData();
        } catch (err) {
            console.error("❌ Lỗi thêm member phòng ban:", err);
            alert("Lỗi: " + (err.response?.data?.message || err.response?.data || err.message));
        }
    };

    const handleDeleteDepartment = async (id) => {
        if (await askConfirm('Xóa phòng ban này và toàn bộ dữ liệu liên quan? Hành động này có thể bị từ chối nếu có dự án hoặc nhân sự bám theo!')) {
            try {
                await api.delete(`/departments/${id}`);
                alert("Đã xóa phòng ban!");
                fetchData();
                if (selectedDept && selectedDept.id === id) {
                    setSelectedDept(null);
                }
            } catch (error) {
                alert("Lỗi xóa: " + (error.response?.data || error.message));
            }
        }
    };

    const handleEditProject = async (p) => {
        const { value: formValues } = await Swal.fire({
            title: 'Sửa thông tin dự án',
            html: `
                <div class="text-start">
                    <label class="form-label fw-bold small text-muted">Tên Dự Án</label>
                    <input id="swal-edit-pname" class="form-control mb-3" value="${p.name || ''}" placeholder="Tên dự án">
                    
                    <label class="form-label fw-bold small text-muted">Mô Tả</label>
                    <textarea id="swal-edit-pdesc" class="form-control mb-3" rows="3" placeholder="Mô tả dự án">${p.description || ''}</textarea>
                    
                    <label class="form-label fw-bold small text-muted">Tải File Lên Từ Máy</label>
                    <input type="file" id="swal-edit-pfile" class="form-control mb-3">
                    
                    <label class="form-label fw-bold small text-muted">Hoặc Dán Link Tài Liệu</label>
                    <input id="swal-edit-plink" class="form-control mb-3" value="${p.documentLink || ''}" placeholder="Dán link vào đây">
                    
                    <div class="row mb-3">
                        <div class="col-6">
                            <label class="form-label fw-bold small text-muted">Bắt Đầu</label>
                            <input type="date" id="swal-edit-pstart" class="form-control" value="${p.startDate || ''}">
                        </div>
                        <div class="col-6">
                            <label class="form-label fw-bold small text-muted">Hạn Chót</label>
                            <input type="date" id="swal-edit-pdeadline" class="form-control" value="${p.deadline || ''}">
                        </div>
                    </div>
                </div>
            `,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: 'Lưu thay đổi',
            cancelButtonText: 'Hủy',
            preConfirm: async () => {
                const name = document.getElementById('swal-edit-pname').value;
                const description = document.getElementById('swal-edit-pdesc').value;
                let documentLink = document.getElementById('swal-edit-plink').value;
                const startDate = document.getElementById('swal-edit-pstart').value;
                const deadline = document.getElementById('swal-edit-pdeadline').value;
                const fileInput = document.getElementById('swal-edit-pfile');
                
                if (!name) {
                    Swal.showValidationMessage('Tên dự án không được để trống!');
                    return false;
                }

                if (fileInput.files.length > 0) {
                    const formData = new FormData();
                    formData.append("file", fileInput.files[0]);
                    try {
                        Swal.getConfirmButton().disabled = true;
                        const uploadRes = await api.post('/files/upload', formData, {
                            headers: { 'Content-Type': 'multipart/form-data' }
                        });
                        // Đính URL upload trả về thành documentLink
                        documentLink = "http://localhost:8080" + uploadRes.data.url;
                    } catch (err) {
                        Swal.showValidationMessage('Lỗi upload file: ' + err.message);
                        return false;
                    }
                }
                
                return { name, description, documentLink, startDate, deadline };
            }
        });

        if (formValues) {
            try {
                await api.put(`/projects/${p.id}/update`, formValues);
                await Swal.fire('Thành công!', 'Đã cập nhật dự án.', 'success');
                fetchData();
            } catch (err) {
                Swal.fire('Lỗi', err.response?.data || err.message, 'error');
            }
        }
    };

    const handleOpenMemberModal = (project) => {
        setSelectedProjectForMember(project);
        const projectDeptId = project.deptId || (project.department ? project.department.id : null);
        
        let deptMembersList = users.filter(u => 
            u.department && 
            u.department.id == projectDeptId && 
            (u.role === 'EMPLOYEE' || u.role === 'QA' || u.role === 'MANAGER')
        );
        
        const existingMemberIds = (project.members || []).map(m => m.id);
        const available = deptMembersList.filter(u => !existingMemberIds.includes(u.id));
        
        setAvailableMembers(available);
        setSelectedMembersToAdd([]);
        setShowMemberModal(true);
    };

    const handleAddMemberToProject = async () => {
        if (selectedMembersToAdd.length === 0) {
            alert("Vui lòng chọn ít nhất một nhân viên!");
            return;
        }
        try {
            await api.post(`/projects/${selectedProjectForMember.id}/add-members`, selectedMembersToAdd);
            alert(`✅ Đã thêm ${selectedMembersToAdd.length} nhân sự thành công!`);
            setShowMemberModal(false);
            setSelectedMembersToAdd([]);
            fetchData();
        } catch (err) {
            console.error("❌ Lỗi thêm member:", err);
            const errorMessage = err.response?.data?.message || err.response?.data || err.message || "Thất bại";
            alert("Lỗi: " + errorMessage);
        }
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
        } catch (error) { console.error(error); alert("Lỗi tạo dự án!"); }
    };

    const getProjectsByDept = (deptId) => { return projects.filter(p => (p.deptId == deptId || p.department?.id == deptId)); };
    const getCompletedProjectsByDept = (deptId) => { return completedProjects.filter(p => (p.deptId == deptId || p.department?.id == deptId)); };

    return (
        <div className="min-vh-100 bg-light d-flex flex-column" style={{fontFamily: "'Segoe UI', sans-serif"}}>
            <nav className="navbar navbar-expand-lg navbar-light bg-white shadow-sm px-4 sticky-top border-bottom w-100">
                <div className="container-fluid">
                    <div className="d-flex align-items-center"><span className="fs-4 me-2">🚀</span><span className="navbar-brand fw-bold text-primary tracking-wide">ADMIN PORTAL</span></div>
                    <div className="ms-auto d-flex align-items-center gap-3">
                        <button onClick={() => navigate('/admin/statistics')} className="btn btn-success btn-sm rounded-pill px-3 fw-bold">
                            <i className="bi bi-bar-chart-fill me-1"></i>
                            Thống kê
                        </button>
                        <NotificationBell />
                        <button onClick={() => navigate('/profile')} className="btn btn-outline-primary btn-sm rounded-pill px-4 fw-bold">
                            <i className="bi bi-person-fill me-1"></i>
                            Tài khoản
                        </button>
                        <button onClick={handleLogout} className="btn btn-outline-dark btn-sm rounded-pill px-4 fw-bold">Đăng xuất</button>
                    </div>
        <div className="admin-dashboard-container">
            {/* Header Navbar */}
            <div className="glass-header d-flex justify-content-between align-items-center">
                {/* Logo - Fixed Width for Balance */}
                <div className="d-flex align-items-center" style={{width: '280px'}}>
                    <span className="fs-3 me-2">🚀</span>
                    <span className="brand-text d-none d-md-block">ADMIN PRO</span>
                </div>

                {/* Centered Menu */}
                <div className="top-menu d-none d-xl-flex justify-content-center">
                    <button className={`top-menu-item ${activeTab === 'users' ? 'active' : ''}`} onClick={() => setActiveTab('users')}>
                        <i className="bi bi-people-fill top-menu-icon" style={{color: activeTab === 'users' ? '#4318ff' : '#a3aed1'}}></i> Nhân sự
                    </button>
                    <button className={`top-menu-item ${activeTab === 'departments' ? 'active' : ''}`} onClick={() => setActiveTab('departments')}>
                        <i className="bi bi-building top-menu-icon" style={{color: activeTab === 'departments' ? '#4318ff' : '#a3aed1'}}></i> Phòng Ban
                    </button>
                    <button className={`top-menu-item ${activeTab === 'projects' ? 'active' : ''}`} onClick={() => setActiveTab('projects')}>
                        <i className="bi bi-folder-fill top-menu-icon" style={{color: activeTab === 'projects' ? '#4318ff' : '#a3aed1'}}></i> Dự Án
                    </button>
                    <button className={`top-menu-item ${activeTab === 'completed' ? 'active' : ''}`} onClick={() => setActiveTab('completed')}>
                        <i className="bi bi-check-circle-fill top-menu-icon" style={{color: activeTab === 'completed' ? '#4318ff' : '#a3aed1'}}></i> Đã Hoàn Thành
                    </button>
                    <button className={`top-menu-item ${activeTab === 'deleted' ? 'active' : ''}`} onClick={() => setActiveTab('deleted')}>
                        <i className="bi bi-trash-fill top-menu-icon" style={{color: activeTab === 'deleted' ? '#4318ff' : '#a3aed1'}}></i> Thùng rác
                    </button>
                </div>

                {/* Right Profile Actions */}
                <div className="d-flex align-items-center justify-content-end gap-3" style={{width: '280px'}}>
                    <div className="d-none d-md-block"><NotificationBell /></div>
                    
                    <div className="dropdown position-relative ms-2">
                        <div 
                            className="d-flex align-items-center py-1 px-2 rounded-pill shadow-sm" 
                            style={{cursor: 'pointer', background: showProfileMenu ? '#f4f7fe' : 'transparent', transition: 'all 0.2s', border: '1px solid #e2e8f0'}} 
                            onClick={() => setShowProfileMenu(!showProfileMenu)}
                        >
                            <div className="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center fw-bold shadow-sm overflow-hidden" style={{width: 36, height: 36}}>
                                {currentUser?.avatarUrl ? (
                                    <img src={currentUser.avatarUrl} alt="Avatar" style={{width: '100%', height: '100%', objectFit: 'cover'}} />
                                ) : (
                                    currentUser?.fullName ? currentUser.fullName.charAt(0).toUpperCase() : 'A'
                                )}
                            </div>
                            <div className="ms-2 me-2 d-none d-sm-block">
                                <div className="fw-bold text-dark" style={{fontSize: '0.85rem', lineHeight: '1.2'}}>{currentUser.fullName}</div>
                                <small className="text-muted" style={{fontSize: '0.7rem'}}>Administrator</small>
                            </div>
                            <i className="bi bi-chevron-down ms-1 text-muted me-2" style={{fontSize: '0.8rem'}}></i>
                        </div>
                        
                        {showProfileMenu && (
                            <div className="dropdown-menu show shadow border-0 position-absolute end-0 mt-2 p-2 rounded-4" style={{minWidth: '220px', backgroundColor: '#fff', top: '100%', zIndex: 1050}}>
                                <div className="px-3 py-2 mb-1 d-sm-none border-bottom">
                                    <div className="fw-bold text-dark">{currentUser.fullName}</div>
                                    <small className="text-muted">Administrator</small>
                                </div>
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

            {/* Main Content Areas */}
            <div className="admin-main-wrapper">
                <div className="p-4 p-md-5 animate-fade-in content-inner">
                    <div className="d-flex justify-content-between align-items-center mb-4 d-xl-none bg-white p-3 rounded-4 shadow-sm">
                        <h4 className="page-title mb-0 fs-5">{activeTab === 'users' ? 'Quản lý Nhân sự' : activeTab === 'departments' ? 'Phòng Ban & Dự Án' : activeTab === 'completed' ? 'Dự án Hoàn thành' : 'Thùng rác'}</h4>
                        <select className="form-select modern-input w-auto fw-bold text-primary-dark shadow-sm py-1" value={activeTab} onChange={(e) => setActiveTab(e.target.value)}>
                            <option value="users">Nhân sự</option>
                            <option value="departments">Phòng ban</option>
                            <option value="completed">Đã hoàn thành</option>
                            <option value="deleted">Thùng rác</option>
                        </select>
                    </div>
                    {activeTab === 'users' && (
                        <div className="row g-4">
                            <div className="col-12 col-xl-3"> 
                                <div className="modern-card">
                                    <div className="modern-card-header">Thêm Nhân Sự Mới</div>
                                    <div className="card-body p-4 bg-white">
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
                                                <button type="button" className="btn btn-sm btn-outline-primary fw-bold" onClick={handleEditAvatar} title="Chọn ảnh từ máy tính">
                                                    <i className="bi bi-upload me-1"></i>Tải lên
                                                </button>
                                                {avatarPreview && (
                                                    <button type="button" className="btn btn-sm btn-outline-danger fw-bold" onClick={handleRemoveAvatar}>
                                                        <i className="bi bi-trash me-1"></i>Xóa
                                                    </button>
                                                )}
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
                                        <select className="form-select mb-4 modern-input" value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })}>
                                            <option value="EMPLOYEE">Nhân viên</option><option value="MANAGER">Trưởng phòng</option><option value="ADMIN">Quản trị viên</option>
                                        </select>
                                        <button className="modern-btn-primary w-100">TẠO MỚI 👤</button>
                                    </form>
                                </div>
                            </div>
                        </div>
                        <div className="col-12 col-xl-9">
                            <div className="modern-card d-flex flex-column h-100">
                                <div className="modern-card-header d-flex justify-content-between align-items-center">
                                    <span>Danh sách Nhân viên</span>
                                    <form onSubmit={handleSearchUser} className="d-flex gap-2">
                                        <input className="form-control form-control-sm modern-input border-0 py-2 px-3" placeholder="Tìm tên hoặc email..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{minWidth: '220px'}}/>
                                        <button type="submit" className="btn btn-primary rounded-circle shadow-sm d-flex align-items-center justify-content-center" style={{width: '42px', height: '42px'}}><i className="bi bi-search"></i></button>
                                        <button type="button" className="btn btn-light rounded-circle shadow-sm d-flex align-items-center justify-content-center" style={{width: '42px', height: '42px', color: '#a3aed1'}} onClick={handleResetSearch} title="Reset"><i className="bi bi-x-lg"></i></button>
                                    </form>
                                </div>
                                <div className="table-responsive flex-grow-1 p-0">
                                    <table className="table table-hover align-middle mb-0">
                                        <thead className="table-light">
                                            <tr>
                                                <th className="text-center" style={{width: '60px'}}>Ảnh</th>
                                                <th>Thông tin nhân viên</th>
                                                <th>Liên hệ (Email)</th>
                                                <th>Vị trí / Phòng ban</th>
                                                <th>Phân quyền</th>
                                                <th>Trạng thái</th>
                                                <th className="text-end">Hành động</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {users.map(u => {
                                                const isEditing = editingUserId === u.id;
                                                return (
                                                    <tr key={u.id}>
                                                        <td className="text-center">
                                                            {u.avatarUrl ? (
                                                                <img src={u.avatarUrl} alt={u.fullName} className="rounded-circle shadow-sm" style={{width: 45, height: 45, objectFit: 'cover', border: '2px solid white'}} />
                                                            ) : (
                                                                <div className="rounded-circle bg-primary bg-opacity-10 text-primary d-flex align-items-center justify-content-center mx-auto fw-bold shadow-sm" style={{width: 45, height: 45, fontSize: '1.2rem', border: '2px solid white'}}>
                                                                    {u.fullName ? u.fullName.charAt(0).toUpperCase() : '?'}
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td>
                                                            <div className="fw-bold text-dark">{u.fullName}</div>
                                                            <div className="text-muted small">
                                                                <i className="bi bi-calendar-event me-1"></i>
                                                                Tham gia: {u.createdAt ? new Date(u.createdAt).toLocaleDateString('vi-VN') : '--'}
                                                            </div>
                                                        </td>
                                                        <td>
                                                            {isEditing ? (
                                                                <input 
                                                                    className="form-control form-control-sm" 
                                                                    value={editEmail}
                                                                    onChange={(e) => setEditEmail(e.target.value)}
                                                                />
                                                            ) : (
                                                                <span className="text-secondary"><i className="bi bi-envelope me-1"></i>{u.email}</span>
                                                            )}
                                                        </td>
                                                        <td>
                                                            {isEditing ? (
                                                                <select 
                                                                    className="form-select form-select-sm" 
                                                                    value={editDeptId}
                                                                    onChange={(e) => setEditDeptId(e.target.value)}
                                                                >
                                                                    <option value="">-- Không phòng ban --</option>
                                                                    {departments.map(d => (
                                                                        <option key={d.id} value={d.id}>{formatDeptName(d.name)}</option>
                                                                    ))}
                                                                </select>
                                                            ) : (
                                                                u.department?.name ? 
                                                                <span className="badge bg-light text-dark border"><i className="bi bi-building me-1 text-muted"></i>{formatDeptName(u.department.name)}</span> : 
                                                                <span className="text-muted small">--</span>
                                                            )}
                                                        </td>
                                                        <td>
                                                            {isEditing ? (
                                                                <select 
                                                                    className="form-select form-select-sm" 
                                                                    value={editRole}
                                                                    onChange={(e) => setEditRole(e.target.value)}
                                                                >
                                                                    <option value="EMPLOYEE">Nhân viên</option>
                                                                    <option value="MANAGER">Trưởng phòng</option>
                                                                    <option value="ADMIN">Quản trị viên</option>
                                                                </select>
                                                            ) : (
                                                                <span className={`badge ${u.role === 'ADMIN' ? 'bg-danger' : u.role === 'MANAGER' ? 'bg-warning text-dark' : 'bg-info text-white'} rounded-pill`}>
                                                                    {u.role === 'ADMIN' ? '👑 ' : u.role === 'MANAGER' ? '💼 ' : '👤 '}{u.role}
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td>
                                                            {u.active !== false ? (
                                                                <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 rounded-pill px-2">Hoạt động</span>
                                                            ) : (
                                                                <span className="badge bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25 rounded-pill px-2">Tạm khóa</span>
                                                            )}
                                                        </td>
                                                        <td className="text-end">
                                                            {u.role !== 'ADMIN' && (
                                                                isEditing ? (
                                                                    <>
                                                                        <button className="btn btn-sm btn-success me-1 shadow-sm" onClick={handleSaveEdit}>✅</button>
                                                                        <button className="btn btn-sm btn-secondary shadow-sm" onClick={handleCancelEdit}>❌</button>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <button className="btn btn-sm btn-primary me-1 shadow-sm" onClick={() => handleEditUser(u.id)}>✏️</button>
                                                                        <button className="btn btn-sm btn-outline-danger shadow-sm" onClick={() => handleDeleteUser(u.id)}>🗑️</button>
                                                                    </>
                                                                )
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                            {users.length === 0 && <tr><td colSpan="7" className="text-center py-5 text-muted"><i className="bi bi-inbox fs-1 d-block mb-2"></i>Không tìm thấy nhân viên nào.</td></tr>}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                
                {activeTab === 'departments' && (
                    <div className="row g-4">
                        <div className="col-12 col-md-4">
                            <div className="modern-card mb-4 h-100">
                                <div className="modern-card-header">Tạo Phòng Ban Mới</div>
                                <div className="card-body p-4 bg-white">
                                    <form onSubmit={handleAddDept}>
                                        <input className="form-control modern-input mb-3" placeholder="Tên phòng ban" required value={newDept.name} onChange={e => setNewDept({...newDept, name: e.target.value})} />
                                        <textarea className="form-control modern-input mb-4" placeholder="Mô tả" rows="4" value={newDept.description} onChange={e => setNewDept({...newDept, description: e.target.value})}></textarea>
                                        <button className="modern-btn-primary w-100">➕ Thêm Phòng Ban</button>
                                    </form>
                                </div>
                            </div>
                        </div>
                        <div className="col-12 col-md-8">
                            <div className="modern-card h-100">
                                <div className="modern-card-header">Danh sách Phòng Ban</div>
                                <div className="card-body p-4 bg-light overflow-auto">
                                    <div className="row g-3">
                                        {departments.map(d => (
                                            <div key={d.id} className="col-md-6 text-dark">
                                                <div className="modern-card p-4 h-100 border border-1 border-opacity-10 shadow-sm d-flex flex-column">
                                                    <div className="d-flex justify-content-between align-items-start mb-2">
                                                        <h6 className="fw-bold mb-0 text-primary-dark"><i className="bi bi-building me-2 text-primary"></i>{formatDeptName(d.name)}</h6>
                                                        <div className="d-flex gap-1" style={{marginTop: '-4px'}}>
                                                            <button className="btn btn-sm text-success hover-text-success p-1 border-0 me-1" title="Thêm nhân viên vào phòng" onClick={(e) => { e.stopPropagation(); handleOpenDeptMemberModal(d); }}><i className="bi bi-person-plus-fill fs-6"></i></button>
                                                            <button className="btn btn-sm text-primary hover-text-primary p-1 border-0" title="Sửa thông tin phòng" onClick={(e) => { e.stopPropagation(); handleEditDepartment(d); }}><i className="bi bi-pencil-square fs-6"></i></button>
                                                            <button className="btn btn-sm text-danger text-opacity-75 hover-text-danger p-1 border-0" title="Xóa phòng ban" onClick={(e) => { e.stopPropagation(); handleDeleteDepartment(d.id); }}><i className="bi bi-trash-fill fs-6"></i></button>
                                                        </div>
                                                    </div>
                                                    <p className="text-muted small mb-3 flex-grow-1">{d.description || 'Chưa có mô tả'}</p>
                                                    <div className="mt-auto pt-3 border-top border-1 border-primary border-opacity-10">
                                                        <div className="d-flex justify-content-between align-items-center mb-2">
                                                            <div className="text-muted small fw-bold">
                                                                <i className="bi bi-people-fill text-primary text-opacity-75 me-1"></i>
                                                                {users.filter(u => u.department?.id === d.id).length} nhân sự
                                                            </div>
                                                        </div>
                                                        <div className="d-flex align-items-center bg-light p-2 rounded border">
                                                            <div className="bg-primary bg-opacity-10 text-primary rounded-circle d-flex align-items-center justify-content-center me-2" style={{width: 32, height: 32}}>
                                                                <i className="bi bi-person-badge-fill"></i>
                                                            </div>
                                                            <div className="min-w-0">
                                                                <div className="small fw-bold text-dark text-truncate" style={{fontSize: '0.8rem'}}>Trưởng phòng</div>
                                                                <div className="small text-muted text-truncate" style={{fontSize: '0.85rem'}}>
                                                                    {d.manager ? d.manager.fullName : <span className="fst-italic">Chưa có trưởng phòng</span>}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        {departments.length === 0 && <div className="col-12 text-center text-muted py-4">Chưa có phòng ban nào.</div>}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                
                {activeTab === 'projects' && (
                    <div className="row g-4">
                        <div className="col-12 col-xl-3">
                            <div className="modern-card h-100" style={{ minHeight: '600px' }}>
                                <div className="modern-card-header bg-white text-dark border-bottom">Chọn Phòng Ban</div>
                                <div className="list-group shadow-none border-0 overflow-hidden rounded-0">
                                    <button 
                                        className={`list-group-item list-group-item-action py-3 d-flex justify-content-between align-items-center ${!selectedDept ? 'bg-primary bg-opacity-10 border-start border-primary border-4' : ''}`} 
                                        onClick={() => { setSelectedDept(null); setShowProjectForm(false); }}
                                    >
                                        <div className="d-flex align-items-center">
                                            <i className="bi bi-globe-americas me-2 text-primary fs-5"></i>
                                            <span className="fw-bold text-dark">Tất cả dự án</span>
                                        </div>
                                        {!selectedDept ? <i className="bi bi-chevron-right text-primary fw-bold"></i> : <i className="bi bi-chevron-right text-muted"></i>}
                                    </button>
                                    
                                    {departments.map(d => (
                                        <button key={d.id} className={`list-group-item list-group-item-action py-3 d-flex justify-content-between align-items-center ${selectedDept?.id === d.id ? 'bg-primary bg-opacity-10 border-start border-primary border-4' : ''}`} onClick={() => {setSelectedDept(d); setShowProjectForm(false);}}>
                                            <div className="d-flex align-items-center">
                                                <i className="bi bi-building me-2 text-primary opacity-75 fs-5"></i>
                                                <div className="fw-bold text-dark">{formatDeptName(d.name)}</div>
                                            </div>
                                            {selectedDept?.id === d.id ? <i className="bi bi-chevron-right text-primary fw-bold"></i> : <i className="bi bi-chevron-right text-muted"></i>}
                                        </button>
                                    ))}
                                    {departments.length === 0 && <div className="text-center text-muted p-4 small">Hãy tạo phòng ban trước.</div>}
                                </div>
                            </div>
                        </div>
                        <div className="col-12 col-xl-9">
                            <div className="modern-card d-flex flex-column h-100" style={{ minHeight: '600px' }}>
                                {(() => {
                                    const projectsToDisplay = selectedDept ? getProjectsByDept(selectedDept.id) : projects.filter(p => !p.isDeleted);
                                    return (
                                        <>
                                            <div className="modern-card-header d-flex justify-content-between align-items-center">
                                                <div className="d-flex align-items-center">
                                                    <span className="fw-bold text-dark">
                                                        {selectedDept ? `📂 Dự án: ${formatDeptName(selectedDept.name)}` : `🌍 Tất cả dự án (${projectsToDisplay.length})`}
                                                    </span>
                                                </div>
                                                <div className="d-flex align-items-center gap-2">
                                                    <div className="btn-group btn-group-sm bg-white shadow-sm rounded" style={{border: '1px solid #e2e8f0'}}>
                                                        <button className={`btn ${projectViewMode === 'grid' ? 'btn-primary text-white' : 'btn-light text-muted'}`} onClick={() => setProjectViewMode('grid')} title="Dạng thẻ (Grid)"><i className="bi bi-grid-fill"></i></button>
                                                        <button className={`btn ${projectViewMode === 'table' ? 'btn-primary text-white' : 'btn-light text-muted'}`} onClick={() => setProjectViewMode('table')} title="Dạng bảng (Table)"><i className="bi bi-list-ul"></i></button>
                                                    </div>
                                                    {selectedDept && (
                                                        <button className="btn btn-sm btn-success fw-bold shadow-sm rounded-pill px-3" onClick={() => setShowProjectForm(!showProjectForm)}>{showProjectForm ? 'Hủy' : '➕ Thêm Dự Án'}</button>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="card-body p-4 bg-light">
                                     {selectedDept && showProjectForm && (
                                        <div className="modern-card mb-4 border border-primary border-opacity-25 shadow-sm">
                                            <div className="modern-card-header bg-primary bg-opacity-10 text-primary-dark d-flex align-items-center">
                                                <i className="bi bi-file-earmark-plus-fill me-2 text-primary"></i> 
                                                <span>Khởi tạo Dự án mới</span>
                                            </div>
                                            <div className="card-body p-4 bg-white">
                                                <form onSubmit={handleAddProject}>
                                                    <div className="mb-4">
                                                        <label className="form-label fw-bold text-dark mb-2">Tên dự án <span className="text-danger">*</span></label>
                                                        <input className="form-control modern-input w-100" placeholder="VD: Nâng cấp hệ thống Backend..." required value={newProject.name} onChange={e => setNewProject({...newProject, name: e.target.value})} />
                                                    </div>
                                                    <div className="row mb-4">
                                                        <div className="col-12 col-md-4 mb-3 mb-md-0">
                                                            <label className="form-label fw-bold text-dark mb-2">Bắt đầu <span className="text-danger">*</span></label>
                                                            <input type="date" className="form-control modern-input w-100" required value={newProject.startDate} onChange={e => setNewProject({...newProject, startDate: e.target.value})} />
                                                        </div>
                                                        <div className="col-12 col-md-4 mb-3 mb-md-0">
                                                            <label className="form-label fw-bold text-dark mb-2">Hạn chót <span className="text-danger">*</span></label>
                                                            <input type="date" className="form-control modern-input w-100" required value={newProject.deadline} onChange={e => setNewProject({...newProject, deadline: e.target.value})} />
                                                        </div>
                                                        <div className="col-12 col-md-4">
                                                            <label className="form-label fw-bold text-dark mb-2">Mức độ ưu tiên <span className="text-danger">*</span></label>
                                                            <select className="form-select modern-input w-100" value={newProject.priority} onChange={e => setNewProject({...newProject, priority: e.target.value})}>
                                                                <option value="LOW">🔵 Ưu tiên Thấp</option>
                                                                <option value="MEDIUM">🟡 Ưu tiên Trung bình</option>
                                                                <option value="HIGH">🔴 Ưu tiên Cao</option>
                                                            </select>
                                                        </div>
                                                    </div>

                                                    <div className="mb-4">
                                                        <label className="form-label fw-bold text-dark mb-2">Mô tả/Mục tiêu dự án</label>
                                                        <textarea className="form-control modern-input w-100" rows="3" placeholder="Nhập chi tiết về mục tiêu, yêu cầu..." value={newProject.description} onChange={e => setNewProject({...newProject, description: e.target.value})} />
                                                    </div>
                                                    <button className="modern-btn-primary w-100 py-2 d-flex justify-content-center align-items-center">
                                                        <i className="bi bi-cloud-arrow-up-fill me-2 mb-0 fs-5"></i> 
                                                        <span className="fw-bold">Khởi tạo và Lưu Dự Án</span>
                                                    </button>
                                                </form>
                                            </div>
                                        </div>
                                    )}
                                        {projectsToDisplay.length === 0 && !showProjectForm && <div className="text-center text-muted py-5">Không có dự án nào đang thực hiện.</div>}
                                        {projectsToDisplay.length > 0 && (
                                            projectViewMode === 'grid' ? (
                                                <div className="row g-3">
                                                    {projectsToDisplay.map(p => (
                                                        <div key={p.id} className="col-12 col-md-6 col-xxl-4">
                                                            <div className="modern-card p-4 h-100 d-flex flex-column shadow-sm border-0 border-start border-4 border-primary transition-hover text-dark position-relative">
                                                                <div className="d-flex justify-content-between align-items-start mb-3">
                                                                    <div>
                                                                        <h5 className="fw-bold text-primary-dark mb-1">{p.name}</h5>
                                                                        <span className={`badge ${p.priority === 'HIGH' ? 'bg-danger text-white' : p.priority === 'LOW' ? 'bg-info text-dark' : 'bg-warning text-dark'} rounded-pill px-3 py-1 shadow-sm mb-2 me-2`}>
                                                                            <i className="bi bi-flag-fill me-1"></i>{p.priority}
                                                                        </span>
                                                                        <span className={`badge ${getProjectTimeStatus(p).color} rounded-pill px-3 py-1 shadow-sm mb-2`}>
                                                                            {getProjectTimeStatus(p).text}
                                                                        </span>
                                                                    </div>
                                                                    <div>
                                                                        <button 
                                                                            className="btn btn-sm text-primary text-opacity-75 hover-text-primary border-0 p-0 fs-5 lh-1 me-2" 
                                                                            title="Sửa dự án"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                handleEditProject(p);
                                                                            }}
                                                                        >
                                                                            <i className="bi bi-pencil-square"></i>
                                                                        </button>
                                                                        <button 
                                                                            className="btn btn-sm text-danger text-opacity-50 hover-text-danger border-0 p-0 fs-5 lh-1" 
                                                                            title="Xóa dự án"
                                                                            onClick={async (e) => {
                                                                                e.stopPropagation();
                                                                                if (await askConfirm('Xóa dự án này (Soft Delete)?')) {
                                                                                    api.delete(`/projects/${p.id}?adminEmail=${currentUser.email}`).then(() => {
                                                                                        fetchData();
                                                                                        alert('Dự án đã được xóa!');
                                                                                    }).catch(err => alert('Lỗi xóa: ' + err.message));
                                                                                }
                                                                            }}
                                                                        >
                                                                            <i className="bi bi-trash-fill"></i>
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                                
                                                                <div className="bg-light p-3 rounded-3 mb-3 border border-1 flex-grow-1">
                                                                    <div className="d-flex justify-content-between mb-1">
                                                                        <span className="text-muted small fw-bold"><i className="bi bi-info-circle me-1"></i>Mô tả:</span>
                                                                        {p.documentLink && (
                                                                            <a href={p.documentLink.startsWith('http') ? p.documentLink : `https://${p.documentLink}`} target="_blank" rel="noopener noreferrer" className="badge bg-primary text-decoration-none" title="Tài liệu đính kèm" onClick={e => e.stopPropagation()}>
                                                                                <i className="bi bi-link-45deg"></i> Link
                                                                            </a>
                                                                        )}
                                                                    </div>
                                                                    <p className="mb-0 text-dark" style={{fontSize: '0.85rem'}}>{p.description || 'Chưa có thông tin...'}</p>
                                                                </div>
                                                                
                                                                <div className="d-flex justify-content-between align-items-center pt-2 border-top mt-auto">
                                                                    <div className="text-muted small" style={{fontSize: '0.75rem'}}>
                                                                        <i className="bi bi-calendar-check text-success me-1"></i>
                                                                        <span className="fw-bold text-dark text-nowrap">
                                                                            {p.startDate ? new Date(p.startDate).toLocaleDateString('vi-VN') : '--'} 
                                                                            {' > '} 
                                                                            {p.deadline ? new Date(p.deadline).toLocaleDateString('vi-VN') : '--'}
                                                                        </span>
                                                                    </div>
                                                                    <div className="text-muted small" style={{cursor: 'pointer'}} onClick={(e) => { e.stopPropagation(); handleOpenMemberModal(p); }} title="Thêm/Xem Nhân Viên">
                                                                        <i className="bi bi-people-fill text-primary me-1"></i> <span className="fw-bold text-dark">{p.members?.length || 0}</span>
                                                                        <i className="bi bi-person-plus-fill ms-1 text-success"></i>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="table-responsive bg-white rounded-3 shadow-sm border">
                                                    <table className="table table-hover align-middle mb-0">
                                                        <thead className="table-light">
                                                            <tr>
                                                                <th>Tên Dự Án</th>
                                                                <th>Ưu tiên</th>
                                                                <th>Tiến độ</th>
                                                                <th>Nhân sự</th>
                                                                <th className="text-end pe-4">Hành động</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {projectsToDisplay.map(p => (
                                                                <tr key={p.id}>
                                                                    <td>
                                                                        <div className="fw-bold text-primary-dark">{p.name}</div>
                                                                        <div className="text-muted small text-truncate" style={{maxWidth: '200px'}} title={p.description}>{p.description}</div>
                                                                    </td>
                                                                    <td>
                                                                        <span className={`badge ${p.priority === 'HIGH' ? 'bg-danger text-white' : p.priority === 'LOW' ? 'bg-info text-dark' : 'bg-warning text-dark'} rounded-pill`}><i className="bi bi-flag-fill me-1"></i>{p.priority}</span>
                                                                    </td>
                                                                    <td>
                                                                        <div className="small text-nowrap mb-1">
                                                                            <span className="text-muted">{p.startDate ? new Date(p.startDate).toLocaleDateString('vi-VN') : '--'}</span>
                                                                            <i className="bi bi-arrow-right mx-1 text-primary"></i>
                                                                            <span className="fw-bold text-dark">{p.deadline ? new Date(p.deadline).toLocaleDateString('vi-VN') : '---'}</span>
                                                                        </div>
                                                                        <span className={`badge ${getProjectTimeStatus(p).color} rounded-pill px-2 py-1 shadow-sm`}>
                                                                            {getProjectTimeStatus(p).text}
                                                                        </span>
                                                                    </td>
                                                                    <td>
                                                                        <span className="badge bg-light text-dark border px-2 py-1" style={{cursor: 'pointer'}} onClick={(e) => { e.stopPropagation(); handleOpenMemberModal(p); }} title="Thêm/Xem Nhân Viên">
                                                                            <i className="bi bi-people-fill text-primary me-1"></i>{p.members?.length || 0}
                                                                            <i className="bi bi-person-plus-fill ms-2 text-success"></i>
                                                                        </span>
                                                                    </td>
                                                                    <td className="text-end pe-4">
                                                                        {p.documentLink && (
                                                                            <a href={p.documentLink.startsWith('http') ? p.documentLink : `https://${p.documentLink}`} target="_blank" rel="noopener noreferrer" className="btn btn-sm text-primary hover-text-primary border-0 p-1 me-1" title="Mở link tài liệu" onClick={e => e.stopPropagation()}>
                                                                                <i className="bi bi-link-45deg fs-5"></i>
                                                                            </a>
                                                                        )}
                                                                        <button className="btn btn-sm text-primary text-opacity-75 hover-text-primary border-0 p-1 me-1" title="Sửa" onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleEditProject(p);
                                                                        }}><i className="bi bi-pencil-square fs-5"></i></button>
                                                                        <button className="btn btn-sm text-danger text-opacity-75 hover-text-danger border-0 p-1" title="Xóa" onClick={async (e) => {
                                                                            e.stopPropagation();
                                                                            if (await askConfirm('Xóa dự án này?')) {
                                                                                api.delete(`/projects/${p.id}?adminEmail=${currentUser.email}`).then(() => fetchData()).catch(err => alert('Lỗi: ' + err.message));
                                                                            }
                                                                        }}><i className="bi bi-trash-fill fs-5"></i></button>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )
                                        )}
                                            </div>
                                        </>
                                    );
                                })()}
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
                                    <div key={dept.id} className="modern-card mb-4">
                                        <div className="modern-card-header bg-success text-white fw-bold d-flex align-items-center"><i className="bi bi-building me-2"></i>{dept.name}</div>
                                        <div className="card-body bg-light p-4">
                                            <div className="row g-4">
                                                {deptCompletedProjects.map(p => (
                                                    <div key={p.id} className="col-md-6 col-lg-3">
                                                        <div className="modern-card h-100 hover-shadow border-0" style={{cursor: 'pointer'}} onClick={() => setViewingCompletedProject(p)}>
                                                            <div className="card-body p-4">
                                                                <div className="d-flex justify-content-between mb-3"><span className="badge bg-secondary rounded-pill px-3 py-2">🔒 CLOSED</span><small className="text-muted fw-bold">{p.deadline}</small></div>
                                                                <h6 className="fw-bold text-primary-dark mb-2">{p.name}</h6>
                                                                <p className="text-muted small text-truncate mb-4">{p.description}</p>
                                                                <div className="d-flex justify-content-between border-top pt-3"><small className="text-muted fw-bold">{p.members?.length || 0} thành viên</small><span className="text-success small fw-bold">Chi tiết &rarr;</span></div>
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

                {activeTab === 'deleted' && (
                    <div className="row">
                        <div className="col-12">
                            <h4 className="fw-bold text-warning mb-4"><i className="bi bi-trash me-2"></i>Dự án đã xóa (Thùng rác)</h4>
                            {departments.map(dept => {
                                const deptDeletedProjects = deletedProjects.filter(p => p.department?.id === dept.id);
                                if (deptDeletedProjects.length === 0) return null;
                                return (
                                    <div key={dept.id} className="modern-card mb-4">
                                        <div className="modern-card-header bg-warning text-dark fw-bold d-flex align-items-center"><i className="bi bi-building me-2"></i>{dept.name}</div>
                                        <div className="card-body bg-light p-4">
                                            <div className="row g-4">
                                                {deptDeletedProjects.map(p => (
                                                    <div key={p.id} className="col-md-6 col-lg-3">
                                                        <div className="modern-card h-100">
                                                            <div className="card-body p-4">
                                                                <div className="d-flex justify-content-between mb-3">
                                                                    <span className="badge bg-danger rounded-pill px-3 py-2">🗑️ ĐÃ XÓA</span>
                                                                    <small className="text-muted fw-bold">{p.deletedAt}</small>
                                                                </div>
                                                                <h6 className="fw-bold text-primary-dark mb-2">{p.name}</h6>
                                                                <p className="text-muted small mb-4">{p.description}</p>
                                                                <button 
                                                                    className="modern-btn-primary bg-success w-100 mt-2" 
                                                                    style={{background: 'linear-gradient(135deg, #20c997 0%, #198754 100%)'}}
                                                                    onClick={async () => {
                                                                        if (await askConfirm('Khôi phục dự án này?', false)) {
                                                                            try {
                                                                                await api.post(`/projects/${p.id}/restore`, null, {
                                                                                    params: { adminEmail: currentUser.email }
                                                                                });
                                                                                fetchData();
                                                                                alert('Đã khôi phục!');
                                                                            } catch (err) {
                                                                                alert('Lỗi: ' + err.message);
                                                                            }
                                                                        }
                                                                    }}
                                                                >
                                                                    🔄 Khôi phục
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                            {deletedProjects.length === 0 && <div className="text-center py-5 text-muted">Chưa có dự án nào trong thùng rác.</div>}
                        </div>
                    </div>
                )}
                </div>
            </div>

            {showDeptMemberModal && selectedDeptForMember && (
                <div className="modal-backdrop-custom">
                    <div className="card shadow-lg border-0" style={{width: 500, borderRadius: '1rem', overflow: 'hidden'}}>
                        <div className="card-header bg-success p-4 border-0 text-white d-flex flex-column position-relative">
                            <button className="btn-close btn-close-white position-absolute top-0 end-0 m-3" onClick={()=>setShowDeptMemberModal(false)}></button>
                            <h5 className="fw-bold mb-1">Thêm nhân sự mới</h5>
                            <span className="text-white text-opacity-75 small">Vào phòng: {formatDeptName(selectedDeptForMember.name)}</span>
                        </div>
                        <div className="card-body p-0">
                            {availableDeptMembers.length > 0 ? (
                                <div className="d-flex flex-column h-100">
                                    <div className="list-group list-group-flush custom-scrollbar" style={{maxHeight: '350px', overflowY: 'auto'}}>
                                        {availableDeptMembers.map(u => (
                                            <button 
                                                key={u.id} 
                                                type="button"
                                                className={`list-group-item list-group-item-action p-3 border-0 border-bottom d-flex align-items-center ${selectedDeptMembersToAdd.includes(u.id) ? 'bg-success bg-opacity-10' : ''}`}
                                                onClick={(e) => { 
                                                    e.preventDefault(); 
                                                    if (selectedDeptMembersToAdd.includes(u.id)) {
                                                        setSelectedDeptMembersToAdd(selectedDeptMembersToAdd.filter(id => id !== u.id));
                                                    } else {
                                                        setSelectedDeptMembersToAdd([...selectedDeptMembersToAdd, u.id]);
                                                    }
                                                }}
                                            >
                                                <div className="flex-shrink-0 me-3">
                                                    {u.avatarUrl ? (
                                                        <img src={u.avatarUrl} alt={u.fullName} className="rounded-circle shadow-sm border border-2 border-white" style={{width: 48, height: 48, objectFit: 'cover'}} />
                                                    ) : (
                                                        <div className="bg-success bg-opacity-25 text-success rounded-circle d-flex align-items-center justify-content-center fw-bold shadow-sm border border-2 border-white" style={{width: 48, height: 48, fontSize: '1.2rem'}}>
                                                            {u.fullName.charAt(0).toUpperCase()}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex-grow-1 min-w-0">
                                                    <div className="fw-bold text-dark text-truncate mb-1">{u.fullName}</div>
                                                    <div className="text-muted small text-truncate d-flex align-items-center mb-1">
                                                        <i className="bi bi-envelope me-1"></i> {u.email}
                                                    </div>
                                                    {u.department ? 
                                                        <span className="badge bg-secondary bg-opacity-10 text-secondary border border-secondary border-opacity-25 fw-normal" style={{fontSize: '0.7rem'}}>
                                                            <i className="bi bi-building me-1"></i>Đang ở: {formatDeptName(u.department.name)}
                                                        </span> : 
                                                        <span className="badge bg-light text-muted border fw-normal" style={{fontSize: '0.7rem'}}>
                                                            <i className="bi bi-question-circle me-1"></i>Chưa có phòng
                                                        </span>
                                                    }
                                                </div>
                                                {selectedDeptMembersToAdd.includes(u.id) && (
                                                    <div className="ms-3 text-success ps-3 border-start border-success border-2">
                                                        <i className="bi bi-check-circle-fill fs-3"></i>
                                                    </div>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="p-3 border-top bg-light mt-auto">
                                        <button className="btn btn-success w-100 py-2 fs-6 fw-bold shadow-sm rounded-pill" onClick={handleAddMemberToDept} disabled={selectedDeptMembersToAdd.length === 0}>
                                            <i className="bi bi-person-plus-fill me-2"></i> Xác nhận chuyển phòng
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-5 text-muted">
                                    <i className="bi bi-people-fill fs-1 d-block mb-3 opacity-25 text-success"></i>
                                    Tất cả nhân viên hệ thống đều đã tham gia phòng ban này.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {showMemberModal && selectedProjectForMember && (
                <div className="modal-backdrop-custom">
                    <div className="card shadow-lg border-0" style={{width: 500, borderRadius: '1rem', overflow: 'hidden'}}>
                        <div className="card-header bg-primary p-4 border-0 text-white d-flex flex-column position-relative">
                            <button className="btn-close btn-close-white position-absolute top-0 end-0 m-3" onClick={()=>setShowMemberModal(false)}></button>
                            <h5 className="fw-bold mb-1">Thêm nhân sự mới</h5>
                            <span className="text-white text-opacity-75 small">Vào dự án: {selectedProjectForMember.name}</span>
                        </div>
                        <div className="card-body p-0">
                            {availableMembers.length > 0 ? (
                                <div className="d-flex flex-column h-100">
                                    <div className="list-group list-group-flush custom-scrollbar" style={{maxHeight: '350px', overflowY: 'auto'}}>
                                        {availableMembers.map(u => (
                                            <button 
                                                key={u.id} 
                                                type="button"
                                                className={`list-group-item list-group-item-action p-3 border-0 border-bottom d-flex align-items-center ${selectedMembersToAdd.includes(u.id) ? 'bg-primary bg-opacity-10' : ''}`}
                                                onClick={(e) => { 
                                                    e.preventDefault(); 
                                                    if (selectedMembersToAdd.includes(u.id)) {
                                                        setSelectedMembersToAdd(selectedMembersToAdd.filter(id => id !== u.id));
                                                    } else {
                                                        setSelectedMembersToAdd([...selectedMembersToAdd, u.id]);
                                                    }
                                                }}
                                            >
                                                <div className="flex-shrink-0 me-3">
                                                    {u.avatarUrl ? (
                                                        <img src={u.avatarUrl} alt={u.fullName} className="rounded-circle shadow-sm border border-2 border-white" style={{width: 48, height: 48, objectFit: 'cover'}} />
                                                    ) : (
                                                        <div className="bg-primary bg-opacity-25 text-primary rounded-circle d-flex align-items-center justify-content-center fw-bold shadow-sm border border-2 border-white" style={{width: 48, height: 48, fontSize: '1.2rem'}}>
                                                            {u.fullName.charAt(0).toUpperCase()}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex-grow-1 min-w-0">
                                                    <div className="fw-bold text-dark text-truncate mb-1">{u.fullName}</div>
                                                    <div className="text-muted small text-truncate d-flex align-items-center mb-1">
                                                        <i className="bi bi-envelope me-1"></i> {u.email}
                                                    </div>
                                                    {u.department ? 
                                                        <span className="badge bg-secondary bg-opacity-10 text-secondary border border-secondary border-opacity-25 fw-normal" style={{fontSize: '0.7rem'}}>
                                                            <i className="bi bi-building me-1"></i>Phòng: {formatDeptName(u.department.name)}
                                                        </span> : 
                                                        <span className="badge bg-light text-muted border fw-normal" style={{fontSize: '0.7rem'}}>
                                                            <i className="bi bi-question-circle me-1"></i>Chưa có phòng
                                                        </span>
                                                    }
                                                </div>
                                                {selectedMembersToAdd.includes(u.id) && (
                                                    <div className="ms-3 text-primary ps-3 border-start border-primary border-2">
                                                        <i className="bi bi-check-circle-fill fs-3"></i>
                                                    </div>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="p-3 border-top bg-light mt-auto">
                                        <button className="btn btn-primary w-100 py-2 fs-6 fw-bold shadow-sm rounded-pill" onClick={handleAddMemberToProject} disabled={selectedMembersToAdd.length === 0}>
                                            <i className="bi bi-person-plus-fill me-2"></i> Xác nhận & Thêm vào
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-5 text-muted">
                                    <i className="bi bi-people-fill fs-1 d-block mb-3 opacity-25 text-primary"></i>
                                    Tất cả nhân viên hệ thống đều đã tham gia dự án này.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {viewingCompletedProject && (
                <div className="modal-backdrop-custom">
                    <div className="modern-card shadow-lg" style={{width: 600, maxHeight: '80vh', overflowY: 'auto'}}>
                        <div className="modern-card-header bg-success text-white fw-bold d-flex justify-content-between align-items-center"><span>Chi tiết dự án: {viewingCompletedProject.name}</span><button className="btn-close btn-close-white" onClick={() => setViewingCompletedProject(null)}></button></div>
                        <div className="card-body p-5">
                            <p className="text-muted fst-italic fs-5">{viewingCompletedProject.description}</p><hr className="my-4"/>
                            <h6 className="fw-bold text-success mb-3"><i className="bi bi-people-fill me-2"></i>Thành viên tham gia</h6>
                            <div className="d-flex flex-wrap gap-2 mb-4">{viewingCompletedProject.members?.map(m => (<span key={m.id} className="badge bg-light text-dark border p-2 px-3 rounded-pill shadow-sm">{m.fullName}</span>))}</div>
                            <h6 className="fw-bold text-success mb-3"><i className="bi bi-list-check me-2"></i>Tổng kết</h6>
                            <div className="alert alert-success fs-6 border-0 shadow-sm rounded-4">Dự án này đã được Quản trị viên đóng lại.<br/><strong className="mt-2 d-block">Ngày hết hạn:</strong> {viewingCompletedProject.deadline}</div>
                            <button className="btn btn-secondary w-100 rounded-pill fw-bold py-2 mt-3" onClick={() => setViewingCompletedProject(null)}>Đóng</button>
                        </div>
                    </div>
                </div>
            )}
            <style>{`.bg-blue-light { background-color: #e7f1ff; } .modal-backdrop-custom { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); z-index: 1050; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(5px); }`}</style>
        </div>
    );
};
export default AdminDashboard;