import { useEffect, useMemo, useState } from 'react';
import { commentAPI, fileAPI, taskAPI } from '../api';
import './TaskDetailModal.css';
import { askConfirm } from '../utils/confirm';

const API_HOST = 'http://localhost:8080';

const getFileUrl = (url) => {
    if (!url) return '#';
    return url.startsWith('http') ? url : `${API_HOST}${url}`;
};

const formatDateTime = (value) => {
    if (!value) return '--';
    return new Date(value).toLocaleString('vi-VN');
};

const formatBytes = (value) => {
    if (!value) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = value;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex += 1;
    }

    return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
};

const TaskDetailModal = ({ task, currentUser, onClose, onTaskUpdate }) => {
    const [taskDetail, setTaskDetail] = useState(task);
    const [comments, setComments] = useState([]);
    const [activity, setActivity] = useState([]);
    const [newComment, setNewComment] = useState('');
    const [commentFiles, setCommentFiles] = useState([]);
    const [taskFiles, setTaskFiles] = useState([]);
    const [newChecklistTitle, setNewChecklistTitle] = useState('');
    const [loading, setLoading] = useState(false);
    const [savingChecklist, setSavingChecklist] = useState(false);
    const [uploadingTaskFiles, setUploadingTaskFiles] = useState(false);
    const [submittingComment, setSubmittingComment] = useState(false);
    const [editingCommentId, setEditingCommentId] = useState(null);
    const [editingContent, setEditingContent] = useState('');

    const currentTask = taskDetail || task;
    const completionText = useMemo(() => {
        if (!currentTask?.checklistItems?.length) return '0/0 hoàn thành';
        const done = currentTask.checklistItems.filter((item) => item.completed).length;
        return `${done}/${currentTask.checklistItems.length} hoàn thành`;
    }, [currentTask]);

    useEffect(() => {
        if (!task?.id) return;

        const loadTaskData = async () => {
            try {
                setLoading(true);
                const [detailRes, commentsRes, activityRes] = await Promise.all([
                    taskAPI.getDetail(task.id),
                    commentAPI.getTaskComments(task.id),
                    taskAPI.getActivity(task.id),
                ]);
                setTaskDetail(detailRes.data || task);
                setComments(commentsRes.data || []);
                setActivity(activityRes.data || []);
            } catch (err) {
                console.error('Error loading task detail:', err);
            } finally {
                setLoading(false);
            }
        };

        loadTaskData();
    }, [task]);

    const refreshTaskDetail = async (shouldRefreshParent = false) => {
        if (!task?.id) return;

        try {
            const [detailRes, commentsRes, activityRes] = await Promise.all([
                taskAPI.getDetail(task.id),
                commentAPI.getTaskComments(task.id),
                taskAPI.getActivity(task.id),
            ]);
            setTaskDetail(detailRes.data || task);
            setComments(commentsRes.data || []);
            setActivity(activityRes.data || []);
            if (shouldRefreshParent && onTaskUpdate) {
                onTaskUpdate();
            }
        } catch (err) {
            console.error('Error refreshing task detail:', err);
        }
    };

    const uploadFiles = async (files) => {
        const uploads = [];

        for (const file of files) {
            const formData = new FormData();
            formData.append('file', file);
            const uploadRes = await fileAPI.upload(formData);
            uploads.push({
                url: uploadRes.data.url,
                originalName: uploadRes.data.originalName || file.name,
                size: uploadRes.data.size || file.size,
            });
        }

        return uploads;
    };

    const handleAddChecklistItem = async (e) => {
        e.preventDefault();
        if (!newChecklistTitle.trim()) return;

        try {
            setSavingChecklist(true);
            await taskAPI.addChecklistItem(task.id, {
                title: newChecklistTitle.trim(),
                actorId: currentUser.id,
            });
            setNewChecklistTitle('');
            await refreshTaskDetail(true);
        } catch (err) {
            alert('Lỗi thêm checklist: ' + (err.response?.data || err.message));
        } finally {
            setSavingChecklist(false);
        }
    };

    const handleToggleChecklistItem = async (item) => {
        try {
            await taskAPI.updateChecklistItem(task.id, item.id, {
                completed: !item.completed,
                actorId: currentUser.id,
            });
            await refreshTaskDetail(true);
        } catch (err) {
            alert('Lỗi cập nhật checklist: ' + (err.response?.data || err.message));
        }
    };

    const handleDeleteChecklistItem = async (itemId) => {
        if (!(await askConfirm('Bạn chắc chắn muốn xóa checklist này?'))) return;

        try {
            await taskAPI.deleteChecklistItem(task.id, itemId, currentUser.id);
            await refreshTaskDetail(true);
        } catch (err) {
            alert('Lỗi xóa checklist: ' + (err.response?.data || err.message));
        }
    };

    const handleAddTaskAttachments = async () => {
        if (taskFiles.length === 0) return;

        try {
            setUploadingTaskFiles(true);
            const uploadedFiles = await uploadFiles(taskFiles);

            for (const uploadedFile of uploadedFiles) {
                await taskAPI.addAttachment(task.id, {
                    ...uploadedFile,
                    actorId: currentUser.id,
                });
            }

            setTaskFiles([]);
            await refreshTaskDetail(true);
        } catch (err) {
            alert('Lỗi tải file công việc: ' + (err.response?.data || err.message));
        } finally {
            setUploadingTaskFiles(false);
        }
    };

    const handleDeleteTaskAttachment = async (attachmentId) => {
        if (!(await askConfirm('Bạn chắc chắn muốn xóa file này?'))) return;

        try {
            await taskAPI.deleteAttachment(task.id, attachmentId, currentUser.id);
            await refreshTaskDetail(true);
        } catch (err) {
            alert('Lỗi xóa file: ' + (err.response?.data || err.message));
        }
    };

    const handleAddComment = async (e) => {
        e.preventDefault();
        if (!newComment.trim() && commentFiles.length === 0) return;

        try {
            setSubmittingComment(true);
            const attachments = commentFiles.length > 0 ? await uploadFiles(commentFiles) : [];
            await commentAPI.add(task.id, currentUser.id, {
                content: newComment,
                attachments,
            });
            setNewComment('');
            setCommentFiles([]);
            await refreshTaskDetail(false);
        } catch (err) {
            alert('Lỗi thêm bình luận: ' + (err.response?.data || err.message));
        } finally {
            setSubmittingComment(false);
        }
    };

    const handleUpdateComment = async (commentId) => {
        if (!editingContent.trim()) return;

        try {
            await commentAPI.update(commentId, { content: editingContent });
            setEditingCommentId(null);
            setEditingContent('');
            await refreshTaskDetail(false);
        } catch (err) {
            alert('Lỗi cập nhật bình luận: ' + (err.response?.data || err.message));
        }
    };

    const handleDeleteComment = async (commentId) => {
        if (!(await askConfirm('Bạn chắc chắn muốn xóa bình luận này?'))) return;

        try {
            await commentAPI.delete(commentId);
            await refreshTaskDetail(false);
        } catch (err) {
            alert('Lỗi xóa bình luận: ' + (err.response?.data || err.message));
        }
    };

    if (!currentTask) return null;

    return (
        <div className="task-modal-backdrop">
            <div className="task-modal-container">
                <div className="task-modal-header">
                    <div className="task-modal-title-section">
                        <div>
                            <h2 className="task-modal-title">{currentTask.title}</h2>
                            <div className="task-modal-subtitle">Task collaboration hub</div>
                        </div>
                        <span className={`badge ${currentTask.priority === 'HIGH' ? 'bg-danger' : currentTask.priority === 'MEDIUM' ? 'bg-warning text-dark' : 'bg-info'}`}>
                            {currentTask.priority}
                        </span>
                    </div>
                    <button className="task-modal-close-btn" onClick={onClose}>&times;</button>
                </div>

                <div className="task-modal-body">
                    <div className="task-details-panel">
                        <div className="task-info-section">
                            <h5 className="task-section-title">Chi tiết công việc</h5>

                            <div className="task-info-item">
                                <label>Dự án</label>
                                <p>{currentTask.project?.name || '--'}</p>
                            </div>

                            <div className="task-info-item">
                                <label>Người thực hiện</label>
                                <p>{currentTask.assignee?.fullName || '--'} {currentTask.assignee?.email ? `(${currentTask.assignee.email})` : ''}</p>
                            </div>

                            <div className="task-info-item">
                                <label>Trạng thái</label>
                                <span className={`badge ${currentTask.status === 'DONE' ? 'bg-success' : currentTask.status === 'IN_PROGRESS' ? 'bg-primary' : 'bg-secondary'}`}>
                                    {currentTask.status?.replace('_', ' ')}
                                </span>
                            </div>

                            <div className="task-info-item">
                                <label>Tiến độ</label>
                                <div className="progress" style={{ height: 8 }}>
                                    <div
                                        className={`progress-bar ${currentTask.status === 'DONE' ? 'bg-success' : 'bg-primary'}`}
                                        style={{ width: `${currentTask.completionPercentage || 0}%` }}
                                    ></div>
                                </div>
                                <span className="progress-text">{currentTask.completionPercentage || 0}%</span>
                            </div>

                            <div className="task-info-item">
                                <label>Hạn chót</label>
                                <p>{currentTask.deadline ? new Date(currentTask.deadline).toLocaleDateString('vi-VN') : 'Không xác định'}</p>
                            </div>

                            {currentTask.submissionLink && (
                                <div className="task-info-item">
                                    <label>Link nộp bài</label>
                                    <a href={getFileUrl(currentTask.submissionLink)} target="_blank" rel="noopener noreferrer" className="task-link">
                                        {currentTask.submissionLink}
                                    </a>
                                </div>
                            )}

                            <div className="task-info-item">
                                <label>Mô tả</label>
                                <p>{currentTask.description || 'Không có mô tả'}</p>
                            </div>
                        </div>

                        <div className="task-info-section">
                            <div className="section-heading-row">
                                <h5 className="task-section-title">Checklist / Subtasks</h5>
                                <span className="section-chip">{completionText}</span>
                            </div>

                            <form className="inline-form" onSubmit={handleAddChecklistItem}>
                                <input
                                    className="form-control"
                                    placeholder="Thêm hạng mục cần làm..."
                                    value={newChecklistTitle}
                                    onChange={(e) => setNewChecklistTitle(e.target.value)}
                                />
                                <button className="btn btn-primary" disabled={savingChecklist || !newChecklistTitle.trim()}>
                                    Thêm
                                </button>
                            </form>

                            <div className="checklist-list">
                                {(currentTask.checklistItems || []).length === 0 ? (
                                    <div className="empty-state">Chưa có checklist nào cho công việc này.</div>
                                ) : (
                                    currentTask.checklistItems.map((item) => (
                                        <div key={item.id} className="checklist-item-row">
                                            <label className="checklist-toggle">
                                                <input
                                                    type="checkbox"
                                                    checked={!!item.completed}
                                                    onChange={() => handleToggleChecklistItem(item)}
                                                />
                                                <span className={item.completed ? 'checklist-item-title is-complete' : 'checklist-item-title'}>
                                                    {item.title}
                                                </span>
                                            </label>
                                            <button className="btn btn-sm btn-link text-danger" onClick={() => handleDeleteChecklistItem(item.id)}>
                                                Xóa
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        <div className="task-info-section">
                            <div className="section-heading-row">
                                <h5 className="task-section-title">Task Attachments</h5>
                                <span className="section-chip">{currentTask.attachments?.length || 0} file</span>
                            </div>

                            <div className="upload-box">
                                <input
                                    type="file"
                                    multiple
                                    className="form-control"
                                    onChange={(e) => setTaskFiles(Array.from(e.target.files || []))}
                                />
                                {taskFiles.length > 0 && (
                                    <div className="selected-files-text">Đã chọn: {taskFiles.map((file) => file.name).join(', ')}</div>
                                )}
                                <button className="btn btn-outline-primary" onClick={handleAddTaskAttachments} disabled={uploadingTaskFiles || taskFiles.length === 0}>
                                    {uploadingTaskFiles ? 'Đang tải...' : 'Tải file lên'}
                                </button>
                            </div>

                            <div className="attachment-list">
                                {(currentTask.attachments || []).length === 0 ? (
                                    <div className="empty-state">Chưa có file đính kèm cho task.</div>
                                ) : (
                                    currentTask.attachments.map((attachment) => (
                                        <div key={attachment.id} className="attachment-card">
                                            <div>
                                                <a href={getFileUrl(attachment.url)} target="_blank" rel="noopener noreferrer" className="attachment-link">
                                                    {attachment.originalName}
                                                </a>
                                                <div className="attachment-meta">
                                                    {formatBytes(attachment.size)} - {attachment.uploadedByName || 'Unknown'} - {formatDateTime(attachment.uploadedAt)}
                                                </div>
                                            </div>
                                            <button className="btn btn-sm btn-link text-danger" onClick={() => handleDeleteTaskAttachment(attachment.id)}>
                                                Xóa
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        <div className="task-info-section task-activity-section">
                            <div className="section-heading-row">
                                <h5 className="task-section-title">Activity History</h5>
                                <span className="section-chip">{activity.length} sự kiện</span>
                            </div>
                            <div className="activity-list">
                                {loading ? (
                                    <div className="empty-state">Đang tải lịch sử...</div>
                                ) : activity.length === 0 ? (
                                    <div className="empty-state">Chưa có hoạt động nào được ghi nhận.</div>
                                ) : (
                                    activity.map((entry) => (
                                        <div key={entry.id} className="activity-item">
                                            <div className="activity-dot"></div>
                                            <div>
                                                <div className="activity-message">{entry.message}</div>
                                                <div className="activity-meta">{entry.actorName || 'Hệ thống'} - {formatDateTime(entry.createdAt)}</div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="task-comments-panel">
                        <div className="section-heading-row">
                            <h5 className="task-section-title">Bình luận</h5>
                            <span className="section-chip">{comments.length} bình luận</span>
                        </div>

                        <form onSubmit={handleAddComment} className="add-comment-form">
                            <div className="input-group">
                                <textarea
                                    autoFocus
                                    className="form-control comment-input"
                                    placeholder="Viết bình luận hoặc tải file..."
                                    value={newComment}
                                    onChange={(e) => setNewComment(e.target.value)}
                                    rows="3"
                                />
                                <input
                                    type="file"
                                    multiple
                                    className="form-control"
                                    onChange={(e) => setCommentFiles(Array.from(e.target.files || []))}
                                />
                                {commentFiles.length > 0 && (
                                    <div className="selected-files-text">Đã chọn: {commentFiles.map((file) => file.name).join(', ')}</div>
                                )}
                                <button type="submit" className="btn btn-primary comment-submit-btn" disabled={submittingComment || (!newComment.trim() && commentFiles.length === 0)}>
                                    {submittingComment ? 'Đang gửi...' : 'Gửi bình luận'}
                                </button>
                            </div>
                        </form>

                        <div className="comments-list">
                            {loading ? (
                                <div className="text-center text-muted py-4">Đang tải bình luận...</div>
                            ) : comments.length === 0 ? (
                                <div className="text-center text-muted py-4">Chưa có bình luận nào</div>
                            ) : (
                                comments.map((comment) => (
                                    <div key={comment.id} className="comment-item">
                                        <div className="comment-header">
                                            <div className="comment-author-info">
                                                <strong className="comment-author">{comment.author?.fullName}</strong>
                                                <small className="comment-time">{formatDateTime(comment.createdAt)}</small>
                                            </div>
                                            {comment.author?.id === currentUser.id && (
                                                <div className="comment-actions">
                                                    <button
                                                        className="comment-edit-btn"
                                                        onClick={() => {
                                                            setEditingCommentId(comment.id);
                                                            setEditingContent(comment.content || '');
                                                        }}
                                                    >
                                                        ✏️
                                                    </button>
                                                    <button className="comment-delete-btn" onClick={() => handleDeleteComment(comment.id)}>
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
                                                    <button className="btn btn-sm btn-primary" onClick={() => handleUpdateComment(comment.id)}>
                                                        Lưu
                                                    </button>
                                                    <button className="btn btn-sm btn-secondary" onClick={() => setEditingCommentId(null)}>
                                                        Hủy
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                {comment.content && <p className="comment-content">{comment.content}</p>}
                                                {comment.attachments?.length > 0 && (
                                                    <div className="comment-attachments">
                                                        {comment.attachments.map((attachment) => (
                                                            <a
                                                                key={attachment.id || attachment.url}
                                                                href={getFileUrl(attachment.url)}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="comment-attachment-link"
                                                            >
                                                                {attachment.originalName} ({formatBytes(attachment.size)})
                                                            </a>
                                                        ))}
                                                    </div>
                                                )}
                                            </>
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
