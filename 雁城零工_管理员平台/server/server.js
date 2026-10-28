require("dotenv").config();

const path = require("path");
const crypto = require("crypto");
const fs = require("fs");
const https = require("https");
const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise");
const multer = require("multer");

const app = express();
const port = Number(process.env.PORT || 3000);

const pool = mysql.createPool({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "yancheng_lingong",
  waitForConnections: true,
  connectionLimit: 10,
  charset: "utf8mb4",
  dateStrings: true
});

const adminUsername = process.env.ADMIN_USERNAME || "admin";
const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
const sessions = new Map();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "..")));

// ========== 头像文件上传配置 ==========
const UPLOAD_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || ".jpg";
    const name = crypto.randomBytes(12).toString("hex") + Date.now() + ext;
    cb(null, name);
  }
});

const avatarUpload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /\/(jpeg|jpg|png|webp)$/;
    cb(null, allowed.test(file.mimetype));
  }
});

// 静态文件服务（uploads 目录）
app.use("/uploads", express.static(UPLOAD_DIR));

const jobStatuses = new Set(["pending", "published", "rejected", "offline"]);
const applicationStatuses = new Set(["new", "contacted", "hired", "closed"]);
const asyncHandler = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
const convenienceStatuses = new Set(["pending", "published", "rejected", "offline"]);

// 头像/图片通用上传接口（放在 asyncHandler 之后）
app.post("/api/upload/avatar", avatarUpload.single("file"), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ code: 400, message: "未上传文件或格式不支持" });
  const url = `/uploads/${req.file.filename}`;
  res.json({ code: 0, data: { url } });
}));

app.post("/api/upload/image", avatarUpload.single("file"), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ code: 400, message: "未上传文件或格式不支持" });
  const url = `/uploads/${req.file.filename}`;
  res.json({ code: 0, data: { url } });
}));

app.get("/api/health", asyncHandler(async (req, res) => {
  await pool.query("SELECT 1");
  res.json({ code: 0, message: "ok" });
}));

app.post("/api/admin/login", asyncHandler(async (req, res) => {
  const { username = "", password = "" } = req.body || {};
  if (username !== adminUsername || password !== adminPassword) {
    return res.status(401).json({ code: 401, message: "用户名或密码错误" });
  }

  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, {
    username,
    loginAt: Date.now()
  });
  res.setHeader("Set-Cookie", serializeCookie("yc_admin_session", token, 8 * 60 * 60));
  res.json({ code: 0, data: { username } });
}));

app.get("/api/admin/me", requireAdmin, asyncHandler(async (req, res) => {
  res.json({ code: 0, data: { username: req.admin.username } });
}));

app.post("/api/admin/logout", requireAdmin, asyncHandler(async (req, res) => {
  const token = getCookie(req, "yc_admin_session");
  if (token) sessions.delete(token);
  res.setHeader("Set-Cookie", serializeCookie("yc_admin_session", "", 0));
  res.json({ code: 0, data: true });
}));

app.get("/api/jobs", asyncHandler(async (req, res) => {
  const { keyword = "", category = "", area = "", salaryType = "", page = 1, pageSize = 20 } = req.query;
  // 首页/找零工只展示管理员后台发布的岗位（source='admin'）
  const where = ["status = 'published'", "source = 'admin'"];
  const params = [];

  if (keyword) {
    where.push("(title LIKE ? OR company LIKE ? OR display_location LIKE ? OR location LIKE ?)");
    const value = `%${keyword}%`;
    params.push(value, value, value, value);
  }
  if (category) {
    where.push("category = ?");
    params.push(category);
  }
  if (area) {
    where.push("display_location = ?");
    params.push(area);
  }
  if (salaryType) {
    where.push("salary_type = ?");
    params.push(salaryType);
  }

  const limit = Math.max(1, Math.min(Number(pageSize) || 20, 100));
  const offset = (Math.max(1, Number(page) || 1) - 1) * limit;
  const [rows] = await pool.query(
    `SELECT SQL_CALC_FOUND_ROWS * FROM jobs WHERE ${where.join(" AND ")} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const [[countRow]] = await pool.query("SELECT FOUND_ROWS() AS total");
  res.json({ code: 0, data: { list: rows.map(mapJob), total: countRow.total } });
}));

app.post("/api/wechat/jobs", asyncHandler(async (req, res) => {
  const body = req.body || {};
  const required = ["title", "category", "salary", "salaryType", "displayLocation", "location", "contact", "phone"];
  const missing = required.filter((key) => !String(body[key] || "").trim());
  if (missing.length) {
    return res.status(400).json({ code: 400, message: `缺少字段：${missing.join(", ")}` });
  }

  const [result] = await pool.query(
    `INSERT INTO jobs
      (title, category, salary, salary_type, headcount, display_location, location, company, contact, phone, work_time, description, status, source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'wechat')`,
    [
      body.title,
      body.category,
      body.salary,
      body.salaryType,
      Number(body.headcount) || 1,
      body.displayLocation,
      body.location,
      body.company || `${body.contact}发布`,
      body.contact,
      body.phone,
      body.workTime || "",
      body.description || ""
    ]
  );
  const job = await getJob(result.insertId);
  res.status(201).json({ code: 0, data: job });
}));

// ========== 小程序便民信息 ==========
app.get("/api/convenience", asyncHandler(async (req, res) => {
  const { keyword = "", area = "", category = "", page = 1, pageSize = 20 } = req.query;
  const where = ["status = 'published'"];
  const params = [];

  if (keyword) {
    where.push("(content LIKE ? OR contact_name LIKE ? OR address LIKE ? OR area LIKE ? OR category LIKE ?)");
    const value = `%${keyword}%`;
    params.push(value, value, value, value, value);
  }
  if (area) {
    where.push("area = ?");
    params.push(area);
  }
  if (category) {
    where.push("category = ?");
    params.push(category);
  }

  const limit = Math.max(1, Math.min(Number(pageSize) || 20, 100));
  const offset = (Math.max(1, Number(page) || 1) - 1) * limit;
  const [rows] = await pool.query(
    `SELECT SQL_CALC_FOUND_ROWS * FROM convenience_posts WHERE ${where.join(" AND ")} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const [[countRow]] = await pool.query("SELECT FOUND_ROWS() AS total");
  res.json({ code: 0, data: { list: rows.map(mapConveniencePost), total: countRow.total } });
}));

app.post("/api/wechat/convenience", asyncHandler(async (req, res) => {
  const body = req.body || {};
  const required = ["category", "area", "content", "contactName", "contactPhone", "address"];
  const missing = required.filter((key) => !String(body[key] || "").trim());
  if (missing.length) {
    return res.status(400).json({ code: 400, message: `缺少字段：${missing.join(", ")}` });
  }

  const phone = String(body.contactPhone || "").trim();
  if (!/^1\d{10}$/.test(phone)) {
    return res.status(400).json({ code: 400, message: "请输入 11 位手机号" });
  }

  const images = Array.isArray(body.images) ? JSON.stringify(body.images) : "[]";
  const [result] = await pool.query(
    `INSERT INTO convenience_posts
      (openid, category, area, content, images, contact_name, contact_phone, other_contact, address, latitude, longitude, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published')`,
    [
      body.openid || null,
      body.category,
      body.area,
      body.content,
      images,
      body.contactName,
      phone,
      body.otherContact || "",
      body.address,
      body.latitude || null,
      body.longitude || null
    ]
  );
  const post = await getConveniencePost(result.insertId);
  res.status(201).json({ code: 0, data: post, message: "便民信息发布成功" });
}));

// 便民信息详情：访问时自动增加浏览量
app.get("/api/convenience/:id", asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ code: 400, message: "参数错误" });
  }

  const post = await getConveniencePost(id);
  if (!post) {
    return res.status(404).json({ code: 404, message: "便民信息不存在" });
  }

  // 浏览量 +1
  await pool.query("UPDATE convenience_posts SET view_count = view_count + 1 WHERE id = ?", [id]);
  post.viewCount = post.viewCount + 1;

  res.json({ code: 0, data: post });
}));

