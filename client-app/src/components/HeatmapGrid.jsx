import React from 'react';

const HeatmapGrid = ({ data }) => {
    const getColor = (count) => {
        if (count === 0) return '#f8f9fa'; // Light gray
        if (count <= 2) return '#dcfce7'; // Light green
        if (count <= 5) return '#fef9c3'; // Light yellow
        return '#fee2e2'; // Light red (Overload)
    };

    const getBorderColor = (count) => {
        if (count === 0) return '#dee2e6';
        if (count <= 2) return '#22c55e';
        if (count <= 5) return '#eab308';
        return '#ef4444';
    };

    if (!data || data.length === 0) {
        return (
            <div className="alert alert-info">
                Không có dữ liệu phân bổ nhân sự.
            </div>
        );
    }

    return (
        <div className="heatmap-container mt-4 animate-fade-in">
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 gap-3 bg-white p-3 rounded-4 shadow-sm border">
                <div>
                    <h6 className="mb-1 fw-bold text-dark d-flex align-items-center">
                        <i className="bi bi-fire text-danger me-2"></i>
                        Bản đồ nhiệt Nguồn lực (Resource Heatmap)
                    </h6>
                    <p className="text-muted small mb-0">Theo dõi mức độ tập trung công việc của toàn bộ đội ngũ nhân sự.</p>
                </div>
                <div className="d-flex flex-wrap gap-3 small">
                    <div className="d-flex align-items-center gap-2 px-2 py-1 bg-success bg-opacity-10 text-success rounded-pill border border-success border-opacity-25">
                        <span className="rounded-circle" style={{ width: 8, height: 8, backgroundColor: '#22c55e' }}></span>
                        <span className="fw-bold">Ổn định (≤2)</span>
                    </div>
                    <div className="d-flex align-items-center gap-2 px-2 py-1 bg-warning bg-opacity-10 text-warning rounded-pill border border-warning border-opacity-25">
                        <span className="rounded-circle" style={{ width: 8, height: 8, backgroundColor: '#eab308' }}></span>
                        <span className="fw-bold">Cảnh báo (3-5)</span>
                    </div>
                    <div className="d-flex align-items-center gap-2 px-2 py-1 bg-danger bg-opacity-10 text-danger rounded-pill border border-danger border-opacity-25">
                        <span className="rounded-circle" style={{ width: 8, height: 8, backgroundColor: '#ef4444' }}></span>
                        <span className="fw-bold">Quá tải (&gt;5)</span>
                    </div>
                </div>
            </div>

            <div className="row row-cols-1 row-cols-sm-2 row-cols-lg-3 row-cols-xl-4 g-4">
                {data.map((item, index) => (
                    <div key={index} className="col">
                        <div 
                            className="card h-100 border-0 shadow-sm transition-transform hover-scale-sm" 
                            style={{ 
                                borderRadius: '1.25rem',
                                background: `linear-gradient(145deg, ${getColor(item.openTasks)} 0%, #ffffff 100%)`,
                                borderLeft: `6px solid ${getBorderColor(item.openTasks)}`
                            }}
                        >
                            <div className="card-body p-4 text-center">
                                <div className="mb-3">
                                    <div className="bg-white rounded-circle d-inline-flex align-items-center justify-content-center shadow-sm" style={{ width: 48, height: 48 }}>
                                        <i className={`bi bi-person-fill fs-4`} style={{ color: getBorderColor(item.openTasks) }}></i>
                                    </div>
                                </div>
                                <div className="fw-bold text-dark text-truncate mb-1" style={{ fontSize: '1.05rem' }} title={item.assigneeName}>
                                    {item.assigneeName}
                                </div>
                                <div className="d-flex align-items-baseline justify-content-center gap-1 mb-2">
                                    <span className="display-5 fw-black text-dark" style={{ letterSpacing: '-1px' }}>
                                        {item.openTasks}
                                    </span>
                                    <span className="text-muted small fw-bold">việc</span>
                                </div>
                                <div className="small text-muted text-uppercase fw-bold ls-1px" style={{ fontSize: '0.65rem', opacity: 0.8 }}>
                                    Đang thực hiện
                                </div>
                                {item.overdueOpenTasks > 0 && (
                                    <div className="mt-3 py-1 px-3 bg-danger text-white rounded-pill d-inline-flex align-items-center gap-1 shadow-sm animate-pulse-slow" style={{ fontSize: '0.75rem' }}>
                                        <i className="bi bi-exclamation-triangle-fill"></i>
                                        {item.overdueOpenTasks} việc quá hạn
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            
            <style>{`
                .hover-scale-sm { transition: transform 0.2s ease-in-out; }
                .hover-scale-sm:hover { transform: translateY(-5px); }
                .fw-black { font-weight: 900; }
                .ls-1px { letter-spacing: 0.5px; }
                .animate-pulse-slow {
                    animation: pulse-red 2s infinite;
                }
                @keyframes pulse-red {
                    0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
                    70% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
                }
            `}</style>
        </div>
    );
};

export default HeatmapGrid;
