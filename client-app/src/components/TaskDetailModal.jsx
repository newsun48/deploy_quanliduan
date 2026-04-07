import { useEffect, useMemo, useState } from 'react';
import { commentAPI, fileAPI, resolveAppUrl, taskAPI } from '../api';
import './TaskDetailModal.css';
import { askConfirm } from '../utils/confirm';

const getFileUrl = (url) => {
    if (!url) return '#';
    return resolveAppUrl(url);
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

const getTodayDateInputValue = () => {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

const toDateInputValue = (value) => {
    if (!value) return '';
    if (typeof value === 'string') return value.slice(0, 10);

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';

    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

const createTaskEditState = (taskData) => ({
    title: taskData?.title || '',
    description: taskData?.description || '',
    deadline: toDateInputValue(taskData?.deadline),
    priority: taskData?.priority || 'MEDIUM',
    assigneeId: taskData?.assignee?.id || '',
});

const TaskDetailModal = ({ task, currentUser, assigneeCandidates = [], onClose, onTaskUpdate }) => {
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
    const [isEditingTask, setIsEditingTask] = useState(false);
    const [taskEditForm, setTaskEditForm] = useState(() => createTaskEditState(task));
    const [savingTask, setSavingTask] = useState(false);
    const [deletingTask, setDeletingTask] = useState(false);

    const currentTask = taskDetail || task;
    const isManager = currentUser?.role === 'MANAGER';
    const canManageTask = isManager && currentTask?.project?.status !== 'CLOSED';
    const todayDate = useMemo(() => getTodayDateInputValue(), []);
    
    // 🔥 Kiểm tra xem assignee có còn trong dự án không
    const isAssigneeStillInProject = useMemo(() => {
        if (!currentTask?.assignee?.id) return false;
        return assigneeCandidates.some(m => m.id === currentTask.assignee.id);
    }, [assigneeCandidates, currentTask?.assignee]);
    
    const assigneeOptions = useMemo(() => {
        const seen = new Set();
        const options = [];

        [...assigneeCandidates, currentTask?.assignee].forEach((member) => {
            if (!member?.id || seen.has(member.id)) return;
            seen.add(member.id);
            options.push(member);
        });

        return options;
    }, [assigneeCandidates, currentTask?.assignee]);
    const completionText = useMemo(() => {
        if (!currentTask?.checklistItems?.length) return '0/0 hoàn thành';
        const done = currentTask.checklistItems.filter((item) => item.completed).length;
        return `${done}/${currentTask.checklistItems.length} hoàn thành`;
    }, [currentTask]);

    useEffect(() => {
        setTaskDetail(task);
        setIsEditingTask(false);
        setTaskEditForm(createTaskEditState(task));
    }, [task]);

    useEffect(() => {
        if (!currentTask || isEditingTask) return;
        setTaskEditForm(createTaskEditState(currentTask));
    }, [currentTask, isEditingTask]);

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
            });
            await refreshTaskDetail(true);
        } catch (err) {
            alert('Lỗi cập nhật checklist: ' + (err.response?.data || err.message));
        }
    };

    const handleDeleteChecklistItem = async (itemId) => {
        if (!(await askConfirm('Bạn chắc chắn muốn xóa checklist này?'))) return;

        try {
            await taskAPI.deleteChecklistItem(task.id, itemId);
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
                await taskAPI.addAttachment(task.id, uploadedFile);
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
            await taskAPI.deleteAttachment(task.id, attachmentId);
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

    const handleTaskEditSubmit = async (e) => {
        e.preventDefault();

        // 🔥 Validate required fields
        if (!taskEditForm.title.trim()) {
            alert('Vui lòng nhập tiêu đề công việc!');
            return;
        }
        if (!taskEditForm.deadline) {
            alert('Vui lòng chọn hạn chót!');
            return;
        }
        if (!taskEditForm.assigneeId) {
            alert('Vui lòng chọn người thực hiện!');
            return;
        }

        try {
            setSavingTask(true);
            await taskAPI.update(task.id, {
                title: taskEditForm.title.trim(),
                description: taskEditForm.description,
                deadline: taskEditForm.deadline,
                priority: taskEditForm.priority,
                assigneeId: taskEditForm.assigneeId,
            });
            setIsEditingTask(false);
            alert('✅ Cập nhật công việc thành công!');
            await refreshTaskDetail(true);
        } catch (err) {
            alert('Lỗi cập nhật công việc: ' + (err.response?.data || err.message));
        } finally {
            setSavingTask(false);
        }
    };

    const handleDeleteTask = async () => {
        if (!(await askConfirm('Bạn chắc chắn muốn xóa công việc này?'))) return;

        try {
            setDeletingTask(true);
            await taskAPI.delete(task.id);
            if (onTaskUpdate) {
                await Promise.resolve(onTaskUpdate());
            }
            onClose();
        } catch (err) {
            alert('Lỗi xóa công việc: ' + (err.response?.data || err.message));
        } finally {
            setDeletingTask(false);
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
                            <div className="task-modal-subtitle">Trung tâm cộng tác công việc</div>
                        </div>
                        <div className="task-modal-header-meta">
                            {canManageTask && !isEditingTask && (
                                <div className="task-modal-manager-actions">
                                    <button className="task-modal-action-btn task-modal-action-btn-secondary" onClick={() => setIsEditingTask(true)}>
                                        <i className="bi bi-pencil-square"></i>
                                        Chỉnh sửa
                                    </button>
                                    <button className="task-modal-action-btn task-modal-action-btn-danger" onClick={handleDeleteTask} disabled={deletingTask}>
                                        <i className="bi bi-trash3"></i>
                                        {deletingTask ? 'Đang xóa...' : 'Xóa'}
                                    </button>
                                </div>
                            )}
                            <span className={`badge ${currentTask.priority === 'HIGH' ? 'bg-danger' : currentTask.priority === 'MEDIUM' ? 'bg-warning text-dark' : 'bg-info'}`}>
                                {currentTask.priority}
                            </span>
                        </div>
                    </div>
                    <button className="task-modal-close-btn" onClick={onClose}>&times;</button>
                </div>

                <div className="task-modal-body">
                    <div className="task-details-panel">
                        <div className="task-info-section">
                            <div className="section-heading-row">
                                <h5 className="task-section-title">Chi tiết công việc</h5>
                                {isEditingTask && <span className="section-chip">Đang chỉnh sửa</span>}
                            </div>

                            {canManageTask && isEditingTask && (
                                <form className="task-edit-form" onSubmit={handleTaskEditSubmit}>
                                    <div className="task-edit-grid">
                                        <div className="task-edit-field task-edit-field-full">
                                            <label htmlFor="task-edit-title">Tiêu đề công việc</label>
                                            <input
                                                id="task-edit-title"
                                                className="form-control"
                                                required
                                                value={taskEditForm.title}
                                                onChange={(e) => setTaskEditForm((prev) => ({ ...prev, title: e.target.value }))}
                                            />
                                        </div>

                                        <div className="task-edit-field task-edit-field-full">
                                            <label htmlFor="task-edit-description">Mô tả</label>
                                            <textarea
                                                id="task-edit-description"
                                                className="form-control"
                                                rows="3"
                                                value={taskEditForm.description}
                                                onChange={(e) => setTaskEditForm((prev) => ({ ...prev, description: e.target.value }))}
                                            />
                                        </div>

                                        <div className="task-edit-field">
                                            <label htmlFor="task-edit-deadline">Hạn hoàn thành</label>
                                            <input
                                                id="task-edit-deadline"
                                                type="date"
                                                min={todayDate}
                                                className="form-control"
                                                required
                                                value={taskEditForm.deadline}
                                                onChange={(e) => setTaskEditForm((prev) => ({ ...prev, deadline: e.target.value }))}
                                            />
                                        </div>

                                        <div className="task-edit-field">
                                            <label htmlFor="task-edit-priority">Độ ưu tiên</label>
                                            <select
                                                id="task-edit-priority"
                                                className="form-select"
                                                value={taskEditForm.priority}
                                                onChange={(e) => setTaskEditForm((prev) => ({ ...prev, priority: e.target.value }))}
                                            >
                                                <option value="MEDIUM">Trung bình</option>
                                                <option value="HIGH">Cao</option>
                                                <option value="LOW">Thấp</option>
                                            </select>
                                        </div>

                                        <div className="task-edit-field">
                                            <label htmlFor="task-edit-assignee">Người thực hiện</label>
                                            <select
                                                id="task-edit-assignee"
                                                className="form-select"
                                                required
                                                value={taskEditForm.assigneeId}
                                                onChange={(e) => setTaskEditForm((prev) => ({ ...prev, assigneeId: e.target.value }))}
                                            >
                                                <option value="">-- Chọn thành viên dự án --</option>
                                                {assigneeOptions.map((member) => (
                                                    <option key={member.id} value={member.id}>
                                                        {member.fullName}{member.email ? ` (${member.email})` : ''}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="task-edit-actions">
                                        <button
                                            type="button"
                                            className="btn btn-light"
                                            onClick={() => {
                                                setIsEditingTask(false);
                                                setTaskEditForm(createTaskEditState(currentTask));
                                            }}
                                        >
                                            Hủy
                                        </button>
                                        <button
                                            type="submit"
                                            className="btn btn-primary"
                                            disabled={savingTask || !taskEditForm.title.trim() || !taskEditForm.deadline || !taskEditForm.assigneeId}
                                        >
                                            {savingTask ? 'Đang lưu...' : 'Lưu thay đổi'}
                                        </button>
                                    </div>
                                </form>
                            )}

                            <div className="task-info-item">
                                <label>Dự án</label>
                                <p>{currentTask.project?.name || '--'}</p>
                            </div>

                            <div className="task-info-item">
                                <label>Người thực hiện</label>
                                <div className="d-flex align-items-center gap-2">
                                    <div>
                                        <p>{currentTask.assignee?.fullName || '--'} {currentTask.assignee?.email ? `(${currentTask.assignee.email})` : ''}</p>
                                        {/* 🔥 Cảnh báo khi assignee bị xóa khỏi dự án */}
                                        {currentTask.assignee && !isAssigneeStillInProject && (
                                            <div className="alert alert-warning alert-sm py-2 px-3 mb-0" style={{ fontSize: '0.875rem' }}>
                                                <i className="bi bi-exclamation-triangle-fill me-2"></i>
                                                <strong>Nhân viên này đã bị xóa khỏi dự án!</strong>
                                                <br/>
                                                Vui lòng bàn giao công việc cho người khác.
                                            </div>
                                        )}
                                    </div>
                                    {/* 🔥 Nút edit nhanh khi assignee bị xóa */}
                                    {canManageTask && !isAssigneeStillInProject && (
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-warning whitespace-nowrap"
                                            onClick={() => setIsEditingTask(true)}
                                            title="Chỉnh sửa người thực hiện"
                                        >
                                            <i className="bi bi-pencil-square me-1"></i>Bàn giao
                                        </button>
                                    )}
                                </div>
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
                                <h5 className="task-section-title">Tệp đính kèm công việc</h5>
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
                                                    {formatBytes(attachment.size)} - {attachment.uploadedByName || 'Không rõ'} - {formatDateTime(attachment.uploadedAt)}
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
                                <h5 className="task-section-title">Lịch sử hoạt động</h5>
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
