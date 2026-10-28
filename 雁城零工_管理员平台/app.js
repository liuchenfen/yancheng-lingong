const API_BASE = window.YC_API_BASE || "";

const categoryOptions = ["餐饮服务", "家政保洁", "物流配送", "展会活动", "门店导购", "临时用工", "技术支持"];
const salaryTypeOptions = ["日结", "周结", "月结", "完工结"];

const viewMeta = {
  overview: ["工作台", "查看岗位、用户、审核和投递整体情况。"],
  jobs: ["岗位管理", "管理已发布、待审核、已驳回和已下线岗位。"],
  publish: ["岗位发布", "管理员直接发布岗位，保存后小程序端立即展示。"],
  reviews: ["岗位审核", "集中处理待审核岗位，决定是否展示到小程序。"],
  users: ["用户信息", "查看微信登录用户资料、手机号、收藏和投递数据。"],
  applications: ["投递记录", "接收小程序投递信息，并跟进联系、录用、关闭状态。"],
  messages: ["客服消息", "接收小程序用户咨询，客服可直接回复并发布系统通知。"],
  interfaces: ["小程序接口", "用于对接微信小程序前端和后端服务的接口字段说明。"]
  , interfaces: ["小程序接口", "用于对接微信小程序前端和后端服务的接口字段说明。"],
  convenience: ["便民信息管理", "查看用户发布的便民信息、举报数，并直接下架或恢复。"],
};

const jobStatus = {
  published: "已发布",
  pending: "待审核",
  rejected: "已驳回",
  offline: "已下线"
};

const applicationStatus = {
  new: "新投递",
  contacted: "已联系",
  hired: "已录用",
  closed: "已关闭"
};

let state = {
  jobs: [],
  conveniencePosts: [],
  users: [],
  applications: [],
  messageThreads: [],
  activeThread: null,
  activeMessages: []
};
let currentView = "overview";

document.addEventListener("DOMContentLoaded", async () => {
  fillSelects();
  bindEvents();
  render();
  await checkLogin();
});

async function loadAllData() {
  try {
    const [jobs, conveniencePosts, users, applications, messageThreads] = await Promise.all([
      api("/api/admin/jobs"),
      api("/api/admin/convenience"),
      api("/api/admin/users"),
      api("/api/admin/applications"),
      api("/api/admin/messages/threads")
    ]);
    state = Object.assign({}, state, { jobs, conveniencePosts, users, applications, messageThreads });
    render();
  } catch (error) {
    if (error.status === 401) {
      showLogin();
      return;
    }
    showToast(`数据库接口连接失败：${error.message}`);
  }
}

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...(options.headers || {})
    }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.code !== 0) {
    const error = new Error(payload.message || `请求失败：${response.status}`);
    error.status = response.status;
    throw error;
  }
  return payload.data;
}

