# Hướng dẫn chi tiết Trang Thống kê Quản trị (Admin Statistics)

Trang Thống kê Quản trị (`/admin/statistics`) là trung tâm điều hành và phân tích dữ liệu chuyên sâu của hệ thống. Trang này kết hợp giữa dữ liệu thực thi (tasks), hiệu suất vận hành (delivery analytics) và mục tiêu chiến lược (KPI/OKR) để giúp Quản trị viên và Trưởng phòng đưa ra các quyết định dựa trên dữ liệu.

---

## 1. Tổng quan Bộ lọc và Phạm vi (Global Filters)
Tại phía trên cùng của trang, bạn có thể điều chỉnh phạm vi dữ liệu:
*   **Chọn Quý (Quarter):** Dữ liệu sẽ được lọc theo mốc thời gian (Quý 1 đến Quý 4 của từng năm).
*   **Chọn Phòng ban:** Admin có thể xem toàn bộ công ty hoặc lọc riêng từng phòng ban. Trưởng phòng sẽ bị giới hạn trong phòng ban của mình.

---

## 2. Các chỉ số Vận hành (Delivery Analytics)
Đây là phần quan trọng nhất để đánh giá tốc độ và chất lượng thực hiện dự án.

### 2.1. Nhóm chỉ số KPI Vận hành
*   **Lead time TB:** Thời gian trung bình từ lúc một công việc được tạo ra đến khi hoàn thành. Chỉ số này càng thấp nghĩa là quy trình từ ý tưởng đến thực thi càng nhanh.
*   **Cycle time TB:** Thời gian trung bình từ lúc nhân viên bắt đầu nhấn "In Progress" đến khi "Done". Đây là thước đo năng lực sản xuất thực tế.
*   **Tỷ lệ task trễ hạn:** Phần trăm các công việc đang mở đã vượt quá hạn chót. Tỷ lệ này cao là dấu hiệu rủi ro nghiêm trọng.
*   **Công việc rủi ro cao:** Số lượng các công việc có điểm rủi ro (Risk Score) trên 75 điểm.

### 2.2. Biểu đồ Phân tích Xu hướng
*   **Biểu đồ Burn-down:** K-Line giữa số lượng công việc còn lại (Remaining) và lũy kế công việc đã hoàn thành. Đường "Remaining" đi xuống càng dốc nghĩa là tiến độ càng tốt.
*   **Vận tốc (Velocity):** Số lượng công việc hoàn thành theo từng tuần. Giúp dự báo khả năng đáp ứng của đội ngũ trong tương lai.
*   **Năng suất (Throughput):** So sánh hiệu suất hoàn thành giữa các phòng ban hoặc qua các tuần để tìm ra đơn vị làm việc hiệu quả nhất.

---

## 3. Quản lý Tài nguyên và Nhân sự (Resource Management)

### 3.1. Bản đồ nhiệt Tải trọng (Resource Load Heatmap)
*   **Cách hoạt động:** Dashboard đếm số lượng công việc đang mở (chưa hoàn thành) của từng nhân sự tại thời điểm thực tế.
*   **Cảnh báo:**
    *   **Xanh:** Dưới 2 việc (Bình thường).
    *   **Vàng:** 3-5 việc (Bận rộn).
    *   **Đỏ:** Trên 5 việc (Quá tải).

### 3.2. Bản đồ nhiệt Hiệu suất (Performance Heatmap)
*   **Cách hoạt động:** Ma trận phân tích xem nhân sự thường hoàn thành công việc vào thứ mấy trong tuần.
*   **Mục đích:** Giúp quản lý hiểu được nhịp độ làm việc của nhân viên (ví dụ: nhân viên thường tập trung dứt điểm việc vào Thứ 6).

---

## 4. Giám sát Rủi ro (Deadline Risk Radar)
Đây là một tính năng thông minh giúp dự báo các công việc có nguy cơ thất bại.

### 4.1. Cách tính điểm Rủi ro (Risk Scoring)
Hệ thống sử dụng thang điểm từ **0 - 100**, tính toán dựa trên 5 yếu tố:
1.  **Thời gian tới hạn (Deadline):** Quá hạn (+45đ), Sát 1 ngày (+25đ), Sát 3 ngày (+18đ).
2.  **Khoảng cách tiến độ (Progress Gap):** Nếu thời gian đã trôi qua 80% mà tiến độ chỉ đạt 20%, hệ thống sẽ cộng điểm phạt nặng.
3.  **Độ ưu tiên (Priority):** Các việc "Khẩn cấp" hoặc "Cao" sẽ có trọng số rủi ro mặc định cao hơn.
4.  **Khối lượng người thực hiện:** Nếu nhân viên đang giữ quá nhiều việc (>10 việc), độ rủi ro của từng việc đó sẽ tăng lên.
5.  **Áp lực dự án:** Nếu dự án tổng thể sắp đến hạn, các task con bên trong cũng bị đánh dấu rủi ro.

---

## 5. Lộ trình Dự án (Project Gantt Timeline)
*   **Chức năng:** Trực quan hóa các công việc trên một trục thời gian.
*   **Tương tác:** Bạn có thể **kéo thả (drag & drop)** các thanh thời gian để thay đổi ngày bắt đầu hoặc hạn chót của công việc ngay trên biểu đồ. Dữ liệu sẽ tự động đồng bộ về backend.

---

## 6. Chiến lược & Mục tiêu (KPI / OKR / Review)
Phần cuối trang tập trung vào việc quản lý mục tiêu dài hạn.

*   **KPI/OKR:** Hiển thị mục tiêu của từng phòng ban, tỷ lệ hoàn thành các Kết quả then chốt (Key Results).
*   **Đánh giá hàng quý (Quarterly Reviews):** Tóm tắt tình trạng sức khỏe của phòng ban sau mỗi quý, bao gồm các hành động cần thực hiện (Action Items) để cải thiện hiệu quả.
*   **Tính năng Insight:** Nút "Phân tích Insights" sử dụng dữ liệu đã thu thập để tự động tạo ra bản tóm tắt đánh giá về hiệu suất của phòng ban đó.
