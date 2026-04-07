import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api, { adminActivityAPI, requestAPI, resolveAppUrl, userAPI } from '../api';
import { useNavigate } from 'react-router-dom';
import { askConfirm } from '../utils/confirm';
import NotificationBell from '../components/NotificationBell';
import Swal from 'sweetalert2';
import '../components/EnterpriseWorkflow.css';
import './AdminDashboard.css';
import {
    REQUEST_PRIORITY_OPTIONS,
    REQUEST_TYPE_OPTIONS,
    formatWorkflowDate,
    formatWorkflowDateTime,
    getRequestStatusMeta,
    normalizeRequestItem,
} from '../utils/enterpriseWorkflow';

const getProjectTimeStatus = (p) => {
    if (p.status === 'CLOSED') return { text: 'Đã hoàn thành', color: 'bg-success text-white' };
    if (!p.startDate || !p.deadline) return { text: 'Chưa xác định', color: 'bg-secondary text-white' };
    const now = new Date();
    const start = new Date(p.startDate);
    const end = new Date(p.deadline);
    now.setHours(0, 0, 0, 0);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    if (now < start) return { text: 'Chưa bắt đầu', color: 'bg-info text-dark' };
    if (now > end) return { text: 'Quá hạn', color: 'bg-danger text-white' };
    return { text: 'Đang thực hiện', color: 'bg-primary text-white' };
};

const formatDeptName = (name) => {
    if (!name) return '';
    let cleanName = name.trim();
    if (cleanName.toLowerCase().startsWith('phòng ')) {
        cleanName = cleanName.substring(6).trim();
    } else if (cleanName.toLowerCase().startsWith('ban ')) {
        cleanName = cleanName.substring(4).trim();
    }
    return `Phòng ${cleanName}`;
};

const getApprovalStatus = (user) => (user?.approvalStatus || (user?.role ? 'APPROVED' : 'PENDING')).toUpperCase();

const isApprovedUser = (user) => getApprovalStatus(user) === 'APPROVED';

const getRoleBadgeConfig = (role) => {
    if (role === 'ADMIN') return { className: 'bg-danger', text: '👑 ADMIN' };
    if (role === 'MANAGER') return { className: 'bg-warning text-dark', text: '💼 MANAGER' };
    if (role === 'EMPLOYEE') return { className: 'bg-info text-white', text: '👤 EMPLOYEE' };
    if (role === 'QA') return { className: 'bg-secondary text-white', text: '🧪 QA' };
    return { className: 'bg-light text-muted border', text: 'Chờ gán vai trò' };
};

const getApprovalBadgeConfig = (user) => {
    const approvalStatus = getApprovalStatus(user);

    if (approvalStatus === 'APPROVED') {
        return {
            className: 'bg-success bg-opacity-10 text-success border border-success border-opacity-25 rounded-pill px-2',
            text: 'APPROVED - Đã duyệt'
        };
    }

    if (approvalStatus === 'REJECTED') {
        return {
            className: 'bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25 rounded-pill px-2',
            text: 'REJECTED - Đã từ chối'
        };
    }

    return {
        className: 'bg-warning bg-opacity-10 text-warning border border-warning border-opacity-25 rounded-pill px-2',
        text: 'PENDING - Chờ duyệt'
    };
};

