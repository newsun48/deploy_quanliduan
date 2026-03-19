import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ChangePasswordForm from '../components/ChangePasswordForm';
import api from '../api';
import './ProfilePage.css';

const ProfilePage = () => {
    const navigate = useNavigate();
    const [currentUser, setCurrentUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('PROFILE');
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
            setCurrentUser(userObj);
            setIsLoading(false);
        } catch (e) {
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

    const handleAvatarUrlChange = (e) => {
        const url = e.target.value;
        setAvatarUrl(url);
        setAvatarFile(null);
        document.getElementById('profileAvatarInput').value = '';
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

    const handleUploadAvatar = async () => {
        if (!avatarFile && !avatarUrl) return;
        try {
            const formData = new FormData();
            if (avatarFile) {
                formData.append('avatar', avatarFile);
            } else if (avatarUrl) {
                formData.append('avatarUrl', avatarUrl);
            }
            const response = await api.post('/users/upload-avatar', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            
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
        <div className="min-vh-100 bg-light" style={{ fontFamily: "'Segoe UI', sans-serif" }}>
            {/* Header */}
            <nav className="navbar navbar-expand-lg navbar-dark bg-dark shadow px-4 w-100">
                <div className="container-fluid">
                    <div className="d-flex align-items-center text-white">
                        <div
                            className="bg-primary rounded-circle d-flex align-items-center justify-content-center me-2"
                            style={{ width: 40, height: 40 }}
                        >
                            <i className="bi bi-person-fill"></i>
                        </div>
                        <div>
                            <div className="fw-bold">CÁ NHÂN</div>
                            <div className="small opacity-75">Quản lý tài khoản</div>
                        </div>
                    </div>
                    <div className="ms-auto d-flex align-items-center gap-3">
                        <button
                            onClick={() => navigate(-1)}
                            className="btn btn-outline-light btn-sm px-3 rounded-pill me-2"
                        >
                            <i className="bi bi-arrow-left me-1"></i>
                            Quay lại
                        </button>
                        <button
                            onClick={handleLogout}
                            className="btn btn-outline-light btn-sm px-3 rounded-pill"
                        >
                            <i className="bi bi-box-arrow-right me-1"></i>
                            Đăng xuất
                        </button>
                    </div>
                </div>
            </nav>

            {/* Main Content */}
            <div className="container-fluid px-4 py-5">
                <div className="row g-4">
                    {/* Sidebar */}
                    <div className="col-lg-3">
                        <div className="card border-0 shadow-sm profile-card">
                            <div className="card-body text-center">
                                <div className="position-relative d-inline-block mb-3">
                                    {avatarPreview ? (
                                        <img src={avatarPreview} alt="Avatar preview" className="rounded-circle border-3 border-primary" style={{width: 100, height: 100, objectFit: 'cover'}} onError={() => setAvatarPreview(null)} />
                                    ) : currentUser?.avatar ? (
                                        <img src={currentUser.avatar} alt="User avatar" className="rounded-circle border-3 border-primary" style={{width: 100, height: 100, objectFit: 'cover'}} onError={() => {}} />
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
                                    <button type="button" className="btn btn-sm btn-outline-primary fw-bold" onClick={handleEditAvatar} title="Tải file ảnh từ máy tính" disabled={avatarUrl && avatarPreview}>
                                        <i className="bi bi-upload me-1"></i>File
                                    </button>
                                    {avatarPreview && (
                                        <button type="button" className="btn btn-sm btn-outline-danger fw-bold" onClick={handleRemoveAvatar}>
                                            <i className="bi bi-trash me-1"></i>Xóa
                                        </button>
                                    )}
                                </div>
                                <div className="mb-3">
                                    <div className="input-group input-group-sm mb-2">
                                        <input 
                                            type="url" 
                                            className="form-control" 
                                            placeholder="https://..."
                                            value={avatarUrl}
                                            onChange={handleAvatarUrlChange}
                                            style={{fontSize: '0.8rem'}}
                                            disabled={avatarFile}
                                        />
                                        <button 
                                            type="button" 
                                            className="btn btn-outline-success fw-bold btn-sm"
                                            onClick={handleLoadAvatarFromUrl}
                                            title="Tải ảnh từ URL"
                                            disabled={avatarFile}
                                        >
                                            <i className="bi bi-globe"></i>
                                        </button>
                                    </div>
                                    <small className="text-muted d-block">Chọn một trong hai: File hoặc URL</small>
                                </div>
                                {avatarPreview && (
                                    <button type="button" className="btn btn-sm btn-success fw-bold w-100 mb-3" onClick={handleUploadAvatar}>
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
                        <ul className="nav nav-tabs nav-pills flex-row mb-4" role="tablist">
                            <li className="nav-item" role="presentation">
                                <button
                                    className={`nav-link rounded-top-3 ${activeTab === 'PROFILE' ? 'active' : ''}`}
                                    onClick={() => setActiveTab('PROFILE')}
                                    type="button"
                                    role="tab"
                                >
                                    <i className="bi bi-person me-2"></i>
                                    Thông Tin Cá Nhân
                                </button>
                            </li>
                            <li className="nav-item" role="presentation">
                                <button
                                    className={`nav-link rounded-top-3 ${activeTab === 'PASSWORD' ? 'active' : ''}`}
                                    onClick={() => setActiveTab('PASSWORD')}
                                    type="button"
                                    role="tab"
                                >
                                    <i className="bi bi-key me-2"></i>
                                    Đổi Mật Khẩu
                                </button>
                            </li>
                        </ul>

                        {/* Tab Content */}
                        {activeTab === 'PROFILE' && (
                            <div className="card border-0 shadow-sm">
                                <div className="card-header bg-primary text-white">
                                    <h5 className="mb-0">
                                        <i className="bi bi-person-badge me-2"></i>
                                        Thông Tin Tài Khoản
                                    </h5>
                                </div>
                                <div className="card-body p-4">
                                    <div className="row g-4">
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
                                                    <span className={`badge ${currentUser.isActive ? 'bg-success' : 'bg-warning'}`}>
                                                        {currentUser.isActive ? '✅ Hoạt động' : '⏸️ Bị khóa'}
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
    );
};

export default ProfilePage;
