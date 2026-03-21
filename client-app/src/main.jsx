import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import Swal from 'sweetalert2';

// Ghi đè phương thức alert mặc định của trình duyệt để dùng giao diện đẹp của SweetAlert2
window.alert = (message) => {
    let icon = 'info';
    let title = 'Thông báo';
    const msgLower = (message || '').toString().toLowerCase();
    
    if (msgLower.includes('lỗi')) {
        icon = 'error'; title = 'Lỗi!';
    } else if (msgLower.includes('thành công') || msgLower.includes('đã') || msgLower.includes('chúc mừng')) {
        icon = 'success'; title = 'Thành công!';
    } else if (msgLower.includes('cảnh báo') || msgLower.includes('vui lòng')) {
        icon = 'warning'; title = 'Chú ý!';
    }
    
    Swal.fire({
        title: title,
        text: message,
        icon: icon,
        confirmButtonColor: '#3b82f6'
    });
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