function bindEvents() {
  const loginForm = $("loginForm");
  if (loginForm) loginForm.addEventListener("submit", handleLogin);
  
  const logoutBtn = $("logoutBtn");
  if (logoutBtn) logoutBtn.addEventListener("click", handleLogout);

  document.querySelectorAll(".nav-item").forEach((item) => {
    item.addEventListener("click", () => setView(item.dataset.view));
  });

  document.querySelectorAll("[data-jump]").forEach((item) => {
    item.addEventListener("click", () => setView(item.dataset.jump));
  });

  const openJobModal = $("openJobModal");
  if (openJobModal) openJobModal.addEventListener("click", openModal);
  
  const closeJobModal = $("closeJobModal");
  if (closeJobModal) closeJobModal.addEventListener("click", closeModal);
  
  const resetFormBtn = $("resetFormBtn");
  if (resetFormBtn) resetFormBtn.addEventListener("click", () => {
    const jobForm = $("jobForm");
    if (jobForm) jobForm.reset();
  });
  
  const exportBtn = $("exportBtn");
  if (exportBtn) exportBtn.addEventListener("click", exportData);
  
  const jobForm = $("jobForm");
  if (jobForm) jobForm.addEventListener("submit", handleJobSubmit);

  const publishForm = $("publishForm");
  if (publishForm) publishForm.addEventListener("submit", handlePublishSubmit);

  const resetPublishBtn = $("resetPublishBtn");
  if (resetPublishBtn) resetPublishBtn.addEventListener("click", () => {
    const publishForm = $("publishForm");
    if (publishForm) publishForm.reset();
  });
  
  const jobModal = $("jobModal");
  if (jobModal) jobModal.addEventListener("click", (event) => {
    if (event.target.id === "jobModal") closeModal();
  });

  const jobSearch = $("jobSearch");
  if (jobSearch) jobSearch.addEventListener("input", renderJobs);
  
  const jobStatusFilter = $("jobStatusFilter");
  if (jobStatusFilter) jobStatusFilter.addEventListener("change", renderJobs);
  
  const applicationSearch = $("applicationSearch");
  if (applicationSearch) applicationSearch.addEventListener("input", renderApplications);
  
  const applicationStatusFilter = $("applicationStatusFilter");
  if (applicationStatusFilter) applicationStatusFilter.addEventListener("change", renderApplications);

  const convenienceSearch = $("convenienceSearch");
  if (convenienceSearch) convenienceSearch.addEventListener("input", renderConvenience);

  const convenienceStatusFilter = $("convenienceStatusFilter");
  if (convenienceStatusFilter) convenienceStatusFilter.addEventListener("change", renderConvenience);

  const jobsTable = $("jobsTable");
  if (jobsTable) jobsTable.addEventListener("click", handleTableAction);
  
  const reviewList = $("reviewList");
  if (reviewList) reviewList.addEventListener("click", handleTableAction);
  
  const applicationsTable = $("applicationsTable");
  if (applicationsTable) applicationsTable.addEventListener("click", handleTableAction);

  const convenienceTable = $("convenienceTable");
  if (convenienceTable) convenienceTable.addEventListener("click", handleTableAction);
  
  const usersTable = $("usersTable");
  if (usersTable) usersTable.addEventListener("click", handleTableAction);

  const messageThreadList = $("messageThreadList");
  if (messageThreadList) messageThreadList.addEventListener("click", handleMessageThreadClick);

  const refreshMessagesBtn = $("refreshMessagesBtn");
  if (refreshMessagesBtn) refreshMessagesBtn.addEventListener("click", refreshMessageThreads);

  const adminReplyForm = $("adminReplyForm");
  if (adminReplyForm) adminReplyForm.addEventListener("submit", handleAdminReply);

  const systemNoticeForm = $("systemNoticeForm");
  if (systemNoticeForm) systemNoticeForm.addEventListener("submit", handleSystemNotice);
}

async function checkLogin() {
  try {
    const admin = await api("/api/admin/me");
    showApp(admin);
    await loadAllData();
  } catch (error) {
    showLogin();
  }
}

async function handleLogin(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  try {
    const admin = await api("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({
        username: clean(form.get("username")),
        password: clean(form.get("password"))
      })
    });
    if (event.currentTarget) event.currentTarget.reset();
    showApp(admin);
    await loadAllData();
    showToast("登录成功");
  } catch (error) {
    showToast(error.message || "登录失败");
  }
}

async function handleLogout() {
  try {
    await api("/api/admin/logout", { method: "POST" });
  } catch (error) {
    // Even if the session expired on the server, the frontend should return to login.
  }
  state = { jobs: [], conveniencePosts: [], users: [], applications: [], messageThreads: [], activeThread: null, activeMessages: [] };
  render();
  showLogin();
}

function showLogin() {
  $("loginScreen").hidden = false;
  document.querySelector(".app-shell").hidden = true;
}

function showApp(admin) {
  $("loginScreen").hidden = true;
  document.querySelector(".app-shell").hidden = false;
  $("adminName").textContent = admin.username || "admin";
}

function fillSelects() {
  const categorySelect = document.querySelector("[name='category']");
  const salaryTypeSelect = document.querySelector("[name='salaryType']");
  categorySelect.innerHTML = categoryOptions.map((item) => `<option value="${item}">${item}</option>`).join("");
  salaryTypeSelect.innerHTML = salaryTypeOptions.map((item) => `<option value="${item}">${item}</option>`).join("");
}