app.post("/api/wechat/convenience/:id/report", asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ code: 400, message: "参数错误" });
  }

  const post = await getConveniencePostRow(id);
  if (!post) {
    return res.status(404).json({ code: 404, message: "便民信息不存在" });
  }

  const body = req.body || {};
  const openid = normalizeOpenid(body.openid) || null;
  const userId = Number(body.userId) || null;
  const reporter = await getTrustedConvenienceReporter({ userId, openid });
  if (!reporter) {
    return res.status(400).json({ code: 400, message: "缺少有效举报人身份" });
  }
  const reporterKey = reporter.reporterKey;

  const conn = await pool.getConnection();
  let created = false;
  try {
    await conn.beginTransaction();
    await conn.query(
      "INSERT INTO convenience_reports (post_id, openid, user_id, reporter_key) VALUES (?, ?, ?, ?)",
      [id, reporter.openid, reporter.userId, reporterKey]
    );
    await conn.query(
      "UPDATE convenience_posts SET report_count = report_count + 1, last_reported_at = NOW() WHERE id = ?",
      [id]
    );
    await conn.commit();
    created = true;
  } catch (error) {
    await conn.rollback();
    if (error && error.code !== "ER_DUP_ENTRY") {
      throw error;
    }
  } finally {
    conn.release();
  }

  const refreshed = await getConveniencePost(id);
  res.status(created ? 201 : 200).json(Object.assign({
    code: 0,
    data: {
      postId: id,
      reportCount: refreshed ? refreshed.reportCount : Number(post.report_count || 0) + (created ? 1 : 0)
    },
    message: "举报已提交"
  }, { message: created ? "举报已提交" : "请勿重复举报" }));
}));

app.use("/api/admin", requireAdmin);

app.get("/api/admin/convenience", asyncHandler(async (req, res) => {
  const { keyword = "", status = "all" } = req.query;
  const where = [];
  const params = [];

  if (status !== "all") {
    where.push("status = ?");
    params.push(status);
  }
  if (keyword) {
    where.push("(content LIKE ? OR contact_name LIKE ? OR contact_phone LIKE ? OR address LIKE ? OR area LIKE ? OR category LIKE ?)");
    const value = `%${keyword}%`;
    params.push(value, value, value, value, value, value);
  }

  const sql = `
    SELECT * FROM convenience_posts
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY report_count DESC, last_reported_at DESC, created_at DESC
  `;
  const [rows] = await pool.query(sql, params);
  res.json({ code: 0, data: rows.map(mapConveniencePost) });
}));

app.patch("/api/admin/convenience/:id/status", asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const { status, offlineReason = "" } = req.body || {};
  if (!["published", "offline"].includes(status)) {
    return res.status(400).json({ code: 400, message: "便民信息状态不正确" });
  }

  const current = await getConveniencePostRow(id, { includeUnpublished: true });
  if (!current) {
    return res.status(404).json({ code: 404, message: "便民信息不存在" });
  }

  if (status === "offline") {
    const nextOfflineReason = String(offlineReason || "").trim() || "举报下架";
    const moderatorId = getAdminReviewerId(req.admin);
    await pool.query(
      `UPDATE convenience_posts
       SET status = 'offline', offline_reason = ?, offline_by = ?
       WHERE id = ?`,
      [nextOfflineReason, moderatorId, id]
    );
    await pool.query(
      "UPDATE convenience_reports SET status = 'resolved' WHERE post_id = ? AND status = 'pending'",
      [id]
    );
  } else {
    await pool.query(
      `UPDATE convenience_posts
       SET status = 'published', offline_reason = '', offline_by = NULL
       WHERE id = ?`,
      [id]
    );
  }

  const refreshed = await getConveniencePost(id, { includeUnpublished: true });
  res.json({ code: 0, data: refreshed });
}));

app.get("/api/admin/jobs", asyncHandler(async (req, res) => {
  const { keyword = "", status = "all" } = req.query;
  const where = [];
  const params = [];

  if (status !== "all") {
    where.push("status = ?");
    params.push(status);
  }
  if (keyword) {
    where.push("(title LIKE ? OR company LIKE ? OR contact LIKE ? OR display_location LIKE ? OR location LIKE ?)");
    const value = `%${keyword}%`;
    params.push(value, value, value, value, value);
  }

  const sql = `SELECT * FROM jobs ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY created_at DESC`;
  const [rows] = await pool.query(sql, params);
  res.json({ code: 0, data: rows.map(mapJob) });
}));

app.post("/api/admin/jobs", asyncHandler(async (req, res) => {
  const body = req.body || {};
  const required = ["title", "category", "salary", "salaryType", "displayLocation", "location", "contact", "phone"];
  const missing = required.filter((key) => !String(body[key] || "").trim());
  if (missing.length) {
    return res.status(400).json({ code: 400, message: `缺少字段：${missing.join(", ")}` });
  }

  const phone = String(body.phone || "").trim();
  if (!/^1\d{10}$/.test(phone)) {
    return res.status(400).json({ code: 400, message: "请输入 11 位手机号" });
  }

  const [result] = await pool.query(
    `INSERT INTO jobs
      (title, category, salary, salary_type, headcount, display_location, location, company, contact, phone, work_time, description, status, source, reviewer_id, reviewed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', 'admin', ?, NOW())`,
    [
      body.title,
      body.category,
      normalizeSalary(body.salary, body.salaryType),
      body.salaryType,
      Number(body.headcount) || 1,
      body.displayLocation,
      body.location,
      body.company || "管理员发布",
      body.contact,
      phone,
      body.workTime || "",
      body.description || "",
      1
    ]
  );
  const job = await getJob(result.insertId);
  res.status(201).json({ code: 0, data: job, message: "岗位已发布，小程序端可立即查看" });
}));

