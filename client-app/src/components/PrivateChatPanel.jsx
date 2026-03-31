import { useCallback, useEffect, useRef, useState } from 'react';
import api, { getWebSocketUrl, resolveAppUrl } from '../api';
import SockJS from 'sockjs-client';
import { Stomp } from '@stomp/stompjs';

const PrivateChatPanel = ({ currentUser, targetUser, onClose }) => {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [editingMessageId, setEditingMessageId] = useState(null);
    const [editingContent, setEditingContent] = useState('');
    const [replyToMessage, setReplyToMessage] = useState(null);
    const messagesEndRef = useRef(null);
    const stompClientRef = useRef(null);
    const reconnectTimeoutRef = useRef(null);
    const token = localStorage.getItem('token');

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const connectWebSocket = useCallback(() => {
        if (!currentUser || !targetUser || currentUser.id === targetUser.id) return;

        if (reconnectTimeoutRef.current) {
            window.clearTimeout(reconnectTimeoutRef.current);
        }
        if (stompClientRef.current) {
            stompClientRef.current.disconnect();
        }

        const socket = new SockJS(getWebSocketUrl());
        const client = Stomp.over(() => socket);
        client.debug = () => {};

        client.connect({ Authorization: token ? `Bearer ${token}` : '' }, () => {
            console.log('✅ WebSocket connected for Private Chat:', currentUser.id);

            client.subscribe('/user/queue/messages', (messageOutput) => {
                const newMsg = JSON.parse(messageOutput.body);

                // Chỉ hiển thị tin nhắn giữa currentUser và targetUser
                const isBetweenUs =
                    (newMsg.sender?.id === currentUser.id && newMsg.receiver?.id === targetUser.id) ||
                    (newMsg.sender?.id === targetUser.id && newMsg.receiver?.id === currentUser.id);

                if (!isBetweenUs) return;

                setMessages((prev) => {
                    const exists = prev.find(m => m.id === newMsg.id);
                    if (exists) {
                        return prev.map(m => m.id === newMsg.id ? newMsg : m);
                    }
                    return [...prev, newMsg];
                });
            });
        }, (error) => {
            console.error('❌ WebSocket Error:', error);
            reconnectTimeoutRef.current = window.setTimeout(connectWebSocket, 5000);
        });

        stompClientRef.current = client;
    }, [currentUser, targetUser, token]);

    const fetchMessages = useCallback(async () => {
        try {
            setLoading(true);
            const res = await api.get(
                `/project-messages/private/user/${currentUser.id}/${targetUser.id}`
            );
            setMessages(res.data || []);
        } catch (err) {
            console.error('Error fetching private messages:', err);
        } finally {
            setLoading(false);
        }
    }, [currentUser?.id, targetUser?.id]);

    useEffect(() => {
        if (!currentUser || !targetUser || currentUser.id === targetUser.id) return;

        fetchMessages();
        connectWebSocket();

        return () => {
            if (reconnectTimeoutRef.current) {
                window.clearTimeout(reconnectTimeoutRef.current);
            }
            if (stompClientRef.current) {
                stompClientRef.current.disconnect();
            }
        };
    }, [connectWebSocket, currentUser, fetchMessages, targetUser]);

    const canEditOrDelete = (msg) => {
        if (!msg.createdAt) return false;
        const created = new Date(msg.createdAt);
        const now = new Date();
        const diffMinutes = (now - created) / (1000 * 60);
        return diffMinutes <= 60;
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() && !file) return;

        try {
            let fileUrl = null;
            let messageType = 'TEXT';

            if (file) {
                const formData = new FormData();
                formData.append('file', file);
                const uploadRes = await api.post('/files/upload', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                fileUrl = uploadRes.data.url;
                messageType = file.type.startsWith('image/') ? 'IMAGE' : 'FILE';
            }

            const payload = {
                receiverId: targetUser.id,
                content: newMessage || (file ? file.name : ''),
                messageType,
                fileUrl,
                replyToId: replyToMessage?.id || ''
            };

            const response = await api.post('/project-messages/send', payload);
            const savedMessage = response.data;

            setMessages((prev) => {
                const exists = prev.find((message) => message.id === savedMessage?.id);
                if (exists || !savedMessage?.id) return prev;
                return [...prev, savedMessage];
            });

            setNewMessage('');
            setFile(null);
            setReplyToMessage(null);
        } catch (err) {
            console.error('Lỗi gửi tin nhắn:', err);
            const errorData = err.response?.data;
            const message = typeof errorData === 'string' ? errorData : (errorData?.message || err.message);
            alert('❌ Lỗi gửi tin nhắn: ' + message);
        }
    };

    const handleUpdateMessage = async (messageId) => {
        if (!editingContent.trim()) return;
        try {
            await api.put(`/project-messages/${messageId}`, { content: editingContent });
            setEditingMessageId(null);
            setEditingContent('');
        } catch (err) {
            alert('Lỗi sửa tin nhắn: ' + (err.response?.data || err.message));
        }
    };

    const handleDeleteMessage = async (messageId) => {
        if (window.confirm('Bạn chắc chắn muốn thu hồi tin nhắn này?')) {
            try {
                await api.delete(`/project-messages/${messageId}`);
            } catch (err) {
                alert('Lỗi thu hồi: ' + (err.response?.data || err.message));
            }
        }
    };

    if (!currentUser || !targetUser || currentUser.id === targetUser.id) return null;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', background: '#f8f9fa', borderRadius: '8px', overflow: 'hidden' }}>

            {/* Header */}
            <div style={{ padding: '12px 16px', background: '#343a40', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <strong>💬 Chat với {targetUser.fullName}</strong>
                    <div style={{ fontSize: '12px', opacity: 0.7 }}>{targetUser.email}</div>
                </div>
                {onClose && (
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'white', fontSize: '20px', cursor: 'pointer' }}>✖</button>
                )}
            </div>

            {/* Form Gửi Tin Nhắn */}
            <form onSubmit={handleSendMessage} style={{ flexShrink: 0, padding: '12px', background: 'white', borderBottom: '1px solid #e9ecef' }}>

                {/* Reply preview */}
                {replyToMessage && (
                    <div style={{ padding: '8px', background: '#f0f4ff', borderRadius: '6px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: '3px solid #007bff' }}>
                        <div style={{ fontSize: '12px', color: '#555' }}>
                            <strong>↩️ Trả lời @{replyToMessage.sender?.fullName}:</strong>
                            <span style={{ marginLeft: '8px', fontStyle: 'italic' }}>{replyToMessage.content?.substring(0, 50)}</span>
                        </div>
                        <button type="button" onClick={() => setReplyToMessage(null)} style={{ background: 'none', border: 'none', color: '#dc3545', cursor: 'pointer', fontSize: '16px' }}>✖</button>
                    </div>
                )}

                {/* File preview */}
                {file && (
                    <div style={{ padding: '8px', background: '#e3f2fd', borderRadius: '6px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                        <span>📎 {file.name}</span>
                        <button type="button" onClick={() => setFile(null)} style={{ background: 'none', border: 'none', color: '#dc3545', cursor: 'pointer' }}>✖</button>
                    </div>
                )}

                <div className="chat-input-group" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <label style={{ cursor: 'pointer', padding: '8px', background: '#f1f3f5', borderRadius: '6px', border: '1px solid #ddd', display: 'flex', alignItems: 'center' }}>
                        📎
                        <input type="file" style={{ display: 'none' }} onChange={(e) => setFile(e.target.files[0])} />
                    </label>
                    <input
                        type="text"
                        className="form-control"
                        placeholder="Nhập tin nhắn..."
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', border: '1px solid #ddd' }}
                    />
                    <button type="submit" className="btn btn-primary" disabled={!newMessage.trim() && !file} style={{ padding: '8px 16px', borderRadius: '6px', fontWeight: 'bold' }}>
                        Gửi
                    </button>
                </div>
            </form>

            {/* Danh sách Tin Nhắn */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px', background: 'white', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {loading && messages.length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#999' }}>Đang tải tin nhắn...</div>
                ) : messages.length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#999', marginTop: '20px' }}>
                        <div style={{ fontSize: '48px', marginBottom: '12px', opacity: 0.5 }}>📨</div>
                        <p>Chưa có tin nhắn nào</p>
                        <small>Gửi tin nhắn đầu tiên cho {targetUser.fullName}!</small>
                    </div>
                ) : (
                    messages.map((msg, index) => {
                        const isOwn = msg.sender?.id === currentUser.id;
                        const showAuthor = index === 0 || messages[index - 1].sender?.id !== msg.sender?.id;

                        return (
                            <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isOwn ? 'flex-end' : 'flex-start', marginBottom: '8px' }}>
                                {showAuthor && (
                                    <div style={{ fontSize: '12px', marginBottom: '4px' }}>
                                        <strong>{msg.sender?.fullName}</strong>
                                        <span style={{ color: '#999', marginLeft: '6px' }}>{new Date(msg.createdAt).toLocaleTimeString('vi-VN')}</span>
                                    </div>
                                )}

                                {editingMessageId === msg.id ? (
                                    <div style={{ width: '70%', background: '#f1f3f5', padding: '8px', borderRadius: '8px' }}>
                                        <textarea
                                            value={editingContent}
                                            onChange={(e) => setEditingContent(e.target.value)}
                                            style={{ width: '100%', padding: '4px', borderRadius: '4px', border: '1px solid #ccc' }}
                                        />
                                        <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                                            <button onClick={() => handleUpdateMessage(msg.id)} className="btn btn-sm btn-primary">Lưu</button>
                                            <button onClick={() => setEditingMessageId(null)} className="btn btn-sm btn-secondary">Hủy</button>
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{
                                        maxWidth: '75%',
                                        padding: '10px 14px',
                                        borderRadius: '12px',
                                        background: isOwn ? '#007bff' : '#e9ecef',
                                        color: isOwn ? '#fff' : '#333',
                                        borderBottomRightRadius: isOwn ? '2px' : '12px',
                                        borderBottomLeftRadius: isOwn ? '12px' : '2px',
                                        position: 'relative'
                                    }}>
                                        {msg.isDeleted || msg.deleted ? (
                                            <i style={{ opacity: 0.7 }}>🚫 Tin nhắn đã bị thu hồi</i>
                                        ) : (
                                            <>
                                                {/* Reply */}
                                                {msg.replyTo && (
                                                    <div style={{ background: 'rgba(0,0,0,0.1)', padding: '6px', borderRadius: '6px', fontSize: '12px', marginBottom: '6px' }}>
                                                        <strong>@{msg.replyTo.sender?.fullName}:</strong> {msg.replyTo.content?.substring(0, 50)}
                                                    </div>
                                                )}

                                                {/* Image */}
                                                {msg.messageType === 'IMAGE' && msg.fileUrl && (
                                                    <img src={resolveAppUrl(msg.fileUrl)} alt="Ảnh" style={{ maxWidth: '100%', borderRadius: '6px', marginBottom: '6px' }} />
                                                )}

                                                {/* File */}
                                                {msg.messageType === 'FILE' && msg.fileUrl && (
                                                    <a href={resolveAppUrl(msg.fileUrl)} target="_blank" rel="noreferrer" style={{ display: 'block', color: 'inherit', textDecoration: 'underline', marginBottom: '6px', fontSize: '13px' }}>
                                                        📎 Tải xuống tài liệu
                                                    </a>
                                                )}

                                                {/* Content */}
                                                <div style={{ fontSize: '14px', lineHeight: 1.4, wordBreak: 'break-word' }}>
                                                    {msg.content}
                                                    {msg.isEdited && <span style={{ fontSize: '11px', opacity: 0.6, marginLeft: '6px' }}>(Đã chỉnh sửa)</span>}
                                                </div>

                                                {/* Actions */}
                                                <div style={{ display: 'flex', gap: '12px', marginTop: '6px', fontSize: '11px', justifyContent: 'flex-end', opacity: 0.8 }}>
                                                    <button onClick={() => setReplyToMessage(msg)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0 }}>↩️ Trả lời</button>
                                                    {isOwn && canEditOrDelete(msg) && (
                                                        <>
                                                            <button onClick={() => { setEditingMessageId(msg.id); setEditingContent(msg.content); }} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0 }}>✏️ Sửa</button>
                                                            <button onClick={() => handleDeleteMessage(msg.id)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0 }}>🗑️ Thu hồi</button>
                                                        </>
                                                    )}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
                <div ref={messagesEndRef} />
            </div>
        </div>
    );
};

export default PrivateChatPanel;
