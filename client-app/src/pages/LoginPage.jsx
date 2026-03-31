import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import api, { authAPI } from '../api';

const LoginPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();
    const normalizedError = error.toLowerCase();
    const rejectedApproval = normalizedError.includes('từ chối');
    const pendingApproval = !rejectedApproval && (normalizedError.includes('chờ') || normalizedError.includes('duyệt') || normalizedError.includes('phê duyệt'));
    const genericError = error && !pendingApproval && !rejectedApproval;
    const googleClientConfigured = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID);

    const persistSessionAndRedirect = (token, user) => {
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));

        if (user.role === 'ADMIN') navigate('/admin');
        else if (user.role === 'MANAGER') navigate('/manager');
        else navigate('/employee');
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            const res = await api.post('/auth/login', { email, password });
            console.log("Login Response:", res.data);
            const { token, user } = res.data;
            persistSessionAndRedirect(token, user);

        } catch (err) {
            console.error("❌ Login error:", err);
            if (err.response) {
                console.error("Error Status:", err.response.status);
                console.error("Error Data:", err.response.data);
            }
            const errorData = err.response?.data;
            const errorMsg = typeof errorData === 'string'
                ? errorData
                : (errorData?.message || err.message || 'Đăng nhập thất bại! Vui lòng kiểm tra thông tin.');
            setError(errorMsg);
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleLogin = async (credentialResponse) => {
        setIsLoading(true);
        setError('');

        try {
            const res = await authAPI.googleLogin(credentialResponse.credential);
            if (res.status === 202) {
                const pendingMsg = res.data?.message || 'Tài khoản của bạn đang chờ quản trị viên phê duyệt!';
                setError(pendingMsg);
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                return;
            }

            const { token, user } = res.data;
            persistSessionAndRedirect(token, user);
        } catch (err) {
            const errorData = err.response?.data;
            const errorMsg = typeof errorData === 'string'
                ? errorData
                : (errorData?.message || err.message || 'Đăng nhập Google thất bại!');
            setError(errorMsg);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-vh-100 bg-light d-flex align-items-center justify-content-center">
            {/* Tăng maxWidth lên 500px cho form to đẹp hơn */}
            <div className="card shadow-lg border-0 p-5" style={{maxWidth: '500px', width: '90%', borderRadius: '15px'}}>
                <div className="text-center mb-4">
                    <div className="bg-primary text-white rounded-circle d-inline-flex align-items-center justify-content-center mb-3 shadow-sm" style={{width: 80, height: 80}}>
                        <i className="bi bi-shield-lock-fill fs-1"></i>
                    </div>
                    <h2 className="fw-bold text-primary mb-1">WELCOME BACK</h2>
                    <p className="text-muted">Đăng nhập để quản lý dự án</p>
                </div>

                {genericError && <div className="alert alert-danger text-center p-2 mb-4">{error}</div>}
                {pendingApproval && (
                    <div className="alert alert-warning text-center p-3 mb-4">
                        <div className="fw-bold mb-1">Tài khoản của bạn đang chờ quản trị viên phê duyệt.</div>
                        <div className="small text-muted">{error}</div>
                    </div>
                )}
                {rejectedApproval && (
                    <div className="alert alert-danger text-center p-3 mb-4">
                        <div className="fw-bold mb-1">Yêu cầu đăng ký của bạn đã bị từ chối.</div>
                        <div className="small">{error}</div>
                        <div className="small text-muted mt-2">Vui lòng liên hệ quản trị viên nếu bạn cần được xem xét lại hoặc tạo yêu cầu mới.</div>
                    </div>
                )}

                <form onSubmit={handleLogin}>
                    <div className="form-floating mb-3">
                        <input 
                            type="email" 
                            className="form-control" 
                            id="emailInput" 
                            placeholder="name@example.com"
                            value={email} 
                            onChange={(e) => setEmail(e.target.value)} 
                            required 
                        />
                        <label htmlFor="emailInput">Email</label>
                    </div>
                    <div className="form-floating mb-4">
                        <input 
                            type="password" 
                            className="form-control" 
                            id="passInput" 
                            placeholder="Password" 
                            value={password} 
                            onChange={(e) => setPassword(e.target.value)} 
                            required 
                        />
                        <label htmlFor="passInput">Mật khẩu</label>
                    </div>
                    
                    <button type="submit" className="btn btn-primary w-100 py-3 fw-bold fs-5 shadow-sm rounded-pill" disabled={isLoading}>
                        {isLoading ? 'Đang xử lý...' : 'ĐĂNG NHẬP'}
                    </button>
                </form>

                <div className="d-flex align-items-center my-4">
                    <div className="flex-grow-1 border-top"></div>
                    <span className="px-3 text-muted small">hoặc</span>
                    <div className="flex-grow-1 border-top"></div>
                </div>

                {googleClientConfigured ? (
                    <div className="d-flex justify-content-center">
                        <GoogleLogin
                            onSuccess={handleGoogleLogin}
                            onError={() => {
                                setIsLoading(false);
                                setError('Không thể đăng nhập bằng Google. Vui lòng thử lại!');
                            }}
                            text="signin_with"
                            shape="pill"
                            width="320"
                        />
                    </div>
                ) : (
                    <div className="text-center text-muted small">
                        Cần cấu hình <code>VITE_GOOGLE_CLIENT_ID</code> để bật đăng nhập Google.
                    </div>
                )}

                <div className="text-center mt-3">
                    <Link to="/forgot-password" className="text-decoration-none">Quên mật khẩu?</Link>
                </div>

                <div className="text-center mt-2">
                    <span className="text-muted">Chưa có tài khoản? </span>
                    <Link to="/signup" className="text-decoration-none fw-semibold">Đăng ký ngay</Link>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