// 兼容旧路径：管理员从顶部按钮弹窗发布岗位时也直接发布（已废弃，请使用 /api/admin/jobs）
app.post("/api/jobs", requireAdmin, asyncHandler(async (req, res) => {
  const body = req.body || {};
  const required = ["title", "category", "salary", "salaryType", "displayLocation", "location", "contact", "phone"];
  const missing = required.filter((key) => !String(body[key] || "").trim());
  if (missing.length) {
    return res.status(400).json({ code: 400, message: `缺少字段：${missing.join(", ")}` });
  }

  const phone = String(body.phone || "").trim();
  if (!/^1\d{10}$/.test(phone)) {
    return res.status(400).json({ code: 400, message: "请输入 11 位手机号" });
  }

  const [result] = await pool.query(
    `INSERT INTO jobs
      (title, category, salary, salary_type, headcount, display_location, location, company, contact, phone, work_time, description, status, source, reviewer_id, reviewed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', 'admin', ?, NOW())`,
    [
      body.title,
      body.category,
      normalizeSalary(body.salary, body.salaryType),
      body.salaryType,
      Number(body.headcount) || 1,
      body.displayLocation,
      body.location,
      body.company || "管理员发布",
      body.contact,
      phone,
      body.workTime || "",
      body.description || "",
      1
    ]
  );
  const job = await getJob(result.insertId);
  res.status(201).json({ code: 0, data: job, message: "岗位已发布，小程序端可立即查看" });
}));

app.patch("/api/admin/jobs/:id/review", asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const { status, reviewReason = "", reviewerId = 1 } = req.body || {};
  if (!jobStatuses.has(status)) {
    return res.status(400).json({ code: 400, message: "岗位状态不正确" });
  }

  await pool.query(
    `UPDATE jobs
     SET status = ?,
         review_reason = ?,
         reviewer_id = ?,
         reviewed_at = CASE WHEN ? IN ('published', 'rejected') THEN NOW() ELSE reviewed_at END,
         offline_at = CASE WHEN ? = 'offline' THEN NOW() ELSE NULL END
     WHERE id = ?`,
    [status, reviewReason || null, reviewerId || null, status, status, id]
  );
  const job = await getJob(id);
  res.json({ code: 0, data: job });
}));

app.get("/api/admin/users", asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT
       u.*,
       COUNT(DISTINCT f.id) AS favorites,
       COUNT(DISTINCT a.id) AS applications
     FROM wx_users u
     LEFT JOIN user_favorites f ON f.user_id = u.id
     LEFT JOIN applications a ON a.user_id = u.id
     GROUP BY u.id
     ORDER BY u.last_login_at DESC, u.created_at DESC`
  );
  res.json({ code: 0, data: rows.map(mapUser) });
}));

/**
 * 微信登录
 * 前端传 code（wx.login 获取）、nickname、avatarUrl
 * 后端调用 jscode2session 换取真实 openid，再写入/更新用户
 */
app.post("/api/auth/wechat-login", asyncHandler(async (req, res) => {
  const body = req.body || {};
  const code = String(body.code || "").trim();
  const appid = process.env.WX_APPID || "";
  const secret = process.env.WX_SECRET || "";

  let openid = "";
  let unionid = body.unionid || null;

  // 用 code 换取真实 openid
  if (code && appid && secret && !code.startsWith("local_")) {
    try {
      const session = await wxRequest(
        `https://api.weixin.qq.com/sns/jscode2session?appid=${appid}&secret=${secret}&js_code=${code}&grant_type=authorization_code`
      );
      if (session.errcode) {
        console.warn("[wechat-login] jscode2session 错误：", session.errmsg);
      } else {
        openid = session.openid || "";
        unionid = session.unionid || unionid;
      }
    } catch (e) {
      console.warn("[wechat-login] jscode2session 请求失败：", e.message);
    }
  }

  // 兜底：没有拿到 openid 时用 code 的 md5 作为临时 openid（开发调试）
  if (!openid) {
    openid = "wx_" + crypto.createHash("md5").update(code || ("fallback_" + Date.now())).digest("hex");
    console.warn("[wechat-login] 未能换取真实 openid，使用临时 openid：", openid);
  }

  const nickname = String(body.nickname || "").trim() || "微信用户";
  const avatarUrl = String(body.avatarUrl || "").trim();

  await pool.query(
    `INSERT INTO wx_users (openid, unionid, nickname, avatar_url, phone, city, last_login_at)
     VALUES (?, ?, ?, ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE
       unionid  = IF(VALUES(unionid)  IS NOT NULL, VALUES(unionid),  unionid),
       nickname = IF(VALUES(nickname) != '',        VALUES(nickname), nickname),
       avatar_url = IF(VALUES(avatar_url) != '',    VALUES(avatar_url), avatar_url),
       city       = IF(VALUES(city) != '',          VALUES(city), city),
       last_login_at = NOW()`,
    [openid, unionid, nickname, avatarUrl, body.phone || "", body.city || ""]
  );
  const [rows] = await pool.query("SELECT * FROM wx_users WHERE openid = ?", [openid]);
  res.json({ code: 0, data: mapUser(rows[0]) });
}));

/**
 * 本机号码一键登录
 * 前端传 phoneCode（getPhoneNumber 获取的 code）和 loginCode（wx.login 获取的 code）
 * 后端调用微信 API 换取手机号，然后创建/更新用户
 */
