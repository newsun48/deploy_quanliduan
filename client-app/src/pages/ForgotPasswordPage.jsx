import { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';

const ForgotPasswordPage = () => {
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleForgotPassword = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        setMessage('');

        try {
            const res = await axios.post('/api/auth/forgot-password', { email });
            setMessage(res.data);
        } catch (err) {
            setError(err.response?.data || "Có lỗi xảy ra!");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-vh-100 bg-light d-flex align-items-center justify-content-center">
            <div className="card shadow-lg border-0 p-5" style={{maxWidth: '500px', width: '90%', borderRadius: '15px'}}>
                <div className="text-center mb-4">
                    <div className="bg-warning text-white rounded-circle d-inline-flex align-items-center justify-content-center mb-3 shadow-sm" style={{width: 80, height: 80}}>
                        <i className="bi bi-key-fill fs-1"></i>
                    </div>
                    <h2 className="fw-bold text-primary mb-1">QUÊN MẬT KHẨU</h2>
                    <p className="text-muted">Nhập email để reset mật khẩu</p>
                </div>

                {error && <div className="alert alert-danger text-center p-2 mb-4">{error}</div>}
                {message && <div className="alert alert-success text-center p-2 mb-4">{message}</div>}

                <form onSubmit={handleForgotPassword}>
                    <div className="form-floating mb-4">
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
                    
                    <button type="submit" className="btn btn-primary w-100 py-3 fw-bold fs-5 shadow-sm rounded-pill" disabled={isLoading}>
                        {isLoading ? 'Đang xử lý...' : 'RESET MẬT KHẨU'}
                    </button>
                </form>

                <div className="text-center mt-3">
                    <Link to="/" className="text-decoration-none">Quay lại đăng nhập</Link>
                </div>
            </div>
        </div>
    );
};

export default ForgotPasswordPage;