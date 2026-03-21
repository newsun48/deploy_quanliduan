import { useEffect, useState, useRef } from "react";
import SockJS from 'sockjs-client';
import { Stomp } from '@stomp/stompjs';
import api from "../api";
import { useNavigate } from "react-router-dom";
import NotificationBell from "../components/NotificationBell";
import TaskDetailModal from "../components/TaskDetailModal";
import ProjectChatPanel from "../components/ProjectChatPanel";
import PrivateChatPanel from "../components/PrivateChatPanel";
import { askConfirm } from "../utils/confirm";
import Swal from "sweetalert2";
import "./AdminDashboard.css";

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

const ManagerDashboard = () => {
  const navigate = useNavigate();
  const stompClientRef = useRef(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [myDepartment, setMyDepartment] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // DATA
  const [deptMembers, setDeptMembers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [allEmployees, setAllEmployees] = useState([]);

  // UI CONTROLS
  const [activeTab, setActiveTab] = useState("DASHBOARD");
  const [selectedProject, setSelectedProject] = useState(null);
  const [projectTab, setProjectTab] = useState("TASKS");

  // MODAL STATE
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [selectedTaskForDetail, setSelectedTaskForDetail] = useState(null);
  const [privateChatUser, setPrivateChatUser] = useState(null);

  // FORMS
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    deadline: "",
    priority: "MEDIUM",
    assigneeId: "",
  });
  const [selectedMembersToAdd, setSelectedMembersToAdd] = useState([]);

  // NEW FOR PROJECT EDIT
  const [showEditProjectModal, setShowEditProjectModal] = useState(false);
  const [editProjectForm, setEditProjectForm] = useState({
    name: "",
    description: "",
    startDate: "",
    deadline: "",
  });
  const [projectDocumentFile, setProjectDocumentFile] = useState(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  useEffect(() => {
    const userJson = localStorage.getItem("user");
    if (!userJson) {
      navigate("/");
      return;
    }
    try {
      const userObj = JSON.parse(userJson);
      fetchManagerInfo(userObj.id);
    } catch (e) {
      console.error(e);
      navigate("/");
    }
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

  const connectWebSocket = (deptId) => {
    const socket = new SockJS('http://localhost:8080/ws');
    const client = Stomp.over(() => socket);
    client.debug = () => {};

    client.connect({}, () => {
      console.log('✅ WebSocket connected for Dashboard updates');
      client.subscribe(`/topic/department/${deptId}/update`, (message) => {
        if (message.body === "REFRESH_PROJECTS") {
          fetchDeptData(deptId);
        }
      });
    }, (error) => {
      console.error('❌ WebSocket Error:', error);
      setTimeout(() => connectWebSocket(deptId), 5000);
    });

    stompClientRef.current = client;
  };

  const fetchManagerInfo = async (userId) => {
    setIsLoading(true);
    try {
      const res = await api.get("/users");
      // Dùng == để so sánh ID (tránh lỗi string vs number)
      const foundUser = res.data.find((u) => u.id == userId);

      if (foundUser) {
        setCurrentUser(foundUser);
        if (foundUser.department) {
          setMyDepartment(foundUser.department);
          await fetchDeptData(foundUser.department.id);
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
        api.get("/users"),
        api.get("/projects"),
      ]);

      // Lấy nhân sự thuộc phòng ban quản lý (Nhân viên, QA, Trưởng phòng) để có thể tham gia dự án
      const staff = usersRes.data.filter((u) => 
        (u.role === "EMPLOYEE" || u.role === "QA" || u.role === "MANAGER") && 
        (u.department && u.department.id == deptId)
      );
      setAllEmployees(staff);

      // Lấy tất cả thành viên thuộc phòng ban (không phân biệt role để khớp với Admin)
      const members = usersRes.data.filter(
        (u) => u.department && u.department.id == deptId,
      );
      setDeptMembers(members);

      // 🔥 SỬA: Lọc dự án (cả dự án tạo bởi deptId hoặc object department)
      setProjects(
        projectsRes.data.filter((p) => {
          const pDeptId = p.deptId || (p.department ? p.department.id : null);
          return pDeptId == deptId;
        }),
      );
    } catch (err) {
      console.error("Lỗi tải dữ liệu phòng:", err);
    }
  };

  const handleSelectProject = async (project) => {
    setSelectedProject(project);
    setActiveTab("PROJECT_DETAIL");
    try {
      const res = await api.get(`/tasks/project/${project.id}`);
      // 🔥 SỬA: Đảm bảo tasks luôn là mảng để tránh crash
      setTasks(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      setTasks([]); // Nếu lỗi thì set rỗng
      console.error(e);
    }
  };

  const handleCompleteProject = async () => {
    if (
      !(await askConfirm(
        "⚠️ CẢNH BÁO: Dự án sẽ chuyển sang trạng thái 'ĐÃ ĐÓNG'. Bạn có chắc chắn không?",
      ))
    )
      return;
    try {
      await api.put(`/projects/${selectedProject.id}/complete`);
      alert("🎉 Chúc mừng! Dự án đã hoàn thành và đóng lại.");
      const updatedProject = { ...selectedProject, status: "CLOSED" };
      setSelectedProject(updatedProject);
      // Cập nhật lại list projects bên ngoài
      setProjects((prev) =>
        prev.map((p) => (p.id === updatedProject.id ? updatedProject : p)),
      );
    } catch (err) {
      alert("Lỗi: " + err.message);
    }
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
        finalDocumentLink = "http://localhost:8080" + uploadRes.data.url;
      } catch (err) {
        alert("Lỗi tải lên tài liệu: " + err.message);
        return;
      }
    }

    const payload = { ...editProjectForm, documentLink: finalDocumentLink };

    try {
      const res = await api.put(
        `/projects/${selectedProject.id}/update`,
        payload,
      );
      alert("✅ Đã cập nhật thông tin dự án!");
      setShowEditProjectModal(false);
      setProjectDocumentFile(null);
      setSelectedProject(res.data);
      setProjects((prev) =>
        prev.map((p) => (p.id === res.data.id ? res.data : p)),
      );
    } catch (err) {
      alert("Lỗi cập nhật: " + (err.response?.data || err.message));
    }
  };

  const openEditProjectModal = () => {
    setEditProjectForm({
      name: selectedProject.name || "",
      description: selectedProject.description || "",
      startDate: selectedProject.startDate || "",
      deadline: selectedProject.deadline || "",
      documentLink: selectedProject.documentLink || "",
    });
    setShowEditProjectModal(true);
  };

  const handleAddMember = async () => {
    if (selectedMembersToAdd.length === 0) {
      alert("Vui lòng chọn ít nhất một nhân viên!");
      return;
    }

    try {
      const response = await api.post(
        `/projects/${selectedProject.id}/add-members`,
        selectedMembersToAdd
      );
      alert(`✅ Đã thêm ${selectedMembersToAdd.length} nhân sự thành công!`);
      setShowMemberModal(false);
      setSelectedMembersToAdd([]);

      // 🔥 CỰC KỲ QUAN TRỌNG: Cập nhật selectedProject ngay với dữ liệu mới từ API
      setSelectedProject(response.data);

      // Reload dữ liệu phòng để cập nhật lại danh sách members khả dụng
      console.log("🔄 Đang reload dữ liệu phòng...");
      await fetchDeptData(myDepartment.id);

      // Reload lại project hiện tại để thấy member mới
      const res = await api.get("/projects");
      const updated = res.data.find((p) => p.id == selectedProject.id);
      if (updated) setSelectedProject(updated);
    } catch (err) {
      console.error("❌ Lỗi thêm member:", err);
      const errorMessage =
        err.response?.data?.message ||
        err.response?.data ||
        err.message ||
        "Thất bại";
      alert("Lỗi: " + errorMessage);
    }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    try {
      await api.post(
        `/tasks/create?projectId=${selectedProject.id}&assigneeId=${newTask.assigneeId}`,
        newTask,
      );
      alert("✅ Giao việc thành công!");
      setShowTaskModal(false);
      setNewTask({
        title: "",
        description: "",
        deadline: "",
        priority: "MEDIUM",
        assigneeId: "",
      });
      const res = await api.get(`/tasks/project/${selectedProject.id}`);
      setTasks(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      alert("Lỗi: " + (err.response?.data || err.message));
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("user");
    navigate("/");
  };

  // --- RENDER ---

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
        <p>
          Tài khoản Manager chưa được gán Phòng ban hoặc không tìm thấy dữ liệu.
        </p>
        <button onClick={handleLogout} className="btn btn-dark btn-sm mt-2">
          Đăng xuất
        </button>
      </div>
    );
  }

  const isProjectClosed = selectedProject?.status === "CLOSED";

  // 🔥 LỌC NHÂN VIÊN ĐỂ THÊM (Loại bỏ người đã có trong dự án)
  // Dùng ?. và || [] để tránh lỗi màn hình trắng nếu project chưa load xong members
  const availableMembers = allEmployees.filter((u) => {
    const currentMembers = selectedProject?.members || [];
    return !currentMembers.some((m) => m.id === u.id);
  });

  return (
    <div className="admin-dashboard-container">
      {/* Header Navbar */}
      <div className="glass-header d-flex justify-content-between align-items-center">
        <div className="d-flex align-items-center" style={{ width: "280px" }}>
          <span className="fs-3 me-2">🚀</span>
          <span className="brand-text d-none d-md-block">MANAGER PRO</span>
        </div>

        <div className="top-menu d-none d-xl-flex justify-content-center">
          <button
            className={`top-menu-item ${activeTab === "DASHBOARD" ? "active" : ""}`}
            onClick={() => setActiveTab("DASHBOARD")}
          >
            <i
              className="bi bi-grid-fill top-menu-icon"
              style={{
                color: activeTab === "DASHBOARD" ? "#4318ff" : "#a3aed1",
              }}
            ></i>{" "}
            Tổng Quan
          </button>
          {activeTab === "PROJECT_DETAIL" && (
            <button className="top-menu-item active">
              <i
                className="bi bi-folder-fill top-menu-icon"
                style={{ color: "#4318ff" }}
              ></i>{" "}
              Chi tiết dự án
            </button>
          )}
        </div>

        <div
          className="d-flex align-items-center justify-content-end gap-3"
          style={{ width: "280px" }}
        >
          <div className="d-none d-md-block">
            <NotificationBell />
          </div>

          <div className="dropdown position-relative ms-2">
            <div
              className="d-flex align-items-center py-1 px-2 rounded-pill shadow-sm"
              style={{
                cursor: "pointer",
                background: showProfileMenu ? "#f4f7fe" : "transparent",
                transition: "all 0.2s",
                border: "1px solid #e2e8f0",
              }}
              onClick={() => setShowProfileMenu(!showProfileMenu)}
            >
              <div
                className="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center fw-bold shadow-sm overflow-hidden"
                style={{ width: 36, height: 36 }}
              >
                {currentUser?.avatarUrl ? (
                  <img
                    src={currentUser.avatarUrl}
                    alt="Avatar"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                ) : currentUser?.fullName ? (
                  currentUser.fullName.charAt(0).toUpperCase()
                ) : (
                  "M"
                )}
              </div>
              <div className="ms-2 me-2 d-none d-sm-block text-start">
                <div
                  className="fw-bold text-dark"
                  style={{ fontSize: "0.85rem", lineHeight: "1.2" }}
                >
                  {currentUser.fullName}
                </div>
                <small className="text-muted" style={{ fontSize: "0.7rem" }}>
                  Trưởng {formatDeptName(myDepartment.name)}
                </small>
              </div>
              <i
                className="bi bi-chevron-down ms-1 text-muted me-2"
                style={{ fontSize: "0.8rem" }}
              ></i>
            </div>

            {showProfileMenu && (
              <div
                className="dropdown-menu show shadow border-0 position-absolute end-0 mt-2 p-2 rounded-4"
                style={{
                  minWidth: "220px",
                  backgroundColor: "#fff",
                  top: "100%",
                  zIndex: 1050,
                }}
              >
                <div className="px-3 py-2 mb-1 d-sm-none border-bottom">
                  <div className="fw-bold text-dark">
                    {currentUser.fullName}
                  </div>
                  <small className="text-muted">Trưởng phòng</small>
                </div>
                <button
                  className="dropdown-item rounded-3 py-2 fw-bold text-dark mb-1 d-flex align-items-center modern-dropdown-item"
                  onClick={() => {
                    setShowProfileMenu(false);
                    navigate("/profile");
                  }}
                >
                  <i className="bi bi-person-fill me-2 fs-5 text-primary"></i>{" "}
                  Tài khoản của tôi
                </button>
                <div className="dropdown-divider my-1 border-light"></div>
                <button
                  className="dropdown-item rounded-3 py-2 fw-bold text-danger d-flex align-items-center modern-dropdown-item"
                  onClick={() => {
                    setShowProfileMenu(false);
                    handleLogout();
                  }}
                >
                  <i className="bi bi-box-arrow-right me-2 fs-5"></i> Đăng xuất
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="admin-main-wrapper">
        <div className="p-4 p-md-5 animate-fade-in content-inner">
          {activeTab === "PROJECT_DETAIL" && (
            <button
              onClick={() => setActiveTab("DASHBOARD")}
              className="btn btn-link text-decoration-none fw-bold mb-3 ps-0 text-dark"
            >
              <i className="bi bi-arrow-left"></i> Quay lại Dashboard
            </button>
          )}

          {activeTab === "DASHBOARD" && (
            <>
              <div className="row g-4 mb-5">
                <div className="col-12 col-md-4">
                  <div className="card border-0 shadow-sm p-3 h-100 border-start border-primary border-5">
                    <div className="text-muted small fw-bold">
                      TỔNG NHÂN VIÊN
                    </div>
                    <div className="display-6 fw-bold text-dark">
                      {deptMembers.length}
                    </div>
                  </div>
                </div>
                <div className="col-12 col-md-4">
                  <div className="card border-0 shadow-sm p-3 h-100 border-start border-success border-5">
                    <div className="text-muted small fw-bold">
                      DỰ ÁN ĐANG CHẠY
                    </div>
                    <div className="display-6 fw-bold text-dark">
                      {projects.filter((p) => p.status !== "CLOSED").length}
                    </div>
                  </div>
                </div>
                <div className="col-12 col-md-4">
                  <div className="card border-0 shadow-sm p-3 h-100 bg-primary text-white">
                    <div className="opacity-75 small fw-bold">HÔM NAY</div>
                    <div className="fs-5 mt-2">
                      Chúc bạn một ngày làm việc hiệu quả! 🚀
                    </div>
                  </div>
                </div>
              </div>
              <h5 className="fw-bold text-dark mb-3">
                <i className="bi bi-folder2-open me-2"></i>Danh Sách Dự Án
              </h5>
              <div className="row g-4">
                {projects.map((p) => (
                  <div key={p.id} className="col-md-6 col-lg-3">
                    <div
                      className={`card border-0 shadow-sm h-100 transition ${
                        p.status === "CLOSED" ? "opacity-75" : "hover-shadow"
                      }`}
                      style={{
                        cursor: p.status === "CLOSED" ? "default" : "pointer",
                      }}
                      onClick={
                        p.status !== "CLOSED"
                          ? () => handleSelectProject(p)
                          : undefined
                      }
                    >
                      <div
                        className={`card-body ${p.status === "CLOSED" ? "bg-secondary bg-opacity-10" : ""}`}
                      >
                        <div className="d-flex justify-content-between mb-2">
                          {p.status === "CLOSED" ? (
                            <span className="badge bg-secondary">
                              🔒 ĐÃ ĐÓNG
                            </span>
                          ) : (
                            <span
                              className={`badge ${p.priority === "HIGH" ? "bg-danger" : p.priority === "MEDIUM" ? "bg-warning text-dark" : "bg-info"}`}
                            >
                              {p.priority}
                            </span>
                          )}
                          <small className="text-muted">
                            <i className="bi bi-clock"></i> {p.deadline}
                          </small>
                        </div>
                        <h5
                          className={`fw-bold mb-1 ${p.status === "CLOSED" ? "text-muted text-decoration-line-through" : "text-primary"}`}
                        >
                          {p.name}
                        </h5>
                        <p className="text-muted small mb-3 text-truncate">
                          {p.description}
                        </p>
                        <div className="d-flex align-items-center justify-content-between border-top pt-3">
                          <div className="d-flex align-items-center">
                            <div
                              className="bg-light rounded-circle text-center small fw-bold text-secondary me-1"
                              style={{
                                width: 30,
                                height: 30,
                                lineHeight: "30px",
                              }}
                            >
                              {(p.members || []).length}
                            </div>
                            <small className="text-muted">thành viên</small>
                          </div>
                          <button
                            className="btn btn-sm btn-outline-primary rounded-pill px-3"
                            onClick={(e) => {
                              e.stopPropagation(); // 🔥 CỐT LÕI LỖI CỦA BẠN
                              handleSelectProject(p);
                            }}
                          >
                            Chi tiết
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {activeTab === "PROJECT_DETAIL" && selectedProject && (
            <div className="row justify-content-center">
              <div className="col-12">
                <div className="card border-0 shadow-lg overflow-hidden">
                  <div
                    className={`card-header p-4 border-bottom ${isProjectClosed ? "bg-secondary text-white" : "bg-white"}`}
                  >
                    <div className="d-flex justify-content-between align-items-start">
                      <div>
                        <div className="d-flex align-items-center gap-2 mb-1">
                          <h2
                            className={`fw-bold mb-0 ${isProjectClosed ? "text-white" : "text-primary"}`}
                          >
                            {selectedProject.name}
                          </h2>
                          {isProjectClosed && (
                            <span className="badge bg-dark border fs-6">
                              🔒 ĐÃ ĐÓNG
                            </span>
                          )}
                        </div>
                        <p
                          className={`${isProjectClosed ? "text-white-50" : "text-muted"} mb-0`}
                        >
                          {selectedProject.description}
                        </p>
                        {selectedProject.documentLink && (
                          <a
                            href={
                              selectedProject.documentLink.startsWith("http")
                                ? selectedProject.documentLink
                                : `https://${selectedProject.documentLink}`
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`btn btn-sm mt-2 fw-bold ${isProjectClosed ? "btn-outline-light" : "btn-outline-primary"}`}
                          >
                            <i className="bi bi-link-45deg me-1"></i> Tài liệu
                            đính kèm
                          </a>
                        )}
                      </div>
                      <div>
                        {!isProjectClosed && (
                          <>
                            <button
                              className="btn btn-outline-primary fw-bold me-2"
                              onClick={openEditProjectModal}
                            >
                              <i className="bi bi-pencil-square me-2"></i>SỬA
                            </button>
                            <button
                              className="btn btn-outline-danger fw-bold me-3"
                              onClick={handleCompleteProject}
                            >
                              <i className="bi bi-check-circle-fill me-2"></i>
                              HOÀN THÀNH DỰ ÁN
                            </button>
                          </>
                        )}
                        <span
                          className={`badge ${isProjectClosed ? "bg-dark" : "bg-light text-dark border"} px-3 py-2 fs-6`}
                        >
                          Hạn: {selectedProject.deadline}
                        </span>
                      </div>
                    </div>
                    <div className="d-flex gap-2 mt-4">
                      <button
                        className={`btn rounded-pill px-4 fw-bold ${projectTab === "TASKS" ? (isProjectClosed ? "btn-light text-dark" : "btn-primary") : "btn-outline-light text-dark bg-white opacity-75"}`}
                        onClick={() => setProjectTab("TASKS")}
                      >
                        <i className="bi bi-list-check me-2"></i>Công việc (
                        {(tasks || []).length})
                      </button>
                      <button
                        className={`btn rounded-pill px-4 fw-bold ${projectTab === "MEMBERS" ? (isProjectClosed ? "btn-light text-dark" : "btn-primary") : "btn-outline-light text-dark bg-white opacity-75"}`}
                        onClick={() => setProjectTab("MEMBERS")}
                      >
                        <i className="bi bi-people-fill me-2"></i>Thành viên (
                        {(selectedProject.members || []).length})
                      </button>
                      <button
                        className={`btn rounded-pill px-4 fw-bold ${projectTab === "CHAT" ? (isProjectClosed ? "btn-light text-dark" : "btn-primary") : "btn-outline-light text-dark bg-white opacity-75"}`}
                        onClick={() => setProjectTab("CHAT")}
                      >
                        <i className="bi bi-chat-dots-fill me-2"></i>Nhóm chat
                      </button>
                    </div>
                  </div>

                  <div className="card-body p-4 bg-light">
                    {projectTab === "TASKS" && (
                      <>
                        {!isProjectClosed ? (
                          <div className="d-flex justify-content-end mb-3">
                            <button
                              className="btn btn-success fw-bold shadow-sm"
                              onClick={() => setShowTaskModal(true)}
                            >
                              <i className="bi bi-plus-lg me-2"></i>Giao Việc
                              Mới
                            </button>
                          </div>
                        ) : (
                          <div className="alert alert-secondary text-center fw-bold">
                            <i className="bi bi-lock-fill me-2"></i>Dự án này đã
                            đóng. Bạn chỉ có thể xem lại lịch sử công việc.
                          </div>
                        )}

                        {/* 🔥 FIX TRẮNG TRANG: Thêm || [] */}
                        <div className="table-responsive bg-white rounded shadow-sm">
                          <table className="table table-hover align-middle mb-0">
                            <thead className="table-light">
                              <tr>
                                <th>Task</th>
                                <th>Giao cho</th>
                                <th>Deadline</th>
                                <th>Trạng thái</th>
                                <th>Tiến độ</th>
                                <th>Hành động</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(tasks || []).map((t) => (
                                <tr key={t.id}>
                                  <td className="fw-bold">{t.title}</td>
                                  <td>
                                    {t.assignee ? (
                                      <div className="d-flex align-items-center">
                                        {t.assignee.avatarUrl ? (
                                          <img
                                            src={t.assignee.avatarUrl}
                                            alt={t.assignee.fullName}
                                            className="rounded-circle me-2"
                                            style={{
                                              width: 25,
                                              height: 25,
                                              objectFit: "cover",
                                            }}
                                          />
                                        ) : (
                                          <div
                                            className="bg-primary text-white rounded-circle text-center small me-2 fw-bold"
                                            style={{
                                              width: 25,
                                              height: 25,
                                              lineHeight: "25px",
                                            }}
                                          >
                                            {t.assignee.fullName
                                              .charAt(0)
                                              .toUpperCase()}
                                          </div>
                                        )}
                                        {t.assignee.fullName}
                                      </div>
                                    ) : (
                                      <span className="text-muted">--</span>
                                    )}
                                  </td>
                                  <td>{t.deadline}</td>
                                  <td>
                                    <span
                                      className={`badge ${t.status === "DONE" ? "bg-success" : "bg-secondary"}`}
                                    >
                                      {t.status}
                                    </span>
                                  </td>
                                  <td>
                                    <div className="d-flex align-items-center gap-2">
                                      <div
                                        className="progress flex-grow-1"
                                        style={{ height: 6 }}
                                      >
                                        <div
                                          className="progress-bar bg-info"
                                          style={{
                                            width: `${t.completionPercentage}%`,
                                          }}
                                        ></div>
                                      </div>
                                      <small className="fw-bold">
                                        {t.completionPercentage}%
                                      </small>
                                    </div>
                                  </td>
                                  <td>
                                    <button
                                      className="btn btn-sm btn-success fw-bold rounded-pill px-3"
                                      onClick={() =>
                                        setSelectedTaskForDetail(t)
                                      }
                                      title="Xem chi tiết & bình luận"
                                    >
                                      💬 Bình luận
                                    </button>
                                  </td>
                                </tr>
                              ))}
                              {(!tasks || tasks.length === 0) && (
                                <tr>
                                  <td
                                    colSpan="6"
                                    className="text-center py-4 text-muted"
                                  >
                                    Chưa có công việc nào
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                    {projectTab === "MEMBERS" && (
                      <>
                        {!isProjectClosed && (
                          <div className="d-flex justify-content-end mb-3">
                            <button
                              className="btn btn-primary fw-bold shadow-sm"
                              onClick={() => setShowMemberModal(true)}
                            >
                              <i className="bi bi-person-plus-fill me-2"></i>
                              Thêm Thành Viên
                            </button>
                          </div>
                        )}
                        <div className="row g-3">
                          {/* 🔥 FIX TRẮNG TRANG: Thêm || [] */}
                          {(selectedProject.members || []).length > 0 ? (
                            (selectedProject.members || []).map((m) => (
                              <div key={m.id} className="col-md-4 col-lg-3">
                                <div className="bg-white p-3 rounded shadow-sm d-flex align-items-center">
                                  {m.avatarUrl ? (
                                    <img
                                      src={m.avatarUrl}
                                      alt={m.fullName}
                                      className="rounded-circle me-3"
                                      style={{
                                        width: 50,
                                        height: 50,
                                        objectFit: "cover",
                                      }}
                                    />
                                  ) : (
                                    <div
                                      className="bg-light rounded-circle d-flex align-items-center justify-content-center text-primary fw-bold me-3"
                                      style={{
                                        width: 50,
                                        height: 50,
                                        fontSize: "1.2rem",
                                      }}
                                    >
                                      {m.fullName.charAt(0).toUpperCase()}
                                    </div>
                                  )}
                                  <div>
                                    <h6 className="fw-bold mb-0">
                                      {m.fullName}
                                    </h6>
                                    <small className="text-muted">
                                      {m.email}
                                    </small>
                                    <div className="mt-1">
                                      <span className="badge bg-secondary">
                                        Employee
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="col-12 text-center text-muted">
                              Chưa có thành viên nào.
                            </div>
                          )}
                        </div>
                      </>
                    )}
                    {projectTab === "CHAT" && (
                      <div
                        style={{
                          minHeight: "600px",
                          display: "flex",
                          flexDirection: "column",
                          width: "100%",
                        }}
                      >
                        <ProjectChatPanel
                          project={selectedProject}
                          currentUser={currentUser}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* MODAL THÊM THÀNH VIÊN */}
        {showMemberModal && !isProjectClosed && (
          <div className="modal-backdrop-custom">
            <div
              className="card shadow-lg border-0"
              style={{ width: 500, borderRadius: "1rem", overflow: "hidden" }}
            >
              <div className="card-header bg-primary p-4 border-0 text-white d-flex flex-column position-relative">
                <button
                  className="btn-close btn-close-white position-absolute top-0 end-0 m-3"
                  onClick={() => setShowMemberModal(false)}
                ></button>
                <h5 className="fw-bold mb-1">Thêm nhân sự mới</h5>
                <span className="text-white text-opacity-75 small">
                  Vào dự án: {selectedProject.name}
                </span>
              </div>
              <div className="card-body p-0">
                {availableMembers.length > 0 ? (
                  <div className="d-flex flex-column h-100">
                    <div
                      className="list-group list-group-flush custom-scrollbar"
                      style={{ maxHeight: "350px", overflowY: "auto" }}
                    >
                      {availableMembers.map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          className={`list-group-item list-group-item-action p-3 border-0 border-bottom d-flex align-items-center ${selectedMembersToAdd.includes(u.id) ? "bg-primary bg-opacity-10" : ""}`}
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
                              <img
                                src={u.avatarUrl}
                                alt={u.fullName}
                                className="rounded-circle shadow-sm border border-2 border-white"
                                style={{
                                  width: 48,
                                  height: 48,
                                  objectFit: "cover",
                                }}
                              />
                            ) : (
                              <div
                                className="bg-primary bg-opacity-25 text-primary rounded-circle d-flex align-items-center justify-content-center fw-bold shadow-sm border border-2 border-white"
                                style={{
                                  width: 48,
                                  height: 48,
                                  fontSize: "1.2rem",
                                }}
                              >
                                {u.fullName.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div className="flex-grow-1 min-w-0">
                            <div className="fw-bold text-dark text-truncate mb-1">
                              {u.fullName}
                            </div>
                            <div className="text-muted small text-truncate d-flex align-items-center mb-1">
                              <i className="bi bi-envelope me-1"></i> {u.email}
                            </div>
                            {u.department ? (
                              <span
                                className="badge bg-secondary bg-opacity-10 text-secondary border border-secondary border-opacity-25 fw-normal"
                                style={{ fontSize: "0.7rem" }}
                              >
                                <i className="bi bi-building me-1"></i>Phòng:{" "}
                                {u.department.name}
                              </span>
                            ) : (
                              <span
                                className="badge bg-light text-muted border fw-normal"
                                style={{ fontSize: "0.7rem" }}
                              >
                                <i className="bi bi-question-circle me-1"></i>
                                Chưa có phòng
                              </span>
                            )}
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
                      <button
                        className="btn btn-primary w-100 py-2 fs-6 fw-bold shadow-sm rounded-pill"
                        onClick={handleAddMember}
                        disabled={selectedMembersToAdd.length === 0}
                      >
                        <i className="bi bi-person-plus-fill me-2"></i> Xác nhận
                        & Thêm vào
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

        {showEditProjectModal && !isProjectClosed && (
          <div className="modal-backdrop-custom">
            <div className="card shadow-lg border-0" style={{ width: 500 }}>
              <div className="card-header bg-primary text-white fw-bold d-flex justify-content-between">
                <span>Sửa Thông Tin Dự Án</span>
                <button
                  className="btn-close btn-close-white"
                  onClick={() => setShowEditProjectModal(false)}
                ></button>
              </div>
              <div className="card-body">
                <form onSubmit={handleEditProjectSubmit}>
                  <label className="form-label fw-bold small text-muted">
                    Tên Dự Án
                  </label>
                  <input
                    className="form-control mb-2"
                    required
                    value={editProjectForm.name}
                    onChange={(e) =>
                      setEditProjectForm({
                        ...editProjectForm,
                        name: e.target.value,
                      })
                    }
                  />
                  <label className="form-label fw-bold small text-muted">
                    Mô Tả
                  </label>
                  <textarea
                    className="form-control mb-2"
                    rows="3"
                    value={editProjectForm.description}
                    onChange={(e) =>
                      setEditProjectForm({
                        ...editProjectForm,
                        description: e.target.value,
                      })
                    }
                  />
                  <div className="row mb-2">
                    <div className="col-12">
                      <label className="form-label fw-bold small text-muted">
                        Tải Tài Liệu Từ Máy Lên
                      </label>
                      <input
                        type="file"
                        className="form-control mb-3"
                        onChange={(e) =>
                          setProjectDocumentFile(e.target.files[0])
                        }
                      />

                      <label className="form-label fw-bold small text-muted">
                        Hoặc Dán Link Tài Liệu
                      </label>
                      <input
                        type="text"
                        className="form-control mb-2"
                        placeholder="Dán link tài liệu dự án..."
                        value={editProjectForm.documentLink || ""}
                        onChange={(e) =>
                          setEditProjectForm({
                            ...editProjectForm,
                            documentLink: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                  <div className="row mb-4">
                    <div className="col-6">
                      <label className="form-label fw-bold small text-muted">
                        Bắt Đầu
                      </label>
                      <input
                        type="date"
                        className="form-control"
                        required
                        value={editProjectForm.startDate}
                        onChange={(e) =>
                          setEditProjectForm({
                            ...editProjectForm,
                            startDate: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="col-6">
                      <label className="form-label fw-bold small text-muted">
                        Deadline
                      </label>
                      <input
                        type="date"
                        className="form-control"
                        required
                        value={editProjectForm.deadline}
                        onChange={(e) =>
                          setEditProjectForm({
                            ...editProjectForm,
                            deadline: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                  <button className="btn btn-primary w-100 fw-bold">
                    LƯU THAY ĐỔI
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {showTaskModal && !isProjectClosed && (
          <div className="modal-backdrop-custom">
            <div className="card shadow-lg border-0" style={{ width: 500 }}>
              <div className="card-header bg-success text-white fw-bold d-flex justify-content-between">
                <span>Giao việc mới</span>
                <button
                  className="btn-close btn-close-white"
                  onClick={() => setShowTaskModal(false)}
                ></button>
              </div>
              <div className="card-body">
                <form onSubmit={handleCreateTask}>
                  <input
                    className="form-control mb-2"
                    placeholder="Tiêu đề"
                    required
                    value={newTask.title}
                    onChange={(e) =>
                      setNewTask({ ...newTask, title: e.target.value })
                    }
                  />
                  <textarea
                    className="form-control mb-2"
                    placeholder="Mô tả"
                    rows="2"
                    value={newTask.description}
                    onChange={(e) =>
                      setNewTask({ ...newTask, description: e.target.value })
                    }
                  />
                  <div className="row mb-2">
                    <div className="col-6">
                      <input
                        type="date"
                        className="form-control"
                        required
                        value={newTask.deadline}
                        onChange={(e) =>
                          setNewTask({ ...newTask, deadline: e.target.value })
                        }
                      />
                    </div>
                    <div className="col-6">
                      <select
                        className="form-select"
                        value={newTask.priority}
                        onChange={(e) =>
                          setNewTask({ ...newTask, priority: e.target.value })
                        }
                      >
                        <option value="MEDIUM">Trung bình</option>
                        <option value="HIGH">Cao</option>
                      </select>
                    </div>
                  </div>
                  <select
                    className="form-select mb-4"
                    required
                    value={newTask.assigneeId}
                    onChange={(e) =>
                      setNewTask({ ...newTask, assigneeId: e.target.value })
                    }
                  >
                    <option value="">-- Giao cho ai? --</option>
                    {(selectedProject.members || []).map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.fullName}
                      </option>
                    ))}
                  </select>
                  <button className="btn btn-success w-100 fw-bold">LƯU</button>
                </form>
              </div>
            </div>
          </div>
        )}

        {selectedTaskForDetail && (
          <TaskDetailModal
            task={selectedTaskForDetail}
            currentUser={currentUser}
            onClose={() => setSelectedTaskForDetail(null)}
            onTaskUpdate={() => {
              if (selectedProject) {
                handleSelectProject(selectedProject);
              }
            }}
          />
        )}

        {privateChatUser && (
          <div
            style={{
              position: "fixed",
              bottom: "20px",
              right: "20px",
              width: "360px",
              height: "500px",
              zIndex: 1060,
              boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
              borderRadius: "12px",
              overflow: "hidden",
            }}
          >
            <PrivateChatPanel
              currentUser={currentUser}
              targetUser={privateChatUser}
              onClose={() => setPrivateChatUser(null)}
            />
          </div>
        )}

        <style>{`.modal-backdrop-custom { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); z-index: 1050; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(5px); } .hover-shadow:hover { transform: translateY(-3px); box-shadow: 0 10px 20px rgba(0,0,0,0.1) !important; } .transition { transition: all 0.3s ease; }`}</style>
      </div>
    </div>
  );
};
export default ManagerDashboard;
