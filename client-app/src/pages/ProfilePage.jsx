import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ChangePasswordForm from '../components/ChangePasswordForm';
import NotificationBell from '../components/NotificationBell';
import api from '../api';
import './AdminDashboard.css';

const ProfilePage = () => {
    const navigate = useNavigate();
    const [currentUser, setCurrentUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('PROFILE');
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const [avatarPreview, setAvatarPreview] = useState(null);
    const [avatarFile, setAvatarFile] = useState(null);
    const [avatarUrl, setAvatarUrl] = useState('');

    useEffect(() => {
        const userJson = localStorage.getItem('user');
        if (!userJson) {
            navigate('/');
            return;
        }
        try {
            const userObj = JSON.parse(userJson);
            // Fetch latest user data from API to get current active status
            api.get('/api/users/me')
                .then(response => {
                    setCurrentUser(response.data);
                    // Update localStorage with latest user data
                    localStorage.setItem('user', JSON.stringify(response.data));
                    setIsLoading(false);
                })
                .catch(error => {
                    console.error('Error fetching user data:', error);
                    // Fallback to localStorage data if API fails
                    setCurrentUser(userObj);
                    setIsLoading(false);
                });
        } catch (e) {
            console.error(e);
            navigate('/');
        }
    }, []);

    const handleLogout = () => {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        navigate('/');
    };

    const handleChangePasswordSuccess = () => {
        // Optional: Có thể hiển thị modal thành công hoặc reset form
    };

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
        document.getElementById('profileAvatarInput').click();
    };

    const handleUploadAvatar = async () => {
        if (!avatarFile && !avatarUrl) return;
        try {
            const formData = new FormData();
            if (avatarFile) {
                formData.append('avatar', avatarFile);
            } else if (avatarUrl) {
                formData.append('avatarUrl', avatarUrl);
            }
            const response = await api.post('/users/upload-avatar', formData);
            
            // Use the response from backend which contains the new avatar
            const updatedUser = response.data;
            alert("✅ Cập nhật avatar thành công!");
            
            // Update localStorage with the new user data from backend
            localStorage.setItem('user', JSON.stringify(updatedUser));
            
            // Update component state with new user data
            setCurrentUser(updatedUser);
            
            // Clear preview states
            setAvatarFile(null);
            setAvatarPreview(null);
            setAvatarUrl('');
            document.getElementById('profileAvatarInput').value = '';
        } catch (err) {
            alert("Lỗi cập nhật avatar: " + err.message);
        }
    };

    const handleRemoveAvatar = () => {
        setAvatarFile(null);
        setAvatarPreview(null);
        setAvatarUrl('');
        document.getElementById('profileAvatarInput').value = '';
    };

    if (isLoading) {
        return (
            <div className="min-vh-100 d-flex align-items-center justify-content-center bg-light">
                <div className="spinner-border text-primary" role="status"></div>
            </div>
        );
    }

    if (!currentUser) {
        return (
            <div className="min-vh-100 d-flex align-items-center justify-content-center bg-light">
                <div className="alert alert-danger">Không tìm thấy thông tin tài khoản</div>
            </div>
        );
    }

    return (
        <div className="admin-dashboard-container">
            {/* Header Navbar */}
            <div className="glass-header d-flex justify-content-between align-items-center">
                {/* Logo - Fixed Width for Balance */}
                <div className="d-flex align-items-center" style={{width: '280px', cursor: 'pointer'}} onClick={() => navigate(-1)}>
                    <span className="fs-3 me-2">🚀</span>
                    <span className="brand-text d-none d-md-block">
                        {currentUser?.role === 'ADMIN' ? 'ADMIN PRO' : currentUser?.role === 'MANAGER' ? 'MANAGER PRO' : 'S-PRO'}
                    </span>
                </div>

                {/* Centered Menu */}
                {currentUser?.role === 'ADMIN' ? (
                <div className="top-menu d-none d-xl-flex justify-content-center">
                    <button className="top-menu-item" onClick={() => navigate('/admin')}>
                        <i className="bi bi-people-fill top-menu-icon" style={{color: '#a3aed1'}}></i> Nhân sự
                    </button>
                    <button className="top-menu-item" onClick={() => navigate('/admin')}>
                        <i className="bi bi-building top-menu-icon" style={{color: '#a3aed1'}}></i> Phòng Ban
                    </button>
                    <button className="top-menu-item" onClick={() => navigate('/admin')}>
                        <i className="bi bi-folder-fill top-menu-icon" style={{color: '#a3aed1'}}></i> Dự Án
                    </button>
                    <button className="top-menu-item" onClick={() => navigate('/admin')}>
                        <i className="bi bi-check-circle-fill top-menu-icon" style={{color: '#a3aed1'}}></i> Đã Hoàn Thành
                    </button>
                    <button className="top-menu-item" onClick={() => navigate('/admin')}>
                        <i className="bi bi-trash-fill top-menu-icon" style={{color: '#a3aed1'}}></i> Thùng rác
                    </button>
                </div>
                ) : (
                <div className="top-menu d-none d-xl-flex justify-content-center">
                    <button className="top-menu-item" onClick={() => navigate(-1)}>
                        <i className="bi bi-arrow-left top-menu-icon" style={{color: '#a3aed1'}}></i> Quay lại Dashboard
                    </button>
                </div>
                )}

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
                            <div className="ms-2 me-2 d-none d-sm-block text-start">
                                <div className="fw-bold text-dark" style={{fontSize: '0.85rem', lineHeight: '1.2'}}>{currentUser?.fullName}</div>
                                <small className="text-muted" style={{fontSize: '0.7rem'}}>
                                    {currentUser?.role === 'ADMIN' ? 'Administrator' : currentUser?.role === 'MANAGER' ? 'Manager' : 'Employee'}
                                </small>
                            </div>
                            <i className="bi bi-chevron-down ms-1 text-muted me-2" style={{fontSize: '0.8rem'}}></i>
                        </div>
                        
                        {showProfileMenu && (
                            <div className="dropdown-menu show shadow border-0 position-absolute end-0 mt-2 p-2 rounded-4" style={{minWidth: '220px', backgroundColor: '#fff', top: '100%', zIndex: 1050}}>
                                <div className="px-3 py-2 mb-1 d-sm-none border-bottom">
                                    <div className="fw-bold text-dark">{currentUser?.fullName}</div>
                                    <small className="text-muted">{currentUser?.role}</small>
                                </div>
                                <button className="dropdown-item rounded-3 py-2 fw-bold text-dark mb-1 d-flex align-items-center modern-dropdown-item" onClick={() => { setShowProfileMenu(false); navigate(-1); }}>
                                    <i className="bi bi-arrow-left-circle me-2 fs-5 text-primary"></i> Quay về Dashboard
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
            <div className="admin-main-wrapper p-4 p-md-5 animate-fade-in content-inner">
                <div className="container-fluid p-0">
                    <div className="row g-4">
                    {/* Sidebar */}
                    <div className="col-lg-3">
                        <div className="modern-card">
                            <div className="card-body text-center p-4">
                                <div className="position-relative d-inline-block mb-3">
                                    {avatarPreview ? (
                                        <img src={avatarPreview} alt="Avatar preview" className="rounded-circle border-3 border-primary" style={{width: 100, height: 100, objectFit: 'cover'}} onError={() => setAvatarPreview(null)} />
                                    ) : currentUser?.avatarUrl ? (
                                        <img src={currentUser.avatarUrl} alt="User avatar" className="rounded-circle border-3 border-primary" style={{width: 100, height: 100, objectFit: 'cover'}} onError={() => {}} />
                                    ) : (
                                        <div className="bg-primary rounded-circle d-flex align-items-center justify-content-center mx-auto" style={{ width: 100, height: 100 }}>
                                            <i className="bi bi-person-fill text-white" style={{ fontSize: '36px' }}></i>
                                        </div>
                                    )}
                                    {avatarPreview && (
                                        <div className="position-absolute top-0 end-0 translate-middle">
                                            <span className="badge bg-success rounded-circle">
                                                <i className="bi bi-check-lg"></i>
                                            </span>
                                        </div>
                                    )}
                                </div>
                                <input type="file" id="profileAvatarInput" accept="image/png,image/jpeg,image/jpg" onChange={handleAvatarSelect} style={{display: 'none'}} />
                                <div className="d-flex gap-2 mb-3 justify-content-center flex-wrap">
                                    <button type="button" className="btn btn-sm btn-outline-primary fw-bold" onClick={handleEditAvatar} title="Tải file ảnh từ máy tính">
                                        <i className="bi bi-upload me-1"></i>Thay Đổi
                                    </button>
                                    {avatarPreview && (
                                        <button type="button" className="btn btn-sm btn-outline-danger fw-bold" onClick={handleRemoveAvatar}>
                                            <i className="bi bi-trash me-1"></i>Hủy
                                        </button>
                                    )}
                                </div>
                                {avatarPreview && (
                                    <button type="button" className="modern-btn-primary w-100 mb-3" onClick={handleUploadAvatar}>
                                        <i className="bi bi-upload me-1"></i>Lưu Avatar
                                    </button>
                                )}
                                <small className="text-muted d-block">{avatarPreview ? 'PNG/JPG, max 5MB' : ''}</small>
                                <h5 className="fw-bold text-dark mt-3">{currentUser.fullName}</h5>
                                <p className="text-muted small mb-2">{currentUser.email}</p>
                                <div className="d-flex justify-content-center">
                                    <span className="badge bg-info">
                                        {currentUser.role === 'ADMIN' ? '👨‍💼 Quản trị viên' :
                                         currentUser.role === 'MANAGER' ? '👔 Trưởng phòng' :
                                         '👨‍💻 Nhân viên'}
                                    </span>
                                </div>

                                <hr className="my-3" />

                                <div className="text-start">
                                    <div className="mb-3">
                                        <small className="text-muted d-block">Tên đầy đủ</small>
                                        <span className="text-dark fw-bold">{currentUser.fullName}</span>
                                    </div>
                                    <div className="mb-3">
                                        <small className="text-muted d-block">Email</small>
                                        <span className="text-dark fw-bold">{currentUser.email}</span>
                                    </div>
                                    <div className="mb-3">
                                        <small className="text-muted d-block">Vai trò</small>
                                        <span className="text-dark fw-bold">
                                            {currentUser.role === 'ADMIN' ? 'Quản trị viên' :
                                             currentUser.role === 'MANAGER' ? 'Trưởng phòng' :
                                             'Nhân viên'}
                                        </span>
                                    </div>
                                    {currentUser.department && (
                                        <div>
                                            <small className="text-muted d-block">Phòng ban</small>
                                            <span className="text-dark fw-bold">{currentUser.department.name}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Main Content */}
                    <div className="col-lg-9">
                        {/* Tabs Navigation */}
                        <div className="top-menu d-inline-flex mb-4 p-1">
                            <button
                                className={`top-menu-item ${activeTab === 'PROFILE' ? 'active' : ''}`}
                                onClick={() => setActiveTab('PROFILE')}
                            >
                                <i className="bi bi-person top-menu-icon" style={{color: activeTab === 'PROFILE' ? '#4318ff' : '#a3aed1'}}></i> Hồ Sơ
                            </button>
                            <button
                                className={`top-menu-item ${activeTab === 'PASSWORD' ? 'active' : ''}`}
                                onClick={() => setActiveTab('PASSWORD')}
                            >
                                <i className="bi bi-key top-menu-icon" style={{color: activeTab === 'PASSWORD' ? '#4318ff' : '#a3aed1'}}></i> Đổi Mật Khẩu
                            </button>
                        </div>

                        {/* Tab Content */}
                        {activeTab === 'PROFILE' && (
                            <div className="modern-card">
                                <div className="modern-card-header d-flex align-items-center bg-white text-primary-dark">
                                    <i className="bi bi-person-badge me-2 fs-5"></i>
                                    Thông Tin Tài Khoản
                                </div>
                                <div className="card-body p-5">
                                    <div className="row g-5">
                                        <div className="col-md-6">
                                            <div>
                                                <label className="form-label fw-bold text-dark">Tên Đầy Đủ</label>
                                                <p className="form-control-plaintext text-muted border-bottom pb-2">
                                                    {currentUser.fullName}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="col-md-6">
                                            <div>
                                                <label className="form-label fw-bold text-dark">Email</label>
                                                <p className="form-control-plaintext text-muted border-bottom pb-2">
                                                    {currentUser.email}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="col-md-6">
                                            <div>
                                                <label className="form-label fw-bold text-dark">Vai Trò</label>
                                                <p className="form-control-plaintext text-muted border-bottom pb-2">
                                                    {currentUser.role === 'ADMIN' ? 'Quản trị viên' :
                                                     currentUser.role === 'MANAGER' ? 'Trưởng phòng' :
                                                     'Nhân viên'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="col-md-6">
                                            <div>
                                                <label className="form-label fw-bold text-dark">Phòng Ban</label>
                                                <p className="form-control-plaintext text-muted border-bottom pb-2">
                                                    {currentUser.department?.name || 'Không có'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="col-12">
                                            <div>
                                                <label className="form-label fw-bold text-dark">Trạng Thái</label>
                                                <p className="form-control-plaintext">
                                                    <span className={`badge ${currentUser.active ? 'bg-success' : 'bg-warning'}`}>
                                                        {currentUser.active ? '✅ Hoạt động' : '⏸️ Bị khóa'}
                                                    </span>
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="alert alert-info mt-4">
                                        <i className="bi bi-info-circle me-2"></i>
                                        Để cập nhật thông tin, vui lòng liên hệ quản trị viên.
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'PASSWORD' && (
                            <ChangePasswordForm onSuccess={handleChangePasswordSuccess} />
                        )}
                    </div>
                </div>
            </div>
            </div>
        </div>
    );
};

export default ProfilePage;