function render() {
  renderOverview();
  renderJobs();
  renderReviews();
  renderConvenience();
  renderUsers();
  renderApplications();
  renderMessages();
  renderApiExample();
}

function setView(view) {
  currentView = view;
  document.querySelectorAll(".view").forEach((item) => item.classList.toggle("active", item.id === view));
  document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.view === view));
  const [title, desc] = viewMeta[view];
  $("viewTitle").textContent = title;
  $("viewDesc").textContent = desc;
}

function renderOverview() {
  $("metricJobs").textContent = state.jobs.length;
  $("metricPending").textContent = state.jobs.filter((job) => job.status === "pending").length;
  $("metricUsers").textContent = state.users.length;
  $("metricApplications").textContent = state.applications.length;

  const pendingJobs = state.jobs.filter((job) => job.status === "pending").slice(0, 4);
  $("pendingPreview").innerHTML = pendingJobs.length
    ? pendingJobs.map((job) => `
      <div class="list-card">
        <strong>${escapeHtml(job.title)}</strong>
        <span>${escapeHtml(job.company || "未填写单位")} · ${escapeHtml(job.displayLocation)} · ${escapeHtml(job.salary)}</span>
      </div>
    `).join("")
    : emptyText("暂无待审核岗位");

  const recentApplications = [...state.applications].sort((a, b) => String(b.appliedAt).localeCompare(String(a.appliedAt))).slice(0, 4);
  $("applicationPreview").innerHTML = recentApplications.length
    ? recentApplications.map((item) => `
      <div class="list-card">
        <strong>${escapeHtml(item.userName)} 投递 ${escapeHtml(item.jobTitle)}</strong>
        <span>${escapeHtml(item.gender || "—")} · ${item.age != null ? item.age + "岁" : "—"} · ${escapeHtml(item.phone)} · ${applicationStatus[item.status] || item.status} · ${escapeHtml(item.appliedAt)}</span>
      </div>
    `).join("")
    : emptyText("暂无投递记录");
}

function renderJobs() {
  const keyword = $("jobSearch").value.trim().toLowerCase();
  const filter = $("jobStatusFilter").value;
  const jobs = state.jobs.filter((job) => {
    const text = `${job.title} ${job.company} ${job.contact} ${job.displayLocation} ${job.location}`.toLowerCase();
    return (filter === "all" || job.status === filter) && (!keyword || text.includes(keyword));
  });

  $("jobsTable").innerHTML = jobs.length
    ? jobs.map((job) => `
      <tr>
        <td class="title-cell">
          <strong>${escapeHtml(job.title)}</strong>
          <span>${escapeHtml(job.category)} · ${escapeHtml(job.createdAt)}</span>
        </td>
        <td>${escapeHtml(job.company || "未填写单位")}<br><span class="muted">${escapeHtml(job.contact)} ${escapeHtml(job.phone)}</span></td>
        <td>${escapeHtml(job.salary)}<br><span class="muted">${escapeHtml(job.salaryType)}</span></td>
        <td>${escapeHtml(job.displayLocation)}</td>
        <td>${statusBadge(job.status, jobStatus[job.status] || job.status)}</td>
        <td><div class="row-actions">${jobActions(job)}</div></td>
      </tr>
    `).join("")
    : emptyRow("没有匹配的岗位", 6);
}

