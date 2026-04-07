import { useEffect, useMemo, useRef, useState } from 'react';
import SockJS from 'sockjs-client';
import { Stomp } from '@stomp/stompjs';
import api, { getWebSocketUrl, projectTemplateAPI, requestAPI, resolveAppUrl, userAPI } from '../api';
import { useNavigate } from 'react-router-dom';
import NotificationBell from '../components/NotificationBell';
import TaskDetailModal from '../components/TaskDetailModal';
import ProjectChatPanel from '../components/ProjectChatPanel';
import PrivateChatPanel from '../components/PrivateChatPanel';
import { askConfirm } from '../utils/confirm';
import Swal from 'sweetalert2';
import '../components/EnterpriseWorkflow.css';
import './AdminDashboard.css';
import {
    REQUEST_PRIORITY_OPTIONS,
    REQUEST_TYPE_OPTIONS,
    TEMPLATE_PRIORITY_OPTIONS,
    formatWorkflowDate,
    formatWorkflowDateTime,
    getRequestStatusMeta,
    getTemplateStatusMeta,
    normalizeRequestItem,
    normalizeTemplateItem,
} from '../utils/enterpriseWorkflow';

const createEmptyTemplateForm = () => ({
    name: '',
    summary: '',
    templateGroupType: 'OTHER',
    priority: 'MEDIUM',
    checklistText: '',
    objectiveText: '',
});

const createProjectFromTemplateForm = () => ({
    templateId: '',
    name: '',
    description: '',
    startDate: '',
    deadline: '',
    priority: '',
});

const formatDeptName = (name) => {
    if (!name) return "";
    let cleanName = name.trim();
    if (cleanName.toLowerCase().startsWith("phòng ")) {
        cleanName = cleanName.substring(6).trim();
    } else if (cleanName.toLowerCase().startsWith("ban ")) {
        cleanName = cleanName.substring(4).trim();
    }
    return `Phòng ${cleanName}`;
};