app.post("/api/auth/phone-login", asyncHandler(async (req, res) => {
  const body = req.body || {};
  const phoneCode = String(body.phoneCode || "").trim();
  const loginCode = String(body.loginCode || "").trim();

  if (!phoneCode) {
    return res.status(400).json({ code: 400, message: "缺少手机号授权 code (phoneCode)" });
  }

  const appid = process.env.WX_APPID || "";
  const secret = process.env.WX_SECRET || "";

  // 如果没有配置 AppID/Secret，走降级模式（开发调试用）
  if (!appid || !secret) {
    console.warn("[phone-login] WX_APPID 或 WX_SECRET 未配置，使用降级模式（手机号不可解析）");
    // 降级：用 phoneCode 作为唯一标识，不解析真实手机号
    const fallbackOpenid = "phone_" + crypto.createHash("md5").update(phoneCode).digest("hex");
    await pool.query(
      `INSERT INTO wx_users (openid, nickname, last_login_at)
       VALUES (?, ?, NOW())
       ON DUPLICATE KEY UPDATE last_login_at = NOW()`,
      [fallbackOpenid, "零工用户"]
    );
    const [rows] = await pool.query("SELECT * FROM wx_users WHERE openid = ?", [fallbackOpenid]);
    return res.json({ code: 0, data: mapUser(rows[0]) });
  }

  // 第一步：用 loginCode 换取 openid（如果有 loginCode）
  let openid = "";
  if (loginCode) {
    try {
      const session = await wxRequest(
        `https://api.weixin.qq.com/sns/jscode2session?appid=${appid}&secret=${secret}&js_code=${loginCode}&grant_type=authorization_code`
      );
      openid = session.openid || "";
    } catch (e) {
      console.warn("[phone-login] jscode2session 失败：", e.message);
    }
  }

  // 第二步：用 phoneCode 换取手机号（需要先获取 access_token）
  let phone = "";
  try {
    const tokenData = await wxRequest(
      `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appid}&secret=${secret}`
    );
    const accessToken = tokenData.access_token || "";
    if (!accessToken) {
      throw new Error("获取 access_token 失败：" + JSON.stringify(tokenData));
    }

    const phoneData = await wxPost(
      `https://api.weixin.qq.com/wxa/business/getuserphonenumber?access_token=${accessToken}`,
      { code: phoneCode }
    );

    if (phoneData.errcode && phoneData.errcode !== 0) {
      throw new Error(`获取手机号失败：errcode=${phoneData.errcode} errmsg=${phoneData.errmsg}`);
    }

    phone = (phoneData.phone_info && phoneData.phone_info.purePhoneNumber) || "";
  } catch (e) {
    console.error("[phone-login] 获取手机号失败：", e.message);
    return res.status(502).json({ code: 502, message: "微信手机号接口调用失败：" + e.message });
  }

  // 第三步：用手机号或 openid 存储用户
  const finalOpenid = openid || ("phone_" + crypto.createHash("md5").update(phone || phoneCode).digest("hex"));
  const nickname = phone ? phone.replace(/(\d{3})\d{4}(\d{4})/, "$1****$2") : "零工用户";

  await pool.query(
    `INSERT INTO wx_users (openid, nickname, phone, last_login_at)
     VALUES (?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE
       phone = IF(VALUES(phone) != '', VALUES(phone), phone),
       nickname = IF(nickname = '' OR nickname = '零工用户' OR nickname LIKE '%****%', VALUES(nickname), nickname),
       last_login_at = NOW()`,
    [finalOpenid, nickname, phone]
  );
  const [rows] = await pool.query("SELECT * FROM wx_users WHERE openid = ?", [finalOpenid]);
  res.json({ code: 0, data: mapUser(rows[0]) });
}));

app.get("/api/wechat/messages", asyncHandler(async (req, res) => {
  const openid = normalizeOpenid(req.query.openid || req.query.userId);
  if (!openid) return res.status(400).json({ code: 400, message: "缺少用户标识 openid" });

  const thread = await getSupportThreadByOpenid(openid);
  const notifications = await getSystemNotifications(openid);
  const countResult = await pool.query(
    `SELECT COUNT(DISTINCT s.id) AS cnt
     FROM system_notifications s
     LEFT JOIN user_notification_reads r ON r.notification_id = s.id AND r.openid = ?
     WHERE (s.openid IS NULL OR s.openid = ?) AND r.read_at IS NULL`,
    [openid, openid]
  );
  const unreadCount = countResult[0]?.[0]?.cnt ?? 0;
  res.json({
    code: 0,
    data: {
      service: thread ? mapThread(thread) : null,
      notifications: notifications.map(mapNotification),
      unreadCount
    }
  });
}));

app.post("/api/wechat/messages/notifications/read", asyncHandler(async (req, res) => {
  const openid = normalizeOpenid(req.body.openid);
  if (!openid) return res.status(400).json({ code: 400, message: "缺少用户标识 openid" });

  const [notifs] = await pool.query(
    "SELECT id FROM system_notifications WHERE openid IS NULL OR openid = ?",
    [openid]
  );
  if (notifs.length > 0) {
    const placeholders = notifs.map(() => "(?, ?)").join(", ");
    const values = [];
    for (const n of notifs) {
      values.push(openid, n.id);
    }
    await pool.query(
      `INSERT IGNORE INTO user_notification_reads (openid, notification_id) VALUES ${placeholders}`,
      values
    );
  }
  res.json({ code: 0, data: { unreadCount: 0 } });
}));

app.get("/api/wechat/messages/customer-service", asyncHandler(async (req, res) => {
  const openid = normalizeOpenid(req.query.openid || req.query.userId);
  if (!openid) return res.status(400).json({ code: 400, message: "缺少用户标识 openid" });

  const thread = await ensureSupportThread(openid, {
    userId: req.query.userId,
    userName: req.query.userName || "微信用户",
    avatarUrl: req.query.avatarUrl || ""
  });
  const messages = await getThreadMessages(thread.id);
  await pool.query("UPDATE support_threads SET unread_user = 0 WHERE id = ?", [thread.id]);
  res.json({ code: 0, data: { thread: mapThread(thread), messages: messages.map(mapSupportMessage) } });
}));

app.post("/api/wechat/messages/customer-service", asyncHandler(async (req, res) => {
  const body = req.body || {};
  const openid = normalizeOpenid(body.openid || body.userId);
  const content = String(body.content || "").trim();
  if (!openid) return res.status(400).json({ code: 400, message: "缺少用户标识 openid" });
  if (!content) return res.status(400).json({ code: 400, message: "消息内容不能为空" });

  const thread = await ensureSupportThread(openid, {
    userId: body.userId,
    userName: body.userName || body.nickname || "微信用户",
    avatarUrl: body.avatarUrl || ""
  });
  await pool.query("INSERT INTO support_messages (thread_id, sender_type, content) VALUES (?, 'user', ?)", [thread.id, content]);
  await pool.query(
    "UPDATE support_threads SET last_message = ?, unread_admin = unread_admin + 1, updated_at = NOW() WHERE id = ?",
    [content.slice(0, 500), thread.id]
  );
  const messages = await getThreadMessages(thread.id);
  const refreshed = await getSupportThread(thread.id);
  res.status(201).json({ code: 0, data: { thread: mapThread(refreshed), messages: messages.map(mapSupportMessage) } });
}));

