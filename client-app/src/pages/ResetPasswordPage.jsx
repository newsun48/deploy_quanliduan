import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { authAPI } from '../api';

const ResetPasswordPage = () => {
    const [searchParams] = useSearchParams();
    const token = useMemo(() => searchParams.get('token') || '', [searchParams]);
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [isChecking, setIsChecking] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isValidToken, setIsValidToken] = useState(false);

    useEffect(() => {
        const validateToken = async () => {
            if (!token) {
                setError('Liên kết đặt lại mật khẩu không hợp lệ.');
                setIsChecking(false);
                return;
            }

            try {
                await authAPI.validateResetToken(token);
                setIsValidToken(true);
            } catch (err) {
                setError(err.response?.data || 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.');
            } finally {
                setIsChecking(false);
            }
        };

        validateToken();
    }, [token]);

    const handleResetPassword = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');

        if (password.length < 6) {
            setError('Mật khẩu mới phải có ít nhất 6 ký tự.');
            return;
        }

        if (password !== confirmPassword) {
            setError('Mật khẩu xác nhận không khớp.');
            return;
        }

        try {
            setIsSubmitting(true);
            const res = await authAPI.resetPassword(token, password);
            setMessage(res.data);
            setIsValidToken(false);
            setPassword('');
            setConfirmPassword('');
        } catch (err) {
            setError(err.response?.data || 'Không thể đặt lại mật khẩu.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-vh-100 bg-light d-flex align-items-center justify-content-center">
            <div className="card shadow-lg border-0 p-5" style={{ maxWidth: '520px', width: '90%', borderRadius: '15px' }}>
                <div className="text-center mb-4">
                    <div className="bg-primary text-white rounded-circle d-inline-flex align-items-center justify-content-center mb-3 shadow-sm" style={{ width: 80, height: 80 }}>
                        <i className="bi bi-shield-lock-fill fs-1"></i>
                    </div>
                    <h2 className="fw-bold text-primary mb-1">ĐẶT LẠI MẬT KHẨU</h2>
                    <p className="text-muted mb-0">Nhập mật khẩu mới để hoàn tất quá trình khôi phục tài khoản</p>
                </div>

                {isChecking && <div className="alert alert-info text-center">Đang kiểm tra liên kết...</div>}
                {error && <div className="alert alert-danger text-center p-2 mb-4">{error}</div>}
                {message && <div className="alert alert-success text-center p-2 mb-4">{message}</div>}

                {!isChecking && isValidToken && (
                    <form onSubmit={handleResetPassword}>
                        <div className="form-floating mb-3">
                            <input
                                type="password"
                                className="form-control"
                                id="newPasswordInput"
                                placeholder="Mật khẩu mới"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                            <label htmlFor="newPasswordInput">Mật khẩu mới</label>
                        </div>

                        <div className="form-floating mb-4">
                            <input
                                type="password"
                                className="form-control"
                                id="confirmPasswordInput"
                                placeholder="Xác nhận mật khẩu"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                            />
                            <label htmlFor="confirmPasswordInput">Xác nhận mật khẩu</label>
                        </div>

                        <button type="submit" className="btn btn-primary w-100 py-3 fw-bold fs-5 shadow-sm rounded-pill" disabled={isSubmitting}>
                            {isSubmitting ? 'Đang cập nhật...' : 'LƯU MẬT KHẨU MỚI'}
                        </button>
                    </form>
                )}

                <div className="text-center mt-3">
                    <Link to="/" className="text-decoration-none">Quay lại đăng nhập</Link>
                </div>
            </div>
        </div>
    );
};

export default ResetPasswordPage;