function renderReviews() {
  const jobs = state.jobs.filter((job) => job.status === "pending");
  $("reviewList").innerHTML = jobs.length
    ? jobs.map((job) => `
      <article class="review-card">
        <div class="review-top">
          <h3>${escapeHtml(job.title)}</h3>
          ${statusBadge(job.status, jobStatus[job.status] || job.status)}
        </div>
        <div class="review-meta">
          <div>${escapeHtml(job.company || "未填写单位")} · ${escapeHtml(job.category)}</div>
          <div>${escapeHtml(job.salary)} · ${escapeHtml(job.salaryType)} · 招 ${Number(job.headcount) || 1} 人</div>
          <div>${escapeHtml(job.displayLocation)} · ${escapeHtml(job.workTime || "时间未填写")}</div>
          <div>联系人：${escapeHtml(job.contact)} ${escapeHtml(job.phone)}</div>
          <p>${escapeHtml(job.description || "暂无岗位描述")}</p>
        </div>
        <div class="review-actions">
          <button class="table-action" data-action="approve" data-id="${job.id}">通过</button>
          <button class="table-action danger" data-action="reject" data-id="${job.id}">驳回</button>
        </div>
      </article>
    `).join("")
    : `<div class="empty review-empty">暂无待审核岗位</div>`;
}

function renderConvenience() {
  const table = $("convenienceTable");
  if (!table) return;

  const keyword = ($("convenienceSearch") && $("convenienceSearch").value.trim().toLowerCase()) || "";
  const filter = ($("convenienceStatusFilter") && $("convenienceStatusFilter").value) || "all";
  const posts = state.conveniencePosts.filter((item) => {
    const text = `${item.content} ${item.contactName} ${item.contactPhone} ${item.address} ${item.area} ${item.category}`.toLowerCase();
    return (filter === "all" || item.status === filter) && (!keyword || text.includes(keyword));
  });

  table.innerHTML = posts.length
    ? posts.map((item) => `
      <tr>
        <td class="summary-cell">
          <strong class="summary-title">${escapeHtml((item.content || "").slice(0, 36) || "未填写内容")}</strong>
          <span class="summary-meta">${escapeHtml(item.address || "未填写地址")}</span>
        </td>
        <td>${escapeHtml(item.category || "-")}<br><span class="muted">${escapeHtml(item.area || "-")}</span></td>
        <td>${escapeHtml(item.contactName || "-")}<br><span class="muted">${escapeHtml(item.contactPhone || "-")}</span></td>
        <td><span class="report-badge ${Number(item.reportCount || 0) > 0 ? "hot" : ""}">${Number(item.reportCount || 0)}</span><br><span class="muted">${escapeHtml(item.lastReportedAt || "-")}</span></td>
        <td>${escapeHtml(item.createdAt || "-")}</td>
        <td>${statusBadge(item.status, item.status === "published" ? "已发布" : "已下架")}</td>
        <td><div class="row-actions">${convenienceActions(item)}</div></td>
      </tr>
    `).join("")
    : emptyRow("没有匹配的便民信息", 7);
}

function renderUsers() {
  $("usersTable").innerHTML = state.users.length
    ? state.users.map((user) => `
      <tr>
        <td>
          <div class="user-cell">
            <span class="avatar">${escapeHtml(user.avatarText || String(user.nickname || "微").slice(0, 1))}</span>
            <div>
              <strong>${escapeHtml(user.nickname || "微信用户")}</strong>
              <span>${escapeHtml(user.openid)}</span>
            </div>
          </div>
        </td>
        <td>${escapeHtml(user.phone || "未授权")}</td>
        <td>${escapeHtml(user.loginAt)}</td>
        <td>${Number(user.favorites) || 0}</td>
        <td>${Number(user.applications) || 0}</td>
        <td><button class="table-action" data-action="filter-user-apps" data-name="${escapeHtml(user.nickname || "")}">查看投递</button></td>
      </tr>
    `).join("")
    : emptyRow("暂无用户信息", 6);
}

function renderApplications() {
  const keyword = $("applicationSearch").value.trim().toLowerCase();
  const filter = $("applicationStatusFilter").value;
  const applications = state.applications.filter((item) => {
    const text = `${item.userName} ${item.gender} ${item.phone} ${item.jobTitle} ${item.note}`.toLowerCase();
    return (filter === "all" || item.status === filter) && (!keyword || text.includes(keyword));
  });

  $("applicationsTable").innerHTML = applications.length
    ? applications.map((item) => `
      <tr>
        <td class="title-cell">
          <strong>${escapeHtml(item.userName)}</strong>
          <span>${escapeHtml(item.note || "无备注")}</span>
        </td>
        <td>${escapeHtml(item.gender || "—")}</td>
        <td>${item.age != null ? item.age : "—"}</td>
        <td>${escapeHtml(item.jobTitle)}</td>
        <td>${escapeHtml(item.phone)}</td>
        <td>${statusBadge(item.status, applicationStatus[item.status] || item.status)}</td>
        <td>${escapeHtml(item.appliedAt)}</td>
        <td><div class="row-actions">${applicationActions(item)}</div></td>
      </tr>
    `).join("")
    : emptyRow("没有匹配的投递记录", 8);
}