app.get("/api/admin/applications", asyncHandler(async (req, res) => {
  const { keyword = "", status = "all" } = req.query;
  const where = [];
  const params = [];

  if (status !== "all") {
    where.push("a.status = ?");
    params.push(status);
  }
  if (keyword) {
    where.push("(a.user_name LIKE ? OR a.phone LIKE ? OR j.title LIKE ?)");
    const value = `%${keyword}%`;
    params.push(value, value, value);
  }

  const [rows] = await pool.query(
    `SELECT a.*, j.title AS job_title
     FROM applications a
     LEFT JOIN jobs j ON j.id = a.job_id
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY a.created_at DESC`,
    params
  );
  res.json({ code: 0, data: rows.map(mapApplication) });
}));

app.post("/api/applications", asyncHandler(async (req, res) => {
  const body = req.body || {};
  const required = ["userId", "jobId", "userName", "phone"];
  const missing = required.filter((key) => !String(body[key] || "").trim());
  if (missing.length) {
    return res.status(400).json({ code: 400, message: `缺少字段：${missing.join(", ")}` });
  }

  try {
    const [result] = await pool.query(
      `INSERT INTO applications (user_id, job_id, user_name, phone, gender, age, wx_avatar_url, note, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'new')`,
      [body.userId, body.jobId, body.userName, body.phone, body.gender || '', body.age || null, body.wxAvatarUrl || "", body.note || ""]
    );
    // 同步回写用户画像到 wx_users，后续投递无需重复填写
    await pool.query(
      `UPDATE wx_users
       SET name   = IF(? != '', ?, name),
           phone  = IF(? != '', ?, phone),
           gender = IF(? != '', ?, gender),
           age    = IF(? IS NOT NULL, ?, age)
       WHERE id = ?`,
      [body.userName, body.userName,
       body.phone, body.phone,
       body.gender || '', body.gender || '',
       body.age || null, body.age || null,
       body.userId]
    );
    const item = await getApplication(result.insertId);
    res.status(201).json({ code: 0, data: item });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ code: 409, message: "该用户已投递过此岗位" });
    }
    throw error;
  }
}));

app.patch("/api/admin/applications/:id/status", asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body || {};
  if (!applicationStatuses.has(status)) {
    return res.status(400).json({ code: 400, message: "投递状态不正确" });
  }

  await pool.query(
    `UPDATE applications
     SET status = ?,
         contacted_at = CASE WHEN ? = 'contacted' THEN NOW() ELSE contacted_at END,
         hired_at = CASE WHEN ? = 'hired' THEN NOW() ELSE hired_at END,
         closed_at = CASE WHEN ? = 'closed' THEN NOW() ELSE closed_at END
     WHERE id = ?`,
    [status, status, status, status, id]
  );
  const item = await getApplication(id);
  res.json({ code: 0, data: item });
}));

app.get("/api/admin/messages/threads", asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT t.*,
            u.nickname AS wu_nickname, u.avatar_url AS wu_avatar_url
     FROM support_threads t
     LEFT JOIN wx_users u ON u.openid COLLATE utf8mb4_unicode_ci = t.openid COLLATE utf8mb4_unicode_ci
     ORDER BY t.updated_at DESC`
  );
  res.json({ code: 0, data: rows.map(mapThread) });
}));

app.get("/api/admin/messages/threads/:id", asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const thread = await getSupportThread(id);
  if (!thread) return res.status(404).json({ code: 404, message: "会话不存在" });

  await pool.query("UPDATE support_threads SET unread_admin = 0 WHERE id = ?", [id]);
  const messages = await getThreadMessages(id);
  res.json({ code: 0, data: { thread: mapThread(thread), messages: messages.map(mapSupportMessage) } });
}));

app.post("/api/admin/messages/threads/:id/reply", asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const content = String((req.body || {}).content || "").trim();
  if (!content) return res.status(400).json({ code: 400, message: "回复内容不能为空" });

  const thread = await getSupportThread(id);
  if (!thread) return res.status(404).json({ code: 404, message: "会话不存在" });

  await pool.query("INSERT INTO support_messages (thread_id, sender_type, content) VALUES (?, 'admin', ?)", [id, content]);
  await pool.query(
    "UPDATE support_threads SET last_message = ?, unread_user = unread_user + 1, updated_at = NOW() WHERE id = ?",
    [content.slice(0, 500), id]
  );
  const messages = await getThreadMessages(id);
  const refreshed = await getSupportThread(id);
  res.status(201).json({ code: 0, data: { thread: mapThread(refreshed), messages: messages.map(mapSupportMessage) } });
}));

app.post("/api/admin/messages/system", requireAdmin, asyncHandler(async (req, res) => {
  const body = req.body || {};
  const title = String(body.title || "").trim();
  const content = String(body.content || "").trim();
  if (!title || !content) return res.status(400).json({ code: 400, message: "通知标题和内容不能为空" });

  const openid = normalizeOpenid(body.openid) || null;
  const userId = body.userId || null;

  // 幂等：全局通知（openid/user_id 为空）在 1 分钟内已有相同标题+内容则不重复创建
  if (!openid && !userId) {
    const [duplicates] = await pool.query(
      `SELECT id FROM system_notifications
       WHERE openid IS NULL AND user_id IS NULL
         AND title = ? AND content = ?
         AND created_at >= DATE_SUB(NOW(), INTERVAL 1 MINUTE)
       ORDER BY created_at DESC LIMIT 1`,
      [title, content]
    );
    if (duplicates.length > 0) {
      const [rows] = await pool.query("SELECT * FROM system_notifications WHERE id = ?", [duplicates[0].id]);
      return res.status(200).json({ code: 0, message: "该通知已存在，未重复发布", data: mapNotification(rows[0]) });
    }
  }

  const [result] = await pool.query(
    "INSERT INTO system_notifications (openid, user_id, title, content) VALUES (?, ?, ?, ?)",
    [openid, userId, title, content]
  );
  const [rows] = await pool.query("SELECT * FROM system_notifications WHERE id = ?", [result.insertId]);
  res.status(201).json({ code: 0, data: mapNotification(rows[0]) });
}));

app.get("/api/admin/export", asyncHandler(async (req, res) => {
  const [jobs] = await pool.query("SELECT * FROM jobs ORDER BY created_at DESC");
  const [users] = await pool.query(
    `SELECT u.*, COUNT(DISTINCT f.id) AS favorites, COUNT(DISTINCT a.id) AS applications
     FROM wx_users u
     LEFT JOIN user_favorites f ON f.user_id = u.id
     LEFT JOIN applications a ON a.user_id = u.id
     GROUP BY u.id
     ORDER BY u.created_at DESC`
  );
  const [applications] = await pool.query(
    `SELECT a.*, j.title AS job_title FROM applications a LEFT JOIN jobs j ON j.id = a.job_id ORDER BY a.created_at DESC`
  );
  res.json({
    code: 0,
    data: {
      exportedAt: formatDate(new Date()),
      jobs: jobs.map(mapJob),
      users: users.map(mapUser),
      applications: applications.map(mapApplication)
    }
  });
}));

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ code: 500, message: "服务器错误", detail: error.message });
});

ensureMessageTables()
  .catch((error) => {
    console.warn("消息表初始化失败，接口访问时可能不可用：", error.message);
  })
  .then(() => migrateConvenienceTable())
  .catch((error) => {
    console.warn("convenience_posts 表初始化失败：", error.message);
  })
  .then(() => migrateConvenienceReportsTable())
  .catch((error) => {
    console.warn("convenience_reports 表初始化失败：", error.message);
  })
  .then(() => migrateJobsSourceColumn())
  .catch((error) => {
    console.warn("jobs.source 列迁移失败：", error.message);
  })
  .then(() => migrateApplicationsTable())
  .catch((error) => {
    console.warn("applications 表迁移失败：", error.message);
  })
  .then(() => migrateUsersTable())
  .catch((error) => {
    console.warn("wx_users 表迁移失败：", error.message);
  })
  .finally(() => {
    app.listen(port, () => {
      console.log(`雁城零工管理员平台已启动：http://localhost:${port}`);
    });
  });

