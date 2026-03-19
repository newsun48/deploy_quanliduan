import { useState, useEffect } from 'react';
import api from '../api';
import './TaskDetailModal.css';

const TaskDetailModal = ({ task, currentUser, onClose }) => {
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState('');
    const [loading, setLoading] = useState(false);
    const [editingCommentId, setEditingCommentId] = useState(null);
    const [editingContent, setEditingContent] = useState('');

    useEffect(() => {
        if (task) {
            fetchComments();
        }
    }, [task]);

    const fetchComments = async () => {
        try {
            setLoading(true);
            const res = await api.get(`/comments/task/${task.id}`);
            setComments(res.data || []);
        } catch (err) {
            console.error('Error fetching comments:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleAddComment = async (e) => {
        e.preventDefault();
        if (!newComment.trim()) return;

        try {
            const res = await api.post(`/comments/add?taskId=${task.id}&userId=${currentUser.id}`, {
                content: newComment
            });
            setComments([...comments, res.data]);
            setNewComment('');
        } catch (err) {
            alert('Lỗi thêm bình luận: ' + (err.response?.data || err.message));
        }
    };

    const handleUpdateComment = async (commentId) => {
        if (!editingContent.trim()) return;

        try {
            const res = await api.put(`/comments/${commentId}`, {
                content: editingContent
            });
            setComments(comments.map(c => c.id === commentId ? res.data : c));
            setEditingCommentId(null);
            setEditingContent('');
        } catch (err) {
            alert('Lỗi cập nhật bình luận: ' + (err.response?.data || err.message));
        }
    };

    const handleDeleteComment = async (commentId) => {
        if (window.confirm('Bạn chắc chắn muốn xóa bình luận này?')) {
            try {
                await api.delete(`/comments/${commentId}`);
                setComments(comments.filter(c => c.id !== commentId));
            } catch (err) {
                alert('Lỗi xóa bình luận: ' + (err.response?.data || err.message));
            }
        }
    };

    if (!task) return null;

    return (
        <div className="task-modal-backdrop">
            <div className="task-modal-container">
                {/* Header */}
                <div className="task-modal-header">
                    <div className="task-modal-title-section">
                        <h2 className="task-modal-title">{task.title}</h2>
                        <span className={`badge ${task.priority === 'HIGH' ? 'bg-danger' : task.priority === 'MEDIUM' ? 'bg-warning text-dark' : 'bg-info'}`}>
                            {task.priority}
                        </span>
                    </div>
                    <button className="task-modal-close-btn" onClick={onClose}>&times;</button>
                </div>

                <div className="task-modal-body">
                    {/* Left Panel - Task Details */}
                    <div className="task-details-panel">
                        <div className="task-info-section">
                            <h5 className="task-section-title">CHI TIẾT CÔNG VIỆC</h5>
                            
                            <div className="task-info-item">
                                <label>Dự án:</label>
                                <p>{task.project?.name}</p>
                            </div>

                            <div className="task-info-item">
                                <label>Người thực hiện:</label>
                                <p>{task.assignee?.fullName} ({task.assignee?.email})</p>
                            </div>

                            <div className="task-info-item">
                                <label>Trạng thái:</label>
                                <span className={`badge ${task.status === 'DONE' ? 'bg-success' : task.status === 'IN_PROGRESS' ? 'bg-primary' : 'bg-secondary'}`}>
                                    {task.status.replace('_', ' ')}
                                </span>
                            </div>

                            <div className="task-info-item">
                                <label>Tiến độ:</label>
                                <div className="progress" style={{ height: 8 }}>
                                    <div 
                                        className={`progress-bar ${task.status === 'DONE' ? 'bg-success' : 'bg-primary'}`}
                                        style={{ width: `${task.completionPercentage}%` }}
                                    ></div>
                                </div>
                                <span className="progress-text">{task.completionPercentage}%</span>
                            </div>

                            <div className="task-info-item">
                                <label>Hạn chót:</label>
                                <p>{task.deadline ? new Date(task.deadline).toLocaleDateString('vi-VN') : 'Không xác định'}</p>
                            </div>

                            <div className="task-info-item">
                                <label>Mô tả:</label>
                                <p>{task.description || 'Không có mô tả'}</p>
                            </div>
                        </div>
                    </div>

                    {/* Right Panel - Comments (Chat) */}
                    <div className="task-comments-panel">
                        <h5 className="task-section-title">BÌNH LUẬN</h5>

                        {/* Add Comment Form - ĐẶT LÊN TRÊN */}
                        <form onSubmit={handleAddComment} className="add-comment-form">
                            <div className="input-group">
                                <textarea
                                    autoFocus
                                    className="form-control comment-input"
                                    placeholder="Viết bình luận..."
                                    value={newComment}
                                    onChange={(e) => {
                                        console.log('Typing comment:', e.target.value);
                                        setNewComment(e.target.value);
                                    }}
                                    onClick={() => console.log('Textarea clicked!')}
                                    onFocus={() => console.log('Textarea focused!')}
                                    rows="3"
                                />
                                <button 
                                    type="submit" 
                                    className="btn btn-primary comment-submit-btn" 
                                    disabled={!newComment.trim()}
                                    onClick={() => {
                                        console.log('Submit button clicked');
                                    }}
                                >
                                    Gửi
                                </button>
                            </div>
                        </form>

                        {/* Comments List */}
                        <div className="comments-list">
                            {loading ? (
                                <div className="text-center text-muted py-4">Đang tải bình luận...</div>
                            ) : comments.length === 0 ? (
                                <div className="text-center text-muted py-4">Chưa có bình luận nào</div>
                            ) : (
                                comments.map(comment => (
                                    <div key={comment.id} className="comment-item">
                                        <div className="comment-header">
                                            <div className="comment-author-info">
                                                <strong className="comment-author">{comment.author?.fullName}</strong>
                                                <small className="comment-time">
                                                    {new Date(comment.createdAt).toLocaleString('vi-VN')}
                                                </small>
                                            </div>
                                            {comment.author?.id === currentUser.id && (
                                                <div className="comment-actions">
                                                    <button 
                                                        className="comment-edit-btn"
                                                        onClick={() => {
                                                            setEditingCommentId(comment.id);
                                                            setEditingContent(comment.content);
                                                        }}
                                                    >
                                                        ✏️
                                                    </button>
                                                    <button 
                                                        className="comment-delete-btn"
                                                        onClick={() => handleDeleteComment(comment.id)}
                                                    >
                                                        🗑️
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {editingCommentId === comment.id ? (
                                            <div className="comment-edit-form">
                                                <textarea
                                                    className="form-control comment-edit-textarea"
                                                    value={editingContent}
                                                    onChange={(e) => setEditingContent(e.target.value)}
                                                    rows="2"
                                                />
                                                <div className="comment-edit-actions mt-2">
                                                    <button 
                                                        className="btn btn-sm btn-primary"
                                                        onClick={() => handleUpdateComment(comment.id)}
                                                    >
                                                        LƯU
                                                    </button>
                                                    <button 
                                                        className="btn btn-sm btn-secondary"
                                                        onClick={() => setEditingCommentId(null)}
                                                    >
                                                        HỦY
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <p className="comment-content">{comment.content}</p>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TaskDetailModal;
