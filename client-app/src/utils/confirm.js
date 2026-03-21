import Swal from 'sweetalert2';

export const askConfirm = async (text, isDanger = true) => {
    const result = await Swal.fire({
        title: 'Xác nhận',
        text: text,
        icon: isDanger ? 'warning' : 'question',
        showCancelButton: true,
        confirmButtonColor: isDanger ? '#d33' : '#3085d6',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Đồng ý',
        cancelButtonText: 'Hủy'
    });
    return result.isConfirmed;
};