const getTodayDateInputValue = () => {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

const getRoleBadgeConfig = (role) => {
    if (role === 'MANAGER') {
        return { className: 'bg-warning text-dark', text: 'MANAGER' };
    }
    if (role === 'QA') {
        return { className: 'bg-secondary text-white', text: 'QA' };
    }
    if (role === 'EMPLOYEE') {
        return { className: 'bg-info text-white', text: 'EMPLOYEE' };
    }
    return { className: 'bg-light text-muted border', text: role || 'MEMBER' };
};

const dedupeMembersById = (members = []) => {
    const seen = new Set();

    return members.filter((member) => {
        const key = member?.id ?? member?.email ?? member?.fullName;
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
    });
};

const getUserDisplayName = (user) => user?.fullName || 'Người dùng hệ thống';
const getUserDisplayEmail = (user) => user?.email || 'Chưa có email';
const getUserInitial = (user) => getUserDisplayName(user).charAt(0).toUpperCase();

const ManagerDashboard = () => {
    const navigate = useNavigate();
    const stompClientRef = useRef(null);
    const selectedProjectIdRef = useRef(null);
    const [currentUser, setCurrentUser] = useState(null);
    const [myDepartment, setMyDepartment] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    
    // DATA
    const [deptMembers, setDeptMembers] = useState([]);
    const [projects, setProjects] = useState([]);
    const [tasks, setTasks] = useState([]);
    const [allEmployees, setAllEmployees] = useState([]);

    // UI CONTROLS
    const [activeTab, setActiveTab] = useState('DASHBOARD');
    const [selectedProject, setSelectedProject] = useState(null);
    const [projectTab, setProjectTab] = useState('TASKS');
    
    // MODAL STATE
    const [showMemberModal, setShowMemberModal] = useState(false);
    const [showTaskModal, setShowTaskModal] = useState(false);
    const [selectedTaskForDetail, setSelectedTaskForDetail] = useState(null);
    const [privateChatUser, setPrivateChatUser] = useState(null);
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const [showEditProjectModal, setShowEditProjectModal] = useState(false);
    
    // 🔥 State cho xóa thành viên
    const [memberToRemove, setMemberToRemove] = useState(null);
    const [removingMember, setRemovingMember] = useState(false);
    
    const [requestInbox, setRequestInbox] = useState([]);
    const [requestHistory, setRequestHistory] = useState([]);
    const [workflowLoading, setWorkflowLoading] = useState(false);
    const [workflowError, setWorkflowError] = useState('');
    const [requestStatusFilter, setRequestStatusFilter] = useState('ALL');
    const [templateList, setTemplateList] = useState([]);
    const [templateForm, setTemplateForm] = useState(createEmptyTemplateForm);
    const [editingTemplateId, setEditingTemplateId] = useState(null);
    const [templateSubmitting, setTemplateSubmitting] = useState(false);
    const [projectFromTemplateForm, setProjectFromTemplateForm] = useState(createProjectFromTemplateForm);
    const [creatingProjectFromTemplate, setCreatingProjectFromTemplate] = useState(false);

    // FORMS
    const [newTask, setNewTask] = useState({ title: '', description: '', startDate: '', deadline: '', priority: 'MEDIUM', assigneeId: '' });
    const [selectedMembersToAdd, setSelectedMembersToAdd] = useState([]);
    const [editProjectForm, setEditProjectForm] = useState({ name: '', description: '', startDate: '', deadline: '', documentLink: '' });
    const [projectDocumentFile, setProjectDocumentFile] = useState(null);

    const loadWorkflowData = async (deptId) => {
        try {
            setWorkflowLoading(true);
            setWorkflowError('');
            const [inboxRes, historyRes, templatesRes] = await Promise.all([
                requestAPI.getApprovals(),
                requestAPI.getHistory(),
                projectTemplateAPI.getAll(),
            ]);
            const normalizedTemplates = (templatesRes.data || []).map(normalizeTemplateItem);
            setRequestInbox((inboxRes.data || []).map(normalizeRequestItem));
            setRequestHistory((historyRes.data || []).map(normalizeRequestItem));
            setTemplateList(normalizedTemplates);
            setProjectFromTemplateForm((prev) => ({
                ...prev,
                templateId: prev.templateId || normalizedTemplates[0]?.id || '',
            }));
        } catch (err) {
            console.error('Lỗi tải workflow manager:', err);
            setWorkflowError(typeof err.response?.data === 'string' ? err.response.data : (err.response?.data?.message || err.message));
        } finally {
            setWorkflowLoading(false);
        }
    };

    useEffect(() => {
        const userJson = localStorage.getItem('user');
        if (!userJson) { navigate('/'); return; }
        try {
            JSON.parse(userJson);
            fetchManagerInfo();
        } catch (e) { console.error(e); navigate('/'); }
    }, []);

    useEffect(() => {
        if (myDepartment) {
            connectWebSocket(myDepartment.id);
        }
        return () => {
            if (stompClientRef.current) {
                stompClientRef.current.disconnect();
            }
        };
    }, [myDepartment]);

    useEffect(() => {
        selectedProjectIdRef.current = selectedProject?.id || null;
    }, [selectedProject?.id]);

    const connectWebSocket = (deptId) => {
        const token = localStorage.getItem('token');
        const socket = new SockJS(getWebSocketUrl());
        const client = Stomp.over(() => socket);
        client.debug = () => { };

        client.connect({ Authorization: token ? `Bearer ${token}` : '' }, async () => {
            console.log('✅ WebSocket connected for Dashboard updates');
            client.subscribe(`/topic/department/${deptId}/update`, async (message) => {
                if (message.body === "REFRESH_PROJECTS") {
                    await fetchDeptData(deptId);
                    if (selectedProjectIdRef.current) {
                        await refreshSelectedProjectData(selectedProjectIdRef.current);
                    }
                }
            });
        }, (error) => {
            console.error('❌ WebSocket Error:', error);
            setTimeout(() => connectWebSocket(deptId), 5000);
        });

        stompClientRef.current = client;
    };

    const fetchManagerInfo = async () => {
        setIsLoading(true);
        try {
            const res = await userAPI.getCurrentUser();
            const foundUser = res.data;
            
            if (foundUser) {
                setCurrentUser(foundUser);
                if (foundUser.department) {
                    setMyDepartment(foundUser.department);
                    await Promise.all([
                        fetchDeptData(foundUser.department.id),
                        loadWorkflowData(foundUser.department.id),
                    ]);
                }
            }
        } catch (err) { 
            console.error("Lỗi tải dữ liệu user:", err); 
        } finally {
            setIsLoading(false);
        }
    };

    const fetchDeptData = async (deptId) => {
        try {
            const [usersRes, projectsRes] = await Promise.all([
                userAPI.getMyDepartmentUsers(),
                api.get('/projects')
            ]);
            
            // 🔥 SỬA: Dùng == để so sánh ID và lọc role EMPLOYEE theo snippet
            const members = usersRes.data.filter(u => 
                u.department && 
                u.department.id == deptId && 
                u.role === 'EMPLOYEE'
            );
            setDeptMembers(members);
            
            // 🔥 SỬA: Lọc dự án (cả dự án tạo bởi deptId hoặc object department)
            setProjects(projectsRes.data.filter(p => {
                const pDeptId = p.deptId || (p.department ? p.department.id : null);
                return pDeptId == deptId;
            }));
            
            // Lấy tất cả nhân viên thuộc phòng (cho multi-select)
            const staff = usersRes.data.filter(u => 
                (u.role === 'EMPLOYEE' || u.role === 'QA' || u.role === 'MANAGER') && 
                (u.department && u.department.id == deptId)
            );
            setAllEmployees(staff);
        } catch (err) { console.error("Lỗi tải dữ liệu phòng:", err); }
    };

    const fetchProjectTasks = async (projectId) => {
        try {
            const res = await api.get(`/tasks/project/${projectId}`);
            setTasks(Array.isArray(res.data) ? res.data : []);
        } catch (e) {
            setTasks([]);
            console.error(e);
        }
    };

    const refreshSelectedProjectData = async (projectId) => {
        try {
            const [projectsRes, tasksRes] = await Promise.all([
                api.get('/projects'),
                api.get(`/tasks/project/${projectId}`),
            ]);
            const updatedProject = (projectsRes.data || []).find((project) => String(project.id) === String(projectId));

            if (updatedProject) {
                setSelectedProject(updatedProject);
            }
            setTasks(Array.isArray(tasksRes.data) ? tasksRes.data : []);
        } catch (err) {
            console.error('Lỗi làm mới chi tiết dự án:', err);
        }
    };

    const handleSelectProject = async (project) => {
        setSelectedProject(project);
        setActiveTab('PROJECT_DETAIL');
        await fetchProjectTasks(project.id);
    };

    const handleCompleteProject = async () => {
        if (!(await askConfirm("⚠️ CẢNH BÁO: Dự án sẽ chuyển sang trạng thái 'ĐÃ ĐÓNG'. Bạn có chắc chắn không?"))) return;
        try {
            await api.put(`/projects/${selectedProject.id}/complete`);
            alert("🎉 Chúc mừng! Dự án đã hoàn thành và đóng lại.");
            const updatedProject = { ...selectedProject, status: 'CLOSED' };
            setSelectedProject(updatedProject);
            setProjects(prev => prev.map(p => p.id === updatedProject.id ? updatedProject : p));
        } catch (err) { alert("Lỗi: " + err.message); }
    };

    const handleEditProjectSubmit = async (e) => {
        e.preventDefault();
        let finalDocumentLink = editProjectForm.documentLink;

        if (projectDocumentFile) {
            const formData = new FormData();
            formData.append("file", projectDocumentFile);
            try {
                const uploadRes = await api.post("/files/upload", formData, {
                    headers: { "Content-Type": "multipart/form-data" },
                });
                finalDocumentLink = uploadRes.data.url;
            } catch (err) {
                alert("Lỗi tải lên tài liệu: " + err.message);
                return;
            }
        }

        const payload = { ...editProjectForm, documentLink: finalDocumentLink };
        try {
            const res = await api.put(`/projects/${selectedProject.id}/update`, payload);
            alert("✅ Đã cập nhật thông tin dự án!");
            setShowEditProjectModal(false);
            setProjectDocumentFile(null);
            setSelectedProject(res.data);
            setProjects(prev => prev.map(p => p.id === res.data.id ? res.data : p));
        } catch (err) {
            alert("Lỗi cập nhật: " + (err.response?.data || err.message));
        }
    };

    const openEditProjectModal = () => {
        setEditProjectForm({
            name: selectedProject.name || '',
            description: selectedProject.description || '',
            startDate: selectedProject.startDate || '',
            deadline: selectedProject.deadline || '',
            documentLink: selectedProject.documentLink || '',
        });
        setShowEditProjectModal(true);
    };

    const handleAddMember = async () => {
        if (selectedMembersToAdd.length === 0) {
            alert("Vui lòng chọn ít nhất một nhân viên!");
            return;
        }
        try {
            const response = await api.post(`/projects/${selectedProject.id}/add-members`, selectedMembersToAdd);
            alert(`✅ Đã thêm ${selectedMembersToAdd.length} nhân sự thành công!`);
            setShowMemberModal(false);
            setSelectedMembersToAdd([]);
            setSelectedProject(response.data);
            
            await fetchDeptData(myDepartment.id);
            const res = await api.get('/projects');
            const updated = res.data.find(p => p.id == selectedProject.id);
            if(updated) setSelectedProject(updated);
        } catch (err) {
            console.error("❌ Lỗi thêm member:", err);
            const errorMessage = err.response?.data?.message || err.response?.data || err.message || "Thất bại";
            alert("Lỗi: " + errorMessage);
        }
    };

    // 🔥 Xóa thành viên khỏi dự án
    const handleRemoveMember = async (member) => {
        if (!member || !member.id || !selectedProject?.id) return;
        
        const confirmMsg = `Bạn chắc chắn muốn xóa "${member.fullName}" ra khỏi dự án "${selectedProject.name}"?`;
        if (!window.confirm(confirmMsg)) {
            return;
        }

        try {
            setRemovingMember(true);
            await api.delete(`/projects/${selectedProject.id}/remove-member/${member.id}`);
            alert("✅ Đã xóa nhân viên thành công!");
            setMemberToRemove(null);
            
            // Refresh project data
            await fetchDeptData(myDepartment.id);
            const res = await api.get('/projects');
            const updated = res.data.find(p => p.id == selectedProject.id);
            if(updated) setSelectedProject(updated);
        } catch (err) {
            console.error("❌ Lỗi xóa member:", err);
            const errorMessage = err.response?.data?.message || err.response?.data || err.message || "Thất bại";
            alert("Lỗi: " + errorMessage);
        } finally {
            setRemovingMember(false);
        }
    };

    const handleCreateTask = async (e) => {
        e.preventDefault();
        try {
            await api.post(`/tasks/create?projectId=${selectedProject.id}&assigneeId=${newTask.assigneeId}`, newTask);
            alert("✅ Giao việc thành công!");
            setShowTaskModal(false);
            setNewTask({ title: '', description: '', startDate: '', deadline: '', priority: 'MEDIUM', assigneeId: '' });
            await refreshSelectedProjectData(selectedProject.id);
        } catch (err) { alert("Lỗi: " + (err.response?.data || err.message)); }
    };

    const handleRequestDecision = async (request, approved) => {
        const actionText = approved ? 'Duyệt yêu cầu' : 'Từ chối yêu cầu';
        const confirmText = approved ? 'Duyệt' : 'Từ chối';

        const result = await Swal.fire({
            title: actionText,
            input: 'textarea',
            inputLabel: 'Ghi chú xử lý',
            inputPlaceholder: 'Thêm ghi chú để người gửi và cấp tiếp theo nắm rõ bối cảnh...',
            inputAttributes: { 'aria-label': 'Ghi chú xử lý' },
            showCancelButton: true,
            confirmButtonText: confirmText,
            cancelButtonText: 'Hủy',
            confirmButtonColor: approved ? '#1d6fa3' : '#dc3545',
        });

        if (!result.isConfirmed) return;

        try {
            await requestAPI.decide(request.id, {
                approved,
                comment: result.value || '',
            });
            await loadWorkflowData(myDepartment.id);
            alert(`Đã cập nhật yêu cầu ${request.title}.`);
        } catch (err) {
            const message = typeof err.response?.data === 'string' ? err.response.data : (err.response?.data?.message || err.message);
            alert(`Lỗi: ${message}`);
        }
    };

    const handleTemplateSubmit = async (e) => {
        e.preventDefault();

        const payload = {
            name: templateForm.name.trim(),
            description: templateForm.summary.trim(),
            templateGroupType: templateForm.templateGroupType,
            taskTemplates: templateForm.objectiveText.split('\n').map((item) => item.trim()).filter(Boolean).map((item, index) => ({
                title: item,
                description: templateForm.summary.trim(),
                priority: templateForm.priority,
                deadlineOffsetDays: index * 7,
                checklistTemplates: index === 0
                    ? templateForm.checklistText.split('\n').map((check) => check.trim()).filter(Boolean).map((check) => ({ title: check }))
                    : [],
            })),
        };

        try {
            setTemplateSubmitting(true);
            await projectTemplateAPI.create(payload);
            setTemplateForm(createEmptyTemplateForm());
            setEditingTemplateId(null);
            await loadWorkflowData(myDepartment.id);
            alert('Đã tạo template dự án mới.');
        } catch (err) {
            const message = typeof err.response?.data === 'string' ? err.response.data : (err.response?.data?.message || err.message);
            alert(`Lỗi: ${message}`);
        } finally {
            setTemplateSubmitting(false);
        }
    };

    const handleCreateProjectFromTemplate = async (e) => {
        e.preventDefault();

        try {
            setCreatingProjectFromTemplate(true);
            await projectTemplateAPI.instantiate(projectFromTemplateForm.templateId, {
                departmentId: myDepartment.id,
                project: {
                    name: projectFromTemplateForm.name.trim(),
                    description: projectFromTemplateForm.description.trim(),
                    startDate: projectFromTemplateForm.startDate,
                    deadline: projectFromTemplateForm.deadline,
                    priority: projectFromTemplateForm.priority || undefined,
                },
            });
            setProjectFromTemplateForm((prev) => ({ ...createProjectFromTemplateForm(), templateId: prev.templateId }));
            await fetchDeptData(myDepartment.id);
            await loadWorkflowData(myDepartment.id);
            alert('Đã khởi tạo dự án từ template.');
        } catch (err) {
            const message = typeof err.response?.data === 'string' ? err.response.data : (err.response?.data?.message || err.message);
            alert(`Lỗi: ${message}`);
        } finally {
            setCreatingProjectFromTemplate(false);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        navigate('/');
    };

    const isProjectClosed = selectedProject?.status === 'CLOSED';
    const todayDate = useMemo(() => getTodayDateInputValue(), []);
    const selectedProjectMembers = useMemo(
        () => dedupeMembersById(selectedProject?.members || []),
        [selectedProject?.members]
    );
    const projectChatCandidates = useMemo(
        () => selectedProjectMembers.filter((member) => String(member?.id) !== String(currentUser?.id)),
        [currentUser?.id, selectedProjectMembers]
    );
    const departmentChatCandidates = useMemo(
        () => dedupeMembersById(allEmployees).filter((member) => String(member?.id) !== String(currentUser?.id)),
        [allEmployees, currentUser?.id]
    );
    const sameDepartmentOnlyChatCandidates = useMemo(
        () => departmentChatCandidates.filter(
            (member) => !projectChatCandidates.some((projectMember) => String(projectMember.id) === String(member.id))
        ),
        [departmentChatCandidates, projectChatCandidates]
    );
    const availableMembers = useMemo(() => allEmployees.filter((user) => {
        if (!user?.id) return false;
        if (String(user.id) === String(currentUser?.id)) return false;
        return !selectedProjectMembers.some((member) => String(member.id) === String(user.id));
    }), [allEmployees, currentUser?.id, selectedProjectMembers]);
    const filteredRequestInbox = useMemo(
        () => requestInbox.filter((request) => requestStatusFilter === 'ALL' || request.status === requestStatusFilter),
        [requestInbox, requestStatusFilter]
    );
    const workflowStats = useMemo(() => ({
        pending: requestInbox.filter((request) => request.status === 'PENDING').length,
        handled: requestHistory.length,
        templates: templateList.length,
    }), [requestHistory.length, requestInbox, templateList.length]);

    if (isLoading) {
        return (
            <div className="min-vh-100 d-flex align-items-center justify-content-center bg-light">
                <div className="spinner-border text-primary" role="status"></div>
            </div>
        );
    }

    if (!currentUser || !myDepartment) {
        return (
            <div className="min-vh-100 d-flex align-items-center justify-content-center bg-light flex-column">
                <h3 className="text-danger fw-bold">⚠️ Lỗi Tài Khoản</h3>
                <p>Tài khoản Manager chưa được gán Phòng ban hoặc không tìm thấy dữ liệu.</p>
                <button onClick={handleLogout} className="btn btn-dark btn-sm mt-2">Đăng xuất</button>
            </div>
        );
    }

    return (
        <div className="admin-dashboard-container" style={{ fontFamily: "'Inter', sans-serif" }}>
             {/* Unified Glass Header */}
             <div className="glass-header d-flex justify-content-between align-items-center w-100 sticky-top">
                {/* Logo */}
                <div className="d-flex align-items-center" style={{ width: '280px' }}>
                    <span className="fs-3 me-2">🚀</span>
                    <span className="brand-text d-none d-md-block">MANAGER PRO</span>
                </div>

                {/* Centered Menu */}
                <div className="top-menu d-none d-xl-flex justify-content-center">
                    <button 
                        className={`top-menu-item ${activeTab === 'DASHBOARD' ? 'active' : ''}`}
                        onClick={() => setActiveTab('DASHBOARD')}
                    >
                        <i className="bi bi-grid-fill top-menu-icon" style={{ color: activeTab === 'DASHBOARD' ? '#4318ff' : '#a3aed1' }}></i> Tổng Quan
                    </button>
                    <button 
                        className={`top-menu-item ${activeTab === 'OPERATIONS' ? 'active' : ''}`}
                        onClick={() => setActiveTab('OPERATIONS')}
                    >
                        <i className="bi bi-briefcase-fill top-menu-icon" style={{ color: activeTab === 'OPERATIONS' ? '#4318ff' : '#a3aed1' }}></i> Workflow
                    </button>
                    <button className="top-menu-item" onClick={() => navigate('/manager/statistics')}>
                        <i className="bi bi-bar-chart-fill top-menu-icon" style={{ color: '#a3aed1' }}></i> KPI / OKR
                    </button>
                    {activeTab === 'PROJECT_DETAIL' && (
                        <button className="top-menu-item active">
                            <i className="bi bi-folder-fill top-menu-icon" style={{ color: '#4318ff' }}></i> Chi tiết dự án
                        </button>
                    )}
                </div>

                {/* Right Profile Actions */}
                <div className="d-flex align-items-center justify-content-end gap-3" style={{ width: '280px' }}>
                    <NotificationBell currentUser={currentUser} />

                    <div className="dropdown position-relative ms-1">
                        <div
                            className="d-flex align-items-center py-1 px-2 rounded-pill shadow-sm"
                            style={{ cursor: 'pointer', background: showProfileMenu ? '#f4f7fe' : 'transparent', transition: 'all 0.2s', border: '1px solid #e2e8f0' }}
                            onClick={() => setShowProfileMenu(!showProfileMenu)}
                        >
                            <div className="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center fw-bold shadow-sm overflow-hidden" style={{ width: 36, height: 36 }}>
                                {currentUser?.avatarUrl ? (
                                    <img src={currentUser.avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                    currentUser?.fullName ? currentUser.fullName.charAt(0).toUpperCase() : 'M'
                                )}
                            </div>
                            <div className="ms-2 me-2 d-none d-sm-block text-start">
                                <div className="fw-bold text-dark" style={{ fontSize: '0.85rem', lineHeight: '1.2' }}>{currentUser?.fullName}</div>
                                <small className="text-muted" style={{ fontSize: '0.7rem' }}>Trưởng {formatDeptName(myDepartment.name)}</small>
                            </div>
                            <i className="bi bi-chevron-down ms-1 text-muted me-2" style={{ fontSize: '0.8rem' }}></i>
                        </div>

                        {showProfileMenu && (
                            <div className="dropdown-menu show shadow border-0 position-absolute end-0 mt-2 p-2 rounded-4" style={{ minWidth: '220px', backgroundColor: '#fff', top: '100%', zIndex: 1050 }}>
                                <button className="dropdown-item rounded-3 py-2 fw-bold text-dark mb-1 d-flex align-items-center modern-dropdown-item" onClick={() => { setShowProfileMenu(false); navigate('/profile'); }}>
                                    <i className="bi bi-person-fill me-2 fs-5 text-primary"></i> Tài khoản của tôi
                                </button>
                                <div className="dropdown-divider my-1 border-light"></div>
                                <button className="dropdown-item rounded-3 py-2 fw-bold text-danger d-flex align-items-center modern-dropdown-item" onClick={() => { setShowProfileMenu(false); handleLogout(); }}>
                                    <i className="bi bi-box-arrow-right me-2 fs-5"></i> Đăng xuất
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="admin-main-wrapper flex-grow-1">
                <div className="p-4 p-md-5 animate-fade-in content-inner">
                    {activeTab === 'PROJECT_DETAIL' && (
                        <button onClick={() => setActiveTab('DASHBOARD')} className="btn btn-link text-decoration-none fw-bold mb-3 ps-0 text-dark">
                            <i className="bi bi-arrow-left"></i> Quay lại Dashboard
                        </button>
                    )}

                    {activeTab !== 'PROJECT_DETAIL' && (
                        <div className="d-flex justify-content-between align-items-center mb-4 d-xl-none bg-white p-3 rounded-4 shadow-sm">
                            <h4 className="page-title mb-0 fs-5">{activeTab === 'DASHBOARD' ? 'Tổng quan phòng ban' : 'Workflow phòng ban'}</h4>
                            <select className="form-select modern-input w-auto fw-bold text-primary-dark shadow-sm py-1" value={activeTab} onChange={(e) => {
                                if (e.target.value === 'STATS') {
                                    navigate('/manager/statistics');
                                    return;
                                }
                                setActiveTab(e.target.value);
                            }}>
                                <option value="DASHBOARD">Tổng quan</option>
                                <option value="OPERATIONS">Workflow</option>
                                <option value="STATS">KPI / OKR</option>
                            </select>
                        </div>
                    )}

                    {activeTab === 'DASHBOARD' && (
                        <>
                             {/* Summary Section */}
                            <div className="row g-4 mb-5">
                                <div className="col-12 col-md-4">
                                    <div className="card border-0 shadow-sm p-3 h-100 border-start border-primary border-5">
                                        <div className="text-muted small fw-bold">TỔNG NHÂN VIÊN</div>
                                        <div className="display-6 fw-bold text-dark">{deptMembers.length}</div>
                                    </div>
                                </div>
                                <div className="col-12 col-md-4">
                                    <div className="card border-0 shadow-sm p-3 h-100 border-start border-success border-5">
                                        <div className="text-muted small fw-bold">DỰ ÁN ĐANG CHẠY</div>
                                        <div className="display-6 fw-bold text-dark">{projects.filter(p => p.status !== 'CLOSED').length}</div>
                                    </div>
                                </div>
                                <div className="col-12 col-md-4">
                                    <div className="card border-0 shadow-sm p-3 h-100 bg-primary text-white">
                                        <div className="opacity-75 small fw-bold">HÔM NAY</div>
                                        <div className="fs-5 mt-2">Chúc bạn một ngày làm việc hiệu quả! 🚀</div>
                                    </div>
                                </div>
                            </div>

                            <h5 className="fw-bold text-dark mb-3">
                                <i className="bi bi-folder2-open me-2"></i>Danh Sách Dự Án
                            </h5>
                            
                            <div className="row g-4">
                                {projects.map(p => (
                                    <div key={p.id} className="col-md-6 col-lg-4 col-xl-3">
                                        <div 
                                            className={`card border-0 shadow-sm h-100 transition ${p.status === 'CLOSED' ? 'opacity-75' : 'hover-shadow'}`}
                                            style={{ cursor: p.status === 'CLOSED' ? 'default' : 'pointer' }}
                                            onClick={p.status !== 'CLOSED' ? () => handleSelectProject(p) : undefined}
                                        >
                                            <div className={`card-body ${p.status === 'CLOSED' ? 'bg-secondary bg-opacity-10' : ''}`}>
                                                <div className="d-flex justify-content-between mb-2">
                                                    <span className={`badge ${p.status === 'CLOSED' ? 'bg-secondary' : (p.priority === 'HIGH' ? 'bg-danger' : p.priority === 'MEDIUM' ? 'bg-warning text-dark' : 'bg-info')}`}>
                                                        {p.status === 'CLOSED' ? '🔒 ĐÃ ĐÓNG' : p.priority}
                                                    </span>
                                                    <small className="text-muted"><i className="bi bi-clock"></i> {p.deadline}</small>
                                                </div>
                                                <h5 className={`fw-bold mb-1 ${p.status === 'CLOSED' ? 'text-muted text-decoration-line-through' : 'text-primary'}`}>{p.name}</h5>
                                                <p className="text-muted small mb-3 text-truncate">{p.description}</p>
                                                
                                                <div className="d-flex align-items-center justify-content-between border-top pt-3">
                                                    <div className="d-flex align-items-center">
                                                        <div className="bg-light rounded-circle text-center small fw-bold text-secondary me-1" style={{ width: 30, height: 30, lineHeight: '30px' }}>
                                                            {(p.members || []).length}
                                                        </div>
                                                        <small className="text-muted">thành viên</small>
                                                    </div>
                                                    <button className="btn btn-sm btn-outline-primary rounded-pill px-3" onClick={(e) => { e.stopPropagation(); handleSelectProject(p); }}>
                                                        Chi tiết
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {projects.length === 0 && (
                                    <div className="col-12 text-center py-5">
                                        <div className="text-muted py-5">Chưa có dự án nào được gán cho phòng ban của bạn.</div>
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {activeTab === 'OPERATIONS' && (
                        <div className="workflow-shell">
                            <div className="workflow-hero">
                                <div>
                                    <span className="admin-section-kicker">Quản trị phê duyệt và template</span>
                                    <h2 className="workflow-hero-title">Xử lý inbox phê duyệt của phòng và chuẩn hóa dự án từ template trong một khu vực</h2>
                                    <p className="workflow-hero-copy">
                                        Manager có thể phê duyệt đề xuất nghiệp vụ, đẩy các yêu cầu cần leo thang cho admin và khởi tạo dự án mới từ các template lặp lại.
                                    </p>
                                </div>
                            </div>

                            <div className="workflow-summary-grid">
                                <div className="workflow-summary-card">
                                    <span className="workflow-summary-label">Cần xử lý</span>
                                    <div className="workflow-summary-value">{workflowStats.pending}</div>
                                    <div className="workflow-summary-note">Yêu cầu đang chờ manager duyệt</div>
                                </div>
                                <div className="workflow-summary-card">
                                    <span className="workflow-summary-label">Đã xử lý</span>
                                    <div className="workflow-summary-value">{workflowStats.handled}</div>
                                    <div className="workflow-summary-note">Lịch sử workflow phòng ban</div>
                                </div>
                                <div className="workflow-summary-card">
                                    <span className="workflow-summary-label">Template đang có</span>
                                    <div className="workflow-summary-value">{workflowStats.templates}</div>
                                    <div className="workflow-summary-note">Mẫu dự án sẵn sàng sử dụng</div>
                                </div>
                            </div>

                            <div className="workflow-layout">
                                <div className="workflow-stack">
                                    <div className="workflow-panel">
                                        <div className="workflow-panel-header">
                                            <div>
                                                <h3 className="workflow-panel-title">Inbox phê duyệt của phòng</h3>
                                                <p className="workflow-panel-copy">Danh sách yêu cầu nghiệp vụ do nhân viên trong phòng gửi lên và cần manager quyết định.</p>
                                            </div>
                                            <select className="form-select modern-input" style={{ maxWidth: '220px' }} value={requestStatusFilter} onChange={(e) => setRequestStatusFilter(e.target.value)}>
                                                <option value="ALL">Tất cả trạng thái</option>
                                                <option value="PENDING">Chờ duyệt</option>
                                                <option value="APPROVED">Đã duyệt</option>
                                                <option value="REJECTED">Từ chối</option>
                                            </select>
                                        </div>
                                        <div className="workflow-panel-body">
                                            {workflowError && <div className="workflow-error mb-3">{workflowError}</div>}
                                            {workflowLoading ? (
                                                <div className="workflow-empty">Đang tải inbox phê duyệt...</div>
                                            ) : filteredRequestInbox.length === 0 ? (
                                                <div className="workflow-empty">Không có yêu cầu nào cần xử lý trong bộ lọc hiện tại.</div>
                                            ) : (
                                                <div className="workflow-list workflow-scroll-region">
                                                    {filteredRequestInbox.map((request) => {
                                                        const statusMeta = getRequestStatusMeta(request.status);
                                                        const requestTypeLabel = REQUEST_TYPE_OPTIONS.find((option) => option.value === request.type)?.label || request.type;
                                                        const requestPriority = REQUEST_PRIORITY_OPTIONS.find((option) => option.value === request.priority)?.label || request.priority;

                                                        return (
                                                            <article key={request.id || `${request.title}-${request.createdAt}`} className="workflow-item">
                                                                <div className="workflow-item-head">
                                                                    <div>
                                                                        <h4 className="workflow-item-title">{request.title}</h4>
                                                                        <p className="workflow-item-copy">{request.summary || 'Không có mô tả bổ sung.'}</p>
                                                                    </div>
                                                                    <span className={`workflow-pill ${statusMeta.className}`}>{statusMeta.label}</span>
                                                                </div>

                                                                <div className="workflow-meta-grid">
                                                                    <div>
                                                                        <span className="workflow-meta-label">Người gửi</span>
                                                                        <div className="workflow-meta-value">{request.requesterName}</div>
                                                                    </div>
                                                                    <div>
                                                                        <span className="workflow-meta-label">Loại / Ưu tiên</span>
                                                                        <div className="workflow-meta-value">{requestTypeLabel} - {requestPriority}</div>
                                                                    </div>
                                                                    <div>
                                                                        <span className="workflow-meta-label">Gửi lúc</span>
                                                                        <div className="workflow-meta-value">{formatWorkflowDateTime(request.createdAt)}</div>
                                                                    </div>
                                                                    <div>
                                                                        <span className="workflow-meta-label">Cập nhật</span>
                                                                        <div className="workflow-meta-value">{formatWorkflowDateTime(request.resolvedAt || request.updatedAt || request.createdAt)}</div>
                                                                    </div>
                                                                </div>

                                                                {request.latestNote ? (
                                                                    <div className="mt-3">
                                                                        <span className="workflow-meta-label">Ghi chú mới nhất</span>
                                                                        <div className="workflow-meta-value">{request.latestNote}</div>
                                                                    </div>
                                                                ) : null}

                                                                <div className="workflow-inline-actions mt-3">
                                                                    <button className="btn btn-sm btn-success rounded-pill px-3 fw-bold" onClick={() => handleRequestDecision(request, true)}>
                                                                        Duyệt
                                                                    </button>
                                                                    <button className="btn btn-sm btn-outline-danger rounded-pill px-3 fw-bold" onClick={() => handleRequestDecision(request, false)}>
                                                                        Từ chối
                                                                    </button>
                                                                </div>
                                                            </article>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="workflow-panel">
                                        <div className="workflow-panel-header">
                                            <div>
                                                <h3 className="workflow-panel-title">Lịch sử đã xử lý</h3>
                                                <p className="workflow-panel-copy">Theo dõi các phê duyệt gần đây của manager để đối chiếu và đánh giá tốc độ xử lý.</p>
                                            </div>
                                        </div>
                                        <div className="workflow-panel-body">
                                            {requestHistory.length === 0 ? (
                                                <div className="workflow-empty">Chưa có mục lịch sử nào được ghi nhận.</div>
                                            ) : (
                                                <div className="workflow-list workflow-scroll-region">
                                                    {requestHistory.slice(0, 8).map((request) => {
                                                        const statusMeta = getRequestStatusMeta(request.status);

                                                        return (
                                                            <article key={request.id || `${request.title}-${request.createdAt}-history`} className="workflow-item">
                                                                <div className="workflow-item-head">
                                                                    <div>
                                                                        <h4 className="workflow-item-title">{request.title}</h4>
                                                                        <p className="workflow-item-copy">{request.requesterName} - {request.departmentName}</p>
                                                                    </div>
                                                                    <span className={`workflow-pill ${statusMeta.className}`}>{statusMeta.label}</span>
                                                                </div>
                                                                <div className="workflow-item-meta">
                                                                    <div>
                                                                        <span className="workflow-meta-label">Cập nhật lúc</span>
                                                                        <div className="workflow-meta-value">{formatWorkflowDateTime(request.createdAt)}</div>
                                                                    </div>
                                                                    {request.latestNote ? (
                                                                        <div className="flex-grow-1">
                                                                            <span className="workflow-meta-label">Ghi chú</span>
                                                                            <div className="workflow-meta-value">{request.latestNote}</div>
                                                                        </div>
                                                                    ) : null}
                                                                </div>
                                                            </article>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="workflow-stack">
                                    <div className="workflow-panel">
                                        <div className="workflow-panel-header">
                                            <div>
                                                <h3 className="workflow-panel-title">Quản lý template dự án</h3>
                                                <p className="workflow-panel-copy">Lưu mẫu dự án lặp lại của phòng để rút ngắn thời gian khởi tạo và giảm sai lệch quy trình.</p>
                                            </div>
                                        </div>
                                        <div className="workflow-panel-body">
                                            <form className="workflow-stack" onSubmit={handleTemplateSubmit}>
                                                <div className="workflow-form-grid">
                                                    <div className="workflow-form-field-full">
                                                        <label className="user-form-label">Tên template</label>
                                                        <input className="form-control modern-input" required value={templateForm.name} onChange={(e) => setTemplateForm((prev) => ({ ...prev, name: e.target.value }))} />
                                                    </div>
                                                    <div className="workflow-form-field-full">
                                                        <label className="user-form-label">Mô tả / phạm vi</label>
                                                        <textarea className="form-control modern-input" rows="3" value={templateForm.summary} onChange={(e) => setTemplateForm((prev) => ({ ...prev, summary: e.target.value }))} />
                                                    </div>
                                                    <div>
                                                        <label className="user-form-label">Loại template</label>
                                                        <select className="form-select modern-input" value={templateForm.templateGroupType} onChange={(e) => setTemplateForm((prev) => ({ ...prev, templateGroupType: e.target.value }))}>
                                                            <option value="DELIVERY">Delivery</option>
                                                            <option value="MAINTENANCE">Maintenance</option>
                                                            <option value="INTERNAL">Internal</option>
                                                            <option value="OTHER">Other</option>
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="user-form-label">Ưu tiên mặc định</label>
                                                        <select className="form-select modern-input" value={templateForm.priority} onChange={(e) => setTemplateForm((prev) => ({ ...prev, priority: e.target.value }))}>
                                                            {TEMPLATE_PRIORITY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                                                        </select>
                                                    </div>
                                                    <div className="workflow-form-field-full">
                                                        <label className="user-form-label">Checklist mặc định</label>
                                                        <textarea className="form-control modern-input" rows="4" placeholder="Mỗi dòng là một hạng mục mặc định" value={templateForm.checklistText} onChange={(e) => setTemplateForm((prev) => ({ ...prev, checklistText: e.target.value }))} />
                                                    </div>
                                                    <div className="workflow-form-field-full">
                                                        <label className="user-form-label">Task templates</label>
                                                        <textarea className="form-control modern-input" rows="4" placeholder="Mỗi dòng là một task template" value={templateForm.objectiveText} onChange={(e) => setTemplateForm((prev) => ({ ...prev, objectiveText: e.target.value }))} />
                                                    </div>
                                                </div>

                                                <div className="workflow-inline-actions">
                                                    <button className="modern-btn-primary flex-grow-1" disabled={templateSubmitting}>
                                                        {templateSubmitting ? 'Đang lưu...' : 'Tạo template'}
                                                    </button>
                                                </div>
                                            </form>
                                        </div>
                                    </div>

                                    <div className="workflow-panel">
                                        <div className="workflow-panel-header">
                                            <div>
                                                <h3 className="workflow-panel-title">Khởi tạo dự án từ template</h3>
                                                <p className="workflow-panel-copy">Chọn template, đặt mốc thời gian và tạo ngay dự án mới cho phòng ban hiện tại.</p>
                                            </div>
                                        </div>
                                        <div className="workflow-panel-body">
                                            <form className="workflow-stack" onSubmit={handleCreateProjectFromTemplate}>
                                                <div className="workflow-form-grid">
                                                    <div className="workflow-form-field-full">
                                                        <label className="user-form-label">Template</label>
                                                        <select className="form-select modern-input" required value={projectFromTemplateForm.templateId} onChange={(e) => setProjectFromTemplateForm((prev) => ({ ...prev, templateId: e.target.value }))}>
                                                            <option value="">-- Chọn template --</option>
                                                            {templateList.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
                                                        </select>
                                                    </div>
                                                    <div className="workflow-form-field-full">
                                                        <label className="user-form-label">Tên dự án mới</label>
                                                        <input className="form-control modern-input" required value={projectFromTemplateForm.name} onChange={(e) => setProjectFromTemplateForm((prev) => ({ ...prev, name: e.target.value }))} />
                                                    </div>
                                                    <div className="workflow-form-field-full">
                                                        <label className="user-form-label">Mô tả bổ sung</label>
                                                        <textarea className="form-control modern-input" rows="3" value={projectFromTemplateForm.description} onChange={(e) => setProjectFromTemplateForm((prev) => ({ ...prev, description: e.target.value }))} />
                                                    </div>
                                                    <div>
                                                        <label className="user-form-label">Ngày bắt đầu</label>
                                                        <input type="date" className="form-control modern-input" required value={projectFromTemplateForm.startDate} onChange={(e) => setProjectFromTemplateForm((prev) => ({ ...prev, startDate: e.target.value }))} />
                                                    </div>
                                                    <div>
                                                        <label className="user-form-label">Hạn cuối</label>
                                                        <input type="date" className="form-control modern-input" required value={projectFromTemplateForm.deadline} onChange={(e) => setProjectFromTemplateForm((prev) => ({ ...prev, deadline: e.target.value }))} />
                                                    </div>
                                                    <div className="workflow-form-field-full">
                                                        <label className="user-form-label">Ưu tiên override</label>
                                                        <select className="form-select modern-input" value={projectFromTemplateForm.priority} onChange={(e) => setProjectFromTemplateForm((prev) => ({ ...prev, priority: e.target.value }))}>
                                                            <option value="">Dùng cấu hình template</option>
                                                            {TEMPLATE_PRIORITY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                                                        </select>
                                                    </div>
                                                </div>

                                                <button className="modern-btn-primary w-100" disabled={creatingProjectFromTemplate || !templateList.length}>
                                                    {creatingProjectFromTemplate ? 'Đang tạo dự án...' : 'Tạo dự án từ template'}
                                                </button>
                                            </form>
                                        </div>
                                    </div>

                                    <div className="workflow-panel">
                                        <div className="workflow-panel-header">
                                            <div>
                                                <h3 className="workflow-panel-title">Thư viện template</h3>
                                                <p className="workflow-panel-copy">Danh sách mẫu dự án hiện có trong phòng, kèm checklist và mục tiêu gợi ý.</p>
                                            </div>
                                        </div>
                                        <div className="workflow-panel-body">
                                            {templateList.length === 0 ? (
                                                <div className="workflow-empty">Chưa có template dự án nào trong phòng ban này.</div>
                                            ) : (
                                                <div className="workflow-template-grid workflow-scroll-region">
                                                    {templateList.map((template) => {
                                                        const statusMeta = getTemplateStatusMeta(template.status);

                                                        return (
                                                            <article key={template.id} className="workflow-template-card">
                                                                <div className="workflow-template-head">
                                                                    <div>
                                                                        <h4 className="workflow-template-title">{template.name}</h4>
                                                                        <p className="workflow-template-copy">{template.summary || 'Không có mô tả cho template này.'}</p>
                                                                    </div>
                                                                    <span className={`workflow-pill ${statusMeta.className}`}>{statusMeta.label}</span>
                                                                </div>

                                                                <div className="workflow-meta-grid">
                                                                    <div>
                                                                        <span className="workflow-meta-label">Loại template</span>
                                                                        <div className="workflow-meta-value">{template.templateGroupType || 'OTHER'}</div>
                                                                    </div>
                                                                    <div>
                                                                        <span className="workflow-meta-label">Cập nhật lần cuối</span>
                                                                        <div className="workflow-meta-value">{formatWorkflowDate(template.updatedAt)}</div>
                                                                    </div>
                                                                </div>

                                                                {template.taskTemplates?.length > 0 ? (
                                                                    <ul className="workflow-template-list">
                                                                        {template.taskTemplates.slice(0, 4).map((item, index) => <li key={`${template.id}-task-${index}`}>{item.title || item.name}</li>)}
                                                                    </ul>
                                                                ) : null}
                                                            </article>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'PROJECT_DETAIL' && selectedProject && (
                        <div className="row justify-content-center">
                            <div className="col-12">
                                <div className="card border-0 shadow-lg overflow-hidden" style={{ borderRadius: '1.2rem' }}>
                                    {/* Project Header */}
                                    <div className={`card-header p-4 border-bottom ${isProjectClosed ? 'bg-secondary text-white' : 'bg-white'}`}>
                                        <div className="d-flex justify-content-between align-items-start">
                                            <div>
                                                <div className="d-flex align-items-center gap-2 mb-1">
                                                    <h2 className={`fw-bold mb-0 ${isProjectClosed ? 'text-white' : 'text-primary'}`}>{selectedProject.name}</h2>
                                                    {isProjectClosed && <span className="badge bg-dark border fs-6">🔒 ĐÃ ĐÓNG</span>}
                                                </div>
                                                <p className={`${isProjectClosed ? 'text-white-50' : 'text-muted'} mb-0`}>{selectedProject.description}</p>
                                                {selectedProject.documentLink && (
                                                    <a 
                                                        href={resolveAppUrl(selectedProject.documentLink)} 
                                                        target="_blank" 
                                                        rel="noopener noreferrer" 
                                                        className={`btn btn-sm mt-3 fw-bold ${isProjectClosed ? 'btn-outline-light' : 'btn-outline-primary'}`}
                                                    >
                                                        <i className="bi bi-link-45deg me-1"></i> Tài liệu đính kèm
                                                    </a>
                                                )}
                                            </div>
                                            <div className="text-end">
                                                {!isProjectClosed && (
                                                    <div className="mb-3 d-flex gap-2">
                                                        <button 
                                                            className="btn btn-outline-primary fw-bold"
                                                            onClick={openEditProjectModal}
                                                        >
                                                            <i className="bi bi-pencil-square me-2"></i>SỬA
                                                        </button>
                                                        <button 
                                                            className="btn btn-outline-danger fw-bold"
                                                            onClick={handleCompleteProject}
                                                        >
                                                            <i className="bi bi-check-circle-fill me-2"></i>HOÀN THÀNH
                                                        </button>
                                                    </div>
                                                )}
                                                <span className={`badge ${isProjectClosed ? 'bg-dark' : 'bg-light text-dark border'} px-3 py-2 fs-6`}>
                                                    Hạn: {selectedProject.deadline}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Sub Tabs */}
                                        <div className="d-flex gap-2 mt-4 bg-light p-1 rounded-pill" style={{ width: 'fit-content' }}>
                                            <button 
                                                className={`btn rounded-pill px-4 fw-bold transition ${projectTab === 'TASKS' ? 'bg-white shadow-sm text-primary' : 'btn-link text-muted'}`}
                                                onClick={() => setProjectTab('TASKS')}
                                            >
                                                <i className="bi bi-list-check me-2"></i>Công việc ({(tasks || []).length})
                                            </button>
                                            <button 
                                                className={`btn rounded-pill px-4 fw-bold transition ${projectTab === 'MEMBERS' ? 'bg-white shadow-sm text-primary' : 'btn-link text-muted'}`}
                                                onClick={() => setProjectTab('MEMBERS')}
                                            >
                                                <i className="bi bi-people-fill me-2"></i>Thành viên ({selectedProjectMembers.length})
                                            </button>
                                            <button 
                                                className={`btn rounded-pill px-4 fw-bold transition ${projectTab === 'CHAT' ? 'bg-white shadow-sm text-primary' : 'btn-link text-muted'}`}
                                                onClick={() => setProjectTab('CHAT')}
                                            >
                                                <i className="bi bi-chat-dots-fill me-2"></i>Nhóm chat
                                            </button>
                                        </div>
                                    </div>

                                    {/* Content Scroll Area */}
                                    <div className="card-body p-4 bg-light" style={{ minHeight: '600px' }}>
                                        {projectTab === 'TASKS' && (
                                            <div className="animate-fade-in">
                                                {!isProjectClosed ? (
                                                    <div className="d-flex justify-content-between align-items-center mb-4">
                                                        <h5 className="fw-bold mb-0">Tiến độ công việc</h5>
                                                        <button 
                                                            className="btn btn-success fw-bold rounded-pill px-4 shadow-sm"
                                                            onClick={() => setShowTaskModal(true)}
                                                        >
                                                            <i className="bi bi-plus-lg me-2"></i>Giao việc mới
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="alert alert-secondary text-center fw-bold border-0 shadow-sm py-3 mb-4">
                                                        <i className="bi bi-info-circle me-2"></i>Dự án này đã hoàn thành. Các tính năng chỉnh sửa đã được khóa.
                                                    </div>
                                                )}

                                                <div className="row g-4">
                                                    {(tasks || []).map(t => (
                                                        <div key={t.id} className="col-12 col-md-6 col-lg-4">
                                                            <div 
                                                                className="card border-0 shadow-sm hover-shadow transition h-100" 
                                                                style={{ cursor: 'pointer', borderLeft: `5px solid ${t.status === 'DONE' ? '#10b981' : '#f59e0b'}` }}
                                                                onClick={() => setSelectedTaskForDetail(t)}
                                                            >
                                                                <div className="card-body">
                                                                    <div className="d-flex justify-content-between mb-2">
                                                                        <span className={`badge ${t.status === 'DONE' ? 'bg-success' : 'bg-warning text-dark'}`}>{t.status}</span>
                                                                        <span className="text-muted small">{t.deadline}</span>
                                                                    </div>
                                                                    <h6 className="fw-bold text-dark mb-1 text-truncate">{t.title}</h6>
                                                                    <div className="d-flex align-items-center mt-3">
                                                                        <div className="rounded-circle bg-secondary text-white text-center small fw-bold me-2" style={{ width: 24, height: 24, lineHeight: '24px' }}>
                                                                            {t.assigneeFullName?.charAt(0) || 'U'}
                                                                        </div>
                                                                        <small className="text-muted">{t.assigneeFullName}</small>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                    {tasks.length === 0 && (
                                                        <div className="col-12 text-center py-5 text-muted">Chưa có công việc nào được tạo.</div>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {projectTab === 'MEMBERS' && (
                                            <div className="animate-fade-in">
                                                {!isProjectClosed && (
                                                    <div className="d-flex justify-content-between align-items-center mb-4">
                                                        <h5 className="fw-bold mb-0">Đội ngũ tham gia</h5>
                                                        <button 
                                                            className="btn btn-primary fw-bold rounded-pill px-4 shadow-sm"
                                                            onClick={() => setShowMemberModal(true)}
                                                        >
                                                            <i className="bi bi-person-plus-fill me-2"></i>Thêm nhân sự
                                                        </button>
                                                    </div>
                                                )}
                                                <div className="row g-4">
                                                    {projectChatCandidates.map(m => {
                                                        const roleBadge = getRoleBadgeConfig(m.role);

                                                        return (
                                                        <div key={m.id} className="col-12 col-md-6 col-lg-4">
                                                            <div className="card border-0 shadow-sm p-3 h-100 transition hover-shadow position-relative" style={{ cursor: 'pointer' }} onClick={() => setPrivateChatUser(m)}>
                                                                {/* 🔥 Nút xóa thành viên */}
                                                                {!isProjectClosed && (
                                                                    <button
                                                                        className="btn btn-sm btn-danger position-absolute top-0 end-0 m-2"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleRemoveMember(m);
                                                                        }}
                                                                        title="Xóa khỏi dự án"
                                                                        disabled={removingMember}
                                                                    >
                                                                        <i className="bi bi-trash-fill"></i>
                                                                    </button>
                                                                )}
                                                                <div className="d-flex align-items-center">
                                                                    {m.avatarUrl ? (
                                                                        <img src={m.avatarUrl} className="rounded-circle me-3 border border-2 border-white shadow-sm" style={{ width: 50, height: 50, objectFit: 'cover' }} alt={m.fullName} />
                                                                    ) : (
                                                                        <div className="bg-primary bg-opacity-10 text-primary rounded-circle d-flex align-items-center justify-content-center fw-bold me-3" style={{ width: 50, height: 50, fontSize: '1.2rem' }}>
                                                                            {getUserInitial(m)}
                                                                        </div>
                                                                    )}
                                                                    <div className="min-w-0 flex-grow-1">
                                                                        <h6 className="fw-bold mb-0 text-truncate">{getUserDisplayName(m)}</h6>
                                                                        <small className="text-muted d-block text-truncate">{getUserDisplayEmail(m)}</small>
                                                                        <div className="mt-1 d-flex align-items-center gap-2">
                                                                            <span className={`badge ${roleBadge.className}`} style={{ fontSize: '0.65rem' }}>{roleBadge.text}</span>
                                                                            {!m.active && (
                                                                                <span className="badge bg-warning text-dark" style={{ fontSize: '0.65rem' }}>
                                                                                    <i className="bi bi-exclamation-triangle-fill me-1"></i>Khóa
                                                                                </span>
                                                                            )}
                                                                            <i className="bi bi-chat-fill text-primary small ms-auto"></i>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        );
                                                    })}

                                                    {projectChatCandidates.length === 0 && (
                                                        <div className="col-12 text-center py-4 text-muted">Chưa có thành viên dự án nào để mở chat riêng.</div>
                                                    )}
                                                </div>

                                                {sameDepartmentOnlyChatCandidates.length > 0 && (
                                                    <>
                                                        <div className="d-flex align-items-center justify-content-between mt-4 mb-3">
                                                            <h6 className="fw-bold mb-0 text-dark">Cùng phòng ban</h6>
                                                            <small className="text-muted">Có thể nhắn riêng ngay cả khi chưa ở cùng dự án</small>
                                                        </div>
                                                        <div className="row g-4">
                                                            {sameDepartmentOnlyChatCandidates.map(m => {
                                                                const roleBadge = getRoleBadgeConfig(m.role);

                                                                return (
                                                                    <div key={m.id} className="col-12 col-md-6 col-lg-4">
                                                                        <div className="card border-0 shadow-sm p-3 h-100 transition hover-shadow" style={{ cursor: 'pointer' }} onClick={() => setPrivateChatUser(m)}>
                                                                            <div className="d-flex align-items-center">
                                                                                {m.avatarUrl ? (
                                                                                    <img src={m.avatarUrl} className="rounded-circle me-3 border border-2 border-white shadow-sm" style={{ width: 50, height: 50, objectFit: 'cover' }} alt={m.fullName} />
                                                                                ) : (
                                                                                    <div className="bg-primary bg-opacity-10 text-primary rounded-circle d-flex align-items-center justify-content-center fw-bold me-3" style={{ width: 50, height: 50, fontSize: '1.2rem' }}>
                                                                                        {getUserInitial(m)}
                                                                                    </div>
                                                                                )}
                                                                                <div className="min-w-0 flex-grow-1">
                                                                                    <h6 className="fw-bold mb-0 text-truncate">{getUserDisplayName(m)}</h6>
                                                                                    <small className="text-muted d-block text-truncate">{getUserDisplayEmail(m)}</small>
                                                                                    <div className="mt-1 d-flex align-items-center gap-2">
                                                                                        <span className={`badge ${roleBadge.className}`} style={{ fontSize: '0.65rem' }}>{roleBadge.text}</span>
                                                                                        <i className="bi bi-chat-fill text-primary small ms-auto"></i>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        )}

                                        {projectTab === 'CHAT' && (
                                            <div className="animate-fade-in" style={{ height: '600px', display: 'flex', flexDirection: 'column' }}>
                                                <ProjectChatPanel project={selectedProject} currentUser={currentUser} />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* MODALS */}
            {showMemberModal && !isProjectClosed && (
                <div className="modal-backdrop-custom">
                    <div className="card shadow-lg border-0" style={{ width: 500, borderRadius: '1rem', overflow: 'hidden' }}>
                        <div className="card-header bg-primary p-4 border-0 text-white d-flex flex-column position-relative">
                            <button className="btn-close btn-close-white position-absolute top-0 end-0 m-3" onClick={() => setShowMemberModal(false)}></button>
                            <h5 className="fw-bold mb-1">Thêm nhân sự mới</h5>
                            <span className="text-white text-opacity-75 small">Vào dự án: {selectedProject.name}</span>
                        </div>
                        <div className="card-body p-0">
                            {availableMembers.length > 0 ? (
                                <div className="d-flex flex-column h-100">
                                    <div className="list-group list-group-flush custom-scrollbar" style={{ maxHeight: '350px', overflowY: 'auto' }}>
                                         {availableMembers.map(u => (
                                             <button 
                                                 key={u.id}
                                                 type="button" 
                                                 className={`list-group-item list-group-item-action p-3 border-0 border-bottom d-flex align-items-center ${selectedMembersToAdd.includes(u.id) ? 'bg-primary bg-opacity-10' : ''}`}
                                                 onClick={(e) => {
                                                     e.preventDefault();
                                                     setSelectedMembersToAdd((prev) => (
                                                         prev.includes(u.id)
                                                             ? prev.filter((id) => id !== u.id)
                                                             : [...prev, u.id]
                                                     ));
                                                 }}
                                             >
                                                <div className="flex-shrink-0 me-3">
                                                    {u.avatarUrl ? (
                                                        <img src={u.avatarUrl} alt={u.fullName} className="rounded-circle shadow-sm border border-2 border-white" style={{ width: 48, height: 48, objectFit: 'cover' }} />
                                                    ) : (
                                                        <div className="bg-primary bg-opacity-10 text-primary rounded-circle d-flex align-items-center justify-content-center fw-bold shadow-sm" style={{ width: 48, height: 48, fontSize: '1.2rem' }}>
                                                            {getUserInitial(u)}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex-grow-1 min-w-0">
                                                    <div className="fw-bold text-dark text-truncate mb-0">{getUserDisplayName(u)}</div>
                                                    <div className="text-muted small text-truncate"><i className="bi bi-envelope me-1"></i> {getUserDisplayEmail(u)}</div>
                                                    <span className="badge bg-secondary bg-opacity-10 text-secondary mt-1" style={{ fontSize: '0.65rem' }}>Phòng: {u.department?.name}</span>
                                                </div>
                                                {selectedMembersToAdd.includes(u.id) && (
                                                    <div className="ms-3 text-primary"><i className="bi bi-check-circle-fill fs-3"></i></div>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="p-3 border-top bg-light">
                                        <button className="btn btn-primary w-100 rounded-pill fw-bold" onClick={handleAddMember} disabled={selectedMembersToAdd.length === 0}>
                                            Xác nhận & Thêm {selectedMembersToAdd.length > 0 ? `(${selectedMembersToAdd.length})` : ''}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-5 text-muted px-4">
                                    <i className="bi bi-person-dash fs-1 d-block mb-2"></i>
                                    Tất cả nhân viên phòng đã tham gia dự án này.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {showEditProjectModal && (
                <div className="modal-backdrop-custom">
                    <div className="card shadow-lg border-0" style={{ width: 550, borderRadius: '1.2rem' }}>
                        <div className="card-header bg-dark p-4 text-white d-flex flex-column position-relative">
                            <button className="btn-close btn-close-white position-absolute top-0 end-0 m-4" onClick={() => setShowEditProjectModal(false)}></button>
                            <h4 className="fw-bold mb-1 text-white">Cập nhật dự án</h4>
                            <p className="mb-0 text-white-50">Chỉnh sửa thông tin cơ bản và tài liệu</p>
                        </div>
                        <div className="card-body p-4">
                            <form onSubmit={handleEditProjectSubmit}>
                                <div className="mb-3">
                                    <label className="form-label fw-bold text-dark small">Tên dự án</label>
                                    <input className="form-control" required value={editProjectForm.name} onChange={e => setEditProjectForm({...editProjectForm, name: e.target.value})} />
                                </div>
                                <div className="mb-3">
                                    <label className="form-label fw-bold text-dark small">Mô tả chi tiết</label>
                                    <textarea className="form-control" rows="3" value={editProjectForm.description} onChange={e => setEditProjectForm({...editProjectForm, description: e.target.value})} />
                                </div>
                                <div className="mb-3">
                                    <label className="form-label fw-bold text-dark small">Link tài liệu đính kèm</label>
                                    <div className="input-group">
                                        <span className="input-group-text bg-white border-end-0"><i className="bi bi-link-45deg"></i></span>
                                        <input className="form-control border-start-0" placeholder="https://..." value={editProjectForm.documentLink} onChange={e => setEditProjectForm({...editProjectForm, documentLink: e.target.value})} />
                                    </div>
                                </div>
                                <div className="row g-3 mb-4">
                                    <div className="col-6">
                                        <label className="form-label fw-bold text-dark small">Ngày bắt đầu</label>
                                        <input type="date" className="form-control" required value={editProjectForm.startDate} onChange={e => setEditProjectForm({...editProjectForm, startDate: e.target.value})} />
                                    </div>
                                    <div className="col-6">
                                        <label className="form-label fw-bold text-dark small">Hạn cuối</label>
                                        <input type="date" className="form-control" required value={editProjectForm.deadline} onChange={e => setEditProjectForm({...editProjectForm, deadline: e.target.value})} />
                                    </div>
                                </div>
                                <button className="btn btn-primary w-100 rounded-pill fw-bold py-2 shadow-sm">LƯU THAY ĐỔI</button>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {showTaskModal && !isProjectClosed && (
                <div className="modal-backdrop-custom">
                    <div className="card shadow-lg border-0" style={{ width: 500, borderRadius: '1rem' }}>
                        <div className="card-header bg-success text-white p-4 d-flex justify-content-between align-items-center">
                            <h5 className="fw-bold mb-0 text-white">Giao việc mới</h5>
                            <button className="btn-close btn-close-white" onClick={() => setShowTaskModal(false)}></button>
                        </div>
                        <div className="card-body p-4">
                            <form onSubmit={handleCreateTask}>
                                <div className="mb-3">
                                    <label className="form-label fw-bold text-dark small">Tiêu đề công việc</label>
                                    <input className="form-control" required value={newTask.title} onChange={e => setNewTask({...newTask, title: e.target.value})} />
                                </div>
                                <div className="mb-3">
                                    <label className="form-label fw-bold text-dark small">Mô tả yêu cầu</label>
                                    <textarea className="form-control" rows="2" value={newTask.description} onChange={e => setNewTask({...newTask, description: e.target.value})} />
                                </div>
                                <div className="row g-3 mb-3">
                                    <div className="col-12 col-md-6">
                                        <label className="form-label fw-bold text-dark small">Ngày bắt đầu</label>
                                        <input type="date" className="form-control" required value={newTask.startDate} onChange={e => setNewTask({...newTask, startDate: e.target.value})} />
                                    </div>
                                    <div className="col-12 col-md-6">
                                        <label className="form-label fw-bold text-dark small">Hạn hoàn thành</label>
                                        <input type="date" min={newTask.startDate || todayDate} className="form-control" required value={newTask.deadline} onChange={e => setNewTask({...newTask, deadline: e.target.value})} />
                                    </div>
                                </div>
                                <div className="mb-3">
                                    <label className="form-label fw-bold text-dark small">Độ ưu tiên</label>
                                    <select className="form-select" value={newTask.priority} onChange={e => setNewTask({...newTask, priority: e.target.value})}>
                                        <option value="MEDIUM">Trung bình</option>
                                        <option value="HIGH">Cao</option>
                                        <option value="LOW">Thấp</option>
                                    </select>
                                </div>
                                <div className="mb-4">
                                    <label className="form-label fw-bold text-dark small">Người thực hiện</label>
                                    <select className="form-select" required value={newTask.assigneeId} onChange={e => setNewTask({...newTask, assigneeId: e.target.value})}>
                                        <option value="">-- Chọn nhân viên --</option>
                                        {selectedProjectMembers.map(m => (
                                            <option key={m.id} value={m.id}>{m.fullName}</option>
                                        ))}
                                    </select>
                                </div>
                                <button className="btn btn-success w-100 rounded-pill fw-bold py-2 shadow-sm">LƯU & GIAO VIỆC</button>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {selectedTaskForDetail && (
                <TaskDetailModal 
                    task={selectedTaskForDetail} 
                    currentUser={currentUser}
                    assigneeCandidates={selectedProjectMembers}
                    onClose={() => setSelectedTaskForDetail(null)}
                    onTaskUpdate={() => {
                        if (selectedProject) handleSelectProject(selectedProject);
                    }}
                />
            )}

            {privateChatUser && (
                <div style={{ position: 'fixed', bottom: '20px', right: '20px', width: '380px', height: '520px', zIndex: 1060, boxShadow: '0 10px 30px rgba(0,0,0,0.15)', borderRadius: '16px', overflow: 'hidden', background: '#fff' }}>
                    <PrivateChatPanel currentUser={currentUser} targetUser={privateChatUser} onClose={() => setPrivateChatUser(null)} />
                </div>
            )}

            <style>{`
                .modal-backdrop-custom {
                    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                    background: rgba(0,0,0,0.6); z-index: 1050;
                    display: flex; align-items: center; justify-content: center;
                    backdrop-filter: blur(5px);
                    padding: 20px;
                }
                .hover-shadow:hover { 
                    transform: translateY(-5px); 
                    box-shadow: 0 15px 30px rgba(0,0,0,0.1) !important; 
                }
                .transition { transition: all 0.3s ease; }
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e0; border-radius: 10px; }
                .glass-header {
                    background: rgba(255, 255, 255, 0.8);
                    backdrop-filter: blur(10px);
                    border-bottom: 1px solid rgba(226, 232, 240, 0.8);
                }
                .animate-fade-in {
                    animation: fadeIn 0.4s ease-out;
                }
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
};

export default ManagerDashboard;