function requireAdmin(req, res, next) {
  const token = getCookie(req, "yc_admin_session");
  const session = token ? sessions.get(token) : null;
  if (!session) {
    return res.status(401).json({ code: 401, message: "请先登录管理员平台" });
  }
  req.admin = session;
  next();
}

function getCookie(req, name) {
  const cookie = req.headers.cookie || "";
  return cookie
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

function serializeCookie(name, value, maxAge) {
  const encoded = encodeURIComponent(value);
  return `${name}=${encoded}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax`;
}

async function getJob(id) {
  const [rows] = await pool.query("SELECT * FROM jobs WHERE id = ?", [id]);
  return rows[0] ? mapJob(rows[0]) : null;
}

async function getConveniencePostRow(id, options = {}) {
  const where = ["id = ?"];
  if (!options.includeUnpublished) {
    where.push("status = 'published'");
  }
  const [rows] = await pool.query(
    `SELECT * FROM convenience_posts WHERE ${where.join(" AND ")} LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

async function getConveniencePost(id, options = {}) {
  const row = await getConveniencePostRow(id, options);
  return row ? mapConveniencePost(row) : null;
}

async function getApplication(id) {
  const [rows] = await pool.query(
    "SELECT a.*, j.title AS job_title FROM applications a LEFT JOIN jobs j ON j.id = a.job_id WHERE a.id = ?",
    [id]
  );
  return rows[0] ? mapApplication(rows[0]) : null;
}

async function ensureMessageTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS support_threads (
      id INT AUTO_INCREMENT PRIMARY KEY,
      openid VARCHAR(128) NOT NULL,
      user_id INT NULL,
      user_name VARCHAR(80) NOT NULL DEFAULT '',
      avatar_url VARCHAR(500) NOT NULL DEFAULT '',
      status ENUM('open','closed') NOT NULL DEFAULT 'open',
      last_message VARCHAR(500) NOT NULL DEFAULT '',
      unread_admin INT NOT NULL DEFAULT 0,
      unread_user INT NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_support_threads_openid (openid),
      KEY idx_support_threads_updated_at (updated_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS support_messages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      thread_id INT NOT NULL,
      sender_type ENUM('user','admin','system') NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_support_messages_thread_id (thread_id),
      CONSTRAINT fk_support_messages_thread
        FOREIGN KEY (thread_id) REFERENCES support_threads(id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS system_notifications (
      id INT AUTO_INCREMENT PRIMARY KEY,
      openid VARCHAR(128) NULL,
      user_id INT NULL,
      title VARCHAR(120) NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_system_notifications_openid (openid),
      KEY idx_system_notifications_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_notification_reads (
      id INT AUTO_INCREMENT PRIMARY KEY,
      openid VARCHAR(128) NOT NULL,
      notification_id INT NOT NULL,
      read_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_openid_notif (openid, notification_id),
      KEY idx_openid (openid)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

/**
 * 给 jobs 表增加 source 列，区分管理员发布（admin）与小程序用户发布（wechat）
 */
async function migrateJobsSourceColumn() {
  const [cols] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'jobs'
       AND COLUMN_NAME = 'source'`
  );
  if (!cols.length) {
    await pool.query("ALTER TABLE jobs ADD COLUMN source VARCHAR(20) NOT NULL DEFAULT 'wechat'");
    await pool.query("UPDATE jobs SET source = 'admin' WHERE reviewer_id IS NOT NULL OR status = 'published'");
  }
}

/**
 * 创建便民信息表 convenience_posts，用于存储小程序用户自行发布的信息
 */
async function migrateConvenienceTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS convenience_posts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      openid VARCHAR(128) NULL,
      category VARCHAR(40) NOT NULL DEFAULT '商业宣传',
      area VARCHAR(120) NOT NULL DEFAULT '',
      content TEXT NOT NULL,
      images TEXT NOT NULL,
      view_count INT NOT NULL DEFAULT 0,
      contact_name VARCHAR(80) NOT NULL DEFAULT '',
      contact_phone VARCHAR(20) NOT NULL DEFAULT '',
      other_contact VARCHAR(120) NOT NULL DEFAULT '',
      address VARCHAR(300) NOT NULL DEFAULT '',
      latitude DECIMAL(10, 8) DEFAULT NULL,
      longitude DECIMAL(11, 8) DEFAULT NULL,
      status ENUM('pending','published','rejected','offline') NOT NULL DEFAULT 'published',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_status_created_at (status, created_at),
      KEY idx_openid (openid)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // 为已存在的表补齐 category / view_count 列
  const [cols] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'convenience_posts'
       AND COLUMN_NAME IN ('category', 'view_count', 'report_count', 'last_reported_at', 'offline_reason', 'offline_by')`
  );
  const existing = new Set(cols.map((c) => c.COLUMN_NAME));
  if (!existing.has('category')) {
    await pool.query("ALTER TABLE convenience_posts ADD COLUMN category VARCHAR(40) NOT NULL DEFAULT '商业宣传'");
  }
  if (!existing.has('view_count')) {
    await pool.query("ALTER TABLE convenience_posts ADD COLUMN view_count INT NOT NULL DEFAULT 0");
  }
  if (!existing.has('report_count')) {
    await pool.query("ALTER TABLE convenience_posts ADD COLUMN report_count INT NOT NULL DEFAULT 0");
  }
  if (!existing.has('last_reported_at')) {
    await pool.query("ALTER TABLE convenience_posts ADD COLUMN last_reported_at DATETIME NULL");
  }
  if (!existing.has('offline_reason')) {
    await pool.query("ALTER TABLE convenience_posts ADD COLUMN offline_reason VARCHAR(120) NOT NULL DEFAULT ''");
  }
  if (!existing.has('offline_by')) {
    await pool.query("ALTER TABLE convenience_posts ADD COLUMN offline_by INT NULL");
  }
}

/**
 * 给 applications 表增加 gender/age 列（MySQL 5.7 兼容写法）
 * 先查 information_schema，不存在再 ALTER，避免重复执行报错
 */
async function migrateConvenienceReportsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS convenience_reports (
      id INT AUTO_INCREMENT PRIMARY KEY,
      post_id INT NOT NULL,
      openid VARCHAR(128) NULL,
      user_id INT NULL,
      reporter_key VARCHAR(160) NOT NULL,
      status ENUM('pending','ignored','resolved') NOT NULL DEFAULT 'pending',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_post_reporter (post_id, reporter_key),
      KEY idx_post_id_created_at (post_id, created_at),
      KEY idx_status_created_at (status, created_at),
      CONSTRAINT fk_convenience_reports_post
        FOREIGN KEY (post_id) REFERENCES convenience_posts(id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  const [cols] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'convenience_reports'
       AND COLUMN_NAME IN ('reporter_key')`
  );
  if (!cols.length) {
    await pool.query("ALTER TABLE convenience_reports ADD COLUMN reporter_key VARCHAR(160) NOT NULL DEFAULT '' AFTER user_id");
  }

  await pool.query(`
    UPDATE convenience_reports
    SET reporter_key = CASE
      WHEN reporter_key IS NOT NULL AND reporter_key <> '' THEN reporter_key
      WHEN user_id IS NOT NULL THEN CONCAT('user:', user_id)
      WHEN openid IS NOT NULL AND openid <> '' THEN CONCAT('openid:', openid)
      ELSE CONCAT('legacy:', id)
    END
  `);

  await pool.query(`
    DELETE cr1 FROM convenience_reports cr1
    INNER JOIN convenience_reports cr2
      ON cr1.post_id = cr2.post_id
     AND cr1.reporter_key = cr2.reporter_key
     AND cr1.id > cr2.id
  `);

  const [indexes] = await pool.query(
    `SELECT INDEX_NAME FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'convenience_reports'
       AND INDEX_NAME = 'uk_post_reporter'`
  );
  if (!indexes.length) {
    await pool.query("ALTER TABLE convenience_reports ADD UNIQUE KEY uk_post_reporter (post_id, reporter_key)");
  }

  await pool.query(`
    UPDATE convenience_posts p
    LEFT JOIN (
      SELECT post_id, COUNT(*) AS total, MAX(created_at) AS last_reported_at
      FROM convenience_reports
      GROUP BY post_id
    ) r ON r.post_id = p.id
    SET p.report_count = COALESCE(r.total, 0),
        p.last_reported_at = r.last_reported_at
  `);
}

