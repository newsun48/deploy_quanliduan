import { useState, useEffect, useRef } from 'react';
import api from '../api';
import './ProjectChatPanel.css';

const ProjectChatPanel = ({ project, currentUser }) => {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [editingMessageId, setEditingMessageId] = useState(null);
    const [editingContent, setEditingContent] = useState('');
    const messagesEndRef = useRef(null);

    useEffect(() => {
        console.log('🔵 ProjectChatPanel mounted/updated:', {
            project: project?.id,
            projectName: project?.name,
            projectMembers: project?.members?.length,
            currentUser: currentUser?.id,
            currentUserName: currentUser?.fullName,
            currentUserEmail: currentUser?.email
        });

        if (!project || !currentUser) {
            console.warn('⚠️ Thiếu dữ liệu: project hoặc currentUser không tồn tại');
            return;
        }
    }, [project, currentUser]);

    useEffect(() => {
        if (project) {
            fetchMessages();
            // Poll for new messages every 2 seconds
            const interval = setInterval(fetchMessages, 2000);
            return () => clearInterval(interval);
        }
    }, [project]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const fetchMessages = async () => {
        try {
            setLoading(true);
            
            // 1️⃣ Lấy project messages (direct chat)
            const messagesRes = await api.get(
                `/project-messages/project/${project.id}/user/${currentUser.id}`
            );
            const messages = messagesRes.data || [];

            // 2️⃣ Lấy comments từ tasks (bình luận dự án)
            const commentsRes = await api.get(`/comments/project/${project.id}`);
            const comments = (commentsRes.data || []).map(comment => ({
                ...comment,
                type: 'comment',  // Đánh dấu là comment
                createdAt: comment.createdAt,  // Sử dụng createdAt để sort
                sender: comment.author  // Normalize field name
            }));

            // 3️⃣ Merge messages + comments, sort theo thời gian
            const allItems = [
                ...messages.map(msg => ({ ...msg, type: 'message' })),
                ...comments
            ].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

            setMessages(allItems);
        } catch (err) {
            console.error('Error fetching messages/comments:', err);
            if (err.response?.status === 400 && err.response?.data?.includes("quyền")) {
                console.warn('⚠️ Không có quyền truy cập');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim()) return;

        try {
            console.log('Gửi tin nhắn:', {
                projectId: project.id,
                userId: currentUser.id,
                content: newMessage
            });

            const res = await api.post(`/project-messages/send?projectId=${project.id}&userId=${currentUser.id}`, {
                content: newMessage
            });
            
            console.log('Tin nhắn gửi thành công:', res.data);
            setMessages([...messages, res.data]);
            setNewMessage('');
        } catch (err) {
            console.error('Lỗi gửi tin nhắn chi tiết:', err);
            const errorMsg = err.response?.data?.message || err.response?.data || err.message;
            alert('❌ Lỗi gửi tin nhắn:\n' + JSON.stringify(errorMsg));
        }
    };

    const handleUpdateMessage = async (messageId) => {
        if (!editingContent.trim()) return;

        try {
            const res = await api.put(`/project-messages/${messageId}`, {
                content: editingContent
            });
            setMessages(messages.map(m => m.id === messageId ? res.data : m));
            setEditingMessageId(null);
            setEditingContent('');
        } catch (err) {
            alert('Lỗi cập nhật tin nhắn: ' + (err.response?.data || err.message));
        }
    };

    const handleDeleteMessage = async (messageId) => {
        if (window.confirm('Bạn chắc chắn muốn xóa tin nhắn này?')) {
            try {
                await api.delete(`/project-messages/${messageId}`);
                setMessages(messages.filter(m => m.id !== messageId));
            } catch (err) {
                alert('Lỗi xóa tin nhắn: ' + (err.response?.data || err.message));
            }
        }
    };

    // Validation before render
    if (!project) {
        return (
            <div style={{ padding: '20px', textAlign: 'center', color: '#d32f2f', background: '#ffebee', borderRadius: '8px' }}>
                ⚠️ <strong>Chưa chọn dự án</strong>
            </div>
        );
    }

    if (!currentUser) {
        return (
            <div style={{ padding: '20px', textAlign: 'center', color: '#d32f2f', background: '#ffebee', borderRadius: '8px' }}>
                ⚠️ <strong>Chưa có thông tin người dùng</strong>
            </div>
        );
    }

    return (
        <div className="project-chat-panel" style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', gap: '12px' }}>
            {/* Send Message Form - ĐẠT LÊN TRÊN */}
            <form onSubmit={handleSendMessage} className="send-message-form" style={{ flexShrink: 0, padding: '12px', background: 'white', borderBottom: '1px solid #e9ecef', borderRadius: '8px 8px 0 0', pointerEvents: 'auto' }}>
                <div className="input-group" style={{ display: 'flex', gap: '8px', width: '100%' }}>
                    <input
                        type="text"
                        className="form-control message-input"
                        placeholder="Nhập tin nhắn..."
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyPress={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSendMessage(e);
                            }
                        }}
                        style={{ flex: 1, fontSize: '13px', border: '1px solid #ddd', borderRadius: '6px', padding: '8px 12px', fontFamily: "'Segoe UI', sans-serif", pointerEvents: 'auto', cursor: 'auto', boxSizing: 'border-box', width: '100%' }}
                    />
                    <button 
                        type="submit" 
                        className="btn btn-primary send-btn" 
                        disabled={!newMessage.trim()}
                        style={{ padding: '8px 16px', fontSize: '13px', fontWeight: '600', borderRadius: '6px', whiteSpace: 'nowrap', pointerEvents: 'auto' }}
                    >
                        Gửi
                    </button>
                </div>
            </form>

            {/* Messages List */}
            <div className="messages-container" style={{ flex: 1, overflowY: 'auto', padding: '16px', background: 'white', display: 'flex', flexDirection: 'column', gap: '8px', borderRadius: '0 0 8px 8px' }}>
                {loading && messages.length === 0 ? (
                    <div className="text-center text-muted py-4">Đang tải tin nhắn...</div>
                ) : messages.length === 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#999' }}>
                        <div style={{ fontSize: '48px', marginBottom: '12px', opacity: 0.5 }}>💬</div>
                        <p style={{ fontWeight: '600', marginBottom: '4px' }}>Chưa có tin nhắn nào</p>
                        <small style={{ fontSize: '12px' }}>Hãy bé gửi tin nhắn đầu tiên!</small>
                    </div>
                ) : (
                    <div className="messages-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {messages.map((msg, index) => {
                            const isOwn = msg.sender?.id === currentUser.id;
                            const isComment = msg.type === 'comment';
                            const showAuthor = index === 0 || messages[index - 1].sender?.id !== msg.sender?.id;
                            
                            return (
                                <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px', alignItems: isOwn ? 'flex-end' : 'flex-start' }}>
                                    {showAuthor && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '8px', fontSize: '12px' }}>
                                            <span style={{ fontWeight: '600', color: '#333' }}>
                                                {isComment && '📝 '}
                                                {msg.sender?.fullName}
                                            </span>
                                            {isComment && msg.task?.title && (
                                                <span style={{ color: '#666', fontSize: '11px', fontStyle: 'italic' }}>
                                                    (Task: {msg.task.title})
                                                </span>
                                            )}
                                            <span style={{ color: '#999' }}>{new Date(msg.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                    )}
                                    
                                    {editingMessageId === msg.id ? (
                                        <div style={{ width: '70%', marginTop: '8px' }}>
                                            <textarea
                                                className="form-control message-edit-textarea"
                                                value={editingContent}
                                                onChange={(e) => setEditingContent(e.target.value)}
                                                rows="2"
                                                style={{ fontSize: '13px', border: '2px solid #007bff', borderRadius: '8px', fontFamily: "'Segoe UI', sans-serif", width: '100%' }}
                                            />
                                            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                                                <button 
                                                    className="btn btn-sm btn-primary"
                                                    onClick={() => handleUpdateMessage(msg.id)}
                                                >
                                                    LƯU
                                                </button>
                                                <button 
                                                    className="btn btn-sm btn-secondary"
                                                    onClick={() => setEditingMessageId(null)}
                                                >
                                                    HỦY
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div style={{ 
                                            maxWidth: '70%', 
                                            padding: '10px 14px', 
                                            borderRadius: '12px', 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            gap: '8px', 
                                            background: isComment 
                                                ? (isOwn ? '#fff3e0' : '#f5f5f5')  // Comments: orange/gray
                                                : (isOwn ? '#007bff' : '#e9ecef'),  // Messages: blue/light
                                            color: isComment ? '#333' : (isOwn ? 'white' : '#333'),
                                            borderLeft: isComment ? '3px solid #ff9800' : 'none',
                                            borderBottomLeftRadius: isOwn ? '12px' : '4px', 
                                            borderBottomRightRadius: isOwn ? '4px' : '12px' 
                                        }}>
                                            <p style={{ margin: 0, wordWrap: 'break-word', fontSize: '14px', lineHeight: 1.4 }}>
                                                {msg.content}
                                            </p>
                                            {isOwn && (
                                                <div style={{ display: 'flex', gap: '4px', opacity: 0.7 }}>
                                                    <button 
                                                        style={{ background: 'none', border: 'none', fontSize: '12px', cursor: 'pointer', padding: '2px', transition: 'transform 0.2s' }}
                                                        onClick={() => {
                                                            setEditingMessageId(msg.id);
                                                            setEditingContent(msg.content);
                                                        }}
                                                        title="Chỉnh sửa"
                                                    >
                                                        ✏️
                                                    </button>
                                                    {!isComment && (
                                                        <button 
                                                            style={{ background: 'none', border: 'none', fontSize: '12px', cursor: 'pointer', padding: '2px', transition: 'transform 0.2s' }}
                                                            onClick={() => handleDeleteMessage(msg.id)}
                                                            title="Xóa"
                                                        >
                                                            🗑️
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        <div ref={messagesEndRef} />
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProjectChatPanel;
