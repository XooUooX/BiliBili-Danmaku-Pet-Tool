const path = require('path');
require('express-async-errors');
const express = require('express');
const session = require('express-session');
const config = require('./config');
const db = require('./db');
const { migrateDatabase } = require('./db/migrateTableNames');
const scheduler = require('./services/scheduler');
const dailyScheduler = require('./services/dailyScheduler');
const settings = require('./services/settings');
const { apiRequireLogin, apiRequireAdmin } = require('./middleware/auth');

const payRoutes = require('./routes/pay');
const apiAuthRoutes = require('./routes/api/auth');
const apiOauthRoutes = require('./routes/api/oauth');
const apiUserRoutes = require('./routes/api/user');
const apiAdminRoutes = require('./routes/api/admin');

const app = express();

// 通用请求体解析
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// 会话
app.use(
  session({
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 7,
      httpOnly: true,
      sameSite: 'lax',
      secure: config.siteUrl.startsWith('https://')
    }
  })
);

// 向模板注入当前用户基本信息
app.use((req, res, next) => {
  res.locals.session = req.session;
  next();
});

// 健康检查
app.get('/api/health', (req, res) => res.json({ ok: true }));

// API 路由
app.use('/api/auth/oauth', apiOauthRoutes);
app.use('/api/auth', apiAuthRoutes);
app.use('/api/user', apiRequireLogin, apiUserRoutes);
app.use('/api/admin', apiRequireLogin, apiRequireAdmin, apiAdminRoutes);

// 支付异步回调（服务端到服务端，保持原样）
app.use('/pay', payRoutes);

// API 错误处理（返回 JSON）
app.use('/api', (err, req, res, next) => {
  console.error('API 错误:', err);
  res.status(500).json({ ok: false, message: err.message });
});

// 前端：React 构建产物静态托管 + SPA 回退
const fs = require('fs');
const clientDist = path.join(__dirname, 'client', 'dist');
const indexHtmlPath = path.join(clientDist, 'index.html');

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// 把 TDK 注入到 index.html 的 <head>
function renderIndexHtml() {
  let html = fs.readFileSync(indexHtmlPath, 'utf8');
  const meta = settings.getSiteMeta();
  if (meta.title) {
    html = html.replace(/<title>.*?<\/title>/i, `<title>${escapeHtml(meta.title)}</title>`);
  }
  const tags = [];
  if (meta.description) tags.push(`<meta name="description" content="${escapeHtml(meta.description)}" />`);
  if (meta.keywords) tags.push(`<meta name="keywords" content="${escapeHtml(meta.keywords)}" />`);
  if (tags.length) html = html.replace('</head>', `    ${tags.join('\n    ')}\n  </head>`);
  return html;
}

// Vite 带哈希的构建资源可永久缓存；其他公开文件每次向服务器确认是否更新。
app.use('/assets', express.static(path.join(clientDist, 'assets'), {
  index: false,
  maxAge: '1y',
  immutable: true
}));
app.use(express.static(clientDist, {
  index: false,
  maxAge: 0,
  setHeaders(res) {
    res.setHeader('Cache-Control', 'no-cache');
  }
}));

app.get('*', (req, res) => {
  try {
    // SPA 入口不能被长期缓存，否则发布后旧 HTML 会继续引用已删除的 chunk，造成刷新白屏。
    res
      .set({
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        Pragma: 'no-cache',
        Expires: '0'
      })
      .send(renderIndexHtml());
  } catch (e) {
    res.status(200).send('前端尚未构建，请在 client 目录运行 npm install && npm run build');
  }
});

// 启动
async function start() {
  if (config.sessionSecret === 'change_me') {
    console.warn('[????] SESSION_SECRET ???????? .env ?????????');
  }

  try {
    await db.query('SELECT 1');
    await migrateDatabase(db.getPool());
    console.log('[OK] 数据库连接正常');
  } catch (e) {
    console.error('[错误] 数据库连接失败，请先配置 .env 并运行 npm run init-db');
    console.error('   ', e.message);
    process.exit(1);
  }

  await settings.load();
  if (config.schedulerEnabled) {
    scheduler.start();
    dailyScheduler.start();
  } else {
    console.log('[INFO] 自动调度器已禁用；网页与手动执行功能仍可使用');
  }

  app.listen(config.port, () => {
    console.log(`服务已启动: ${config.siteUrl}  (端口 ${config.port})`);
    console.log(`管理后台: ${config.siteUrl}/admin  默认账号: ${config.admin.username}`);
  });
}

start();