const AdminDashboard = () => {
    const navigate = useNavigate();
    const currentUser = JSON.parse(localStorage.getItem('user'));

    const [users, setUsers] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [projects, setProjects] = useState([]);
    const [completedProjects, setCompletedProjects] = useState([]);
    const [deletedProjects, setDeletedProjects] = useState([]);
    const [viewingCompletedProject, setViewingCompletedProject] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [userFilters, setUserFilters] = useState({ role: 'ALL', approval: 'ALL', access: 'ALL', departmentId: 'ALL' });

    const [activeTab, setActiveTab] = useState('users');
    const [selectedDept, setSelectedDept] = useState(null);
    const [showProjectForm, setShowProjectForm] = useState(false);
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const [activityEntries, setActivityEntries] = useState([]);
    const [selectedActivityUserId, setSelectedActivityUserId] = useState('');
    const [activityLoading, setActivityLoading] = useState(false);
    const [activityError, setActivityError] = useState('');
    const [activityFilters, setActivityFilters] = useState({ keyword: '', type: 'ALL', period: 'ALL' });
    const [escalatedRequests, setEscalatedRequests] = useState([]);
    const [requestAuditTrail, setRequestAuditTrail] = useState([]);
    const [requestWorkflowLoading, setRequestWorkflowLoading] = useState(false);
    const [requestWorkflowError, setRequestWorkflowError] = useState('');
    const [requestWorkflowFilter, setRequestWorkflowFilter] = useState('ALL');

    const [newUser, setNewUser] = useState({ fullName: '', email: '', password: '', role: 'EMPLOYEE', deptId: '' });
    const [avatarFile, setAvatarFile] = useState(null);
    const [avatarPreview, setAvatarPreview] = useState(null);
    const [avatarUrl, setAvatarUrl] = useState('');
    const [newDept, setNewDept] = useState({ name: '', description: '' });
    const [newProject, setNewProject] = useState({ name: '', description: '', startDate: '', deadline: '', priority: 'MEDIUM' });
    const [projectViewMode, setProjectViewMode] = useState('grid');
    const [showMemberModal, setShowMemberModal] = useState(false);
    const [selectedProjectForMember, setSelectedProjectForMember] = useState(null);
    const [availableMembers, setAvailableMembers] = useState([]);
    const [selectedMembersToAdd, setSelectedMembersToAdd] = useState([]);
    const [showDeptMemberModal, setShowDeptMemberModal] = useState(false);
    const [selectedDeptForMember, setSelectedDeptForMember] = useState(null);
    const [availableDeptMembers, setAvailableDeptMembers] = useState([]);
    const [selectedDeptMembersToAdd, setSelectedDeptMembersToAdd] = useState([]);

    const [showDeptPersonnelModal, setShowDeptPersonnelModal] = useState(false);
    const [selectedDeptForPersonnel, setSelectedDeptForPersonnel] = useState(null);

    const fetchData = useCallback(async () => {
        try {
            const [usersRes, deptsRes, projectsRes, deletedRes] = await Promise.all([
                api.get('/users'),
                api.get('/departments'),
                api.get('/projects'),
                api.get(`/projects/deleted?adminEmail=${currentUser.email}`)
            ]);
            console.log("Users:", usersRes.data);
            console.log("Departments:", deptsRes.data);
            console.log("Projects:", projectsRes.data);
            console.log("Deleted Projects:", deletedRes.data);

            setUsers(usersRes.data);
            setDepartments(deptsRes.data);
            setProjects(projectsRes.data.filter(p => !p.isDeleted));
            setCompletedProjects(projectsRes.data.filter(p => p.status === 'CLOSED'));
            setDeletedProjects(deletedRes.data);
        } catch (error) { console.error("Lỗi tải dữ liệu:", error); }
    }, [currentUser.email]);

    const fetchRequestWorkflowData = useCallback(async () => {
        try {
            setRequestWorkflowLoading(true);
            setRequestWorkflowError('');
            const [queueRes, historyRes] = await Promise.all([
                requestAPI.getApprovals(),
                requestAPI.getHistory(),
            ]);
            setEscalatedRequests((queueRes.data || []).map(normalizeRequestItem));
            setRequestAuditTrail((historyRes.data || []).map(normalizeRequestItem));
        } catch (error) {
            console.error('Lỗi tải workflow admin:', error);
            setRequestWorkflowError(typeof error.response?.data === 'string' ? error.response.data : (error.response?.data?.message || error.message));
        } finally {
            setRequestWorkflowLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
        fetchRequestWorkflowData();
    }, [fetchData, fetchRequestWorkflowData]);

    const fetchActivities = useCallback(async () => {
        if (activeTab !== 'activity') return;
        try {
            setActivityLoading(true);
            setActivityError('');
            const res = await adminActivityAPI.getRecentActivities(selectedActivityUserId || undefined, 80);
            setActivityEntries(res.data || []);
        } catch (err) {
            const errorData = err.response?.data;
            setActivityError(typeof errorData === 'string' ? errorData : (errorData?.message || err.message));
        } finally {
            setActivityLoading(false);
        }
    }, [activeTab, selectedActivityUserId]);

    useEffect(() => {
        fetchActivities();
    }, [fetchActivities]);

    const handleUndoActivity = async (activityId) => {
        if (!(await askConfirm('Bạn có chắc chắn muốn hoàn tác hoạt động này? Những thay đổi liên quan sẽ được khôi phục về trạng thái trước đó.'))) return;
        
        try {
            await adminActivityAPI.undoActivity(activityId);
            alert('Đã hoàn tác thành công!');
            await Promise.all([fetchActivities(), fetchData()]);
        } catch (err) {
            const errorData = err.response?.data;
            const message = typeof errorData === 'string' ? errorData : (errorData?.message || err.message);
            alert('Lỗi khi hoàn tác: ' + message);
        }
    };
    const handleLogout = () => { localStorage.removeItem('user'); navigate('/'); };

    const handleSearchUser = (e) => {
        e.preventDefault();
    };

    const handleResetSearch = () => {
        setSearchTerm('');
        setUserFilters({ role: 'ALL', approval: 'ALL', access: 'ALL', departmentId: 'ALL' });
    };

    const handleResetActivityFilters = () => {
        setSelectedActivityUserId('');
        setActivityFilters({ keyword: '', type: 'ALL', period: 'ALL' });
    };

    const handleRequestWorkflowDecision = async (request, approved) => {
        const result = await Swal.fire({
            title: approved ? 'Phê duyệt yêu cầu cấp admin' : 'Từ chối yêu cầu cấp admin',
            input: 'textarea',
            inputLabel: 'Ghi chú điều phối',
            inputPlaceholder: 'Thêm hướng xử lý để người gửi và manager có thể theo dõi...',
            showCancelButton: true,
            confirmButtonText: approved ? 'Phê duyệt' : 'Từ chối',
            cancelButtonText: 'Hủy',
            confirmButtonColor: approved ? '#1d6fa3' : '#dc3545',
        });

        if (!result.isConfirmed) return;

        try {
            await requestAPI.decide(request.id, {
                approved,
                comment: result.value || '',
            });
            await fetchRequestWorkflowData();
            alert(`Đã cập nhật yêu cầu ${request.title}.`);
        } catch (error) {
            const message = typeof error.response?.data === 'string' ? error.response.data : (error.response?.data?.message || error.message);
            alert(`Lỗi: ${message}`);
        }
    };

    const formatActivityTime = (value) => {
        if (!value) return '--';
        return new Date(value).toLocaleString('vi-VN');
    };

    const handleAvatarSelect = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (!file.type.match(/image\/(png|jpeg|jpg)/)) {
                alert("Vui lòng chọn file ảnh PNG hoặc JPG!");
                return;
            }
            if (file.size > 5 * 1024 * 1024) {
                alert("Kích thước ảnh không được vượt quá 5MB!");
                return;
            }
            setAvatarFile(file);
            setAvatarUrl('');
            const reader = new FileReader();
            reader.onload = (e) => {
                setAvatarPreview(e.target.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleEditAvatar = () => {
        document.getElementById('avatarInput').click();
    };

    const handleRemoveAvatar = () => {
        setAvatarFile(null);
        setAvatarPreview(null);
        setAvatarUrl('');
        document.getElementById('avatarInput').value = '';
    };

    const handleAddUser = async (e) => {
        e.preventDefault();

        const form = e.currentTarget;
        const formDataFromDom = new FormData(form);
        const submittedUser = {
            fullName: String(formDataFromDom.get('fullName') || '').trim(),
            email: String(formDataFromDom.get('email') || '').trim(),
            password: String(formDataFromDom.get('password') || ''),
            role: String(formDataFromDom.get('role') || newUser.role || 'EMPLOYEE'),
            deptId: String(formDataFromDom.get('deptId') || ''),
        };

        try {
            if (avatarFile || avatarUrl) {
                const formData = new FormData();
                formData.append('fullName', submittedUser.fullName);
                formData.append('email', submittedUser.email);
                formData.append('password', submittedUser.password);
                formData.append('role', submittedUser.role);
                if (submittedUser.deptId) formData.append('deptId', submittedUser.deptId);
                if (avatarFile) {
                    formData.append('avatar', avatarFile);
                } else if (avatarUrl) {
                    formData.append('avatarUrl', avatarUrl);
                }

                await api.post('/users/create-with-avatar', formData);
            } else {
                let url = '/users';
                if (submittedUser.deptId) url += `?deptId=${submittedUser.deptId}`;
                await api.post(url, submittedUser);
            }

            alert("Thêm nhân sự thành công!");
            setNewUser({ fullName: '', email: '', password: '', role: 'EMPLOYEE', deptId: '' });
            setAvatarFile(null);
            setAvatarPreview(null);
            setAvatarUrl('');
            document.getElementById('avatarInput').value = '';
            await fetchData();
        } catch (err) {
            const errorData = err.response?.data;
            const message = typeof errorData === 'string' ? errorData : (errorData?.message || err.message);
            alert("Lỗi: " + message);
        }
    };

    const handleDeleteUser = async (id) => {
        const user = users.find(u => u.id === id);
        if (!user) return;

        // Trường hợp là Trưởng phòng
        const managedDept = departments.find(d => d.manager?.id === user.id);
        
        if (managedDept) {
            const potentialSuccessors = users.filter(c => 
                c.id !== user.id && 
                c.department?.id === managedDept.id &&
                isApprovedUser(c) && 
                isUserActive(c)
            );

            const { value: successorId } = await Swal.fire({
                title: 'Xóa tài khoản Trưởng phòng',
                html: `
                    <div class="text-start">
                        <div class="alert alert-danger small mb-3">
                            <i class="bi bi-exclamation-triangle-fill me-2"></i>
                            Bạn đang xóa tài khoản của Trưởng phòng <b>${formatDeptName(managedDept.name)}</b>. 
                            Hành động này là vĩnh viễn. Bạn <b>bắt buộc</b> phải chọn người kế nhiệm.
                        </div>
                        <label class="form-label fw-bold small text-muted">Chọn người kế nhiệm <span class="text-danger">*</span></label>
                        <select id="swal-delete-successor" class="form-select">
                            <option value="">-- Chọn nhân viên thay thế --</option>
                            ${potentialSuccessors.map(c => `<option value="${c.id}">${c.fullName} (${c.email})</option>`).join('')}
                        </select>
                        <div class="form-text mt-2 small">Quyền quản lý phòng ban sẽ được chuyển giao ngay lập tức cho người này.</div>
                    </div>
                `,
                showCancelButton: true,
                confirmButtonText: 'Xóa vĩnh viễn & Bàn giao',
                cancelButtonText: 'Hủy',
                confirmButtonColor: '#dc3545',
                focusConfirm: false,
                preConfirm: () => {
                    const sid = document.getElementById('swal-delete-successor').value;
                    if (!sid) {
                        Swal.showValidationMessage('Vui lòng chọn người kế nhiệm!');
                        return false;
                    }
                    return sid;
                }
            });

            if (!successorId) return;

            try {
                await userAPI.deleteUser(id, successorId);
                alert(`Đã xóa tài khoản của ${user.fullName} và bàn giao quyền quản lý thành công!`);
                fetchData();
            } catch (err) {
                const errorData = err.response?.data;
                const message = typeof errorData === 'string' ? errorData : (errorData?.message || err.message);
                alert('Lỗi: ' + message);
            }
        } else {
            // Nhân viên thường
            if (!(await askConfirm(`Xóa nhân viên ${user.fullName}? Hành động này là vĩnh viễn và không thể hoàn tác.`))) return;
            try {
                await userAPI.deleteUser(id);
                alert('Đã xóa thành công!');
                fetchData();
            } catch (err) {
                const errorData = err.response?.data;
                const message = typeof errorData === 'string' ? errorData : (errorData?.message || err.message);
                alert('Lỗi: ' + message);
            }
        }
    };

    const [editingUserId, setEditingUserId] = useState(null);
    const [editEmail, setEditEmail] = useState('');
    const [editDeptId, setEditDeptId] = useState('');
    const [editRole, setEditRole] = useState('');
    const [editSuccessorId, setEditSuccessorId] = useState('');

    const handleEditUser = (id) => {
        const user = users.find(u => u.id === id);
        if (!isApprovedUser(user)) return;
        setEditingUserId(id);
        setEditEmail(user.email);
        setEditDeptId(user.department?.id || '');
        setEditRole(user.role);
        setEditSuccessorId('');
    };

    const handleSaveEdit = async () => {
        try {
            await userAPI.updateUser(editingUserId, {
                email: editEmail,
                deptId: editDeptId,
                role: editRole,
                successorId: editSuccessorId
            });
            alert('Cập nhật thành công!');
            fetchData();
            setEditingUserId(null);
        } catch (err) {
            const errorData = err.response?.data;
            const message = typeof errorData === 'string' ? errorData : (errorData?.message || err.message);
            alert('Lỗi: ' + message);
        }
    };

    const handleCancelEdit = () => {
        setEditingUserId(null);
    };

    const isUserActive = (user) => user?.isActive !== false && user?.active !== false;

    const filteredUsers = useMemo(() => {
        const normalizedKeyword = searchTerm.trim().toLowerCase();

        return users.filter((user) => {
            const matchesKeyword = !normalizedKeyword
                || user.fullName?.toLowerCase().includes(normalizedKeyword)
                || user.email?.toLowerCase().includes(normalizedKeyword);
            const matchesRole = userFilters.role === 'ALL' || user.role === userFilters.role;
            const matchesApproval = userFilters.approval === 'ALL' || getApprovalStatus(user) === userFilters.approval;
            const matchesAccess = userFilters.access === 'ALL'
                || (userFilters.access === 'ACTIVE' && isApprovedUser(user) && isUserActive(user))
                || (userFilters.access === 'LOCKED' && isApprovedUser(user) && !isUserActive(user))
                || (userFilters.access === 'PENDING' && getApprovalStatus(user) === 'PENDING')
                || (userFilters.access === 'REJECTED' && getApprovalStatus(user) === 'REJECTED');
            const matchesDepartment = userFilters.departmentId === 'ALL'
                || user.department?.id === userFilters.departmentId;

            return matchesKeyword && matchesRole && matchesApproval && matchesAccess && matchesDepartment;
        });
    }, [users, searchTerm, userFilters]);

    useEffect(() => {
        if (!editingUserId) return;

        const editedUserStillVisible = filteredUsers.some((user) => user.id === editingUserId);
        if (!editedUserStillVisible) {
            setEditingUserId(null);
        }
    }, [editingUserId, filteredUsers]);

    const filteredActivityEntries = useMemo(() => {
        const normalizedKeyword = activityFilters.keyword.trim().toLowerCase();
        const now = Date.now();

        return activityEntries.filter((entry) => {
            const entryText = [
                entry.message,
                entry.actorName,
                entry.actorEmail,
                entry.targetUserName,
                entry.targetUserEmail,
                entry.type,
            ].filter(Boolean).join(' ').toLowerCase();

            const matchesKeyword = !normalizedKeyword || entryText.includes(normalizedKeyword);
            const matchesType = activityFilters.type === 'ALL' || entry.type === activityFilters.type;

            let matchesPeriod = true;
            if (activityFilters.period === 'TODAY') {
                const startOfDay = new Date();
                startOfDay.setHours(0, 0, 0, 0);
                matchesPeriod = new Date(entry.createdAt).getTime() >= startOfDay.getTime();
            } else if (activityFilters.period === 'LAST_7_DAYS') {
                matchesPeriod = new Date(entry.createdAt).getTime() >= now - (7 * 24 * 60 * 60 * 1000);
            } else if (activityFilters.period === 'LAST_30_DAYS') {
                matchesPeriod = new Date(entry.createdAt).getTime() >= now - (30 * 24 * 60 * 60 * 1000);
            }

            return matchesKeyword && matchesType && matchesPeriod;
        });
    }, [activityEntries, activityFilters]);

    const activityTypes = useMemo(() => {
        return Array.from(new Set(activityEntries.map((entry) => entry.type).filter(Boolean))).sort();
    }, [activityEntries]);
    const filteredEscalatedRequests = useMemo(
        () => escalatedRequests.filter((request) => requestWorkflowFilter === 'ALL' || request.status === requestWorkflowFilter),
        [escalatedRequests, requestWorkflowFilter]
    );
    const requestWorkflowStats = useMemo(() => ({
        escalated: escalatedRequests.length,
        pending: escalatedRequests.filter((request) => request.status === 'PENDING').length,
        approved: requestAuditTrail.filter((request) => request.status === 'APPROVED').length,
        rejected: requestAuditTrail.filter((request) => request.status === 'REJECTED').length,
    }), [escalatedRequests, requestAuditTrail]);

    const getAccessStatusConfig = (user) => {
        const approvalStatus = getApprovalStatus(user);

        if (approvalStatus === 'REJECTED') {
            return {
                className: 'bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25 rounded-pill px-2',
                text: 'Từ chối truy cập'
            };
        }

        if (approvalStatus === 'PENDING') {
            return {
                className: 'bg-secondary bg-opacity-10 text-secondary border border-secondary border-opacity-25 rounded-pill px-2',
                text: 'Chưa có quyền truy cập'
            };
        }

        if (isUserActive(user)) {
            return {
                className: 'bg-success bg-opacity-10 text-success border border-success border-opacity-25 rounded-pill px-2',
                text: 'Hoạt động'
            };
        }

        return {
            className: 'bg-warning bg-opacity-10 text-warning border border-warning border-opacity-25 rounded-pill px-2',
            text: 'Đang bị khóa'
        };
    };

    const handleToggleUserStatus = async (user) => {
        if (!isApprovedUser(user)) return;

        const willLock = isUserActive(user);
        const actionText = willLock ? 'Khóa' : 'Mở khóa';
        
        if (!(await askConfirm(`${actionText} tài khoản ${user.fullName}?`))) return;

        try {
            await userAPI.updateUserStatus(user.id, !willLock);
            alert(`Đã ${actionText.toLowerCase()} tài khoản!`);
            if (editingUserId === user.id) setEditingUserId(null);
            await fetchData();
        } catch (err) {
            const errorData = err.response?.data;
            const message = typeof errorData === 'string' ? errorData : (errorData?.message || err.message);
            alert('Lỗi: ' + message);
        }
    };

    const handleApproveUser = async (user) => {
        const { value: formValues } = await Swal.fire({
            title: 'Phê duyệt tài khoản',
            html: `
                <div class="text-start">
                    <div class="alert alert-info small mb-3">
                        Tài khoản này sẽ được cấp quyền truy cập sau khi chọn vai trò.
                    </div>
                    <label class="form-label fw-bold small text-muted">Vai trò <span class="text-danger">*</span></label>
                    <select id="swal-approve-role" class="form-select mb-3">
                        <option value="EMPLOYEE">Nhân viên</option>
                        <option value="MANAGER">Trưởng phòng</option>
                        <option value="ADMIN">Quản trị viên</option>
                    </select>

                    <label class="form-label fw-bold small text-muted">Phòng ban</label>
                    <select id="swal-approve-dept" class="form-select">
                        <option value="">-- Chưa gán phòng ban --</option>
                        ${departments.map((dept) => `<option value="${dept.id}">${formatDeptName(dept.name)}</option>`).join('')}
                    </select>
                    <div class="form-text mt-2">Phòng ban là tùy chọn và có thể cập nhật lại sau.</div>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'Phê duyệt',
            cancelButtonText: 'Hủy',
            preConfirm: () => {
                const role = document.getElementById('swal-approve-role').value;
                const deptId = document.getElementById('swal-approve-dept').value;

                if (!role) {
                    Swal.showValidationMessage('Vui lòng chọn vai trò cho tài khoản này.');
                    return false;
                }

                return { role, deptId };
            }
        });

        if (!formValues) return;

        try {
            await userAPI.approveUser(user.id, {
                role: formValues.role,
                deptId: formValues.deptId || null
            });
            await Swal.fire('Thành công', `Đã phê duyệt tài khoản ${user.fullName}.`, 'success');
            if (editingUserId === user.id) {
                setEditingUserId(null);
            }
            await fetchData();
        } catch (err) {
            const errorData = err.response?.data;
            const message = typeof errorData === 'string' ? errorData : (errorData?.message || err.message);
            Swal.fire('Lỗi', message, 'error');
        }
    };

    const handleRejectUser = async (user) => {
        const { value: formValues } = await Swal.fire({
            title: 'Từ chối đăng ký',
            html: `
                <div class="text-start">
                    <div class="alert alert-danger small mb-3">
                        Tài khoản này sẽ bị chuyển sang trạng thái từ chối và không thể đăng nhập.
                    </div>
                    <label class="form-label fw-bold small text-muted">Lý do từ chối <span class="text-danger">*</span></label>
                    <textarea id="swal-reject-reason" class="form-control" rows="4" placeholder="Nhập lý do từ chối để gửi cho người dùng"></textarea>
                    <div class="form-text mt-2">Lý do này sẽ được lưu lại và hiển thị cho người dùng khi họ đăng nhập.</div>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'Từ chối tài khoản',
            cancelButtonText: 'Hủy',
            confirmButtonColor: '#dc3545',
            focusConfirm: false,
            preConfirm: () => {
                const reason = document.getElementById('swal-reject-reason').value.trim();

                if (!reason) {
                    Swal.showValidationMessage('Vui lòng nhập lý do từ chối cho tài khoản này.');
                    return false;
                }

                return { reason };
            }
        });

        if (!formValues) return;

        try {
            await userAPI.rejectUser(user.id, { reason: formValues.reason });
            await Swal.fire('Đã từ chối', `Đã từ chối tài khoản ${user.fullName}.`, 'success');
            if (editingUserId === user.id) {
                setEditingUserId(null);
            }
            await fetchData();
        } catch (err) {
            const errorData = err.response?.data;
            const message = typeof errorData === 'string' ? errorData : (errorData?.message || err.message);
            Swal.fire('Lỗi', message, 'error');
        }
    };

    const handleAddDept = async (e) => {
        e.preventDefault();
        try {
            await api.post('/departments', newDept);
            alert("Thêm phòng thành công!");
            setNewDept({ name: '', description: '' });
            await fetchData();
        } catch (err) { console.error(err); alert("Lỗi thêm phòng!"); }
    };

    const handleEditDepartment = async (dept) => {
        let availableManagers = users.filter(u => u.role === 'MANAGER');

        const { value: formValues } = await Swal.fire({
            title: 'Sửa Thông Tin Phòng Ban',
            html: `
                <div class="text-start">
                    <label class="form-label fw-bold small text-muted">Tên Phòng Ban</label>
                    <input id="swal-edit-dname" class="form-control mb-3" value="${formatDeptName(dept.name).replace('Phòng ', '')}">
                    
                    <label class="form-label fw-bold small text-muted">Mô Tả</label>
                    <textarea id="swal-edit-ddesc" class="form-control mb-3" rows="4">${dept.description || ''}</textarea>

                    <label class="form-label fw-bold small text-muted">Trưởng Phòng</label>
                    <select id="swal-edit-dmanager" class="form-select mb-3">
                        <option value="">-- Chưa có --</option>
                        ${availableManagers.map(m => `<option value="${m.id}" ${(dept.manager?.id === m.id) ? 'selected' : ''}>${m.fullName} (${m.email})</option>`).join('')}
                    </select>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'Lưu',
            cancelButtonText: 'Hủy',
            preConfirm: () => {
                const name = document.getElementById('swal-edit-dname').value.trim();
                const description = document.getElementById('swal-edit-ddesc').value.trim();
                const managerId = document.getElementById('swal-edit-dmanager').value;
                if (!name) {
                    Swal.showValidationMessage('Tên phòng ban không được để trống!');
                    return false;
                }
                return { name, description, managerId };
            }
        });

        if (formValues) {
            try {
                const updatedPayload = {
                    ...dept,
                    name: formValues.name,
                    description: formValues.description
                };
                if (formValues.managerId) {
                    updatedPayload.manager = { id: formValues.managerId };
                } else {
                    updatedPayload.manager = null;
                }

                await api.put(`/departments/${dept.id}`, updatedPayload);
                await Swal.fire('Thành công', 'Đã cập nhật phòng ban', 'success');
                fetchData();
                if (selectedDept && selectedDept.id === dept.id) {
                    setSelectedDept({ ...selectedDept, name: formValues.name, description: formValues.description });
                }
            } catch (error) {
                Swal.fire("Lỗi", error.response?.data || error.message, "error");
            }
        }
    };

    const handleOpenDeptMemberModal = (dept) => {
        setSelectedDeptForMember(dept);
        let allEmployees = users.filter(u => u.role === 'EMPLOYEE' || u.role === 'QA');
        const available = allEmployees.filter(u => !u.department || u.department.id !== dept.id);
        setAvailableDeptMembers(available);
        setSelectedDeptMembersToAdd([]);
        setShowDeptMemberModal(true);
    };

    const handleAddMemberToDept = async () => {
        if (selectedDeptMembersToAdd.length === 0) {
            alert("Vui lòng chọn ít nhất một nhân viên!");
            return;
        }
        try {
            await api.patch(`/users/bulk-update-dept`, selectedDeptMembersToAdd, {
                params: {
                    deptId: selectedDeptForMember.id,
                    adminEmail: currentUser.email
                }
            });
            alert(`✅ Đã thêm ${selectedDeptMembersToAdd.length} nhân viên vào phòng ban!`);
            setShowDeptMemberModal(false);
            setSelectedDeptMembersToAdd([]);
            fetchData();
        } catch (err) {
            console.error("❌ Lỗi thêm member phòng ban:", err);
            alert("Lỗi: " + (err.response?.data?.message || err.response?.data || err.message));
        }
    };

    const handleDeleteDepartment = async (id) => {
        if (await askConfirm('Xóa phòng ban này và toàn bộ dữ liệu liên quan? Hành động này có thể bị từ chối nếu có dự án hoặc nhân sự bám theo!')) {
            try {
                await api.delete(`/departments/${id}`);
                alert("Đã xóa phòng ban!");
                fetchData();
                if (selectedDept && selectedDept.id === id) {
                    setSelectedDept(null);
                }
            } catch (error) {
                alert("Lỗi xóa: " + (error.response?.data || error.message));
            }
        }
    };

    const handleEditProject = async (p) => {
        const { value: formValues } = await Swal.fire({
            title: 'Sửa thông tin dự án',
            html: `
                <div class="text-start">
                    <label class="form-label fw-bold small text-muted">Tên Dự Án</label>
                    <input id="swal-edit-pname" class="form-control mb-3" value="${p.name || ''}" placeholder="Tên dự án">
                    
                    <label class="form-label fw-bold small text-muted">Mô Tả</label>
                    <textarea id="swal-edit-pdesc" class="form-control mb-3" rows="3" placeholder="Mô tả dự án">${p.description || ''}</textarea>
                    
                    <label class="form-label fw-bold small text-muted">Tải File Lên Từ Máy</label>
                    <input type="file" id="swal-edit-pfile" class="form-control mb-3">
                    
                    <label class="form-label fw-bold small text-muted">Hoặc Dán Link Tài Liệu</label>
                    <input id="swal-edit-plink" class="form-control mb-3" value="${p.documentLink || ''}" placeholder="Dán link vào đây">
                    
                    <div class="row mb-3">
                        <div class="col-6">
                            <label class="form-label fw-bold small text-muted">Bắt Đầu</label>
                            <input type="date" id="swal-edit-pstart" class="form-control" value="${p.startDate || ''}">
                        </div>
                        <div class="col-6">
                            <label class="form-label fw-bold small text-muted">Hạn Chót</label>
                            <input type="date" id="swal-edit-pdeadline" class="form-control" value="${p.deadline || ''}">
                        </div>
                    </div>
                </div>
            `,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: 'Lưu thay đổi',
            cancelButtonText: 'Hủy',
            preConfirm: async () => {
                const name = document.getElementById('swal-edit-pname').value;
                const description = document.getElementById('swal-edit-pdesc').value;
                let documentLink = document.getElementById('swal-edit-plink').value;
                const startDate = document.getElementById('swal-edit-pstart').value;
                const deadline = document.getElementById('swal-edit-pdeadline').value;
                const fileInput = document.getElementById('swal-edit-pfile');

                if (!name) {
                    Swal.showValidationMessage('Tên dự án không được để trống!');
                    return false;
                }

                if (fileInput.files.length > 0) {
                    const formData = new FormData();
                    formData.append("file", fileInput.files[0]);
                    try {
                        Swal.getConfirmButton().disabled = true;
                        const uploadRes = await api.post('/files/upload', formData, {
                            headers: { 'Content-Type': 'multipart/form-data' }
                        });
                        // Đính URL upload trả về thành documentLink
                        documentLink = uploadRes.data.url;
                    } catch (err) {
                        Swal.showValidationMessage('Lỗi upload file: ' + err.message);
                        return false;
                    }
                }

                return { name, description, documentLink, startDate, deadline };
            }
        });

        if (formValues) {
            try {
                await api.put(`/projects/${p.id}/update`, formValues);
                await Swal.fire('Thành công!', 'Đã cập nhật dự án.', 'success');
                fetchData();
            } catch (err) {
                Swal.fire('Lỗi', err.response?.data || err.message, 'error');
            }
        }
    };

    const handleOpenMemberModal = (project) => {
        setSelectedProjectForMember(project);
        const projectDeptId = project.deptId || (project.department ? project.department.id : null);

        let deptMembersList = users.filter(u =>
            u.department &&
            u.department.id == projectDeptId &&
            (u.role === 'EMPLOYEE' || u.role === 'QA' || u.role === 'MANAGER')
        );

        const existingMemberIds = (project.members || []).map(m => m.id);
        const available = deptMembersList.filter(u => !existingMemberIds.includes(u.id));

        setAvailableMembers(available);
        setSelectedMembersToAdd([]);
        setShowMemberModal(true);
    };

    const handleAddMemberToProject = async () => {
        if (selectedMembersToAdd.length === 0) {
            alert("Vui lòng chọn ít nhất một nhân viên!");
            return;
        }
        try {
            await api.post(`/projects/${selectedProjectForMember.id}/add-members`, selectedMembersToAdd);
            alert(`✅ Đã thêm ${selectedMembersToAdd.length} nhân sự thành công!`);
            setShowMemberModal(false);
            setSelectedMembersToAdd([]);
            fetchData();
        } catch (err) {
            console.error("❌ Lỗi thêm member:", err);
            const errorMessage = err.response?.data?.message || err.response?.data || err.message || "Thất bại";
            alert("Lỗi: " + errorMessage);
        }
    };

    const handleAddProject = async (e) => {
        e.preventDefault();
        if (!selectedDept) return;

        // Frontend validation basics
        if (!newProject.name || !newProject.startDate || !newProject.deadline) {
            Swal.fire({
                icon: 'warning',
                title: 'Thiếu thông tin',
                text: 'Vui lòng điền đầy đủ Tên, Ngày bắt đầu và Hạn chót!',
                confirmButtonColor: '#3085d6'
            });
            return;
        }

        const start = new Date(newProject.startDate);
        const end = new Date(newProject.deadline);
        if (end < start) {
            Swal.fire({
                icon: 'error',
                title: 'Lỗi ngày tháng',
                text: 'Hạn chót dự án không được sớm hơn ngày bắt đầu!',
                confirmButtonColor: '#d33'
            });
            return;
        }

        try {
            const url = `/projects/create?deptId=${selectedDept.id}&email=${currentUser.email}`;
            await api.post(url, newProject);
            
            await Swal.fire({
                icon: 'success',
                title: 'Thành công!',
                text: `Đã tạo dự án "${newProject.name}" cho phòng ${selectedDept.name}`,
                timer: 2000,
                showConfirmButton: false
            });

            fetchData();
            // Reset form hoàn chỉnh bao gồm cả ngày bắt đầu
            setNewProject({ name: '', description: '', startDate: '', deadline: '', priority: 'MEDIUM' });
            setShowProjectForm(false);
        } catch (error) {
            console.error("Project Create Error:", error);
            // Trích xuất thông báo từ Backend (chuỗi hoặc object có trường message)
            const serverMsg = error.response?.data?.message || (typeof error.response?.data === 'string' ? error.response.data : null) || error.message;
            
            Swal.fire({
                icon: 'error',
                title: 'Lỗi khởi tạo dự án',
                text: serverMsg || 'Vui lòng kiểm tra lại thông tin nhập liệu!',
                footer: '<small class="text-info"><i class="bi bi-info-circle"></i> Kiểm tra xem ngày bắt đầu có ở quá khứ không?</small>',
                confirmButtonColor: '#d33'
            });
        }
    };

    const getProjectsByDept = (deptId) => { return projects.filter(p => (p.deptId == deptId || p.department?.id == deptId)); };
    const getCompletedProjectsByDept = (deptId) => { return completedProjects.filter(p => (p.deptId == deptId || p.department?.id == deptId)); };
    const pendingUsersCount = filteredUsers.filter((user) => getApprovalStatus(user) === 'PENDING').length;
    const activeUsersCount = filteredUsers.filter((user) => getApprovalStatus(user) === 'APPROVED' && isUserActive(user)).length;

    return (
        <div className="admin-page min-vh-100 bg-light d-flex flex-column">
            {/* Header Navbar */}
            <div className="glass-header d-flex justify-content-between align-items-center shadow-sm w-100 sticky-top">
                {/* Logo - Fixed Width for Balance */}
                <div className="admin-header-slot admin-header-brand d-flex align-items-center">
                    <span className="fs-3 me-2">🚀</span>
                    <span className="brand-text d-none d-md-block">ADMIN PRO</span>
                </div>

                {/* Centered Menu */}
                <div className="top-menu admin-top-menu d-none d-xl-flex justify-content-center">
                    <button className={`top-menu-item ${activeTab === 'users' ? 'active' : ''}`} onClick={() => setActiveTab('users')}>
                        <i className="bi bi-people-fill top-menu-icon" style={{ color: activeTab === 'users' ? '#1d6fa3' : '#8aa2bc' }}></i> Nhân sự
                    </button>
                    <button className={`top-menu-item ${activeTab === 'departments' ? 'active' : ''}`} onClick={() => setActiveTab('departments')}>
                        <i className="bi bi-building top-menu-icon" style={{ color: activeTab === 'departments' ? '#1d6fa3' : '#8aa2bc' }}></i> Phòng Ban
                    </button>
                    <button className={`top-menu-item ${activeTab === 'projects' ? 'active' : ''}`} onClick={() => setActiveTab('projects')}>
                        <i className="bi bi-folder-fill top-menu-icon" style={{ color: activeTab === 'projects' ? '#1d6fa3' : '#8aa2bc' }}></i> Dự Án
                    </button>
                    <button className={`top-menu-item ${activeTab === 'completed' ? 'active' : ''}`} onClick={() => setActiveTab('completed')}>
                        <i className="bi bi-check-circle-fill top-menu-icon" style={{ color: activeTab === 'completed' ? '#1d6fa3' : '#8aa2bc' }}></i> Đã Hoàn Thành
                    </button>
                    <button className={`top-menu-item ${activeTab === 'workflow' ? 'active' : ''}`} onClick={() => setActiveTab('workflow')}>
                        <i className="bi bi-briefcase-fill top-menu-icon" style={{ color: activeTab === 'workflow' ? '#1d6fa3' : '#8aa2bc' }}></i> Workflow
                    </button>
                    <button className={`top-menu-item ${activeTab === 'activity' ? 'active' : ''}`} onClick={() => setActiveTab('activity')}>
                        <i className="bi bi-clock-history top-menu-icon" style={{ color: activeTab === 'activity' ? '#1d6fa3' : '#8aa2bc' }}></i> Hoạt động
                    </button>
                    <button className={`top-menu-item`} onClick={() => navigate('/admin/statistics')}>
                        <i className="bi bi-bar-chart-fill top-menu-icon" style={{ color: '#8aa2bc' }}></i> Thống kê
                    </button>
                </div>

                {/* Right Profile Actions */}
                <div className="admin-header-slot admin-header-actions d-flex align-items-center justify-content-end gap-3">
                    <div className="d-none d-md-block"><NotificationBell /></div>

                    <div className="dropdown position-relative ms-1">
                        <div
                            className="admin-profile-toggle d-flex align-items-center py-1 px-2 rounded-pill shadow-sm"
                            onClick={() => setShowProfileMenu(!showProfileMenu)}
                        >
                            <div className="admin-profile-avatar rounded-circle bg-primary text-white d-flex align-items-center justify-content-center fw-bold shadow-sm overflow-hidden">
                                {currentUser?.avatarUrl ? (
                                    <img src={currentUser.avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                    currentUser?.fullName ? currentUser.fullName.charAt(0).toUpperCase() : 'A'
                                )}
                            </div>
                            <div className="ms-2 me-2 d-none d-sm-block text-start">
                                <div className="fw-bold text-dark" style={{ fontSize: '0.85rem', lineHeight: '1.2' }}>{currentUser?.fullName}</div>
                                <small className="text-muted" style={{ fontSize: '0.7rem' }}>Administrator</small>
                            </div>
                            <i className="bi bi-chevron-down ms-1 text-muted me-2" style={{ fontSize: '0.8rem' }}></i>
                        </div>

                        {showProfileMenu && (
                            <div className="dropdown-menu show shadow border-0 position-absolute end-0 mt-2 p-2 rounded-4" style={{ minWidth: '220px', backgroundColor: '#fff', top: '100%', zIndex: 1050 }}>
                                <div className="px-3 py-2 mb-1 d-sm-none border-bottom">
                                    <div className="fw-bold text-dark">{currentUser?.fullName}</div>
                                    <small className="text-muted">Administrator</small>
                                </div>
                                <button className="dropdown-item rounded-3 py-2 fw-bold text-dark mb-1 d-flex align-items-center modern-dropdown-item" onClick={() => { setShowProfileMenu(false); navigate('/profile'); }}>
                                    <i className="bi bi-person-fill me-2 fs-5 text-primary"></i> Tài khoản của tôi
                                </button>
                                <button className="dropdown-item rounded-3 py-2 fw-bold text-dark mb-1 d-flex align-items-center modern-dropdown-item" onClick={() => { setShowProfileMenu(false); setActiveTab('deleted'); }}>
                                    <i className="bi bi-trash-fill me-2 fs-5 text-danger"></i> Thùng rác
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

            {/* Main Content Areas */}
            <div className="admin-main-wrapper">
                <div className="p-4 p-md-5 animate-fade-in content-inner">
                    <div className="d-flex justify-content-between align-items-center mb-4 d-xl-none bg-white p-3 rounded-4 shadow-sm">
                        <h4 className="page-title mb-0 fs-5">{activeTab === 'users' ? 'Quản lý Nhân sự' : activeTab === 'departments' ? 'Phòng Ban & Dự Án' : activeTab === 'completed' ? 'Dự án Hoàn thành' : activeTab === 'workflow' ? 'Workflow phê duyệt' : activeTab === 'activity' ? 'Lịch sử hoạt động' : 'Thùng rác'}</h4>
                        <select className="form-select modern-input w-auto fw-bold text-primary-dark shadow-sm py-1" value={activeTab} onChange={(e) => { if (e.target.value === 'stats') navigate('/admin/statistics'); else setActiveTab(e.target.value); }}>
                            <option value="users">Nhân sự</option>
                            <option value="departments">Phòng ban</option>
                            <option value="completed">Đã hoàn thành</option>
                            <option value="workflow">Workflow</option>
                            <option value="activity">Hoạt động</option>
                            <option value="deleted">Thùng rác</option>
                            <option value="stats">Thống kê</option>
                        </select>
                    </div>
                    {activeTab === 'users' && (
                        <div className="admin-users-shell">
                            <div className="admin-users-overview">
                                <div>
                                    <span className="admin-section-kicker">Quản lý nhân sự</span>
                                    <h2 className="admin-users-title">Theo dõi tài khoản, phê duyệt và quyền truy cập trong một không gian rõ ràng hơn</h2>
                                    <p className="admin-users-description mb-0">
                                        Giữ danh sách nhân viên dễ quét, thao tác nhanh và cân bằng hơn giữa khu vực tạo mới với bảng quản trị.
                                    </p>
                                </div>
                                <div className="admin-users-stats" aria-label="Tổng quan nhân sự">
                                    <div className="admin-users-stat">
                                        <span className="admin-users-stat-value">{filteredUsers.length}</span>
                                        <span className="admin-users-stat-label">Tài khoản hiển thị</span>
                                    </div>
                                    <div className="admin-users-stat">
                                        <span className="admin-users-stat-value">{pendingUsersCount}</span>
                                        <span className="admin-users-stat-label">Chờ duyệt</span>
                                    </div>
                                    <div className="admin-users-stat">
                                        <span className="admin-users-stat-value">{activeUsersCount}</span>
                                        <span className="admin-users-stat-label">Đang hoạt động</span>
                                    </div>
                                </div>
                            </div>

                            <div className="row g-4 align-items-start">
                                <div className="col-12 col-xl-4">
                                    <div className="modern-card user-create-card">
                                        <div className="modern-card-header user-create-card-header">
                                            <div>
                                                <span className="admin-section-kicker">Khởi tạo nhanh</span>
                                                <div className="user-create-title-row">Thêm Nhân Sự Mới</div>
                                                <p className="user-create-subtitle mb-0">Tạo tài khoản mới với ảnh đại diện, vai trò và phòng ban ngay trong một biểu mẫu gọn gàng.</p>
                                            </div>
                                        </div>
                                        <div className="card-body p-4 bg-white">
                                            <form onSubmit={handleAddUser} className="user-create-form">
                                                <div className="user-avatar-panel text-center">
                                                    <div className="user-avatar-frame position-relative d-inline-flex align-items-center justify-content-center">
                                                        {avatarPreview ? (
                                                            <img src={avatarPreview} alt="Avatar preview" className="user-avatar-preview rounded-circle border-3 border-primary" style={{ width: 104, height: 104, objectFit: 'cover' }} />
                                                        ) : (
                                                            <div className="user-avatar-placeholder rounded-circle d-flex align-items-center justify-content-center">
                                                                <i className="bi bi-image text-muted" style={{ fontSize: '2rem' }}></i>
                                                            </div>
                                                        )}
                                                        <input type="file" id="avatarInput" accept="image/png,image/jpeg,image/jpg" onChange={handleAvatarSelect} style={{ display: 'none' }} />
                                                    </div>
                                                    <p className="user-avatar-note mb-0">Ảnh đại diện giúp nhận diện nhanh hơn trong danh sách và thông báo nội bộ.</p>
                                                    <div className="d-flex gap-2 mt-3 justify-content-center flex-wrap">
                                                        <button type="button" className="btn btn-sm btn-outline-primary fw-bold user-avatar-btn" onClick={handleEditAvatar} title="Chọn ảnh từ máy tính">
                                                            <i className="bi bi-upload me-1"></i>Tải lên
                                                        </button>
                                                        {avatarPreview && (
                                                            <button type="button" className="btn btn-sm btn-outline-danger fw-bold user-avatar-btn" onClick={handleRemoveAvatar}>
                                                                <i className="bi bi-trash me-1"></i>Xóa
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="user-form-stack">
                                                    <div className="user-form-field">
                                                        <label className="user-form-label">Họ tên</label>
                                                        <input name="fullName" className="form-control modern-input user-form-control" placeholder="Nhập họ và tên" required value={newUser.fullName} onChange={e => setNewUser({ ...newUser, fullName: e.target.value })} />
                                                    </div>
                                                    <div className="user-form-field">
                                                        <label className="user-form-label">Email</label>
                                                        <input name="email" type="email" className="form-control modern-input user-form-control" placeholder="Nhập email liên hệ" required value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} />
                                                    </div>
                                                    <div className="user-form-field">
                                                        <label className="user-form-label">Mật khẩu</label>
                                                        <input name="password" type="password" autoComplete="new-password" className="form-control modern-input user-form-control" placeholder="Nhập mật khẩu ban đầu" required value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} />
                                                    </div>
                                                    <div className="user-form-grid">
                                                        <div className="user-form-field">
                                                            <label className="user-form-label">Phòng ban</label>
                                                            <select name="deptId" className="form-select modern-input user-form-control" value={newUser.deptId} onChange={e => setNewUser({ ...newUser, deptId: e.target.value })}>
                                                                <option value="">-- Chọn phòng ban --</option>
                                                                {departments.map(d => <option key={d.id} value={d.id}>{formatDeptName(d.name)}</option>)}
                                                            </select>
                                                        </div>
                                                        <div className="user-form-field">
                                                            <label className="user-form-label">Vai trò</label>
                                                            <select name="role" className="form-select modern-input user-form-control" value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })}>
                                                                <option value="EMPLOYEE">Nhân viên</option>
                                                                <option value="MANAGER">Trưởng phòng</option>
                                                                <option value="ADMIN">Quản trị viên</option>
                                                            </select>
                                                        </div>
                                                    </div>
                                                </div>

                                                <button className="modern-btn-primary w-100 user-submit-btn">Tạo mới tài khoản</button>
                                            </form>
                                        </div>
                                    </div>
                                </div>

                                <div className="col-12 col-xl-8">
                                    <div className="modern-card user-list-card d-flex flex-column h-100">
                                        <div className="modern-card-header admin-user-list-header">
                                            <div className="admin-user-list-heading">
                                                <span className="admin-section-kicker">Nhân sự hệ thống</span>
                                                <div className="admin-user-list-title-row">
                                                    <span>Danh sách Nhân viên</span>
                                                    <span className="admin-list-counter">{filteredUsers.length} tài khoản</span>
                                                </div>
                                                <p className="admin-user-list-subtitle mb-0">Tìm kiếm, chỉnh sửa quyền, phê duyệt và xử lý trạng thái ngay trong cùng một bảng.</p>
                                            </div>
                                            <form onSubmit={handleSearchUser} className="admin-search-form">
                                                <div className="admin-search-input-wrap">
                                                    <i className="bi bi-search admin-search-icon"></i>
                                                    <input className="form-control form-control-sm modern-input admin-search-input border-0" placeholder="Tìm tên hoặc email..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                                                </div>
                                                <select className="form-select modern-input admin-filter-select" value={userFilters.role} onChange={(e) => setUserFilters((prev) => ({ ...prev, role: e.target.value }))}>
                                                    <option value="ALL">Tất cả vai trò</option>
                                                    <option value="ADMIN">Admin</option>
                                                    <option value="MANAGER">Trưởng phòng</option>
                                                    <option value="EMPLOYEE">Nhân viên</option>
                                                    <option value="QA">QA</option>
                                                </select>
                                                <select className="form-select modern-input admin-filter-select" value={userFilters.approval} onChange={(e) => setUserFilters((prev) => ({ ...prev, approval: e.target.value }))}>
                                                    <option value="ALL">Mọi phê duyệt</option>
                                                    <option value="APPROVED">Đã duyệt</option>
                                                    <option value="PENDING">Chờ duyệt</option>
                                                    <option value="REJECTED">Đã từ chối</option>
                                                </select>
                                                <select className="form-select modern-input admin-filter-select" value={userFilters.access} onChange={(e) => setUserFilters((prev) => ({ ...prev, access: e.target.value }))}>
                                                    <option value="ALL">Mọi truy cập</option>
                                                    <option value="ACTIVE">Đang hoạt động</option>
                                                    <option value="LOCKED">Đang bị khóa</option>
                                                    <option value="PENDING">Chưa có quyền</option>
                                                    <option value="REJECTED">Từ chối truy cập</option>
                                                </select>
                                                <select className="form-select modern-input admin-filter-select" value={userFilters.departmentId} onChange={(e) => setUserFilters((prev) => ({ ...prev, departmentId: e.target.value }))}>
                                                    <option value="ALL">Mọi phòng ban</option>
                                                    {departments.map((dept) => <option key={dept.id} value={dept.id}>{formatDeptName(dept.name)}</option>)}
                                                </select>
                                                <div className="admin-search-actions">
                                                    <button type="submit" className="btn admin-search-btn admin-search-btn-primary rounded-circle shadow-sm d-flex align-items-center justify-content-center" title="Tìm kiếm">
                                                        <i className="bi bi-arrow-right"></i>
                                                    </button>
                                                    <button type="button" className="btn admin-search-btn admin-search-btn-secondary rounded-circle shadow-sm d-flex align-items-center justify-content-center" onClick={handleResetSearch} title="Đặt lại bộ lọc">
                                                        <i className="bi bi-x-lg"></i>
                                                    </button>
                                                </div>
                                            </form>
                                        </div>
                                        <div className="table-responsive flex-grow-1 p-0 admin-user-table-shell">
                                            <table className="table table-hover align-middle mb-0 admin-user-table">
                                                <colgroup>
                                                    <col className="admin-col-avatar" />
                                                    <col className="admin-col-user" />
                                                    <col className="admin-col-email" />
                                                    <col className="admin-col-organization" />
                                                    <col className="admin-col-role" />
                                                    <col className="admin-col-approval" />
                                                    <col className="admin-col-status" />
                                                    <col className="admin-col-actions" />
                                                </colgroup>
                                                <thead className="table-light">
                                                    <tr>
                                                        <th className="text-center admin-user-column-avatar">Ảnh</th>
                                                        <th className="admin-user-column-primary">Thông tin nhân viên</th>
                                                        <th className="admin-user-column-email">Liên hệ (Email)</th>
                                                        <th className="admin-user-column-organization">Vị trí / Phòng ban</th>
                                                        <th className="admin-user-column-role">Phân quyền</th>
                                                        <th className="admin-user-column-approval">Phê duyệt</th>
                                                        <th className="admin-user-column-status">Trạng thái</th>
                                                        <th className="text-end admin-user-column-actions">Hành động</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {filteredUsers.map(u => {
                                                        const isEditing = editingUserId === u.id;
                                                        const isApproved = isApprovedUser(u);
                                                        const approvalStatus = getApprovalStatus(u);
                                                        const roleBadge = getRoleBadgeConfig(u.role);
                                                        const approvalBadge = getApprovalBadgeConfig(u);
                                                        const accessStatus = getAccessStatusConfig(u);
                                                        return (
                                                            <tr key={u.id} className="admin-user-row">
                                                                <td className="text-center admin-user-avatar-cell admin-user-column-avatar" data-label="Ảnh">
                                                                    {u.avatarUrl ? (
                                                                        <img src={u.avatarUrl} alt={u.fullName} className="admin-user-avatar rounded-circle shadow-sm" style={{ width: 48, height: 48, objectFit: 'cover', border: '2px solid white' }} />
                                                                    ) : (
                                                                        <div className="admin-user-avatar admin-user-avatar-fallback rounded-circle bg-primary bg-opacity-10 text-primary d-flex align-items-center justify-content-center mx-auto fw-bold shadow-sm" style={{ width: 48, height: 48, fontSize: '1.1rem', border: '2px solid white' }}>
                                                                            {u.fullName ? u.fullName.charAt(0).toUpperCase() : '?'}
                                                                        </div>
                                                                    )}
                                                                </td>
                                                                <td className="admin-user-column-primary" data-label="Thông tin nhân viên">
                                                                    <div className="admin-user-primary">
                                                                        <div className="admin-user-name">{u.fullName}</div>
                                                                        <div className="admin-user-meta">
                                                                            <span className="admin-user-meta-item">
                                                                                <i className="bi bi-calendar-event me-1"></i>
                                                                                Tham gia: {u.createdAt ? new Date(u.createdAt).toLocaleDateString('vi-VN') : '--'}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                                <td className="admin-user-column-email" data-label="Liên hệ (Email)">
                                                                    {isEditing ? (
                                                                        <input
                                                                            className="form-control form-control-sm modern-input admin-inline-input"
                                                                            value={editEmail}
                                                                            onChange={(e) => setEditEmail(e.target.value)}
                                                                        />
                                                                    ) : (
                                                                        <span className="admin-user-email" title={u.email}><i className="bi bi-envelope me-2"></i>{u.email}</span>
                                                                    )}
                                                                </td>
                                                                <td className="admin-user-column-organization" data-label="Vị trí / Phòng ban">
                                                                    {isEditing ? (
                                                                        <select
                                                                            className="form-select form-select-sm modern-input admin-inline-input"
                                                                            value={editDeptId}
                                                                            onChange={(e) => setEditDeptId(e.target.value)}
                                                                        >
                                                                            <option value="">-- Không phòng ban --</option>
                                                                            {departments.map(d => (
                                                                                <option key={d.id} value={d.id}>{formatDeptName(d.name)}</option>
                                                                            ))}
                                                                        </select>
                                                                    ) : (
                                                                        u.department?.name ?
                                                                            <span className="badge bg-light text-dark border admin-inline-badge"><i className="bi bi-building me-1 text-muted"></i>{formatDeptName(u.department.name)}</span> :
                                                                            <span className="admin-cell-note">{isApproved ? '--' : approvalStatus === 'REJECTED' ? 'Từ chối trước khi gán phòng ban' : 'Chưa gán khi chờ duyệt'}</span>
                                                                    )}
                                                                </td>
                                                                <td className="admin-user-column-role" data-label="Phân quyền">
                                                                    {isEditing ? (
                                                                        <>
                                                                            <select
                                                                                className="form-select form-select-sm modern-input admin-inline-input"
                                                                                value={editRole}
                                                                                onChange={(e) => setEditRole(e.target.value)}
                                                                            >
                                                                                <option value="EMPLOYEE">Nhân viên</option>
                                                                                <option value="MANAGER">Trưởng phòng</option>
                                                                                <option value="ADMIN">Quản trị viên</option>
                                                                            </select>
                                                                            {u.role === 'MANAGER' && (editRole !== 'MANAGER' || (editDeptId !== (u.department?.id || ''))) && (
                                                                                <div className="mt-2 animate-fade-in">
                                                                                    <label className="text-danger small fw-bold d-block mb-1">
                                                                                        <i className="bi bi-person-up me-1"></i>Chọn người kế nhiệm <span className="text-danger">*</span>
                                                                                    </label>
                                                                                    <select
                                                                                        className="form-select form-select-sm border-danger-subtle modern-input"
                                                                                        value={editSuccessorId}
                                                                                        onChange={(e) => setEditSuccessorId(e.target.value)}
                                                                                        required
                                                                                    >
                                                                                        <option value="">-- Chọn người thay thế --</option>
                                                                                        {users
                                                                                            .filter(candidate => 
                                                                                                candidate.id !== u.id && 
                                                                                                candidate.department?.id === u.department?.id &&
                                                                                                isApprovedUser(candidate) &&
                                                                                                isUserActive(candidate)
                                                                                            )
                                                                                            .map(candidate => (
                                                                                                <option key={candidate.id} value={candidate.id}>
                                                                                                    {candidate.fullName} ({candidate.email})
                                                                                                </option>
                                                                                            ))
                                                                                        }
                                                                                    </select>
                                                                                    <div className="form-text text-danger" style={{ fontSize: '0.65rem' }}>
                                                                                        Bắt buộc chọn người kế nhiệm để không gián đoạn quản lý phòng ban.
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                        </>
                                                                    ) : (
                                                                        <span className={`badge ${roleBadge.className} rounded-pill admin-role-badge`}>
                                                                            {roleBadge.text}
                                                                        </span>
                                                                    )}
                                                                </td>
                                                                <td className="admin-user-column-approval" data-label="Phê duyệt">
                                                                    <div className="admin-status-stack d-flex flex-column align-items-start gap-1">
                                                                        <span className={`badge ${approvalBadge.className} admin-status-badge`}>{approvalBadge.text}</span>
                                                                        {approvalStatus === 'REJECTED' && u.rejectionReason && (
                                                                            <span className="small text-danger text-break admin-cell-note">{u.rejectionReason}</span>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                                <td className="admin-user-column-status" data-label="Trạng thái">
                                                                    <span className={`badge ${accessStatus.className} admin-status-badge`}>{accessStatus.text}</span>
                                                                </td>
                                                                <td className="text-end admin-user-column-actions" data-label="Hành động">
                                                                    {u.role !== 'ADMIN' && (
                                                                        <div className="admin-user-actions">
                                                                            {isEditing ? (
                                                                                <>
                                                                                    <button className="btn btn-sm btn-success shadow-sm admin-user-action-btn admin-user-action-btn-success" onClick={handleSaveEdit} title="Lưu thay đổi" aria-label="Lưu thay đổi">
                                                                                        <i className="bi bi-check-lg"></i>
                                                                                    </button>
                                                                                    <button className="btn btn-sm btn-secondary shadow-sm admin-user-action-btn admin-user-action-btn-neutral" onClick={handleCancelEdit} title="Hủy chỉnh sửa" aria-label="Hủy chỉnh sửa">
                                                                                        <i className="bi bi-x-lg"></i>
                                                                                    </button>
                                                                                </>
                                                                            ) : (
                                                                                <>
                                                                                    {approvalStatus === 'PENDING' && (
                                                                                        <button className="btn btn-sm btn-success shadow-sm admin-user-action-btn admin-user-action-btn-success" onClick={() => handleApproveUser(u)} title="Phê duyệt tài khoản" aria-label="Phê duyệt tài khoản">
                                                                                            <i className="bi bi-check2-circle"></i>
                                                                                            <span className="admin-user-action-text">Duyệt</span>
                                                                                        </button>
                                                                                    )}
                                                                                    {approvalStatus === 'PENDING' && (
                                                                                        <button className="btn btn-sm btn-outline-danger shadow-sm admin-user-action-btn admin-user-action-btn-danger" onClick={() => handleRejectUser(u)} title="Từ chối tài khoản" aria-label="Từ chối tài khoản">
                                                                                            <i className="bi bi-x-circle"></i>
                                                                                            <span className="admin-user-action-text">Từ chối</span>
                                                                                        </button>
                                                                                    )}
                                                                                    {isApproved && (
                                                                                        <button className="btn btn-sm btn-primary shadow-sm admin-user-action-btn admin-user-action-btn-primary" onClick={() => handleEditUser(u.id)} title="Chỉnh sửa" aria-label="Chỉnh sửa">
                                                                                            <i className="bi bi-pencil-square"></i>
                                                                                            <span className="admin-user-action-text">Sửa</span>
                                                                                        </button>
                                                                                    )}
                                                                                    {isApproved && (
                                                                                        <button className={`btn btn-sm shadow-sm admin-user-action-btn ${isUserActive(u) ? 'btn-outline-warning admin-user-action-btn-warning' : 'btn-outline-success admin-user-action-btn-success-outline'}`} onClick={() => handleToggleUserStatus(u)} title={isUserActive(u) ? 'Khóa tài khoản' : 'Mở khóa tài khoản'} aria-label={isUserActive(u) ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}>
                                                                                            <i className={`bi ${isUserActive(u) ? 'bi-lock' : 'bi-unlock'}`}></i>
                                                                                            <span className="admin-user-action-text">{isUserActive(u) ? 'Khóa' : 'Mở khóa'}</span>
                                                                                        </button>
                                                                                    )}
                                                                                    <button className="btn btn-sm btn-outline-danger shadow-sm admin-user-action-btn admin-user-action-btn-danger" onClick={() => handleDeleteUser(u.id)} title="Xóa tài khoản" aria-label="Xóa tài khoản">
                                                                                        <i className="bi bi-trash"></i>
                                                                                        <span className="admin-user-action-text">Xóa</span>
                                                                                    </button>
                                                                                </>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                    {filteredUsers.length === 0 && <tr><td colSpan="8" className="text-center py-5 text-muted admin-empty-state"><i className="bi bi-inbox fs-1 d-block mb-2"></i>Không tìm thấy nhân viên nào.</td></tr>}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'workflow' && (
                        <div className="workflow-shell">
                            <div className="workflow-hero">
                                <div>
                                    <span className="admin-section-kicker">Điều phối phê duyệt toàn công ty</span>
                                    <h2 className="workflow-hero-title">Tiếp nhận các yêu cầu đã leo thang và giám sát luồng phê duyệt nghiệp vụ ở cấp tổ chức</h2>
                                    <p className="workflow-hero-copy">
                                        Admin xử lý các trường hợp cần quyết định vượt cấp phòng ban, đồng thời theo dõi lịch sử yêu cầu để đối chiếu với KPI, OKR và các đợt quarterly review.
                                    </p>
                                </div>
                                <button className="btn btn-white shadow-sm rounded-pill px-4 fw-bold statistics-back-btn" onClick={() => navigate('/admin/statistics')}>
                                    <i className="bi bi-bar-chart-fill me-2"></i>KPI / OKR
                                </button>
                            </div>

                            <div className="workflow-summary-grid">
                                <div className="workflow-summary-card">
                                    <span className="workflow-summary-label">Chờ admin xử lý</span>
                                    <div className="workflow-summary-value">{requestWorkflowStats.escalated}</div>
                                    <div className="workflow-summary-note">Yêu cầu hiện đang đến bước duyệt cấp admin</div>
                                </div>
                                <div className="workflow-summary-card">
                                    <span className="workflow-summary-label">Can quyet dinh</span>
                                    <div className="workflow-summary-value">{requestWorkflowStats.pending}</div>
                                    <div className="workflow-summary-note">Chờ duyệt hoặc từ chối</div>
                                </div>
                                <div className="workflow-summary-card">
                                    <span className="workflow-summary-label">Đã duyệt</span>
                                    <div className="workflow-summary-value">{requestWorkflowStats.approved}</div>
                                    <div className="workflow-summary-note">Tổng số case đã thông qua</div>
                                </div>
                                <div className="workflow-summary-card">
                                    <span className="workflow-summary-label">Từ chối</span>
                                    <div className="workflow-summary-value">{requestWorkflowStats.rejected}</div>
                                    <div className="workflow-summary-note">Case cần theo dõi lại với các đơn vị</div>
                                </div>
                            </div>

                            <div className="workflow-layout">
                                <div className="workflow-panel">
                                    <div className="workflow-panel-header">
                                        <div>
                                            <h3 className="workflow-panel-title">Inbox yêu cầu leo thang</h3>
                                            <p className="workflow-panel-copy">Danh sách case mà manager đã đẩy lên cấp tổ chức để xin quyết định cuối cùng.</p>
                                        </div>
                                        <select className="form-select modern-input" style={{ maxWidth: '220px' }} value={requestWorkflowFilter} onChange={(e) => setRequestWorkflowFilter(e.target.value)}>
                                            <option value="ALL">Tất cả trạng thái</option>
                                            <option value="PENDING">Chờ duyệt</option>
                                            <option value="APPROVED">Đã duyệt</option>
                                            <option value="REJECTED">Từ chối</option>
                                        </select>
                                    </div>
                                    <div className="workflow-panel-body">
                                        {requestWorkflowError && <div className="workflow-error mb-3">{requestWorkflowError}</div>}
                                        {requestWorkflowLoading ? (
                                            <div className="workflow-empty">Đang tải yêu cầu leo thang...</div>
                                        ) : filteredEscalatedRequests.length === 0 ? (
                                            <div className="workflow-empty">Chưa có yêu cầu leo thang nào trong bộ lọc hiện tại.</div>
                                        ) : (
                                            <div className="workflow-list workflow-scroll-region">
                                                {filteredEscalatedRequests.map((request) => {
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
                                                                    <div className="workflow-meta-value">{request.requesterName} - {request.requesterEmail}</div>
                                                                </div>
                                                                <div>
                                                                    <span className="workflow-meta-label">Đơn vị</span>
                                                                    <div className="workflow-meta-value">{request.departmentName}</div>
                                                                </div>
                                                                <div>
                                                                    <span className="workflow-meta-label">Loại / Ưu tiên</span>
                                                                    <div className="workflow-meta-value">{requestTypeLabel} - {requestPriority}</div>
                                                                </div>
                                                                <div>
                                                                    <span className="workflow-meta-label">Cập nhật</span>
                                                                    <div className="workflow-meta-value">{formatWorkflowDateTime(request.createdAt)}</div>
                                                                </div>
                                                            </div>

                                                            {request.latestNote ? (
                                                                <div className="mt-3">
                                                                    <span className="workflow-meta-label">Lý do leo thang / ghi chú</span>
                                                                    <div className="workflow-meta-value">{request.latestNote}</div>
                                                                </div>
                                                            ) : null}

                                                            <div className="workflow-inline-actions mt-3">
                                                                <button className="btn btn-sm btn-success rounded-pill px-3 fw-bold" onClick={() => handleRequestWorkflowDecision(request, true)}>
                                                                    Duyệt
                                                                </button>
                                                                <button className="btn btn-sm btn-outline-danger rounded-pill px-3 fw-bold" onClick={() => handleRequestWorkflowDecision(request, false)}>
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
                                            <h3 className="workflow-panel-title">Lịch sử yêu cầu tổ chức</h3>
                                            <p className="workflow-panel-copy">Lịch sử gần đây để đối chiếu với thống kê, review quý và các quyết định cần thông báo lại cho đơn vị.</p>
                                        </div>
                                    </div>
                                    <div className="workflow-panel-body">
                                        {requestAuditTrail.length === 0 ? (
                                            <div className="workflow-empty">Chưa có lịch sử workflow tổ chức.</div>
                                        ) : (
                                            <div className="workflow-list workflow-scroll-region">
                                                {requestAuditTrail.slice(0, 10).map((request) => {
                                                    const statusMeta = getRequestStatusMeta(request.status);

                                                    return (
                                                        <article key={request.id || `${request.title}-${request.createdAt}-audit`} className="workflow-item">
                                                            <div className="workflow-item-head">
                                                                <div>
                                                                    <h4 className="workflow-item-title">{request.title}</h4>
                                                                    <p className="workflow-item-copy">{request.requesterName} - {request.departmentName}</p>
                                                                </div>
                                                                <span className={`workflow-pill ${statusMeta.className}`}>{statusMeta.label}</span>
                                                            </div>
                                                            <div className="workflow-item-meta">
                                                                <div>
                                                                    <span className="workflow-meta-label">Cập nhật gần nhất</span>
                                                                    <div className="workflow-meta-value">{formatWorkflowDateTime(request.createdAt)}</div>
                                                                </div>
                                                                <div>
                                                                    <span className="workflow-meta-label">Cập nhật gần nhất</span>
                                                                    <div className="workflow-meta-value">{formatWorkflowDateTime(request.resolvedAt || request.updatedAt || request.createdAt)}</div>
                                                                </div>
                                                            </div>
                                                            {request.latestNote ? (
                                                                <div className="mt-3">
                                                                    <span className="workflow-meta-label">Ghi chú</span>
                                                                    <div className="workflow-meta-value">{request.latestNote}</div>
                                                                </div>
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
                    )}

                    {activeTab === 'activity' && (
                        <div className="row g-4">
                            <div className="col-12 col-xl-4">
                                <div className="modern-card">
                                    <div className="modern-card-header">Bộ lọc hoạt động</div>
                                    <div className="card-body p-4 bg-white">
                                        <label className="form-label fw-bold small text-muted">Xem theo người dùng</label>
                                        <select className="form-select modern-input mb-3" value={selectedActivityUserId} onChange={(e) => setSelectedActivityUserId(e.target.value)}>
                                            <option value="">Tất cả người dùng</option>
                                            {users.map((u) => (
                                                <option key={u.id} value={u.id}>{u.fullName} ({u.email})</option>
                                            ))}
                                        </select>
                                        <label className="form-label fw-bold small text-muted">Từ khóa hoạt động</label>
                                        <input
                                            className="form-control modern-input mb-3"
                                            placeholder="Tìm theo nội dung, actor, target hoặc email..."
                                            value={activityFilters.keyword}
                                            onChange={(e) => setActivityFilters((prev) => ({ ...prev, keyword: e.target.value }))}
                                        />
                                        <label className="form-label fw-bold small text-muted">Loại hoạt động</label>
                                        <select className="form-select modern-input mb-3" value={activityFilters.type} onChange={(e) => setActivityFilters((prev) => ({ ...prev, type: e.target.value }))}>
                                            <option value="ALL">Tất cả loại</option>
                                            {activityTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                                        </select>
                                        <label className="form-label fw-bold small text-muted">Thời gian</label>
                                        <select className="form-select modern-input mb-3" value={activityFilters.period} onChange={(e) => setActivityFilters((prev) => ({ ...prev, period: e.target.value }))}>
                                            <option value="ALL">Toàn bộ dữ liệu đã tải</option>
                                            <option value="TODAY">Hôm nay</option>
                                            <option value="LAST_7_DAYS">7 ngày gần đây</option>
                                            <option value="LAST_30_DAYS">30 ngày gần đây</option>
                                        </select>
                                        <button type="button" className="btn btn-light border rounded-pill px-3 fw-bold w-100 mb-3" onClick={handleResetActivityFilters}>
                                            Đặt lại bộ lọc hoạt động
                                        </button>
                                        <div className="small text-muted">
                                            Admin có thể xem các hoạt động quan trọng của user như đăng nhập, đổi mật khẩu, reset mật khẩu, khóa/mở khóa, cập nhật tài khoản, task và bình luận.
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="col-12 col-xl-8">
                                <div className="modern-card h-100">
                                    <div className="modern-card-header d-flex justify-content-between align-items-center">
                                        <span>Lịch sử hoạt động người dùng</span>
                                        <span className="badge bg-light text-dark border">{filteredActivityEntries.length} sự kiện</span>
                                    </div>
                                    <div className="card-body p-4 bg-light">
                                        {activityLoading ? (
                                            <div className="text-center text-muted py-5">Đang tải hoạt động...</div>
                                        ) : activityError ? (
                                            <div className="alert alert-danger mb-0">{activityError}</div>
                                        ) : filteredActivityEntries.length === 0 ? (
                                            <div className="text-center text-muted py-5"><i className="bi bi-clock-history fs-1 d-block mb-2"></i>Chưa có hoạt động nào để hiển thị.</div>
                                        ) : (
                                            <div className="d-flex flex-column gap-3">
                                                {filteredActivityEntries.map((entry) => (
                                                    <div key={entry.id} className="bg-white rounded-4 shadow-sm border p-3">
                                                        <div className="d-flex justify-content-between align-items-start gap-3 mb-2">
                                                            <div>
                                                                <div className="fw-bold text-dark">{entry.message}</div>
                                                                <div className="small text-muted mt-1">
                                                                    Actor: {entry.actorName || entry.actorEmail || 'Hệ thống'}{entry.targetUserName ? ` • Target: ${entry.targetUserName}` : ''}
                                                                </div>
                                                            </div>
                                                            <span className="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25">{entry.type}</span>
                                                        </div>
                                                        <div className="d-flex justify-content-between align-items-center">
                                                            <div className="small text-muted">{formatActivityTime(entry.createdAt)}</div>
                                                            {['USER_LOCKED', 'USER_UNLOCKED', 'USER_APPROVED', 'USER_REJECTED', 'USER_UPDATED', 'PROMOTED_TO_MANAGER', 'DEPARTMENT_TRANSFERRED', 'USER_DELETED'].includes(entry.type) && (
                                                                <button
                                                                    className="btn btn-sm btn-outline-primary rounded-pill px-3 py-1 fw-bold animate-pulse-subtle shadow-sm"
                                                                    style={{ fontSize: '0.75rem' }}
                                                                    onClick={(e) => { e.stopPropagation(); handleUndoActivity(entry.id); }}
                                                                >
                                                                    <i className="bi bi-arrow-counterclockwise me-1"></i>Hoàn tác
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'departments' && (
                        <div className="row g-4">
                            <div className="col-12 col-md-4">
                                <div className="modern-card mb-4 h-100">
                                    <div className="modern-card-header">Tạo Phòng Ban Mới</div>
                                    <div className="card-body p-4 bg-white">
                                        <form onSubmit={handleAddDept}>
                                            <input className="form-control modern-input mb-3" placeholder="Tên phòng ban" required value={newDept.name} onChange={e => setNewDept({ ...newDept, name: e.target.value })} />
                                            <textarea className="form-control modern-input mb-4" placeholder="Mô tả" rows="4" value={newDept.description} onChange={e => setNewDept({ ...newDept, description: e.target.value })}></textarea>
                                            <button className="modern-btn-primary w-100">➕ Thêm Phòng Ban</button>
                                        </form>
                                    </div>
                                </div>
                            </div>
                            <div className="col-12 col-md-8">
                                <div className="modern-card h-100">
                                    <div className="modern-card-header">Danh sách Phòng Ban</div>
                                    <div className="card-body p-4 bg-light overflow-auto">
                                        <div className="row g-3">
                                            {departments.map(d => (
                                                <div key={d.id} className="col-md-6 text-dark">
                                                    <div className="modern-card p-4 h-100 border border-1 border-opacity-10 shadow-sm d-flex flex-column">
                                                        <div className="d-flex justify-content-between align-items-start mb-2">
                                                            <h6 className="fw-bold mb-0 text-primary-dark"><i className="bi bi-building me-2 text-primary"></i>{formatDeptName(d.name)}</h6>
                                                            <div className="d-flex gap-1" style={{ marginTop: '-4px' }}>
                                                                <button className="btn btn-sm text-success hover-text-success p-1 border-0 me-1" title="Thêm nhân viên vào phòng" onClick={(e) => { e.stopPropagation(); handleOpenDeptMemberModal(d); }}><i className="bi bi-person-plus-fill fs-6"></i></button>
                                                                <button className="btn btn-sm text-primary hover-text-primary p-1 border-0" title="Sửa thông tin phòng" onClick={(e) => { e.stopPropagation(); handleEditDepartment(d); }}><i className="bi bi-pencil-square fs-6"></i></button>
                                                                <button className="btn btn-sm text-danger text-opacity-75 hover-text-danger p-1 border-0" title="Xóa phòng ban" onClick={(e) => { e.stopPropagation(); handleDeleteDepartment(d.id); }}><i className="bi bi-trash-fill fs-6"></i></button>
                                                            </div>
                                                        </div>
                                                        <p className="text-muted small mb-3 flex-grow-1">{d.description || 'Chưa có mô tả'}</p>
                                                        <div className="mt-auto pt-3 border-top border-1 border-primary border-opacity-10">
                                                            <div className="d-flex justify-content-between align-items-center mb-2">
                                                                <div className="text-muted small fw-bold">
                                                                    <i className="bi bi-people-fill text-primary text-opacity-75 me-1"></i>
                                                                    {users.filter(u => u.department?.id === d.id).length} nhân sự
                                                                </div>
                                                                <button
                                                                    className="btn btn-sm btn-light border rounded-pill px-3 fw-bold text-primary shadow-sm"
                                                                    style={{ fontSize: '0.75rem' }}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setSelectedDeptForPersonnel(d);
                                                                        setShowDeptPersonnelModal(true);
                                                                    }}
                                                                >
                                                                    <i className="bi bi-eye-fill me-1"></i> Xem danh sách
                                                                </button>
                                                            </div>
                                                            <div className="d-flex align-items-center bg-light p-2 rounded border">
                                                                <div className="bg-primary bg-opacity-10 text-primary rounded-circle d-flex align-items-center justify-content-center me-2" style={{ width: 32, height: 32 }}>
                                                                    <i className="bi bi-person-badge-fill"></i>
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <div className="small fw-bold text-dark text-truncate" style={{ fontSize: '0.8rem' }}>Trưởng phòng</div>
                                                                    <div className="small text-muted text-truncate" style={{ fontSize: '0.85rem' }}>
                                                                        {d.manager ? d.manager.fullName : <span className="fst-italic">Chưa có trưởng phòng</span>}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                            {departments.length === 0 && <div className="col-12 text-center text-muted py-4">Chưa có phòng ban nào.</div>}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'projects' && (
                        <div className="row g-4">
                            <div className="col-12 col-xl-3">
                                <div className="modern-card h-100" style={{ minHeight: '600px' }}>
                                    <div className="modern-card-header bg-white text-dark border-bottom">Chọn Phòng Ban</div>
                                    <div className="list-group shadow-none border-0 overflow-hidden rounded-0">
                                        <button
                                            className={`list-group-item list-group-item-action py-3 d-flex justify-content-between align-items-center ${!selectedDept ? 'bg-primary bg-opacity-10 border-start border-primary border-4' : ''}`}
                                            onClick={() => { setSelectedDept(null); setShowProjectForm(false); }}
                                        >
                                            <div className="d-flex align-items-center">
                                                <i className="bi bi-globe-americas me-2 text-primary fs-5"></i>
                                                <span className="fw-bold text-dark">Tất cả dự án</span>
                                            </div>
                                            {!selectedDept ? <i className="bi bi-chevron-right text-primary fw-bold"></i> : <i className="bi bi-chevron-right text-muted"></i>}
                                        </button>

                                        {departments.map(d => (
                                            <button key={d.id} className={`list-group-item list-group-item-action py-3 d-flex justify-content-between align-items-center ${selectedDept?.id === d.id ? 'bg-primary bg-opacity-10 border-start border-primary border-4' : ''}`} onClick={() => { setSelectedDept(d); setShowProjectForm(false); }}>
                                                <div className="d-flex align-items-center">
                                                    <i className="bi bi-building me-2 text-primary opacity-75 fs-5"></i>
                                                    <div className="fw-bold text-dark">{formatDeptName(d.name)}</div>
                                                </div>
                                                {selectedDept?.id === d.id ? <i className="bi bi-chevron-right text-primary fw-bold"></i> : <i className="bi bi-chevron-right text-muted"></i>}
                                            </button>
                                        ))}
                                        {departments.length === 0 && <div className="text-center text-muted p-4 small">Hãy tạo phòng ban trước.</div>}
                                    </div>
                                </div>
                            </div>
                            <div className="col-12 col-xl-9">
                                <div className="modern-card d-flex flex-column h-100" style={{ minHeight: '600px' }}>
                                    {(() => {
                                        const projectsToDisplay = selectedDept ? getProjectsByDept(selectedDept.id) : projects.filter(p => !p.isDeleted);
                                        return (
                                            <>
                                                <div className="modern-card-header d-flex justify-content-between align-items-center">
                                                    <div className="d-flex align-items-center">
                                                        <span className="fw-bold text-dark">
                                                            {selectedDept ? `📂 Dự án: ${formatDeptName(selectedDept.name)}` : `🌍 Tất cả dự án (${projectsToDisplay.length})`}
                                                        </span>
                                                    </div>
                                                    <div className="d-flex align-items-center gap-2">
                                                        <div className="btn-group btn-group-sm bg-white shadow-sm rounded" style={{ border: '1px solid #e2e8f0' }}>
                                                            <button className={`btn ${projectViewMode === 'grid' ? 'btn-primary text-white' : 'btn-light text-muted'}`} onClick={() => setProjectViewMode('grid')} title="Dạng thẻ (Grid)"><i className="bi bi-grid-fill"></i></button>
                                                            <button className={`btn ${projectViewMode === 'table' ? 'btn-primary text-white' : 'btn-light text-muted'}`} onClick={() => setProjectViewMode('table')} title="Dạng bảng (Table)"><i className="bi bi-list-ul"></i></button>
                                                        </div>
                                                        {selectedDept && (
                                                            <button className="btn btn-sm btn-success fw-bold shadow-sm rounded-pill px-3" onClick={() => setShowProjectForm(!showProjectForm)}>{showProjectForm ? 'Hủy' : '➕ Thêm Dự Án'}</button>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="card-body p-4 bg-light">
                                                    {selectedDept && showProjectForm && (
                                                        <div className="modern-card mb-4 border border-primary border-opacity-25 shadow-sm">
                                                            <div className="modern-card-header bg-primary bg-opacity-10 text-primary-dark d-flex align-items-center">
                                                                <i className="bi bi-file-earmark-plus-fill me-2 text-primary"></i>
                                                                <span>Khởi tạo Dự án mới</span>
                                                            </div>
                                                            <div className="card-body p-4 bg-white">
                                                                <form onSubmit={handleAddProject}>
                                                                    <div className="mb-4">
                                                                        <label className="form-label fw-bold text-dark mb-2">Tên dự án <span className="text-danger">*</span></label>
                                                                        <input className="form-control modern-input w-100" placeholder="VD: Nâng cấp hệ thống Backend..." required value={newProject.name} onChange={e => setNewProject({ ...newProject, name: e.target.value })} />
                                                                    </div>
                                                                    <div className="row mb-4">
                                                                        <div className="col-12 col-md-4 mb-3 mb-md-0">
                                                                            <label className="form-label fw-bold text-dark mb-2">Bắt đầu <span className="text-danger">*</span></label>
                                                                            <input type="date" className="form-control modern-input w-100" required value={newProject.startDate} onChange={e => setNewProject({ ...newProject, startDate: e.target.value })} />
                                                                        </div>
                                                                        <div className="col-12 col-md-4 mb-3 mb-md-0">
                                                                            <label className="form-label fw-bold text-dark mb-2">Hạn chót <span className="text-danger">*</span></label>
                                                                            <input type="date" className="form-control modern-input w-100" required value={newProject.deadline} onChange={e => setNewProject({ ...newProject, deadline: e.target.value })} />
                                                                        </div>
                                                                        <div className="col-12 col-md-4">
                                                                            <label className="form-label fw-bold text-dark mb-2">Mức độ ưu tiên <span className="text-danger">*</span></label>
                                                                            <select className="form-select modern-input w-100" value={newProject.priority} onChange={e => setNewProject({ ...newProject, priority: e.target.value })}>
                                                                                <option value="LOW">🔵 Ưu tiên Thấp</option>
                                                                                <option value="MEDIUM">🟡 Ưu tiên Trung bình</option>
                                                                                <option value="HIGH">🔴 Ưu tiên Cao</option>
                                                                            </select>
                                                                        </div>
                                                                    </div>

                                                                    <div className="mb-4">
                                                                        <label className="form-label fw-bold text-dark mb-2">Mô tả/Mục tiêu dự án</label>
                                                                        <textarea className="form-control modern-input w-100" rows="3" placeholder="Nhập chi tiết về mục tiêu, yêu cầu..." value={newProject.description} onChange={e => setNewProject({ ...newProject, description: e.target.value })} />
                                                                    </div>
                                                                    <button className="modern-btn-primary w-100 py-2 d-flex justify-content-center align-items-center">
                                                                        <i className="bi bi-cloud-arrow-up-fill me-2 mb-0 fs-5"></i>
                                                                        <span className="fw-bold">Khởi tạo và Lưu Dự Án</span>
                                                                    </button>
                                                                </form>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {projectsToDisplay.length === 0 && !showProjectForm && <div className="text-center text-muted py-5">Không có dự án nào đang thực hiện.</div>}
                                                    {projectsToDisplay.length > 0 && (
                                                        projectViewMode === 'grid' ? (
                                                            <div className="row g-3">
                                                                {projectsToDisplay.map(p => (
                                                                    <div key={p.id} className="col-12 col-md-6 col-xxl-4">
                                                                        <div className="modern-card p-4 h-100 d-flex flex-column shadow-sm border-0 border-start border-4 border-primary transition-hover text-dark position-relative">
                                                                            <div className="d-flex justify-content-between align-items-start mb-3">
                                                                                <div>
                                                                                    <h5 className="fw-bold text-primary-dark mb-1">{p.name}</h5>
                                                                                    <span className={`badge ${p.priority === 'HIGH' ? 'bg-danger text-white' : p.priority === 'LOW' ? 'bg-info text-dark' : 'bg-warning text-dark'} rounded-pill px-3 py-1 shadow-sm mb-2 me-2`}>
                                                                                        <i className="bi bi-flag-fill me-1"></i>{p.priority}
                                                                                    </span>
                                                                                    <span className={`badge ${getProjectTimeStatus(p).color} rounded-pill px-3 py-1 shadow-sm mb-2`}>
                                                                                        {getProjectTimeStatus(p).text}
                                                                                    </span>
                                                                                </div>
                                                                                <div>
                                                                                    <button
                                                                                        className="btn btn-sm text-primary text-opacity-75 hover-text-primary border-0 p-0 fs-5 lh-1 me-2"
                                                                                        title="Sửa dự án"
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            handleEditProject(p);
                                                                                        }}
                                                                                    >
                                                                                        <i className="bi bi-pencil-square"></i>
                                                                                    </button>
                                                                                    <button
                                                                                        className="btn btn-sm text-danger text-opacity-50 hover-text-danger border-0 p-0 fs-5 lh-1"
                                                                                        title="Xóa dự án"
                                                                                        onClick={async (e) => {
                                                                                            e.stopPropagation();
                                                                                            if (await askConfirm('Xóa dự án này (Soft Delete)?')) {
                                                                                                api.delete(`/projects/${p.id}?adminEmail=${currentUser.email}`).then(() => {
                                                                                                    fetchData();
                                                                                                    alert('Dự án đã được xóa!');
                                                                                                }).catch(err => alert('Lỗi xóa: ' + err.message));
                                                                                            }
                                                                                        }}
                                                                                    >
                                                                                        <i className="bi bi-trash-fill"></i>
                                                                                    </button>
                                                                                </div>
                                                                            </div>

                                                                            <div className="bg-light p-3 rounded-3 mb-3 border border-1 flex-grow-1">
                                                                                <div className="d-flex justify-content-between mb-1">
                                                                                    <span className="text-muted small fw-bold"><i className="bi bi-info-circle me-1"></i>Mô tả:</span>
                                                                                    {p.documentLink && (
                                                                                        <a href={resolveAppUrl(p.documentLink)} target="_blank" rel="noopener noreferrer" className="badge bg-primary text-decoration-none" title="Tài liệu đính kèm" onClick={e => e.stopPropagation()}>
                                                                                            <i className="bi bi-link-45deg"></i> Link
                                                                                        </a>
                                                                                    )}
                                                                                </div>
                                                                                <p className="mb-0 text-dark" style={{ fontSize: '0.85rem' }}>{p.description || 'Chưa có thông tin...'}</p>
                                                                            </div>

                                                                            <div className="d-flex justify-content-between align-items-center pt-2 border-top mt-auto">
                                                                                <div className="text-muted small" style={{ fontSize: '0.75rem' }}>
                                                                                    <i className="bi bi-calendar-check text-success me-1"></i>
                                                                                    <span className="fw-bold text-dark text-nowrap">
                                                                                        {p.startDate ? new Date(p.startDate).toLocaleDateString('vi-VN') : '--'}
                                                                                        {' > '}
                                                                                        {p.deadline ? new Date(p.deadline).toLocaleDateString('vi-VN') : '--'}
                                                                                    </span>
                                                                                </div>
                                                                                <div className="text-muted small" style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); handleOpenMemberModal(p); }} title="Thêm/Xem Nhân Viên">
                                                                                    <i className="bi bi-people-fill text-primary me-1"></i> <span className="fw-bold text-dark">{p.members?.length || 0}</span>
                                                                                    <i className="bi bi-person-plus-fill ms-1 text-success"></i>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <div className="table-responsive bg-white rounded-3 shadow-sm border">
                                                                <table className="table table-hover align-middle mb-0">
                                                                    <thead className="table-light">
                                                                        <tr>
                                                                            <th>Tên Dự Án</th>
                                                                            <th>Ưu tiên</th>
                                                                            <th>Tiến độ</th>
                                                                            <th>Nhân sự</th>
                                                                            <th className="text-end pe-4">Hành động</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {projectsToDisplay.map(p => (
                                                                            <tr key={p.id}>
                                                                                <td>
                                                                                    <div className="fw-bold text-primary-dark">{p.name}</div>
                                                                                    <div className="text-muted small text-truncate" style={{ maxWidth: '200px' }} title={p.description}>{p.description}</div>
                                                                                </td>
                                                                                <td>
                                                                                    <span className={`badge ${p.priority === 'HIGH' ? 'bg-danger text-white' : p.priority === 'LOW' ? 'bg-info text-dark' : 'bg-warning text-dark'} rounded-pill`}><i className="bi bi-flag-fill me-1"></i>{p.priority}</span>
                                                                                </td>
                                                                                <td>
                                                                                    <div className="small text-nowrap mb-1">
                                                                                        <span className="text-muted">{p.startDate ? new Date(p.startDate).toLocaleDateString('vi-VN') : '--'}</span>
                                                                                        <i className="bi bi-arrow-right mx-1 text-primary"></i>
                                                                                        <span className="fw-bold text-dark">{p.deadline ? new Date(p.deadline).toLocaleDateString('vi-VN') : '---'}</span>
                                                                                    </div>
                                                                                    <span className={`badge ${getProjectTimeStatus(p).color} rounded-pill px-2 py-1 shadow-sm`}>
                                                                                        {getProjectTimeStatus(p).text}
                                                                                    </span>
                                                                                </td>
                                                                                <td>
                                                                                    <span className="badge bg-light text-dark border px-2 py-1" style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); handleOpenMemberModal(p); }} title="Thêm/Xem Nhân Viên">
                                                                                        <i className="bi bi-people-fill text-primary me-1"></i>{p.members?.length || 0}
                                                                                        <i className="bi bi-person-plus-fill ms-2 text-success"></i>
                                                                                    </span>
                                                                                </td>
                                                                                <td className="text-end pe-4">
                                                                                    {p.documentLink && (
                                                                                        <a href={resolveAppUrl(p.documentLink)} target="_blank" rel="noopener noreferrer" className="btn btn-sm text-primary hover-text-primary border-0 p-1 me-1" title="Mở link tài liệu" onClick={e => e.stopPropagation()}>
                                                                                            <i className="bi bi-link-45deg fs-5"></i>
                                                                                        </a>
                                                                                    )}
                                                                                    <button className="btn btn-sm text-primary text-opacity-75 hover-text-primary border-0 p-1 me-1" title="Sửa" onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        handleEditProject(p);
                                                                                    }}><i className="bi bi-pencil-square fs-5"></i></button>
                                                                                    <button className="btn btn-sm text-danger text-opacity-75 hover-text-danger border-0 p-1" title="Xóa" onClick={async (e) => {
                                                                                        e.stopPropagation();
                                                                                        if (await askConfirm('Xóa dự án này?')) {
                                                                                            api.delete(`/projects/${p.id}?adminEmail=${currentUser.email}`).then(() => fetchData()).catch(err => alert('Lỗi: ' + err.message));
                                                                                        }
                                                                                    }}><i className="bi bi-trash-fill fs-5"></i></button>
                                                                                </td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        )
                                                    )}
                                                </div>
                                            </>
                                        );
                                    })()}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'completed' && (
                        <div className="row">
                            <div className="col-12">
                                <h4 className="fw-bold text-success mb-4"><i className="bi bi-check-all me-2"></i>Dự án đã hoàn thành (CLOSED)</h4>
                                {departments.map(dept => {
                                    const deptCompletedProjects = getCompletedProjectsByDept(dept.id);
                                    if (deptCompletedProjects.length === 0) return null;
                                    return (
                                        <div key={dept.id} className="modern-card mb-4">
                                            <div className="modern-card-header bg-success text-white fw-bold d-flex align-items-center"><i className="bi bi-building me-2"></i>{dept.name}</div>
                                            <div className="card-body bg-light p-4">
                                                <div className="row g-4">
                                                    {deptCompletedProjects.map(p => (
                                                        <div key={p.id} className="col-md-6 col-lg-3">
                                                            <div className="modern-card h-100 hover-shadow border-0" style={{ cursor: 'pointer' }} onClick={() => setViewingCompletedProject(p)}>
                                                                <div className="card-body p-4">
                                                                    <div className="d-flex justify-content-between mb-3"><span className="badge bg-secondary rounded-pill px-3 py-2">🔒 CLOSED</span><small className="text-muted fw-bold">{p.deadline}</small></div>
                                                                    <h6 className="fw-bold text-primary-dark mb-2">{p.name}</h6>
                                                                    <p className="text-muted small text-truncate mb-4">{p.description}</p>
                                                                    <div className="d-flex justify-content-between border-top pt-3"><small className="text-muted fw-bold">{p.members?.length || 0} thành viên</small><span className="text-success small fw-bold">Chi tiết &rarr;</span></div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                                {completedProjects.length === 0 && <div className="text-center py-5 text-muted">Chưa có dự án nào hoàn thành.</div>}
                            </div>
                        </div>
                    )}

                    {activeTab === 'deleted' && (
                        <div className="row">
                            <div className="col-12">
                                <h4 className="fw-bold text-warning mb-4"><i className="bi bi-trash me-2"></i>Dự án đã xóa (Thùng rác)</h4>
                                {departments.map(dept => {
                                    const deptDeletedProjects = deletedProjects.filter(p => p.department?.id === dept.id);
                                    if (deptDeletedProjects.length === 0) return null;
                                    return (
                                        <div key={dept.id} className="modern-card mb-4">
                                            <div className="modern-card-header bg-warning text-dark fw-bold d-flex align-items-center"><i className="bi bi-building me-2"></i>{dept.name}</div>
                                            <div className="card-body bg-light p-4">
                                                <div className="row g-4">
                                                    {deptDeletedProjects.map(p => (
                                                        <div key={p.id} className="col-md-6 col-lg-3">
                                                            <div className="modern-card h-100">
                                                                <div className="card-body p-4">
                                                                    <div className="d-flex justify-content-between mb-3">
                                                                        <span className="badge bg-danger rounded-pill px-3 py-2">🗑️ ĐÃ XÓA</span>
                                                                        <small className="text-muted fw-bold">{p.deletedAt}</small>
                                                                    </div>
                                                                    <h6 className="fw-bold text-primary-dark mb-2">{p.name}</h6>
                                                                    <p className="text-muted small mb-4">{p.description}</p>
                                                                    <button
                                                                        className="modern-btn-primary bg-success w-100 mt-2"
                                                                        style={{ background: 'linear-gradient(135deg, #20c997 0%, #198754 100%)' }}
                                                                        onClick={async () => {
                                                                            if (await askConfirm('Khôi phục dự án này?', false)) {
                                                                                try {
                                                                                    await api.post(`/projects/${p.id}/restore`, null, {
                                                                                        params: { adminEmail: currentUser.email }
                                                                                    });
                                                                                    fetchData();
                                                                                    alert('Đã khôi phục!');
                                                                                } catch (err) {
                                                                                    alert('Lỗi: ' + err.message);
                                                                                }
                                                                            }
                                                                        }}
                                                                    >
                                                                        🔄 Khôi phục
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                                {deletedProjects.length === 0 && <div className="text-center py-5 text-muted">Chưa có dự án nào trong thùng rác.</div>}
                            </div>
                        </div>
                    )}


                    {showDeptMemberModal && selectedDeptForMember && (
                        <div className="modal-backdrop-custom">
                            <div className="card shadow-lg border-0" style={{ width: 500, borderRadius: '1rem', overflow: 'hidden' }}>
                                <div className="card-header bg-success p-4 border-0 text-white d-flex flex-column position-relative">
                                    <button className="btn-close btn-close-white position-absolute top-0 end-0 m-3" onClick={() => setShowDeptMemberModal(false)}></button>
                                    <h5 className="fw-bold mb-1">Thêm nhân sự mới</h5>
                                    <span className="text-white text-opacity-75 small">Vào phòng: {formatDeptName(selectedDeptForMember.name)}</span>
                                </div>
                                <div className="card-body p-0">
                                    {availableDeptMembers.length > 0 ? (
                                        <div className="d-flex flex-column h-100">
                                            <div className="list-group list-group-flush custom-scrollbar" style={{ maxHeight: '350px', overflowY: 'auto' }}>
                                                {availableDeptMembers.map(u => (
                                                    <button
                                                        key={u.id}
                                                        type="button"
                                                        className={`list-group-item list-group-item-action p-3 border-0 border-bottom d-flex align-items-center ${selectedDeptMembersToAdd.includes(u.id) ? 'bg-success bg-opacity-10' : ''}`}
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            if (selectedDeptMembersToAdd.includes(u.id)) {
                                                                setSelectedDeptMembersToAdd(selectedDeptMembersToAdd.filter(id => id !== u.id));
                                                            } else {
                                                                setSelectedDeptMembersToAdd([...selectedDeptMembersToAdd, u.id]);
                                                            }
                                                        }}
                                                    >
                                                        <div className="flex-shrink-0 me-3">
                                                            {u.avatarUrl ? (
                                                                <img src={u.avatarUrl} alt={u.fullName} className="rounded-circle shadow-sm border border-2 border-white" style={{ width: 48, height: 48, objectFit: 'cover' }} />
                                                            ) : (
                                                                <div className="bg-success bg-opacity-25 text-success rounded-circle d-flex align-items-center justify-content-center fw-bold shadow-sm border border-2 border-white" style={{ width: 48, height: 48, fontSize: '1.2rem' }}>
                                                                    {u.fullName.charAt(0).toUpperCase()}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="flex-grow-1 min-w-0">
                                                            <div className="fw-bold text-dark text-truncate mb-1">{u.fullName}</div>
                                                            <div className="text-muted small text-truncate d-flex align-items-center mb-1">
                                                                <i className="bi bi-envelope me-1"></i> {u.email}
                                                            </div>
                                                            {u.department ?
                                                                <span className="badge bg-secondary bg-opacity-10 text-secondary border border-secondary border-opacity-25 fw-normal" style={{ fontSize: '0.7rem' }}>
                                                                    <i className="bi bi-building me-1"></i>Đang ở: {formatDeptName(u.department.name)}
                                                                </span> :
                                                                <span className="badge bg-light text-muted border fw-normal" style={{ fontSize: '0.7rem' }}>
                                                                    <i className="bi bi-question-circle me-1"></i>Chưa có phòng
                                                                </span>
                                                            }
                                                        </div>
                                                        {selectedDeptMembersToAdd.includes(u.id) && (
                                                            <div className="ms-3 text-success ps-3 border-start border-success border-2">
                                                                <i className="bi bi-check-circle-fill fs-3"></i>
                                                            </div>
                                                        )}
                                                    </button>
                                                ))}
                                            </div>
                                            <div className="p-3 border-top bg-light mt-auto">
                                                <button className="btn btn-success w-100 py-2 fs-6 fw-bold shadow-sm rounded-pill" onClick={handleAddMemberToDept} disabled={selectedDeptMembersToAdd.length === 0}>
                                                    <i className="bi bi-person-plus-fill me-2"></i> Xác nhận chuyển phòng
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-center py-5 text-muted">
                                            <i className="bi bi-people-fill fs-1 d-block mb-3 opacity-25 text-success"></i>
                                            Tất cả nhân viên hệ thống đều đã tham gia phòng ban này.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {showMemberModal && selectedProjectForMember && (
                        <div className="modal-backdrop-custom">
                            <div className="card shadow-lg border-0" style={{ width: 500, borderRadius: '1rem', overflow: 'hidden' }}>
                                <div className="card-header bg-primary p-4 border-0 text-white d-flex flex-column position-relative">
                                    <button className="btn-close btn-close-white position-absolute top-0 end-0 m-3" onClick={() => setShowMemberModal(false)}></button>
                                    <h5 className="fw-bold mb-1">Thêm nhân sự mới</h5>
                                    <span className="text-white text-opacity-75 small">Vào dự án: {selectedProjectForMember.name}</span>
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
                                                            if (selectedMembersToAdd.includes(u.id)) {
                                                                setSelectedMembersToAdd(selectedMembersToAdd.filter(id => id !== u.id));
                                                            } else {
                                                                setSelectedMembersToAdd([...selectedMembersToAdd, u.id]);
                                                            }
                                                        }}
                                                    >
                                                        <div className="flex-shrink-0 me-3">
                                                            {u.avatarUrl ? (
                                                                <img src={u.avatarUrl} alt={u.fullName} className="rounded-circle shadow-sm border border-2 border-white" style={{ width: 48, height: 48, objectFit: 'cover' }} />
                                                            ) : (
                                                                <div className="bg-primary bg-opacity-25 text-primary rounded-circle d-flex align-items-center justify-content-center fw-bold shadow-sm border border-2 border-white" style={{ width: 48, height: 48, fontSize: '1.2rem' }}>
                                                                    {u.fullName.charAt(0).toUpperCase()}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="flex-grow-1 min-w-0">
                                                            <div className="fw-bold text-dark text-truncate mb-1">{u.fullName}</div>
                                                            <div className="text-muted small text-truncate d-flex align-items-center mb-1">
                                                                <i className="bi bi-envelope me-1"></i> {u.email}
                                                            </div>
                                                            {u.department ?
                                                                <span className="badge bg-secondary bg-opacity-10 text-secondary border border-secondary border-opacity-25 fw-normal" style={{ fontSize: '0.7rem' }}>
                                                                    <i className="bi bi-building me-1"></i>Phòng: {formatDeptName(u.department.name)}
                                                                </span> :
                                                                <span className="badge bg-light text-muted border fw-normal" style={{ fontSize: '0.7rem' }}>
                                                                    <i className="bi bi-question-circle me-1"></i>Chưa có phòng
                                                                </span>
                                                            }
                                                        </div>
                                                        {selectedMembersToAdd.includes(u.id) && (
                                                            <div className="ms-3 text-primary ps-3 border-start border-primary border-2">
                                                                <i className="bi bi-check-circle-fill fs-3"></i>
                                                            </div>
                                                        )}
                                                    </button>
                                                ))}
                                            </div>
                                            <div className="p-3 border-top bg-light mt-auto">
                                                <button className="btn btn-primary w-100 py-2 fs-6 fw-bold shadow-sm rounded-pill" onClick={handleAddMemberToProject} disabled={selectedMembersToAdd.length === 0}>
                                                    <i className="bi bi-person-plus-fill me-2"></i> Xác nhận & Thêm vào
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-center py-5 text-muted">
                                            <i className="bi bi-people-fill fs-1 d-block mb-3 opacity-25 text-primary"></i>
                                            Tất cả nhân viên hệ thống đều đã tham gia dự án này.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {viewingCompletedProject && (
                        <div className="modal-backdrop-custom">
                            <div className="modern-card shadow-lg" style={{ width: 600, maxHeight: '80vh', overflowY: 'auto' }}>
                                <div className="modern-card-header bg-success text-white fw-bold d-flex justify-content-between align-items-center"><span>Chi tiết dự án: {viewingCompletedProject.name}</span><button className="btn-close btn-close-white" onClick={() => setViewingCompletedProject(null)}></button></div>
                                <div className="card-body p-5">
                                    <p className="text-muted fst-italic fs-5">{viewingCompletedProject.description}</p><hr className="my-4" />
                                    <h6 className="fw-bold text-success mb-3"><i className="bi bi-people-fill me-2"></i>Thành viên tham gia</h6>
                                    <div className="d-flex flex-wrap gap-2 mb-4">{viewingCompletedProject.members?.map(m => (<span key={m.id} className="badge bg-light text-dark border p-2 px-3 rounded-pill shadow-sm">{m.fullName}</span>))}</div>
                                    <h6 className="fw-bold text-success mb-3"><i className="bi bi-list-check me-2"></i>Tổng kết</h6>
                                    <div className="alert alert-success fs-6 border-0 shadow-sm rounded-4">Dự án này đã được Quản trị viên đóng lại.<br /><strong className="mt-2 d-block">Ngày hết hạn:</strong> {viewingCompletedProject.deadline}</div>
                                    <button className="btn btn-secondary w-100 rounded-pill fw-bold py-2 mt-3" onClick={() => setViewingCompletedProject(null)}>Đóng</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {showDeptPersonnelModal && selectedDeptForPersonnel && (
                        <div className="modal-backdrop-custom">
                            <div className="modern-card shadow-lg animate-fade-in" style={{ width: '100%', maxWidth: '550px', borderRadius: '1.25rem', overflow: 'hidden' }}>
                                <div className="bg-primary p-4 text-white position-relative">
                                    <h5 className="fw-bold mb-1 text-white">Thành viên phòng ban</h5>
                                    <p className="small mb-0 text-white-50">{formatDeptName(selectedDeptForPersonnel.name)}</p>
                                    <button className="btn-close btn-close-white position-absolute top-0 end-0 m-4" onClick={() => setShowDeptPersonnelModal(false)}></button>
                                </div>
                                <div className="p-0">
                                    <div className="list-group list-group-flush custom-scrollbar" style={{ maxHeight: '450px', overflowY: 'auto' }}>
                                        {users.filter(u => u.department?.id === selectedDeptForPersonnel.id).length > 0 ? (
                                            users.filter(u => u.department?.id === selectedDeptForPersonnel.id).map(user => (
                                                <div key={user.id} className="list-group-item p-3 border-0 border-bottom d-flex align-items-center justify-content-between hover-bg-light transition">
                                                    <div className="d-flex align-items-center">
                                                        <div className="flex-shrink-0 me-3">
                                                            {user.avatarUrl ? (
                                                                <img src={user.avatarUrl} alt={user.fullName} className="rounded-circle shadow-sm border border-2 border-white" style={{ width: 45, height: 45, objectFit: 'cover' }} />
                                                            ) : (
                                                                <div className="bg-primary bg-opacity-10 text-primary rounded-circle d-flex align-items-center justify-content-center fw-bold shadow-sm" style={{ width: 45, height: 45, fontSize: '1.1rem' }}>
                                                                    {user.fullName.charAt(0).toUpperCase()}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="fw-bold text-dark text-truncate" style={{ fontSize: '0.95rem' }}>{user.fullName}</div>
                                                            <div className="text-muted small text-truncate"><i className="bi bi-envelope me-1"></i> {user.email}</div>
                                                            <span className={`badge ${user.role === 'ADMIN' ? 'bg-danger' : user.role === 'MANAGER' ? 'bg-warning text-dark' : 'bg-info text-white'} rounded-pill mt-1`} style={{ fontSize: '0.65rem' }}>
                                                                {user.role}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="text-end">
                                                        <button
                                                            className="btn btn-sm btn-outline-primary rounded-pill px-3 fw-bold"
                                                            style={{ fontSize: '0.75rem' }}
                                                            onClick={() => {
                                                                setShowDeptPersonnelModal(false);
                                                                setActiveTab('users');
                                                                handleEditUser(user.id);
                                                            }}
                                                        >
                                                            Chỉnh sửa
                                                        </button>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="text-center py-5 text-muted">
                                                <i className="bi bi-people fs-1 d-block mb-2 opacity-25"></i>
                                                Chưa có nhân viên nào trong phòng này.
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-3 bg-light border-top">
                                        <button className="btn btn-secondary w-100 rounded-pill fw-bold" onClick={() => setShowDeptPersonnelModal(false)}>Đóng</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    <style>{`.bg-blue-light { background-color: #e7f1ff; } .modal-backdrop-custom { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); z-index: 1050; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(5px); } .hover-bg-light:hover { background-color: #f8f9fa; } .transition { transition: all 0.2s ease; }`}</style>
                </div>
            </div>
        </div>
    );
};
export default AdminDashboard;
