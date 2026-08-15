const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../../db');
const settings = require('../../services/settings');
const mailer = require('../../services/mailer');

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// 校验邮箱是否通过黑/白名单过滤
function checkEmailAllowed(email) {
  const filter = settings.getEmailFilter();
  if (filter.mode !== 'blacklist' && filter.mode !== 'whitelist') return true;
  const domain = String(email).split('@')[1] || '';
  const list = String(filter.list || '')
    .split(/[\r\n,]+/)
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
  if (list.length === 0) return true;
  const hit = list.includes(domain.toLowerCase());
  return filter.mode === 'whitelist' ? hit : !hit;
}

// 当前登录态
router.get('/me', async (req, res) => {
  if (!req.session.userId) return res.json({ ok: true, user: null });
  const user = await db.queryOne(
    'SELECT id, username, email, qq, avatar, balance, is_admin, status, created_at FROM bili_users WHERE id = ?',
    [req.session.userId]
  );
  res.json({ ok: true, user });
});

// Public site configuration
router.get('/config', (req, res) => {
  const meta = settings.getSiteMeta();
  const mail = settings.getMailConfig();
  const oauth = settings.getOauthConfig();
  res.json({
    ok: true,
    config: {
      title: meta.title,
      subtitle: meta.subtitle,
      description: meta.description,
      keywords: meta.keywords,
      announcement: meta.announcement,
      emailRequired: mail.enabled,
      oauth: { enabled: oauth.enabled && !!oauth.appId && !!oauth.appKey, providers: oauth.providers }
    }
  });
});

// 发送邮箱验证码
router.post('/send-code', async (req, res) => {
  const mail = settings.getMailConfig();
  if (!mail.enabled) return res.status(400).json({ ok: false, message: '未开启邮箱验证' });

  const email = String(req.body.email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return res.status(400).json({ ok: false, message: '邮箱格式不正确' });
  if (!checkEmailAllowed(email)) return res.status(400).json({ ok: false, message: '该邮箱不允许注册' });

  const exist = await db.queryOne('SELECT id FROM bili_users WHERE email = ?', [email]);
  if (exist) return res.status(400).json({ ok: false, message: '该邮箱已被注册' });

  // 60 秒内不可重复发送
  const recent = await db.queryOne(
    "SELECT id FROM bili_email_codes WHERE email = ? AND created_at > (NOW() - INTERVAL 60 SECOND) ORDER BY id DESC LIMIT 1",
    [email]
  );
  if (recent) return res.status(429).json({ ok: false, message: '验证码发送过于频繁，请稍后再试' });

  const code = String(Math.floor(100000 + Math.random() * 900000));
  await db.query(
    "INSERT INTO bili_email_codes (email, code, scene, expires_at) VALUES (?, ?, 'register', NOW() + INTERVAL 10 MINUTE)",
    [email, code]
  );
  try {
    await mailer.sendCode(email, code);
  } catch (e) {
    return res.status(500).json({ ok: false, message: '验证码发送失败：' + e.message });
  }
  res.json({ ok: true });
});

// 登录
router.post('/login', async (req, res) => {
  const { username, password } = req.body;


  const user = await db.queryOne('SELECT * FROM bili_users WHERE username = ?', [username]);
  if (!user || !(await bcrypt.compare(password || '', user.password))) {
    return res.status(400).json({ ok: false, message: '用户名或密码错误' });
  }
  if (user.status !== 1) {
    return res.status(403).json({ ok: false, message: '账号已被封禁' });
  }
  req.session.userId = user.id;
  req.session.username = user.username;
  req.session.isAdmin = user.is_admin === 1;
  res.json({ ok: true, isAdmin: user.is_admin === 1 });
});

// 注册
router.post('/register', async (req, res) => {
  const { username, password, email, qq, code } = req.body;


  if (!username || !password || username.length < 3 || password.length < 6) {
    return res.status(400).json({ ok: false, message: '用户名至少3位，密码至少6位' });
  }
  const exist = await db.queryOne('SELECT id FROM bili_users WHERE username = ?', [username]);
  if (exist) return res.status(400).json({ ok: false, message: '用户名已存在' });

  const mail = settings.getMailConfig();
  let normalizedEmail = null;
  if (mail.enabled) {
    normalizedEmail = String(email || '').trim().toLowerCase();
    if (!EMAIL_RE.test(normalizedEmail)) {
      return res.status(400).json({ ok: false, message: '邮箱格式不正确' });
    }
    if (!checkEmailAllowed(normalizedEmail)) {
      return res.status(400).json({ ok: false, message: '该邮箱不允许注册' });
    }
    const dup = await db.queryOne('SELECT id FROM bili_users WHERE email = ?', [normalizedEmail]);
    if (dup) return res.status(400).json({ ok: false, message: '该邮箱已被注册' });

    const record = await db.queryOne(
      "SELECT id FROM bili_email_codes WHERE email = ? AND code = ? AND used = 0 AND expires_at > NOW() ORDER BY id DESC LIMIT 1",
      [normalizedEmail, String(code || '').trim()]
    );
    if (!record) return res.status(400).json({ ok: false, message: '验证码错误或已过期' });
    await db.query('UPDATE bili_email_codes SET used = 1 WHERE id = ?', [record.id]);
  }

  // 处理QQ号和头像
  let qqNumber = null;
  let avatar = null;
  const qqInput = String(qq || '').trim();
  if (qqInput && /^\d+$/.test(qqInput)) {
    qqNumber = qqInput;
    // QQ头像URL格式：https://q1.qlogo.cn/g?b=qq&nk=QQ号&s=100
    avatar = `https://q1.qlogo.cn/g?b=qq&nk=${qqNumber}&s=100`;
  }

  const hash = await bcrypt.hash(password, 10);
  const result = await db.query(
    'INSERT INTO bili_users (username, email, qq, avatar, password) VALUES (?, ?, ?, ?, ?)',
    [username, normalizedEmail, qqNumber, avatar, hash]
  );
  req.session.userId = result.insertId;
  req.session.username = username;
  req.session.isAdmin = false;
  res.json({ ok: true, isAdmin: false });
});

// 退出
router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

module.exports = router;

