import { useState } from 'react';
import { userAPI } from '../api';
import './ChangePasswordForm.css';

const ChangePasswordForm = ({ onSuccess }) => {
    const [formData, setFormData] = useState({
        oldPassword: '',
        newPassword: '',
        confirmPassword: ''
    });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showPasswords, setShowPasswords] = useState({
        old: false,
        new: false,
        confirm: false
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
        setError('');
        setSuccess('');
    };

    const handleTogglePasswordVisibility = (field) => {
        setShowPasswords(prev => ({
            ...prev,
            [field]: !prev[field]
        }));
    };

    const validateForm = () => {
        if (!formData.oldPassword.trim()) {
            setError('Vui lòng nhập mật khẩu cũ');
            return false;
        }

        if (!formData.newPassword.trim()) {
            setError('Vui lòng nhập mật khẩu mới');
            return false;
        }

        if (formData.newPassword.length < 6) {
            setError('Mật khẩu mới phải có ít nhất 6 ký tự');
            return false;
        }

        if (formData.newPassword !== formData.confirmPassword) {
            setError('Mật khẩu xác nhận không khớp');
            return false;
        }

        if (formData.oldPassword === formData.newPassword) {
            setError('Mật khẩu mới phải khác mật khẩu cũ');
            return false;
        }

        return true;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validateForm()) return;

        setIsLoading(true);
        try {
            await userAPI.changePassword(formData.oldPassword, formData.newPassword);
            setSuccess('✅ Đổi mật khẩu thành công!');
            setFormData({
                oldPassword: '',
                newPassword: '',
                confirmPassword: ''
            });
            
            // Gọi callback sau 1.5 giây
            if (onSuccess) {
                setTimeout(onSuccess, 1500);
            }
        } catch (err) {
            const errorMsg = err.response?.data?.message || err.response?.data || 'Đã xảy ra lỗi khi đổi mật khẩu';
            setError(typeof errorMsg === 'string' ? errorMsg : 'Đã xảy ra lỗi khi đổi mật khẩu');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="change-password-form card border-0 shadow-sm">
            <div className="card-header bg-primary text-white">
                <h5 className="mb-0">
                    <i className="bi bi-key-fill me-2"></i>
                    Đổi Mật Khẩu
                </h5>
            </div>

            <div className="card-body p-4">
                {error && (
                    <div className="alert alert-danger alert-dismissible fade show" role="alert">
                        <i className="bi bi-exclamation-circle me-2"></i>
                        {error}
                        <button
                            type="button"
                            className="btn-close"
                            onClick={() => setError('')}
                        ></button>
                    </div>
                )}

                {success && (
                    <div className="alert alert-success alert-dismissible fade show" role="alert">
                        {success}
                        <button
                            type="button"
                            className="btn-close"
                            onClick={() => setSuccess('')}
                        ></button>
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    {/* Mật khẩu cũ */}
                    <div className="mb-3">
                        <label htmlFor="oldPassword" className="form-label fw-bold">
                            Mật Khẩu Cũ <span className="text-danger">*</span>
                        </label>
                        <div className="input-group">
                            <input
                                type={showPasswords.old ? 'text' : 'password'}
                                className="form-control border-1"
                                id="oldPassword"
                                name="oldPassword"
                                value={formData.oldPassword}
                                onChange={handleChange}
                                placeholder="Nhập mật khẩu cũ..."
                                disabled={isLoading}
                            />
                            <button
                                type="button"
                                className="btn btn-outline-secondary"
                                onClick={() => handleTogglePasswordVisibility('old')}
                                disabled={isLoading}
                            >
                                <i className={`bi bi-eye${showPasswords.old ? '-slash' : ''}-fill`}></i>
                            </button>
                        </div>
                    </div>

                    {/* Mật khẩu mới */}
                    <div className="mb-3">
                        <label htmlFor="newPassword" className="form-label fw-bold">
                            Mật Khẩu Mới <span className="text-danger">*</span>
                        </label>
                        <div className="input-group">
                            <input
                                type={showPasswords.new ? 'text' : 'password'}
                                className="form-control border-1"
                                id="newPassword"
                                name="newPassword"
                                value={formData.newPassword}
                                onChange={handleChange}
                                placeholder="Nhập mật khẩu mới..."
                                disabled={isLoading}
                            />
                            <button
                                type="button"
                                className="btn btn-outline-secondary"
                                onClick={() => handleTogglePasswordVisibility('new')}
                                disabled={isLoading}
                            >
                                <i className={`bi bi-eye${showPasswords.new ? '-slash' : ''}-fill`}></i>
                            </button>
                        </div>
                        <small className="text-muted d-block mt-1">
                            Mật khẩu phải có ít nhất 6 ký tự
                        </small>
                    </div>

                    {/* Xác nhận mật khẩu mới */}
                    <div className="mb-3">
                        <label htmlFor="confirmPassword" className="form-label fw-bold">
                            Xác Nhận Mật Khẩu Mới <span className="text-danger">*</span>
                        </label>
                        <div className="input-group">
                            <input
                                type={showPasswords.confirm ? 'text' : 'password'}
                                className="form-control border-1"
                                id="confirmPassword"
                                name="confirmPassword"
                                value={formData.confirmPassword}
                                onChange={handleChange}
                                placeholder="Nhập lại mật khẩu mới..."
                                disabled={isLoading}
                            />
                            <button
                                type="button"
                                className="btn btn-outline-secondary"
                                onClick={() => handleTogglePasswordVisibility('confirm')}
                                disabled={isLoading}
                            >
                                <i className={`bi bi-eye${showPasswords.confirm ? '-slash' : ''}-fill`}></i>
                            </button>
                        </div>
                    </div>

                    {/* Nút submit */}
                    <div className="d-grid gap-2 mt-4">
                        <button
                            type="submit"
                            className="btn btn-primary btn-lg fw-bold"
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <>
                                    <span className="spinner-border spinner-border-sm me-2"></span>
                                    Đang xử lý...
                                </>
                            ) : (
                                <>
                                    <i className="bi bi-check-circle me-2"></i>
                                    Đổi Mật Khẩu
                                </>
                            )}
                        </button>
                    </div>
                </form>

                {/* Ghi chú bảo mật */}
                <div className="alert alert-info mt-4 mb-0">
                    <h6 className="fw-bold mb-2">
                        <i className="bi bi-shield-check me-2"></i>
                        Mẹo Bảo Mật
                    </h6>
                    <ul className="mb-0 small">
                        <li>Sử dụng mật khẩu mạnh với ký tự in hoa, in thường và số</li>
                        <li>Không chia sẻ mật khẩu với bất kỳ ai</li>
                        <li>Thay đổi mật khẩu thường xuyên để bảo vệ tài khoản</li>
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default ChangePasswordForm;
