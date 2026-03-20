import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api';

const LoginPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            const res = await api.post('/auth/login', { email, password });
            console.log("Login Response:", res.data);
            const { token, user } = res.data;

            // Lưu token và user vào localStorage
            localStorage.setItem('token', token);
            localStorage.setItem('user', JSON.stringify(user));

            if (user.role === 'ADMIN') navigate('/admin');
            else if (user.role === 'MANAGER') navigate('/manager');
            else navigate('/employee');

        } catch (err) {
            console.error("❌ Login error:", err);
            if (err.response) {
                console.error("Error Status:", err.response.status);
                console.error("Error Data:", err.response.data);
            }
            const errorMsg = err.response?.data || err.message || "Đăng nhập thất bại! Vui lòng kiểm tra thông tin.";
            setError(typeof errorMsg === 'string' ? errorMsg : "Đăng nhập thất bại!");
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

                {error && <div className="alert alert-danger text-center p-2 mb-4">{error}</div>}

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

                <div className="text-center mt-3">
                    <Link to="/forgot-password" className="text-decoration-none">Quên mật khẩu?</Link>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;