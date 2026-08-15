# 安装与部署

本文档适用于首次部署、版本升级和 GitHub 拉取后的环境重建。

## 1. 环境要求

| 组件 | 最低要求 | 建议 |
| --- | --- | --- |
| Node.js | 20.19 | Node.js 22 LTS |
| npm | 10 | 随 Node.js 更新 |
| MySQL | 5.7 | MySQL 8.0 |
| 操作系统 | Windows / Linux / macOS | 生产环境建议 Linux |

前端使用 Vite 8，因此 Node.js 18 已不再满足构建要求。

## 2. 安装依赖

从 GitHub 克隆项目后执行：

~~~bash
npm ci
npm --prefix client ci
~~~

`npm ci` 会严格按照锁文件安装，适合部署和 CI；日常开发新增依赖时使用 `npm install`。

## 3. 配置环境变量

复制示例文件：

~~~bash
# Linux / macOS
cp .env.example .env

# Windows PowerShell
Copy-Item .env.example .env
~~~

### 必填配置

| 变量 | 说明 |
| --- | --- |
| `SESSION_SECRET` | 会话签名密钥，建议使用至少 32 字符的随机字符串 |
| `SITE_URL` | 站点对外地址，公网部署应使用 HTTPS 域名 |
| `DB_HOST` / `DB_PORT` | MySQL 地址与端口 |
| `DB_USER` / `DB_PASSWORD` | MySQL 用户和密码 |
| `DB_NAME` | 数据库名，默认 `bilibili_danmu` |
| `ADMIN_USERNAME` | 首次初始化创建的管理员用户名 |
| `ADMIN_PASSWORD` | 管理员强密码，不能使用示例值或 `admin888` |

### 可选配置

- `SCHEDULER_ENABLED`：是否启用自动调度。多实例部署时只能有一个实例设为 `true`。
- `EPAY_*`：易支付配置。
- `ALIPAY_*`：支付宝官方支付配置。
- `OAUTH_*`：聚合第三方登录配置。

支付、OAuth、SMTP、邮箱过滤和兰空图床也可以登录管理后台后配置。数据库中的后台配置优先于 `.env` 中对应的运行时默认值。

## 4. 初始化或升级数据库

执行：

~~~bash
npm run init-db
~~~

该命令会：

1. 创建数据库（如果不存在）。
2. 迁移历史表名。
3. 创建缺失的数据表。
4. 逐列检查并补充历史版本缺少的字段。
5. 同步数据库表和字段备注。
6. 在空表中写入默认任务模板和时长套餐。
7. 在管理员不存在时创建管理员账号。

该脚本设计为可重复执行，但生产环境升级前仍应备份数据库。

## 5. 构建前端

~~~bash
npm run client:build
~~~

产物生成到 `client/dist`，由 Express 直接托管。`client/dist` 是生成目录，不应提交到 GitHub。

## 6. 启动与检查

先执行完整检查：

~~~bash
npm run verify
~~~

启动服务：

~~~bash
npm start
~~~

检查健康接口：

~~~text
GET http://localhost:3000/api/health
~~~

正常响应：

~~~json
{"ok":true}
~~~

## 7. 使用 PM2 部署

安装 PM2：

~~~bash
npm install -g pm2
~~~

启动：

~~~bash
pm2 start server.js --name bilibili-danmu
pm2 save
pm2 startup
~~~

更新代码后的建议流程：

~~~bash
git pull
npm ci
npm --prefix client ci
npm run init-db
npm run verify
pm2 restart bilibili-danmu
~~~

## 8. Nginx 反向代理示例

~~~nginx
server {
    listen 80;
    server_name example.com;

    client_max_body_size 12m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
~~~

生产环境请配置 TLS 证书，将 HTTP 跳转到 HTTPS，并把 `SITE_URL` 改成完整的 HTTPS 地址。服务检测到 HTTPS 地址后会启用安全 Cookie，并信任第一层反向代理。

## 9. 多实例注意事项

当前项目默认使用 `express-session` 内存存储：

- 进程重启后登录状态会丢失。
- 多实例之间不会共享会话。
- 不适合直接用于负载均衡集群。

若需要多实例部署，应接入 Redis 或 MySQL 会话存储，并确保只有一个实例启用 `SCHEDULER_ENABLED=true`，避免重复执行自动任务。

## 10. 数据备份

升级前示例：

~~~bash
mysqldump -u root -p --single-transaction --routines --triggers bilibili_danmu > bilibili_danmu_backup.sql
~~~

恢复示例：

~~~bash
mysql -u root -p bilibili_danmu < bilibili_danmu_backup.sql
~~~

数据库备份可能包含用户资料、B站 Cookie、支付信息和系统密钥，不要提交到 GitHub。

## 11. 常见问题

### 页面提示“前端尚未构建”

执行：

~~~bash
npm --prefix client ci
npm run client:build
~~~

### 数据库连接失败

检查 `.env` 中的数据库地址、端口、账号、密码和数据库权限，然后重新执行 `npm run init-db`。

### HTTPS 下无法保持登录

确认：

- `SITE_URL` 使用 `https://`。
- Nginx 传递了 `X-Forwarded-Proto`。
- 浏览器实际通过 HTTPS 访问。

### 自动任务重复执行

确认多实例部署中只有一个实例启用了调度器，并检查是否同时存在人工“立即执行”操作。每日任务内部使用 MySQL 命名锁防止同一任务并发执行，但人工顺序重复执行仍会产生新的执行记录。

### 充电任务消耗多少 B币

默认配置为 50 电池，即 5 B币。10 电池等于 1 B币。点击“立即执行”不会跳过本月已执行的人工确认，请谨慎操作。
