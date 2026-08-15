# BiliBili 弹宠小助手

一个基于 **Node.js、Express、MySQL、React 和 Vite** 的BiliBili直播间弹幕宠物小工具。

> [!WARNING]
> 本项目会调用哔哩哔哩相关接口，部分自动任务可能消耗硬币或 B币。请仅操作你本人拥有或已获得明确授权的账号，遵守平台规则并自行承担账号风控、接口变更和资金消耗风险。本项目与哔哩哔哩官方无关。

## 功能概览

### 用户端

- 注册、登录、资料与密码管理
- B站账号二维码绑定及状态检测
- 弹幕任务创建、编辑、启停、日志查看
- 固定间隔、随机间隔、每日执行等任务模式
- 按直播间分类自动切换正在直播的房间
- 每日观看、投币、点赞任务
- 充电任务：默认 50 电池，即 **5 B币**；启用前二次确认
- 大会员每月权益领取
- 余额充值、订单、卡密兑换
- 抽奖、工单和直播间列表

### 管理端

- 用户、B站账号、弹幕任务和运行日志管理
- 任务模板、时长套餐、卡密、订单和余额管理
- 直播间、抽奖奖品、工单、友情链接管理
- 站点信息、支付、SMTP、邮箱过滤、第三方登录和兰空图床配置
- 后台设置仅回显数据库中已保存的内容；未保存字段保持为空，点击“保存设置”后才写入数据库

## 演示
<img width="1794" height="1552" alt="首页" src="https://github.com/user-attachments/assets/84dba4d0-95b7-4b0b-955c-f44f5dcb10a0" />
<img width="1794" height="857" alt="仪表盘" src="https://github.com/user-attachments/assets/6e114de6-eb61-4bb5-ac93-e6c4e494f05c" />
<img width="1794" height="857" alt="扫码登录" src="https://github.com/user-attachments/assets/3db80006-040a-4cb6-8cc5-70beacb2cbaa" />
<img width="1794" height="857" alt="新建任务" src="https://github.com/user-attachments/assets/92f95ad7-fcc8-47cf-a8c7-2b85534b7e2a" />
<img width="1794" height="1514" alt="日常任务" src="https://github.com/user-attachments/assets/5a87cc3e-a965-457e-94bd-f2b19b5af8f3" />
<img width="1794" height="857" alt="在线工单" src="https://github.com/user-attachments/assets/852b538c-969f-44b1-8604-ac95b4ed64de" />
<img width="1794" height="857" alt="账户充值" src="https://github.com/user-attachments/assets/fd606a0c-fb42-4d5d-8266-bcfa86017d4f" />
<img width="1794" height="857" alt="个人资料" src="https://github.com/user-attachments/assets/2ea16c28-68d8-4729-b169-be823705a5de" />
<img width="1794" height="857" alt="后台" src="https://github.com/user-attachments/assets/d5222fde-4693-4bcb-92b2-cc24c154a171" />


## 技术栈

| 层级 | 技术 |
| --- | --- |
| 后端 | Node.js、Express、MySQL2 |
| 前端 | React 18、React Router 7、Vite 8、Tailwind CSS |
| 会话 | express-session |
| 邮件 | Nodemailer |
| 富文本 | TinyMCE（静态资源随项目提供） |
| B站交互 | Axios、二维码登录与相关接口封装 |

## 环境要求

- Node.js 20.19+，推荐 Node.js 22 LTS
- npm 10+
- MySQL 5.7 或 MySQL 8.0
- 可选：Nginx、PM2

## 快速开始

~~~bash
git clone https://github.com/XooUooX/BiliBili-Danmaku-Pet-Tool.git
cd BiliBili

npm ci
npm --prefix client ci
~~~

复制环境变量示例：

~~~bash
# Linux / macOS
cp .env.example .env

# Windows PowerShell
Copy-Item .env.example .env
~~~

编辑 `.env`，至少修改以下项目：

- `SESSION_SECRET`
- `DB_HOST`、`DB_PORT`、`DB_USER`、`DB_PASSWORD`、`DB_NAME`
- `ADMIN_USERNAME`、`ADMIN_PASSWORD`
- 公网部署时的 `SITE_URL`

初始化数据库并构建前端：

~~~bash
npm run init-db
npm run client:build
npm start
~~~

默认访问地址：

- 站点：`http://localhost:3000`
- 管理后台：`http://localhost:3000/admin`
- 健康检查：`http://localhost:3000/api/health`

更完整的升级、反向代理和生产部署说明见 [INSTALL.md](INSTALL.md)。

## 常用命令

| 命令 | 用途 |
| --- | --- |
| `npm start` | 启动后端并托管已构建前端 |
| `npm run client:dev` | 启动 Vite 开发服务器 |
| `npm run client:build` | 构建前端到 `client/dist` |
| `npm run init-db` | 创建数据库、建表并执行增量迁移 |
| `npm run migrate-table-names` | 单独执行历史表名迁移 |
| `npm test` / `npm run check` | 检查 JSON、Node 语法、依赖声明、环境变量和忽略规则 |
| `npm run verify` | 执行完整静态检查并构建前端 |

## 项目结构

~~~text
.
├─ client/                 React 前端
│  ├─ public/              OAuth 图标与 TinyMCE 静态资源
│  └─ src/                 页面、组件、Hooks 与 API 封装
├─ config/                 环境变量配置
├─ db/                     数据库连接、结构与迁移
├─ middleware/             API 身份验证中间件
├─ routes/                 API 与支付回调路由
├─ scripts/                初始化、迁移和完整性检查脚本
├─ services/               调度、B站、支付、邮件等业务服务
├─ server.js               Express 入口
├─ .env.example            环境变量模板
└─ INSTALL.md              部署文档
~~~

## 开发说明

前后端分开运行：

~~~bash
# 终端 1：后端
npm start

# 终端 2：前端开发服务器
npm run client:dev
~~~

Vite 会把 `/api` 和 `/pay` 请求代理到 `http://localhost:3000`。

提交前执行：

~~~bash
npm run verify
npm audit --omit=dev
npm --prefix client audit
~~~

GitHub Actions 会在推送和拉取请求时自动安装依赖、检查项目、构建前端并执行依赖审计。

## 数据与安全

- `.env`、依赖目录和构建产物已加入 `.gitignore`，不要强制提交。
- B站 Cookie、支付密钥、SMTP 密码、OAuth App Key、图床 Token 均属于敏感信息。
- 初始化脚本拒绝使用默认管理员密码 `admin888` 或示例占位密码。
- 公网部署必须使用 HTTPS，并设置高强度 `SESSION_SECRET`。
- 当前默认会话存储为进程内存，适合单实例部署；多实例或需要持久会话时应接入 Redis/MySQL 会话存储。
- 上线前应备份数据库，并先在测试环境验证数据库迁移。

安全问题处理方式见 [SECURITY.md](SECURITY.md)。

更多文档：

- [数据库表命名说明](docs/DATABASE_NAMING.md)
- [每日任务排查指南](docs/DAILY_TASK_TROUBLESHOOTING.md)

## 贡献

欢迎提交 Issue 和 Pull Request。请先阅读 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 许可证

本项目使用 [ISC License](LICENSE)。第三方静态资源和依赖仍遵循各自许可证。