function renderMessages() {
  const list = $("messageThreadList");
  if (!list) return;
  const threads = state.messageThreads || [];
  list.innerHTML = threads.length
    ? threads.map((thread) => `
      <button class="thread-card ${state.activeThread && state.activeThread.id === thread.id ? "active" : ""}" data-id="${thread.id}" type="button">
        <span class="thread-avatar">${thread.avatarUrl
          ? `<img src="${escapeAttr(thread.avatarUrl)}" alt="" onerror="this.style.display='none';this.nextElementSibling&&(this.nextElementSibling.style.display='flex');"><span style="display:none">${escapeHtml(thread.avatarText)}</span>`
          : escapeHtml(thread.avatarText)
        }</span>
        <span class="thread-main">
          <strong>${escapeHtml(thread.userName || "微信用户")}</strong>
          <em>${escapeHtml(thread.lastMessage || "暂无消息")}</em>
        </span>
        <span class="thread-side">
          <small>${escapeHtml(thread.updatedAt || "")}</small>
          ${thread.unreadAdmin > 0 ? `<b>${thread.unreadAdmin}</b>` : ""}
        </span>
      </button>
    `).join("")
    : `<div class="empty">暂无用户咨询</div>`;

  const active = state.activeThread;
  $("activeThreadName").textContent = active ? active.userName : "请选择会话";
  $("activeThreadMeta").textContent = active
    ? `openid：${active.openid || "-"} · 最近更新：${active.updatedAt || "-"}`
    : "用户在小程序消息页发送咨询后，会出现在这里。";

  const messages = state.activeMessages || [];
  $("adminChatMessages").innerHTML = active
    ? messages.map((item) => `
      <div class="admin-chat-bubble ${item.senderType}">
        <p>${escapeHtml(item.content)}</p>
        <span>${escapeHtml(item.senderType === "user" ? "用户" : "客服")} · ${escapeHtml(item.createdAt || "")}</span>
      </div>
    `).join("")
    : `<div class="empty">请选择左侧会话后回复用户</div>`;
}

async function refreshMessageThreads() {
  try {
    const messageThreads = await api("/api/admin/messages/threads");
    state.messageThreads = messageThreads;
    renderMessages();
    showToast("客服消息已刷新");
  } catch (error) {
    showToast(error.message);
  }
}

async function handleMessageThreadClick(event) {
  const card = event.target.closest("[data-id]");
  if (!card) return;
  await loadMessageThread(card.dataset.id);
}

async function loadMessageThread(id) {
  try {
    const data = await api(`/api/admin/messages/threads/${id}`);
    state.activeThread = data.thread;
    state.activeMessages = data.messages || [];
    state.messageThreads = state.messageThreads.map((thread) => (
      thread.id === data.thread.id ? Object.assign({}, thread, data.thread, { unreadAdmin: 0 }) : thread
    ));
    renderMessages();
  } catch (error) {
    showToast(error.message);
  }
}

async function handleAdminReply(event) {
  event.preventDefault();
  if (!state.activeThread) {
    showToast("请先选择用户会话");
    return;
  }
  const input = $("adminReplyInput");
  const content = clean(input.value);
  if (!content) {
    showToast("请输入回复内容");
    return;
  }
  try {
    const data = await api(`/api/admin/messages/threads/${state.activeThread.id}/reply`, {
      method: "POST",
      body: JSON.stringify({ content })
    });
    input.value = "";
    state.activeThread = data.thread;
    state.activeMessages = data.messages || [];
    await refreshMessageThreads();
    state.activeThread = data.thread;
    renderMessages();
    showToast("回复已发送");
  } catch (error) {
    showToast(error.message);
  }
}

