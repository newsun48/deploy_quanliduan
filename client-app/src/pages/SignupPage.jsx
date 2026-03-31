import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authAPI } from '../api';

const initialForm = {
    fullName: '',
    email: '',
    password: '',
    confirmPassword: ''
};

const SignupPage = () => {
    const [formData, setFormData] = useState(initialForm);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleChange = (field, value) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
        setError('');
        setSuccess('');
    };

    const handleSignup = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (formData.password.length < 6) {
            setError('Mật khẩu phải có ít nhất 6 ký tự.');
            return;
        }

        if (formData.password !== formData.confirmPassword) {
            setError('Mật khẩu xác nhận không khớp.');
            return;
        }

        try {
            setIsLoading(true);
            await authAPI.signup({
                fullName: formData.fullName,
                email: formData.email,
                password: formData.password
            });
            setSuccess('Đăng ký thành công! Tài khoản của bạn đang chờ quản trị viên phê duyệt. Hệ thống sẽ thông báo khi yêu cầu được duyệt hoặc bị từ chối.');
            setFormData(initialForm);
        } catch (err) {
            const errorData = err.response?.data;
            const message = typeof errorData === 'string'
                ? errorData
                : (errorData?.message || err.message || 'Không thể đăng ký tài khoản.');
            setError(message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-vh-100 bg-light d-flex align-items-center justify-content-center py-4">
            <div className="card shadow-lg border-0 p-5" style={{ maxWidth: '560px', width: '92%', borderRadius: '15px' }}>
                <div className="text-center mb-4">
                    <div className="bg-success text-white rounded-circle d-inline-flex align-items-center justify-content-center mb-3 shadow-sm" style={{ width: 80, height: 80 }}>
                        <i className="bi bi-person-plus-fill fs-1"></i>
                    </div>
                    <h2 className="fw-bold text-primary mb-1">TẠO TÀI KHOẢN</h2>
                    <p className="text-muted mb-0">Điền thông tin để gửi yêu cầu đăng ký. Sau khi xem xét, quản trị viên sẽ duyệt hoặc từ chối tài khoản của bạn.</p>
                </div>

                {error && <div className="alert alert-danger text-center p-2 mb-4">{error}</div>}
                {success && <div className="alert alert-success text-center p-3 mb-4">{success}</div>}

                <form onSubmit={handleSignup}>
                    <div className="form-floating mb-3">
                        <input
                            type="text"
                            className="form-control"
                            id="signupFullName"
                            placeholder="Nguyen Van A"
                            value={formData.fullName}
                            onChange={(e) => handleChange('fullName', e.target.value)}
                            required
                        />
                        <label htmlFor="signupFullName">Họ và tên</label>
                    </div>

                    <div className="form-floating mb-3">
                        <input
                            type="email"
                            className="form-control"
                            id="signupEmail"
                            placeholder="name@example.com"
                            value={formData.email}
                            onChange={(e) => handleChange('email', e.target.value)}
                            required
                        />
                        <label htmlFor="signupEmail">Email</label>
                    </div>

                    <div className="form-floating mb-3">
                        <input
                            type="password"
                            className="form-control"
                            id="signupPassword"
                            placeholder="Mật khẩu"
                            value={formData.password}
                            onChange={(e) => handleChange('password', e.target.value)}
                            required
                        />
                        <label htmlFor="signupPassword">Mật khẩu</label>
                    </div>

                    <div className="form-floating mb-4">
                        <input
                            type="password"
                            className="form-control"
                            id="signupConfirmPassword"
                            placeholder="Xác nhận mật khẩu"
                            value={formData.confirmPassword}
                            onChange={(e) => handleChange('confirmPassword', e.target.value)}
                            required
                        />
                        <label htmlFor="signupConfirmPassword">Xác nhận mật khẩu</label>
                    </div>

                    <button type="submit" className="btn btn-primary w-100 py-3 fw-bold fs-5 shadow-sm rounded-pill" disabled={isLoading}>
                        {isLoading ? 'Đang gửi yêu cầu...' : 'ĐĂNG KÝ TÀI KHOẢN'}
                    </button>
                </form>

                <div className="alert alert-warning mt-4 mb-0">
                    <div className="fw-bold mb-1">Lưu ý</div>
                    <div className="small">Sau khi đăng ký, tài khoản sẽ ở trạng thái chờ duyệt. Bạn chỉ đăng nhập được sau khi quản trị viên phê duyệt và gán quyền; nếu bị từ chối, hệ thống sẽ gửi lý do để bạn liên hệ quản trị viên xử lý tiếp.</div>
                </div>

                <div className="text-center mt-3">
                    <span className="text-muted">Đã có tài khoản? </span>
                    <Link to="/" className="text-decoration-none fw-semibold">Quay lại đăng nhập</Link>
                </div>
            </div>
        </div>
    );
};

export default SignupPage;