async function migrateApplicationsTable() {
  const [cols] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'applications'
       AND COLUMN_NAME IN ('gender', 'age')`
  );
  const existing = new Set(cols.map((c) => c.COLUMN_NAME));
  if (!existing.has('gender')) {
    await pool.query("ALTER TABLE applications ADD COLUMN gender VARCHAR(4) NOT NULL DEFAULT ''");
  }
  if (!existing.has('age')) {
    await pool.query("ALTER TABLE applications ADD COLUMN age TINYINT UNSIGNED DEFAULT NULL");
  }
}


/**
 * 给 wx_users 表增加 name/gender/age 列，用于持久化用户投递画像
 * 首次投递后自动回写，后续投递/重新登录均可直接填充
 */
async function migrateUsersTable() {
  const [cols] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'wx_users'
       AND COLUMN_NAME IN ('name', 'gender', 'age')`
  );
  const existing = new Set(cols.map((c) => c.COLUMN_NAME));
  if (!existing.has('name')) {
    await pool.query("ALTER TABLE wx_users ADD COLUMN name VARCHAR(40) NOT NULL DEFAULT ''");
  }
  if (!existing.has('gender')) {
    await pool.query("ALTER TABLE wx_users ADD COLUMN gender VARCHAR(4) NOT NULL DEFAULT ''");
  }
  if (!existing.has('age')) {
    await pool.query("ALTER TABLE wx_users ADD COLUMN age TINYINT UNSIGNED DEFAULT NULL");
  }
}

async function ensureSupportThread(openid, profile) {
  const safeOpenid = normalizeOpenid(openid);
  const userName = String((profile && profile.userName) || "微信用户").trim() || "微信用户";
  const avatarUrl = String((profile && profile.avatarUrl) || "").trim();
  const userId = Number(profile && profile.userId) || null;
  await pool.query(
    `INSERT INTO support_threads (openid, user_id, user_name, avatar_url, last_message)
     VALUES (?, ?, ?, ?, '您好，请直接说明想找的工作类型、区域和可上岗时间。')
     ON DUPLICATE KEY UPDATE
       user_id = COALESCE(VALUES(user_id), user_id),
       user_name = VALUES(user_name),
       avatar_url = VALUES(avatar_url)`,
    [safeOpenid, userId, userName, avatarUrl]
  );
  const thread = await getSupportThreadByOpenid(safeOpenid);
  const [countRows] = await pool.query("SELECT COUNT(*) AS count FROM support_messages WHERE thread_id = ?", [thread.id]);
  if (!Number(countRows[0].count)) {
    await pool.query(
      "INSERT INTO support_messages (thread_id, sender_type, content) VALUES (?, 'admin', ?)",
      [thread.id, "您好，我是雁城零工客服。请告诉我想找什么工作、所在区域和可上岗时间，我来帮您推荐。"]
    );
  }
  return getSupportThread(thread.id);
}

async function getSupportThread(id) {
  const [rows] = await pool.query(
    `SELECT t.*,
            u.nickname AS wu_nickname, u.avatar_url AS wu_avatar_url
     FROM support_threads t
     LEFT JOIN wx_users u ON u.openid COLLATE utf8mb4_unicode_ci = t.openid COLLATE utf8mb4_unicode_ci
     WHERE t.id = ?`,
    [id]
  );
  return rows[0] || null;
}

async function getSupportThreadByOpenid(openid) {
  const [rows] = await pool.query("SELECT * FROM support_threads WHERE openid = ?", [normalizeOpenid(openid)]);
  return rows[0] || null;
}

async function getThreadMessages(threadId) {
  const [rows] = await pool.query(
    "SELECT * FROM support_messages WHERE thread_id = ? ORDER BY created_at ASC, id ASC",
    [threadId]
  );
  return rows;
}