async function handleSystemNotice(event) {
  event.preventDefault();
  const formEl = event.currentTarget;
  const btn = $("sendSystemNoticeBtn");
  const form = new FormData(formEl);
  const title = clean(form.get("title"));
  const content = clean(form.get("content"));
  const openid = clean(form.get("openid"));
  if (!title || !content) {
    showToast("请填写通知标题和内容");
    return;
  }
  if (btn) {
    btn.disabled = true;
    btn.textContent = "发布中...";
  }
  try {
    await api("/api/admin/messages/system", {
      method: "POST",
      body: JSON.stringify({ title, content, openid })
    });
    if (formEl) formEl.reset();
    showToast("系统通知已发布（若已存在则不重复）");
    await loadAllData();
  } catch (error) {
    showToast(error.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "发布通知";
    }
  }
}

function renderApiExample() {
  const example = {
    database: "MySQL: yancheng_lingong",
    job: {
      id: 2,
      title: "咖啡店晚班店员",
      category: "餐饮服务",
      salary: "20元/小时",
      salaryType: "周结",
      displayLocation: "蒸湘区",
      status: "published"
    },
    application: {
      jobId: 2,
      userId: 1,
      userName: "一米阳光",
      phone: "13900139001",
      wxAvatarUrl: "微信头像地址",
      note: "可连续做一周"
    },
    review: {
      status: "published",
      reviewReason: "",
      reviewerId: 1
    }
  };
  $("apiExample").textContent = JSON.stringify(example, null, 2);
}

async function handleTableAction(event) {
  const target = event.target.closest("[data-action]");
  if (!target) return;
  const { action, id, name } = target.dataset;

  try {
    if (action === "approve") await updateJobStatus(id, "published");
    if (action === "reject") await rejectJob(id);
    if (action === "offline") await updateJobStatus(id, "offline");
    if (action === "resubmit") await updateJobStatus(id, "pending");
    if (action === "convenience-offline") await updateConvenienceStatus(id, "offline");
    if (action === "convenience-restore") await updateConvenienceStatus(id, "published");
    if (action === "application-status") await updateApplicationStatus(id, target.dataset.status);
    if (action === "filter-user-apps") {
      $("applicationSearch").value = name;
      $("applicationStatusFilter").value = "all";
      setView("applications");
      renderApplications();
    }
  } catch (error) {
    showToast(error.message);
  }
}

async function handleJobSubmit(event) {
  event.preventDefault();
  await submitJobForm(event.currentTarget, { endpoint: "/api/admin/jobs", afterSubmit: (formEl) => {
    if (formEl) formEl.reset();
    closeModal();
    setView("jobs");
  }});
}

async function handlePublishSubmit(event) {
  event.preventDefault();
  await submitJobForm(event.currentTarget, { endpoint: "/api/admin/jobs", afterSubmit: (formEl) => {
    if (formEl) formEl.reset();
    setView("jobs");
  }});
}

async function submitJobForm(formEl, options) {
  const submitBtn = formEl.querySelector("button[type='submit']");
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.dataset.originalText = submitBtn.textContent;
    submitBtn.textContent = "发布中...";
  }

  try {
    const phone = String(formEl.querySelector("[name='phone']").value || "").trim();
    if (!/^1\d{10}$/.test(phone)) {
      showToast("请输入 11 位手机号");
      return;
    }

    const getValue = (name) => String(formEl.querySelector(`[name='${name}']`).value || "").trim();
    const job = {
      title: getValue("title"),
      category: getValue("category"),
      salary: getValue("salary"),
      salaryType: getValue("salaryType"),
      headcount: Number(getValue("headcount")) || 1,
      displayLocation: getValue("displayLocation"),
      location: getValue("location"),
      contact: getValue("contact"),
      phone,
      workTime: getValue("workTime"),
      company: getValue("company") || "管理员发布",
      description: getValue("description")
    };

    await api(options.endpoint, {
      method: "POST",
      body: JSON.stringify(job)
    });
    if (options.afterSubmit) options.afterSubmit(formEl);
    await loadAllData();
    showToast("岗位已发布，小程序端可立即查看");
  } catch (error) {
    showToast(error.message);
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = submitBtn.dataset.originalText || "立即发布";
    }
  }
}

