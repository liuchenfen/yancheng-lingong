CREATE DATABASE IF NOT EXISTS yancheng_lingong
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE yancheng_lingong;

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS applications;
DROP TABLE IF EXISTS user_favorites;
DROP TABLE IF EXISTS jobs;
DROP TABLE IF EXISTS wx_users;
DROP TABLE IF EXISTS admin_users;

CREATE TABLE admin_users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  username VARCHAR(50) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  real_name VARCHAR(50) DEFAULT NULL,
  role ENUM('super_admin', 'operator', 'auditor') NOT NULL DEFAULT 'operator',
  status TINYINT NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_admin_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE wx_users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  openid VARCHAR(100) NOT NULL,
  unionid VARCHAR(100) DEFAULT NULL,
  nickname VARCHAR(80) DEFAULT NULL,
  avatar_url VARCHAR(500) DEFAULT NULL,
  phone VARCHAR(20) DEFAULT NULL,
  city VARCHAR(50) DEFAULT NULL,
  last_login_at DATETIME DEFAULT NULL,
  status TINYINT NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_wx_openid (openid),
  KEY idx_wx_phone (phone),
  KEY idx_wx_last_login (last_login_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE jobs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  title VARCHAR(120) NOT NULL,
  category VARCHAR(50) NOT NULL,
  salary VARCHAR(80) NOT NULL,
  salary_type VARCHAR(30) NOT NULL,
  headcount INT UNSIGNED NOT NULL DEFAULT 1,
  display_location VARCHAR(80) NOT NULL,
  location VARCHAR(255) NOT NULL,
  company VARCHAR(120) DEFAULT NULL,
  contact VARCHAR(50) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  work_time VARCHAR(120) DEFAULT NULL,
  description TEXT,
  status ENUM('pending', 'published', 'rejected', 'offline') NOT NULL DEFAULT 'pending',
  review_reason VARCHAR(500) DEFAULT NULL,
  reviewer_id BIGINT UNSIGNED DEFAULT NULL,
  reviewed_at DATETIME DEFAULT NULL,
  offline_at DATETIME DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_jobs_status (status),
  KEY idx_jobs_category (category),
  KEY idx_jobs_location (display_location),
  KEY idx_jobs_created_at (created_at),
  CONSTRAINT fk_jobs_reviewer FOREIGN KEY (reviewer_id) REFERENCES admin_users(id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE user_favorites (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  job_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_favorite_user_job (user_id, job_id),
  KEY idx_favorite_job (job_id),
  CONSTRAINT fk_favorite_user FOREIGN KEY (user_id) REFERENCES wx_users(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_favorite_job FOREIGN KEY (job_id) REFERENCES jobs(id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE applications (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  job_id BIGINT UNSIGNED NOT NULL,
  user_name VARCHAR(80) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  wx_avatar_url VARCHAR(500) DEFAULT NULL,
  note VARCHAR(500) DEFAULT NULL,
  status ENUM('new', 'contacted', 'hired', 'closed') NOT NULL DEFAULT 'new',
  contacted_at DATETIME DEFAULT NULL,
  hired_at DATETIME DEFAULT NULL,
  closed_at DATETIME DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_application_user_job (user_id, job_id),
  KEY idx_applications_status (status),
  KEY idx_applications_created_at (created_at),
  KEY idx_applications_job (job_id),
  CONSTRAINT fk_application_user FOREIGN KEY (user_id) REFERENCES wx_users(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_application_job FOREIGN KEY (job_id) REFERENCES jobs(id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

INSERT INTO admin_users (id, username, password_hash, real_name, role) VALUES
  (1, 'admin', '$2b$10$replace_with_real_hash_before_production', '系统管理员', 'super_admin');

INSERT INTO wx_users (id, openid, nickname, avatar_url, phone, city, last_login_at) VALUES
  (1, 'wx_openid_demo_001', '一米阳光', '', '13900139001', '衡阳', '2026-05-30 09:12:00'),
  (2, 'wx_openid_demo_002', '小周', '', '13900139002', '衡阳', '2026-05-29 21:40:00'),
  (3, 'wx_openid_demo_003', '南风', '', '13900139003', '衡阳', '2026-05-28 18:06:00');

INSERT INTO jobs (
  id, title, category, salary, salary_type, headcount, display_location, location,
  company, contact, phone, work_time, description, status, review_reason, reviewer_id, reviewed_at, offline_at, created_at
) VALUES
  (1, '商场活动协助', '展会活动', '180元/天', '日结', 6, '雁峰区', '雁峰区先锋路商圈',
   '衡阳星启活动服务', '陈主管', '13800138001', '9:00-18:00', '负责现场引导、物料摆放、秩序维护，要求准时、有服务意识。', 'pending', NULL, NULL, NULL, NULL, '2026-05-28 09:20:00'),
  (2, '咖啡店晚班店员', '餐饮服务', '20元/小时', '周结', 2, '蒸湘区', '蒸湘区船山大道万达附近',
   '青屿咖啡', '李店长', '13800138002', '18:00-22:30', '负责点单、出品辅助、桌面整理，有餐饮经验优先。', 'published', NULL, 1, '2026-05-25 15:00:00', NULL, '2026-05-25 14:05:00'),
  (3, '社区快递分拣', '物流配送', '160-200元/天', '日结', 8, '石鼓区', '石鼓区五一路仓配点',
   '顺达仓配', '王经理', '13800138003', '8:00-17:00', '按区域分拣快递，工作节奏较快，要求能搬运小件包裹。', 'published', NULL, 1, '2026-05-23 11:00:00', NULL, '2026-05-23 10:30:00'),
  (4, '门店宣传员', '门店导购', '120元/天+提成', '日结', 3, '珠晖区', '珠晖区火车站商圈',
   '惠民生活馆', '刘女士', '13800138004', '10:00-19:00', '需要在门店周边派发活动单页并引导客户到店。', 'rejected', '岗位描述过短，需补充结算规则和工作内容。', 1, '2026-05-20 17:00:00', NULL, '2026-05-20 16:10:00'),
  (5, '小区保洁小时工', '家政保洁', '25元/小时', '完工结', 4, '高新区', '高新区解放大道社区',
   '清蓝物业', '赵主管', '13800138005', '7:00-11:00', '公共区域保洁，要求认真负责，可长期优先。', 'offline', NULL, 1, '2026-05-18 09:10:00', '2026-05-26 18:00:00', '2026-05-18 08:45:00');

INSERT INTO user_favorites (user_id, job_id) VALUES
  (1, 2), (1, 3), (2, 3), (3, 2);

INSERT INTO applications (id, user_id, job_id, user_name, phone, wx_avatar_url, note, status, contacted_at, hired_at, created_at) VALUES
  (1, 1, 2, '一米阳光', '13900139001', '', '可连续做一周', 'new', NULL, NULL, '2026-05-30 09:30:00'),
  (2, 2, 3, '小周', '13900139002', '', '已电话沟通，明天到岗', 'contacted', '2026-05-30 10:00:00', NULL, '2026-05-29 22:10:00'),
  (3, 3, 2, '南风', '13900139003', '', '有咖啡店经验', 'hired', '2026-05-29 09:20:00', '2026-05-29 14:30:00', '2026-05-28 19:45:00');
