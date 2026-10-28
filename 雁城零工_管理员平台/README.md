# 雁城零工管理员平台说明

这是给“雁城零工”微信小程序配套设计的管理员平台，数据不再保存到浏览器，而是通过后端接口写入 MySQL 数据库。

## 文件结构

```text
雁城零工_管理员平台/
├─ index.html              管理员平台页面
├─ styles.css              页面样式
├─ app.js                  前端接口调用逻辑
├─ sql/yancheng_lingong.sql MySQL 建表和初始化数据
├─ server/server.js        Node + Express + MySQL 接口服务
├─ server/package.json     后端依赖配置
├─ server/.env.example     数据库连接配置示例
├─ 接口说明.md             小程序和后台接口说明
└─ mock-api.json           接口清单
```

## 初始化 MySQL

1. 打开 MySQL 客户端，例如 Navicat、DBeaver、MySQL Workbench 或命令行。
2. 执行 SQL 文件：

```bash
mysql -u root -p < F:\雁城零工\雁城零工_管理员平台\sql\yancheng_lingong.sql
```

执行后会创建数据库 `yancheng_lingong`，并生成以下表：

- `admin_users`：管理员账号
- `wx_users`：微信登录用户
- `jobs`：岗位信息和审核状态
- `user_favorites`：用户收藏岗位
- `applications`：用户投递记录

## 启动后端接口

进入后端目录：

```bash
cd F:\雁城零工\雁城零工_管理员平台\server
```

安装依赖：

```bash
npm install
```

复制配置文件：

```bash
copy .env.example .env
```

修改 `.env` 里的 MySQL 账号密码：

```text
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=你的MySQL密码
DB_NAME=yancheng_lingong
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
```

启动服务：

```bash
npm start
```

浏览器打开：

```text
http://localhost:3000
```

不要再直接双击 `index.html` 使用，因为直接打开页面无法连接 MySQL，必须通过后端接口访问。

登录账号：

```text
用户名：admin
密码：admin123
```

## 功能模块

- 工作台：展示岗位总数、待审核岗位、微信登录用户数、投递总数。
- 登录页：管理员登录后才能查看后台数据，支持退出登录。
- 岗位管理：查看全部岗位，支持关键词和状态筛选。
- 岗位发布：新增岗位会写入 `jobs` 表，默认状态为 `pending`。
- 岗位审核：通过、驳回、下线都会更新 MySQL 中的岗位状态。
- 用户信息：读取 `wx_users` 表，并统计收藏数和投递数。
- 投递记录：读取 `applications` 表，可更新为“已联系”“已录用”“已关闭”。
- 小程序接口：展示小程序前端需要对接的岗位、登录、投递接口。
- 数据导出：从 MySQL 查询当前数据并导出 JSON。

## 常用操作

### 发布岗位

1. 打开 `http://localhost:3000`
2. 使用 `admin / admin123` 登录
3. 点击右上角“发布岗位”
4. 填写职位名称、类型、薪资、区域、地点、联系人、手机号等信息
5. 点击“保存并提交审核”
6. 数据会写入 MySQL 的 `jobs` 表，状态为 `pending`

### 审核岗位

1. 打开“岗位审核”
2. 点击“通过”，岗位状态更新为 `published`
3. 点击“驳回”，填写驳回原因，岗位状态更新为 `rejected`
4. 在“岗位管理”点击“下线”，岗位状态更新为 `offline`

### 管理投递

1. 打开“投递记录”
2. 搜索用户、手机号或岗位名称
3. 点击“已联系”“录用”“关闭”
4. 状态会更新到 MySQL 的 `applications` 表

## 小程序对接方式

微信小程序不要直接连接 MySQL，应请求后端接口：

- `GET /api/jobs`：小程序获取已发布岗位
- `POST /api/wechat/jobs`：小程序用户发布岗位，默认进入待审核
- `POST /api/auth/wechat-login`：微信登录用户同步
- `POST /api/applications`：用户投递岗位

小程序端接口地址配置在：

```text
F:\雁城零工\雁城零工_修复版\utils\api.js
```

开发工具本机调试默认使用：

```text
http://127.0.0.1:3000
```

如果要在真机预览，需要把 `API_BASE` 改成电脑局域网 IP 或线上 HTTPS 域名，并在微信公众平台配置 request 合法域名。

当前小程序已接入：

- `fetchPublishedJobs`：找零工列表读取后台已审核岗位
- `submitWechatJob`：小程序用户发布岗位到后台待审核
- `syncWechatLogin`：微信登录后同步用户信息到后台
- `submitApplication`：用户投递岗位后同步到后台投递记录

管理员平台使用：

- `GET /api/admin/jobs`
- `POST /api/jobs`
- `PATCH /api/admin/jobs/{id}/review`
- `GET /api/admin/users`
- `GET /api/admin/applications`
- `PATCH /api/admin/applications/{id}/status`

字段详情见 `接口说明.md`。