async function updateJobStatus(id, status) {
  await api(`/api/admin/jobs/${id}/review`, {
    method: "PATCH",
    body: JSON.stringify({
      status,
      reviewReason: "",
      reviewerId: 1
    })
  });
  await loadAllData();
  showToast(`岗位已更新为：${jobStatus[status]}`);
}

async function rejectJob(id) {
  const reason = prompt("请输入驳回原因", "请补充岗位描述、薪资结算或联系方式。");
  if (reason === null) return;
  await api(`/api/admin/jobs/${id}/review`, {
    method: "PATCH",
    body: JSON.stringify({
      status: "rejected",
      reviewReason: reason.trim() || "未填写驳回原因",
      reviewerId: 1
    })
  });
  await loadAllData();
  showToast("岗位已驳回，并写入 MySQL");
}

async function updateApplicationStatus(id, status) {
  await api(`/api/admin/applications/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status })
  });
  await loadAllData();
  showToast(`投递状态已更新为：${applicationStatus[status]}`);
}

async function updateConvenienceStatus(id, status) {
  await api(`/api/admin/convenience/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status })
  });
  await loadAllData();
  showToast(status === "offline" ? "便民信息已下架" : "便民信息已恢复");
}

function jobActions(job) {
  if (job.status === "pending") {
    return `
      <button class="table-action" data-action="approve" data-id="${job.id}">通过</button>
      <button class="table-action danger" data-action="reject" data-id="${job.id}">驳回</button>
    `;
  }
  if (job.status === "published") {
    return `<button class="table-action danger" data-action="offline" data-id="${job.id}">下线</button>`;
  }
  return `<button class="table-action" data-action="resubmit" data-id="${job.id}">重新审核</button>`;
}

function convenienceActions(item) {
  if (item.status === "published") {
    return `<button class="table-action danger" data-action="convenience-offline" data-id="${item.id}">下架</button>`;
  }
  return `<button class="table-action" data-action="convenience-restore" data-id="${item.id}">恢复</button>`;
}

function applicationActions(item) {
  const buttons = [];
  if (item.status !== "contacted") buttons.push(`<button class="table-action" data-action="application-status" data-id="${item.id}" data-status="contacted">已联系</button>`);
  if (item.status !== "hired") buttons.push(`<button class="table-action" data-action="application-status" data-id="${item.id}" data-status="hired">录用</button>`);
  if (item.status !== "closed") buttons.push(`<button class="table-action danger" data-action="application-status" data-id="${item.id}" data-status="closed">关闭</button>`);
  return buttons.join("");
}

function openModal() {
  const jobModal = $("jobModal");
  if (jobModal) jobModal.hidden = false;
  
  const titleInput = document.querySelector("[name='title']");
  if (titleInput) titleInput.focus();
}

function closeModal() {
  const jobModal = $("jobModal");
  if (jobModal) jobModal.hidden = true;
  
  const jobForm = $("jobForm");
  if (jobForm) jobForm.reset();
}

async function exportData() {
  try {
    const data = await api("/api/admin/export");
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `雁城零工后台数据_${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showToast("已从 MySQL 导出数据");
  } catch (error) {
    showToast(error.message);
  }
}

function statusBadge(status, text) {
  return `<span class="status ${status}">${escapeHtml(text)}</span>`;
}

function emptyText(text) {
  return `<div class="empty">${escapeHtml(text)}</div>`;
}

function emptyRow(text, colspan) {
  return `<tr><td colspan="${colspan}"><div class="empty">${escapeHtml(text)}</div></td></tr>`;
}

function showToast(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2800);
}

function clean(value) {
  return String(value || "").trim();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function $(id) {
  return document.getElementById(id);
}