async function getSystemNotifications(openid) {
  const safeOpenid = normalizeOpenid(openid);
  const [rows] = await pool.query(
    `SELECT s.*, r.read_at IS NOT NULL AS is_read
     FROM system_notifications s
     LEFT JOIN user_notification_reads r ON r.notification_id = s.id AND r.openid = ?
     WHERE s.openid IS NULL OR s.openid = ?
     ORDER BY s.created_at DESC
     LIMIT 20`,
    [safeOpenid, safeOpenid]
  );
  return rows;
}

function normalizeOpenid(value) {
  return String(value || "").trim();
}

function getAdminReviewerId(admin) {
  if (!admin || !admin.username) return null;
  return admin.username === adminUsername ? 1 : null;
}

async function getTrustedConvenienceReporter({ userId, openid }) {
  const safeUserId = Number.isInteger(userId) && userId > 0 ? userId : null;
  const safeOpenid = normalizeOpenid(openid);

  if (!safeUserId && !safeOpenid) {
    return null;
  }

  if (safeUserId) {
    const [rows] = await pool.query(
      "SELECT id, openid FROM wx_users WHERE id = ? LIMIT 1",
      [safeUserId]
    );
    const row = rows[0];
    if (!row) {
      return null;
    }
    if (safeOpenid && normalizeOpenid(row.openid) !== safeOpenid) {
      return null;
    }
    return {
      userId: row.id,
      openid: normalizeOpenid(row.openid),
      reporterKey: `user:${row.id}`
    };
  }

  const [rows] = await pool.query(
    "SELECT id, openid FROM wx_users WHERE openid = ? LIMIT 1",
    [safeOpenid]
  );
  const row = rows[0];
  if (!row) {
    return null;
  }
  return {
    userId: row.id,
    openid: normalizeOpenid(row.openid),
    reporterKey: `user:${row.id}`
  };
}

function normalizeSalary(salary, salaryType) {
  const s = String(salary || "").trim();
  if (!s) return s;
  if (/[元块\/]/.test(s)) return s;
  const unitMap = { "日结": "元/天", "周结": "元/周", "月结": "元/月", "完工结": "元/单" };
  return s + (unitMap[salaryType] || "元/天");
}

function mapJob(row) {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    salary: row.salary,
    salaryType: row.salary_type,
    headcount: row.headcount,
    displayLocation: row.display_location,
    location: row.location,
    company: row.company,
    contact: row.contact,
    phone: row.phone,
    workTime: row.work_time,
    description: row.description,
    status: row.status,
    source: row.source,
    reviewReason: row.review_reason,
    reviewedAt: formatDate(row.reviewed_at),
    offlineAt: formatDate(row.offline_at),
    createdAt: formatDate(row.created_at),
    updatedAt: formatDate(row.updated_at)
  };
}

function mapConveniencePost(row) {
  let images = [];
  try {
    images = JSON.parse(row.images || "[]");
  } catch (e) {
    images = [];
  }
  return {
    id: row.id,
    openid: row.openid,
    category: row.category || "商业宣传",
    area: row.area,
    content: row.content,
    images: Array.isArray(images) ? images : [],
    viewCount: Number(row.view_count || 0),
    reportCount: Number(row.report_count || 0),
    lastReportedAt: formatDate(row.last_reported_at),
    contactName: row.contact_name,
    contactPhone: row.contact_phone,
    otherContact: row.other_contact,
    address: row.address,
    latitude: row.latitude,
    longitude: row.longitude,
    status: row.status,
    offlineReason: row.offline_reason || "",
    offlineBy: row.offline_by || null,
    createdAt: formatDate(row.created_at),
    updatedAt: formatDate(row.updated_at)
  };
}

function mapUser(row) {
  const nickname = row.nickname || "微信用户";
  return {
    id: row.id,
    openid: row.openid,
    unionid: row.unionid,
    nickname,
    name: row.name || "",
    avatarText: nickname.slice(0, 1),
    avatarUrl: row.avatar_url,
    phone: row.phone,
    gender: row.gender || "",
    age: row.age || null,
    city: row.city,
    loginAt: formatDate(row.last_login_at),
    favorites: Number(row.favorites || 0),
    applications: Number(row.applications || 0),
    createdAt: formatDate(row.created_at)
  };
}

function mapApplication(row) {
  return {
    id: row.id,
    userId: row.user_id,
    jobId: row.job_id,
    userName: row.user_name,
    phone: row.phone,
    gender: row.gender || '',
    age: row.age || null,
    wxAvatarUrl: row.wx_avatar_url,
    note: row.note,
    status: row.status,
    jobTitle: row.job_title || "",
    appliedAt: formatDate(row.created_at),
    updatedAt: formatDate(row.updated_at)
  };
}

function mapThread(row) {
  const userName = row.user_name || row.wu_nickname || "微信用户";
  const avatarUrl = row.avatar_url || row.wu_avatar_url || "";
  return {
    id: row.id,
    openid: row.openid,
    userId: row.user_id,
    userName,
    avatarUrl,
    avatarText: String(userName).slice(0, 1),
    status: row.status,
    lastMessage: row.last_message || "",
    unreadAdmin: Number(row.unread_admin || 0),
    unreadUser: Number(row.unread_user || 0),
    createdAt: formatDate(row.created_at),
    updatedAt: formatDate(row.updated_at)
  };
}

function mapSupportMessage(row) {
  return {
    id: row.id,
    threadId: row.thread_id,
    senderType: row.sender_type,
    content: row.content,
    createdAt: formatDate(row.created_at)
  };
}

function mapNotification(row) {
  return {
    id: row.id,
    openid: row.openid || "",
    userId: row.user_id,
    title: row.title,
    content: row.content,
    isRead: !!row.is_read,
    createdAt: formatDate(row.created_at)
  };
}

function formatDate(value) {
  if (!value) return "";
  if (typeof value === "string") return value.replace("T", " ").slice(0, 16);
  const pad = (num) => String(num).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} ${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

/**
 * 发送 HTTPS GET 请求到微信 API（返回 JSON）
 */
function wxRequest(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (resp) => {
      let data = "";
      resp.on("data", (chunk) => { data += chunk; });
      resp.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error("微信接口返回非 JSON：" + data));
        }
      });
    }).on("error", reject);
  });
}

/**
 * 发送 HTTPS POST 请求到微信 API（body 为 JSON，返回 JSON）
 */
function wxPost(url, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload)
      }
    };
    const req = https.request(options, (resp) => {
      let data = "";
      resp.on("data", (chunk) => { data += chunk; });
      resp.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error("微信接口返回非 JSON：" + data));
        }
      });
    });
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}
