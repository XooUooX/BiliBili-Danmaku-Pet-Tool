const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const db = require('../../db');
const balanceService = require('../../services/balance');
const settings = require('../../services/settings');
const bili = require('../../services/bilibili');
const lsky = require('../../services/lsky');
const { sanitizeHtml, htmlToText } = require('../../services/sanitizeHtml');

const router = express.Router();

// 图片上传：内存存储，限制 10MB
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (lsky.isValidImageFile(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('仅支持 jpg/jpeg/png/gif/webp/bmp 格式的图片'));
    }
  }
});

// 概览统计
router.get('/stats', async (req, res) => {
  const stats = {
    users: (await db.queryOne('SELECT COUNT(*) c FROM bili_users')).c,
    accounts: (await db.queryOne('SELECT COUNT(*) c FROM bili_accounts')).c,
    activeAccounts: (await db.queryOne('SELECT COUNT(*) c FROM bili_accounts WHERE active = 1')).c,
    tasks: (await db.queryOne('SELECT COUNT(*) c FROM bili_danmu_tasks')).c,
    paidOrders: (await db.queryOne('SELECT COUNT(*) c FROM bili_orders WHERE status = "paid"')).c,
    income: (await db.queryOne('SELECT COALESCE(SUM(amount),0) s FROM bili_orders WHERE status = "paid"')).s,
    unusedCards: (await db.queryOne('SELECT COUNT(*) c FROM bili_cards WHERE used = 0')).c
  };
  res.json({ ok: true, stats });
});

// 用户列表（搜索 / 状态筛选 / 分页）
router.get('/users', async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize || '20', 10)));
  const keyword = (req.query.keyword || '').toString().trim();
  const status = (req.query.status || '').toString().trim(); // '', '1', '0'
  const role = (req.query.role || '').toString().trim();     // '', 'admin', 'user'

  const where = [];
  const params = [];
  if (keyword) {
    where.push('(username LIKE ? OR email LIKE ?)');
    params.push(`%${keyword}%`, `%${keyword}%`);
  }
  if (status === '1' || status === '0') {
    where.push('status = ?');
    params.push(Number(status));
  }
  if (role === 'admin') where.push('is_admin = 1');
  else if (role === 'user') where.push('is_admin = 0');

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = (await db.queryOne(`SELECT COUNT(*) c FROM bili_users ${whereSql}`, params)).c;
  const users = await db.query(
    `SELECT id, username, email, balance, is_admin, status, created_at FROM bili_users
     ${whereSql} ORDER BY id DESC LIMIT ? OFFSET ?`,
    [...params, pageSize, (page - 1) * pageSize]
  );
  res.json({ ok: true, users, total, page, pageSize });
});

// 用户详情（绑定账号 / 任务数 / 订单 / 余额流水）
router.get('/users/:id', async (req, res) => {
  const user = await db.queryOne(
    'SELECT id, username, email, balance, is_admin, status, created_at FROM bili_users WHERE id = ?',
    [req.params.id]
  );
  if (!user) return res.status(404).json({ ok: false, message: '用户不存在' });
  const accounts = await db.query(
    `SELECT a.id, a.bili_uid, a.nickname, a.active, a.expire_at,
            (SELECT COUNT(*) FROM bili_danmu_tasks t WHERE t.account_id = a.id) AS task_count
       FROM bili_accounts a WHERE a.user_id = ? ORDER BY a.id DESC`,
    [req.params.id]
  );
  const orders = await db.query(
    `SELECT id, order_no, amount, channel, status, created_at FROM bili_orders
       WHERE user_id = ? ORDER BY id DESC LIMIT 20`,
    [req.params.id]
  );
  const balanceLogs = await db.query(
    `SELECT id, change_amount, balance_after, type, remark, created_at FROM bili_balance_logs
       WHERE user_id = ? ORDER BY id DESC LIMIT 20`,
    [req.params.id]
  );
  res.json({ ok: true, user, accounts, orders, balanceLogs });
});

// 创建用户
router.post('/users', async (req, res) => {
  const username = (req.body.username || '').toString().trim();
  const password = (req.body.password || '').toString();
  const email = (req.body.email || '').toString().trim().toLowerCase() || null;
  const isAdmin = req.body.is_admin ? 1 : 0;
  if (username.length < 3 || password.length < 6) {
    return res.status(400).json({ ok: false, message: '用户名至少3位，密码至少6位' });
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ ok: false, message: '邮箱格式不正确' });
  }
  if (await db.queryOne('SELECT id FROM bili_users WHERE username = ?', [username])) {
    return res.status(400).json({ ok: false, message: '用户名已存在' });
  }
  if (email && (await db.queryOne('SELECT id FROM bili_users WHERE email = ?', [email]))) {
    return res.status(400).json({ ok: false, message: '该邮箱已被使用' });
  }
  const hash = await bcrypt.hash(password, 10);
  await db.query('INSERT INTO bili_users (username, email, password, is_admin) VALUES (?, ?, ?, ?)', [
    username, email, hash, isAdmin
  ]);
  res.json({ ok: true });
});

// 编辑资料（邮箱 / 角色）
router.post('/users/:id/profile', async (req, res) => {
  const user = await db.queryOne('SELECT id, is_admin FROM bili_users WHERE id = ?', [req.params.id]);
  if (!user) return res.status(404).json({ ok: false, message: '用户不存在' });
  const email = (req.body.email || '').toString().trim().toLowerCase() || null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ ok: false, message: '邮箱格式不正确' });
  }
  if (email) {
    const dup = await db.queryOne('SELECT id FROM bili_users WHERE email = ? AND id <> ?', [email, req.params.id]);
    if (dup) return res.status(400).json({ ok: false, message: '该邮箱已被使用' });
  }
  const isAdmin = req.body.is_admin ? 1 : 0;
  // 防止取消最后一个管理员
  if (user.is_admin === 1 && !isAdmin) {
    const adminCount = (await db.queryOne('SELECT COUNT(*) c FROM bili_users WHERE is_admin = 1')).c;
    if (adminCount <= 1) return res.status(400).json({ ok: false, message: '至少保留一名管理员' });
  }
  await db.query('UPDATE bili_users SET email = ?, is_admin = ? WHERE id = ?', [email, isAdmin, req.params.id]);
  res.json({ ok: true });
});

// 批量操作（封禁 / 解封 / 删除）
router.post('/users/batch', async (req, res) => {
  const action = (req.body.action || '').toString();
  const ids = Array.isArray(req.body.ids) ? req.body.ids.map(Number).filter(Boolean) : [];
  if (!ids.length) return res.status(400).json({ ok: false, message: '未选择用户' });
  const placeholders = ids.map(() => '?').join(',');
  if (action === 'ban') {
    await db.query(`UPDATE bili_users SET status = 0 WHERE id IN (${placeholders}) AND is_admin = 0`, ids);
  } else if (action === 'unban') {
    await db.query(`UPDATE bili_users SET status = 1 WHERE id IN (${placeholders}) AND is_admin = 0`, ids);
  } else if (action === 'delete') {
    await db.query(`DELETE FROM bili_users WHERE id IN (${placeholders}) AND is_admin = 0`, ids);
  } else {
    return res.status(400).json({ ok: false, message: '未知操作' });
  }
  res.json({ ok: true });
});

// 调整余额
router.post('/users/:id/balance', async (req, res) => {
  const amount = parseFloat(req.body.amount);
  if (isNaN(amount) || amount === 0) return res.status(400).json({ ok: false, message: '金额无效' });
  
  const conn = await db.getPool().getConnection();
  try {
    await conn.beginTransaction();
    
    // 查询当前余额
    const [userRows] = await conn.execute('SELECT id, balance FROM bili_users WHERE id = ? FOR UPDATE', [req.params.id]);
    if (!userRows.length) {
      await conn.rollback();
      return res.status(404).json({ ok: false, message: '用户不存在' });
    }
    
    const user = userRows[0];
    const after = Number(user.balance) + amount;
    if (after < 0) {
      await conn.rollback();
      return res.status(400).json({ ok: false, message: '余额不足' });
    }
    
    // 记录操作人（管理员用户名）
    const adminName = req.session.username || '系统';
    const remark = `管理员 ${adminName} ${amount > 0 ? '充值' : '扣款'} ¥${Math.abs(amount).toFixed(2)}`;
    
    // 更新余额
    await conn.execute('UPDATE bili_users SET balance = ? WHERE id = ?', [after, req.params.id]);
    
    // 插入流水记录
    await conn.execute(
      'INSERT INTO bili_balance_logs (user_id, change_amount, balance_after, type, remark) VALUES (?, ?, ?, ?, ?)',
      [req.params.id, amount, after.toFixed(2), 'admin_adjust', remark]
    );
    
    await conn.commit();
    res.json({ ok: true });
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
});

// 封禁/解封
router.post('/users/:id/status', async (req, res) => {
  await db.query('UPDATE bili_users SET status = IF(status = 1, 0, 1) WHERE id = ? AND is_admin = 0', [
    req.params.id
  ]);
  res.json({ ok: true });
});

// 重置密码
router.post('/users/:id/password', async (req, res) => {
  const password = (req.body.password || '').toString();
  if (password.length < 6) return res.status(400).json({ ok: false, message: '密码至少6位' });
  const user = await db.queryOne('SELECT id FROM bili_users WHERE id = ?', [req.params.id]);
  if (!user) return res.status(404).json({ ok: false, message: '用户不存在' });
  const hash = await bcrypt.hash(password, 10);
  await db.query('UPDATE bili_users SET password = ? WHERE id = ?', [hash, req.params.id]);
  res.json({ ok: true });
});

// 删除用户（级联清理账号、任务、订单、流水）
router.post('/users/:id/delete', async (req, res) => {
  const user = await db.queryOne('SELECT id, is_admin FROM bili_users WHERE id = ?', [req.params.id]);
  if (!user) return res.status(404).json({ ok: false, message: '用户不存在' });
  if (user.is_admin === 1) return res.status(400).json({ ok: false, message: '不能删除管理员' });

  // 级联删除：用事务确保原子性
  const conn = await db.getPool().getConnection();
  try {
    await conn.beginTransaction();

    // 删除该用户的所有关联数据
    // 1. 删除每日任务日志
    await conn.execute(
      `DELETE FROM bili_daily_task_logs 
       WHERE daily_task_id IN (SELECT id FROM bili_daily_tasks WHERE account_id IN (SELECT id FROM bili_accounts WHERE user_id = ?))`,
      [user.id]
    );

    // 2. 删除每日任务
    await conn.execute(
      `DELETE FROM bili_daily_tasks 
       WHERE account_id IN (SELECT id FROM bili_accounts WHERE user_id = ?)`,
      [user.id]
    );

    // 3. 删除弹幕任务日志
    await conn.execute(
      `DELETE FROM bili_danmu_logs 
       WHERE task_id IN (SELECT id FROM bili_danmu_tasks WHERE account_id IN (SELECT id FROM bili_accounts WHERE user_id = ?))`,
      [user.id]
    );

    // 4. 删除弹幕任务
    await conn.execute(
      `DELETE FROM bili_danmu_tasks 
       WHERE account_id IN (SELECT id FROM bili_accounts WHERE user_id = ?)`,
      [user.id]
    );

    // 5. 删除宠物等级日志
    await conn.execute(
      `DELETE FROM bili_pet_level_logs 
       WHERE account_id IN (SELECT id FROM bili_accounts WHERE user_id = ?)`,
      [user.id]
    );

    // 6. 删除B站账号
    await conn.execute(
      'DELETE FROM bili_accounts WHERE user_id = ?',
      [user.id]
    );

    // 7. 删除工单消息
    await conn.execute(
      `DELETE FROM bili_ticket_messages 
       WHERE ticket_id IN (SELECT id FROM bili_tickets WHERE user_id = ?)`,
      [user.id]
    );

    // 8. 删除工单
    await conn.execute(
      'DELETE FROM bili_tickets WHERE user_id = ?',
      [user.id]
    );

    // 9. 删除订单
    await conn.execute(
      'DELETE FROM bili_orders WHERE user_id = ?',
      [user.id]
    );

    // 10. 删除卡密兑换记录
    await conn.execute(
      'DELETE FROM bili_card_redemptions WHERE user_id = ?',
      [user.id]
    );

    // 11. 删除余额变动日志
    await conn.execute(
      'DELETE FROM bili_balance_logs WHERE user_id = ?',
      [user.id]
    );

    // 12. 删除抽奖记录
    await conn.execute(
      'DELETE FROM bili_lottery_records WHERE user_id = ?',
      [user.id]
    );

    // 13. 最后删除用户
    await conn.execute(
      'DELETE FROM bili_users WHERE id = ?',
      [user.id]
    );

    await conn.commit();
    res.json({ ok: true });
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
});

// 弹幕任务列表（关联账号 / 用户，搜索 + 状态筛选 + 分页，含最近执行日志统计）
router.get('/tasks', async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize || '20', 10)));
  const offset = (page - 1) * pageSize;
  const keyword = (req.query.keyword || '').toString().trim();
  const status = (req.query.status || '').toString().trim(); // '', '1', '0'

  const where = [];
  const params = [];
  if (keyword) {
    where.push('(u.username LIKE ? OR a.bili_uid LIKE ? OR a.nickname LIKE ? OR t.room_id LIKE ?)');
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }
  if (status === '1' || status === '0') {
    where.push('t.enabled = ?');
    params.push(Number(status));
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = (await db.queryOne(
    `SELECT COUNT(*) c FROM bili_danmu_tasks t
       JOIN bili_accounts a ON t.account_id = a.id
       JOIN bili_users u ON a.user_id = u.id ${whereSql}`,
    params
  )).c;
  const tasks = await db.query(
    `SELECT t.id, t.room_id, t.schedule_type, t.interval_seconds, t.interval_min, t.interval_max,
            t.preset, t.mode, t.messages, t.enabled, t.created_at,
            a.id AS account_id, a.bili_uid, a.nickname, a.active AS account_active,
            u.id AS user_id, u.username,
            MAX(l.created_at) as last_run_at,
            SUM(CASE WHEN l.success = 1 THEN 1 ELSE 0 END) as success_count,
            COUNT(l.id) as total_logs,
            (SELECT result FROM bili_danmu_logs WHERE task_id = t.id ORDER BY created_at DESC LIMIT 1) as last_error
       FROM bili_danmu_tasks t
       JOIN bili_accounts a ON t.account_id = a.id
       JOIN bili_users u ON a.user_id = u.id
       LEFT JOIN bili_danmu_logs l ON t.id = l.task_id
       ${whereSql} GROUP BY t.id ORDER BY t.id DESC LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );
  res.json({ ok: true, tasks, total, page, pageSize });
});

// 订单列表（分页 + 状态筛选）
router.get('/orders', async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize || '20', 10)));
  const offset = (page - 1) * pageSize;
  const status = String(req.query.status || '').trim();
  
  const where = [];
  const params = [];
  if (status && ['pending', 'paid', 'failed'].includes(status)) {
    where.push('o.status = ?');
    params.push(status);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')} ` : '';
  
  const total = (await db.queryOne(`SELECT COUNT(*) c FROM bili_orders ${whereSql}`)).c;
  const orders = await db.query(
    `SELECT o.id, o.order_no, o.amount, o.channel, o.status, o.trade_no, o.created_at, o.paid_at, u.username
       FROM bili_orders o JOIN bili_users u ON o.user_id = u.id ${whereSql}ORDER BY o.id DESC LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );
  res.json({ ok: true, orders, total, page, pageSize });
});

// 导出卡密为CSV
router.get('/cards/export', async (req, res) => {
  const keyword = String(req.query.keyword || '').trim();
  const status = String(req.query.status || '').trim();
  
  let whereClause = '1=1';
  const params = [];
  
  if (keyword) {
    whereClause += ' AND code LIKE ?';
    params.push(`%${keyword}%`);
  }
  
  if (status === 'used') {
    whereClause += ' AND used = 1';
  } else if (status === 'unused') {
    whereClause += ' AND used = 0';
  }
  
  const cards = await db.query(
    `SELECT code, amount, used_count, max_uses, created_at, used_at FROM bili_cards WHERE ${whereClause} ORDER BY created_at DESC`,
    params
  );
  
  // 生成CSV内容
  const header = '卡密,面额(元),使用次数,上限次数,创建时间,使用时间\n';
  const rows = cards.map(c => {
    const createdAt = c.created_at ? new Date(c.created_at).toLocaleString('zh-CN', { hour12: false }) : '';
    const usedAt = c.used_at ? new Date(c.used_at).toLocaleString('zh-CN', { hour12: false }) : '';
    return `"${c.code}",${c.amount},${c.used_count},${c.max_uses},"${createdAt}","${usedAt}"`;
  }).join('\n');
  
  const csv = header + rows;
  
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent('卡密列表-' + Date.now() + '.csv')}`);
  res.send(csv);
});

// 卡密列表（搜索 / 状态筛选 / 分页）
router.get('/cards', async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize || '20', 10)));
  const keyword = (req.query.keyword || '').toString().trim();
  const status = (req.query.status || '').toString().trim(); // '', 'used', 'unused'
  const all = req.query.all === '1'; // 导出用：返回全部匹配项

  const where = [];
  const params = [];
  if (keyword) {
    where.push('code LIKE ?');
    params.push(`%${keyword}%`);
  }
  if (status === 'used') where.push('used_count >= max_uses');
  else if (status === 'unused') where.push('used_count < max_uses');
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const total = (await db.queryOne(`SELECT COUNT(*) c FROM bili_cards ${whereSql}`, params)).c;

  const selectSql = `SELECT id, code, amount, max_uses, used_count, used, used_at FROM bili_cards ${whereSql} ORDER BY id DESC`;
  const cards = all
    ? await db.query(selectSql, params)
    : await db.query(`${selectSql} LIMIT ? OFFSET ?`, [...params, pageSize, (page - 1) * pageSize]);

  // 全局统计（不受筛选影响）
  const statsRow = await db.queryOne(
    `SELECT COUNT(*) total,
            COALESCE(SUM(CASE WHEN used_count < max_uses THEN 1 ELSE 0 END), 0) availableCount,
            COALESCE(SUM(CASE WHEN used_count < max_uses THEN amount ELSE 0 END), 0) availableAmount
       FROM bili_cards`
  );
  const stats = {
    total: statsRow.total,
    availableCount: Number(statsRow.availableCount) || 0,
    usedCount: statsRow.total - (Number(statsRow.availableCount) || 0),
    availableAmount: Number(statsRow.availableAmount) || 0
  };

  res.json({ ok: true, cards, total, page, pageSize, stats });
});

// 批量生成卡密
router.post('/cards/generate', async (req, res) => {
  const amount = parseFloat(req.body.amount);
  const count = Math.min(200, Math.max(1, parseInt(req.body.count || '1', 10)));
  const maxUses = Math.max(1, parseInt(req.body.maxUses || '1', 10));
  const customCode = String(req.body.code || '').trim().toUpperCase();
  if (!amount || amount <= 0) return res.status(400).json({ ok: false, message: '面额无效' });

  // 自定义卡密内容：仅支持生成 1 张
  if (customCode) {
    if (!/^[A-Z0-9_-]{4,64}$/.test(customCode)) {
      return res.status(400).json({ ok: false, message: '卡密内容仅支持 4-64 位字母、数字、- 或 _' });
    }
    const exists = await db.queryOne('SELECT id FROM bili_cards WHERE code = ?', [customCode]);
    if (exists) return res.status(400).json({ ok: false, message: '该卡密内容已存在' });
    await db.query('INSERT INTO bili_cards (code, amount, max_uses) VALUES (?, ?, ?)', [
      customCode,
      amount.toFixed(2),
      maxUses
    ]);
    return res.json({ ok: true, codes: [customCode] });
  }

  const codes = [];
  for (let i = 0; i < count; i++) {
    const code = crypto.randomBytes(8).toString('hex').toUpperCase();
    codes.push(code);
    await db.query('INSERT INTO bili_cards (code, amount, max_uses) VALUES (?, ?, ?)', [
      code,
      amount.toFixed(2),
      maxUses
    ]);
  }
  res.json({ ok: true, codes });
});

// 删除卡密（未被兑换过的）
router.post('/cards/:id/delete', async (req, res) => {
  await db.query('DELETE FROM bili_cards WHERE id = ? AND used_count = 0', [req.params.id]);
  res.json({ ok: true });
});

// ============ 系统设置 ============
const SETTING_KEYS = [
  'site_url',
  // TDK
  'site_title', 'site_subtitle', 'site_description', 'site_keywords',
  // 站点公告（富文本）
  'site_announcement',
  // 支付
  'epay_enabled', 'epay_api_url', 'epay_pid', 'epay_key',
  'alipay_enabled', 'alipay_app_id', 'alipay_private_key', 'alipay_public_key', 'alipay_gateway',
  // 邮件
  'mail_enabled', 'smtp_host', 'smtp_port', 'smtp_secure', 'smtp_user', 'smtp_pass', 'smtp_from',
  // 邮箱过滤
  'email_filter_mode', 'email_filter_list',
  // 聚合第三方登录
  'oauth_enabled', 'oauth_api_url', 'oauth_appid', 'oauth_appkey', 'oauth_providers',
  // 兰空图床
  'lsky_enabled', 'lsky_api_url', 'lsky_token', 'lsky_strategy_id'
];
const BOOL_KEYS = ['epay_enabled', 'alipay_enabled', 'mail_enabled', 'smtp_secure', 'oauth_enabled', 'lsky_enabled'];

router.get('/settings', (req, res) => {
  res.json({ ok: true, ...settings.getAdminSettings() });
});

router.post('/settings', async (req, res) => {
  const pairs = {};
  for (const key of SETTING_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(req.body, key)) continue;
    if (BOOL_KEYS.includes(key)) {
      pairs[key] = req.body[key] ? 'true' : 'false';
    } else if (key === 'site_announcement') {
      pairs[key] = sanitizeHtml(req.body[key]);
    } else {
      pairs[key] = (req.body[key] || '').toString().trim();
    }
  }
  if (Object.keys(pairs).length > 0) await settings.setMany(pairs);
  res.json({ ok: true });
});

// ============ 任务模板（总任务） ============
function normalizeTemplate(body) {
  const schedule_type = ['random', 'daily'].includes(body.schedule_type) ? body.schedule_type : 'fixed';
  const interval_min = Math.max(5, parseInt(body.interval_min || '300', 10));
  const interval_max = Math.max(interval_min, parseInt(body.interval_max || '600', 10));
  return {
    group_name: String(body.group_name || '其他').trim().slice(0, 64) || '其他',
    label: String(body.label || '').trim().slice(0, 64),
    schedule_type,
    interval_seconds: Math.max(5, parseInt(body.interval_seconds || '60', 10)),
    interval_min,
    interval_max,
    mode: body.mode === 'random' ? 'random' : 'sequential',
    messages: String(body.messages || '').trim(),
    sort_order: parseInt(body.sort_order || '0', 10) || 0
  };
}

router.get('/templates', async (req, res) => {
  const templates = await db.query('SELECT * FROM bili_task_templates ORDER BY sort_order ASC, id ASC');
  res.json({ ok: true, templates });
});

router.post('/templates', async (req, res) => {
  const f = normalizeTemplate(req.body);
  if (!f.label || !f.messages) {
    return res.status(400).json({ ok: false, message: '请填写名称与弹幕内容' });
  }
  let presetKey = String(req.body.preset_key || '').trim().slice(0, 32);
  if (!presetKey) presetKey = 'tpl_' + Date.now().toString(36);
  if (!/^[a-zA-Z0-9_]+$/.test(presetKey)) {
    return res.status(400).json({ ok: false, message: '模板标识只能包含字母、数字、下划线' });
  }
  if (await db.queryOne('SELECT id FROM bili_task_templates WHERE preset_key = ?', [presetKey])) {
    return res.status(400).json({ ok: false, message: '模板标识已存在' });
  }
  await db.query(
    `INSERT INTO bili_task_templates
       (preset_key, group_name, label, schedule_type, interval_seconds, interval_min, interval_max, mode, messages, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [presetKey, f.group_name, f.label, f.schedule_type, f.interval_seconds, f.interval_min, f.interval_max, f.mode, f.messages, f.sort_order]
  );
  res.json({ ok: true });
});

router.post('/templates/:id/update', async (req, res) => {
  const tpl = await db.queryOne('SELECT id FROM bili_task_templates WHERE id = ?', [req.params.id]);
  if (!tpl) return res.status(404).json({ ok: false, message: '模板不存在' });
  const f = normalizeTemplate(req.body);
  if (!f.label || !f.messages) {
    return res.status(400).json({ ok: false, message: '请填写名称与弹幕内容' });
  }
  await db.query(
    `UPDATE bili_task_templates SET group_name = ?, label = ?, schedule_type = ?, interval_seconds = ?,
       interval_min = ?, interval_max = ?, mode = ?, messages = ?, sort_order = ? WHERE id = ?`,
    [f.group_name, f.label, f.schedule_type, f.interval_seconds, f.interval_min, f.interval_max, f.mode, f.messages, f.sort_order, tpl.id]
  );
  res.json({ ok: true });
});

router.post('/templates/:id/toggle', async (req, res) => {
  const tpl = await db.queryOne('SELECT id, enabled FROM bili_task_templates WHERE id = ?', [req.params.id]);
  if (!tpl) return res.status(404).json({ ok: false, message: '模板不存在' });
  await db.query('UPDATE bili_task_templates SET enabled = ? WHERE id = ?', [tpl.enabled ? 0 : 1, tpl.id]);
  res.json({ ok: true });
});

router.post('/templates/:id/delete', async (req, res) => {
  const tpl = await db.queryOne('SELECT id FROM bili_task_templates WHERE id = ?', [req.params.id]);
  if (!tpl) return res.status(404).json({ ok: false, message: '模板不存在' });
  await db.query('DELETE FROM bili_task_templates WHERE id = ?', [tpl.id]);
  res.json({ ok: true });
});

// ============ 时长套餐 ============
function normalizePackage(body) {
  return {
    name: String(body.name || '').trim().slice(0, 64),
    days: Math.max(1, parseInt(body.days || '30', 10)),
    price: Math.max(0, Math.round(parseFloat(body.price || '0') * 100) / 100),
    sort_order: parseInt(body.sort_order || '0', 10) || 0,
    description: sanitizeHtml(body.description)
  };
}

router.get('/packages', async (req, res) => {
  const packages = await db.query('SELECT * FROM bili_duration_packages ORDER BY sort_order ASC, id ASC');
  res.json({ ok: true, packages });
});

router.post('/packages', async (req, res) => {
  const f = normalizePackage(req.body);
  if (!f.name) return res.status(400).json({ ok: false, message: '请填写套餐名称' });
  await db.query(
    'INSERT INTO bili_duration_packages (name, days, price, sort_order, description) VALUES (?, ?, ?, ?, ?)',
    [f.name, f.days, f.price, f.sort_order, f.description]
  );
  res.json({ ok: true });
});

router.post('/packages/:id/update', async (req, res) => {
  const pkg = await db.queryOne('SELECT id FROM bili_duration_packages WHERE id = ?', [req.params.id]);
  if (!pkg) return res.status(404).json({ ok: false, message: '套餐不存在' });
  const f = normalizePackage(req.body);
  if (!f.name) return res.status(400).json({ ok: false, message: '请填写套餐名称' });
  await db.query(
    'UPDATE bili_duration_packages SET name = ?, days = ?, price = ?, sort_order = ?, description = ? WHERE id = ?',
    [f.name, f.days, f.price, f.sort_order, f.description, pkg.id]
  );
  res.json({ ok: true });
});

router.post('/packages/:id/toggle', async (req, res) => {
  const pkg = await db.queryOne('SELECT id, enabled FROM bili_duration_packages WHERE id = ?', [req.params.id]);
  if (!pkg) return res.status(404).json({ ok: false, message: '套餐不存在' });
  await db.query('UPDATE bili_duration_packages SET enabled = ? WHERE id = ?', [pkg.enabled ? 0 : 1, pkg.id]);
  res.json({ ok: true });
});

router.post('/packages/:id/delete', async (req, res) => {
  const pkg = await db.queryOne('SELECT id FROM bili_duration_packages WHERE id = ?', [req.params.id]);
  if (!pkg) return res.status(404).json({ ok: false, message: '套餐不存在' });
  await db.query('DELETE FROM bili_duration_packages WHERE id = ?', [pkg.id]);
  res.json({ ok: true });
});

// ============ 在线直播间 ============
const LIVE_CATEGORIES = ['danchong', 'maomao'];

// 列出全部直播间
router.get('/live-rooms', async (req, res) => {
  const rooms = await db.query('SELECT * FROM bili_live_rooms ORDER BY category ASC, sort_order ASC, id ASC');
  res.json({ ok: true, rooms });
});

// B站账号信息查询（按 UID，调用第三方 API）
router.get('/bili-userinfo', async (req, res) => {
  const uid = String(req.query.uid || '').trim();
  if (!/^\d+$/.test(uid)) return res.status(400).json({ ok: false, message: '请输入有效的 UID（纯数字）' });
  try {
    const info = await bili.getBiliUserInfo(uid);
    res.json({ ok: true, info });
  } catch (e) {
    res.status(400).json({ ok: false, message: e.message });
  }
});

// 所有用户绑定的 B 站账号列表（从旧到新，支持分页、搜索、筛选）
router.get('/bili-accounts', async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize || '20', 10)));
  const keyword = (req.query.keyword || '').toString().trim();
  const status = (req.query.status || '').toString().trim();
  
  const where = [];
  const params = [];
  
  // 关键词搜索：用户名、UID、昵称
  if (keyword) {
    where.push('(u.username LIKE ? OR a.bili_uid LIKE ? OR a.nickname LIKE ?)');
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }
  
  // 状态筛选：active（生效中）expired（已过期）
  if (status === 'active') {
    where.push('a.active = 1 AND (a.expire_at IS NULL OR a.expire_at > NOW())');
  } else if (status === 'expired') {
    where.push('(a.active = 0 OR (a.expire_at IS NOT NULL AND a.expire_at <= NOW()))');
  }
  
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = (await db.queryOne(
    `SELECT COUNT(*) c FROM bili_accounts a
     JOIN bili_users u ON u.id = a.user_id ${whereSql}`,
    params
  )).c;
  
  const rows = await db.query(
    `SELECT a.id, a.bili_uid, a.nickname, a.avatar, a.active, a.expire_at, a.created_at,
            u.id AS user_id, u.username, u.avatar AS user_avatar
     FROM bili_accounts a
     JOIN bili_users u ON u.id = a.user_id
     ${whereSql}
     ORDER BY a.created_at ASC, a.id ASC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, (page - 1) * pageSize]
  );
  res.json({ ok: true, accounts: rows, total, page, pageSize });
});

// 预览：根据房间号拉取 B站直播间信息（封面/标题/主播）
router.get('/live-rooms/fetch', async (req, res) => {
  const roomId = String(req.query.room_id || '').trim();
  if (!roomId) return res.status(400).json({ ok: false, message: '请输入房间号' });
  try {
    const info = await bili.getLiveRoomInfo(roomId);
    res.json({ ok: true, info });
  } catch (e) {
    res.status(400).json({ ok: false, message: e.message });
  }
});

// 新增直播间（自动拉取封面等信息）
router.post('/live-rooms', async (req, res) => {
  const roomId = String(req.body.room_id || '').trim();
  const category = String(req.body.category || 'danchong');
  if (!roomId) return res.status(400).json({ ok: false, message: '请输入房间号' });
  if (!LIVE_CATEGORIES.includes(category)) return res.status(400).json({ ok: false, message: '未知分类' });
  const dup = await db.queryOne('SELECT id FROM bili_live_rooms WHERE room_id = ?', [roomId]);
  if (dup) return res.status(400).json({ ok: false, message: '该直播间已存在' });

  let info;
  try {
    info = await bili.getLiveRoomInfo(roomId);
  } catch (e) {
    return res.status(400).json({ ok: false, message: '拉取直播间信息失败：' + e.message });
  }
  await db.query(
    'INSERT INTO bili_live_rooms (room_id, category, title, cover, uname, uid, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [info.room_id, category, info.title, info.cover, info.uname, info.uid, Number(req.body.sort_order) || 0]
  );
  res.json({ ok: true });
});

// 刷新某直播间封面与标题
router.post('/live-rooms/:id/refresh', async (req, res) => {
  const room = await db.queryOne('SELECT * FROM bili_live_rooms WHERE id = ?', [req.params.id]);
  if (!room) return res.status(404).json({ ok: false, message: '直播间不存在' });
  try {
    const info = await bili.getLiveRoomInfo(room.room_id);
    await db.query(
      'UPDATE bili_live_rooms SET title = ?, cover = ?, uname = ?, uid = ? WHERE id = ?',
      [info.title, info.cover, info.uname, info.uid, room.id]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ ok: false, message: e.message });
  }
});

// 更新分类 / 排序
router.post('/live-rooms/:id/update', async (req, res) => {
  const room = await db.queryOne('SELECT id FROM bili_live_rooms WHERE id = ?', [req.params.id]);
  if (!room) return res.status(404).json({ ok: false, message: '直播间不存在' });
  const category = String(req.body.category || 'danchong');
  if (!LIVE_CATEGORIES.includes(category)) return res.status(400).json({ ok: false, message: '未知分类' });
  await db.query(
    'UPDATE bili_live_rooms SET category = ?, sort_order = ? WHERE id = ?',
    [category, Number(req.body.sort_order) || 0, room.id]
  );
  res.json({ ok: true });
});

router.post('/live-rooms/:id/toggle', async (req, res) => {
  const room = await db.queryOne('SELECT id, enabled FROM bili_live_rooms WHERE id = ?', [req.params.id]);
  if (!room) return res.status(404).json({ ok: false, message: '直播间不存在' });
  await db.query('UPDATE bili_live_rooms SET enabled = ? WHERE id = ?', [room.enabled ? 0 : 1, room.id]);
  res.json({ ok: true });
});

router.post('/live-rooms/:id/delete', async (req, res) => {
  const room = await db.queryOne('SELECT id FROM bili_live_rooms WHERE id = ?', [req.params.id]);
  if (!room) return res.status(404).json({ ok: false, message: '直播间不存在' });
  
  // 检查关联任务数
  const taskCount = (await db.queryOne(
    'SELECT COUNT(*) c FROM bili_danmu_tasks WHERE room_id = ?',
    [req.params.id]
  )).c;
  
  if (taskCount > 0) {
    // 若有关联任务，仅返回警告不删除（由前端决定是否继续）
    const force = req.body.force === true;
    if (!force) {
      return res.status(400).json({ 
        ok: false, 
        message: `该直播间有 ${taskCount} 个任务使用，确认删除吗？`,
        warning: true,
        taskCount
      });
    }
    // force=true 时禁用所有关联任务再删除
    await db.query('UPDATE bili_danmu_tasks SET enabled = 0 WHERE room_id = ?', [req.params.id]);
  }
  
  await db.query('DELETE FROM bili_live_rooms WHERE id = ?', [req.params.id]);
  res.json({ ok: true, message: taskCount > 0 ? `删除直播间并禁用了 ${taskCount} 个任务` : '直播间已删除' });
});

// ============ 抽奖管理 ============
const PRIZE_TYPES = ['balance', 'days', 'none', 'physical'];

// 奖品列表
router.get('/lottery/prizes', async (req, res) => {
  const prizes = await db.query('SELECT * FROM bili_lottery_prizes ORDER BY sort_order ASC, id ASC');
  const total = prizes.filter(p => p.enabled && p.weight > 0).reduce((s, p) => s + p.weight, 0);
  res.json({ ok: true, prizes, totalWeight: total });
});

// 抽奖配置（价格/每日免费次数）
router.get('/lottery/config', async (req, res) => {
  res.json({
    ok: true,
    config: {
      cost: Number(settings.getRaw('lottery_cost', '5')) || 0,
      free_per_day: parseInt(settings.getRaw('lottery_free_per_day', '1'), 10) || 0
    }
  });
});

router.post('/lottery/config', async (req, res) => {
  const cost = Math.max(0, Number(req.body.cost) || 0);
  const free = Math.max(0, parseInt(req.body.free_per_day, 10) || 0);
  await settings.setMany({ lottery_cost: cost, lottery_free_per_day: free });
  res.json({ ok: true });
});

// 新增奖品
router.post('/lottery/prizes', async (req, res) => {
  const { name, type, value, weight, stock, image, sort_order } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ ok: false, message: '请填写奖品名称' });
  if (!PRIZE_TYPES.includes(type)) return res.status(400).json({ ok: false, message: '奖品类型不合法' });
  await db.query(
    `INSERT INTO bili_lottery_prizes (name, type, value, weight, stock, image, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [name.trim(), type, Number(value) || 0, parseInt(weight, 10) || 0,
     stock === '' || stock == null ? -1 : parseInt(stock, 10), image || null, parseInt(sort_order, 10) || 0]
  );
  res.json({ ok: true });
});

// 更新奖品
router.post('/lottery/prizes/:id/update', async (req, res) => {
  const prize = await db.queryOne('SELECT id FROM bili_lottery_prizes WHERE id = ?', [req.params.id]);
  if (!prize) return res.status(404).json({ ok: false, message: '奖品不存在' });
  const { name, type, value, weight, stock, image, sort_order } = req.body;
  if (!PRIZE_TYPES.includes(type)) return res.status(400).json({ ok: false, message: '奖品类型不合法' });
  await db.query(
    `UPDATE bili_lottery_prizes SET name = ?, type = ?, value = ?, weight = ?, stock = ?, image = ?, sort_order = ? WHERE id = ?`,
    [name.trim(), type, Number(value) || 0, parseInt(weight, 10) || 0,
     stock === '' || stock == null ? -1 : parseInt(stock, 10), image || null, parseInt(sort_order, 10) || 0, prize.id]
  );
  res.json({ ok: true });
});

// 上下架
router.post('/lottery/prizes/:id/toggle', async (req, res) => {
  const prize = await db.queryOne('SELECT enabled FROM bili_lottery_prizes WHERE id = ?', [req.params.id]);
  if (!prize) return res.status(404).json({ ok: false, message: '奖品不存在' });
  await db.query('UPDATE bili_lottery_prizes SET enabled = ? WHERE id = ?', [prize.enabled ? 0 : 1, req.params.id]);
  res.json({ ok: true });
});

// 删除
router.post('/lottery/prizes/:id/delete', async (req, res) => {
  await db.query('DELETE FROM bili_lottery_prizes WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

// 抽奖记录（分页）
router.get('/lottery/records', async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize || '20', 10)));
  const offset = (page - 1) * pageSize;
  const total = (await db.queryOne('SELECT COUNT(*) c FROM bili_lottery_records')).c;
  const records = await db.query(
    `SELECT r.*, u.username FROM bili_lottery_records r JOIN bili_users u ON u.id = r.user_id
     ORDER BY r.id DESC LIMIT ? OFFSET ?`,
    [pageSize, offset]
  );
  res.json({ ok: true, records, total, page, pageSize });
});

// 标记中奖记录已发放（实物/卡密核销）
router.post('/lottery/records/:id/fulfill', async (req, res) => {
  await db.query('UPDATE bili_lottery_records SET fulfilled = 1 WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

// ============ 工单管理 ============
const TICKET_STATUS = ['open', 'pending', 'resolved', 'closed'];

router.get('/tickets', async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize || '20', 10)));
  const offset = (page - 1) * pageSize;
  const where = [];
  const params = [];
  if (req.query.status && TICKET_STATUS.includes(req.query.status)) {
    where.push('t.status = ?');
    params.push(req.query.status);
  }
  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const total = (await db.queryOne(`SELECT COUNT(*) c FROM bili_tickets t ${whereSql}`, params)).c;
  const sql = `SELECT t.*, u.username,
      (SELECT COUNT(*) FROM bili_ticket_messages m WHERE m.ticket_id = t.id) AS msg_count
    FROM bili_tickets t JOIN bili_users u ON u.id = t.user_id
    ${whereSql}
    ORDER BY t.updated_at DESC LIMIT ? OFFSET ?`;
  const tickets = await db.query(sql, [...params, pageSize, offset]);
  res.json({ ok: true, tickets, total, page, pageSize });
});

router.get('/tickets/:id', async (req, res) => {
  const ticket = await db.queryOne(
    'SELECT t.*, u.username, u.avatar AS user_avatar FROM bili_tickets t JOIN bili_users u ON u.id = t.user_id WHERE t.id = ?',
    [req.params.id]
  );
  if (!ticket) return res.status(404).json({ ok: false, message: '工单不存在' });
  const messages = await db.query(
    'SELECT * FROM bili_ticket_messages WHERE ticket_id = ? ORDER BY id ASC',
    [ticket.id]
  );
  res.json({ ok: true, ticket, messages: messages.map(m => ({ ...m, images: m.images ? JSON.parse(m.images) : [] })) });
});

// 管理员回复
router.post('/tickets/:id/reply', async (req, res) => {
  const ticket = await db.queryOne('SELECT id FROM bili_tickets WHERE id = ?', [req.params.id]);
  if (!ticket) return res.status(404).json({ ok: false, message: '工单不存在' });
  const content = sanitizeHtml(req.body.content);
  const images = Array.isArray(req.body.images) ? req.body.images.slice(0, 6) : [];
  if (!htmlToText(content) && images.length === 0) return res.status(400).json({ ok: false, message: '请输入回复内容' });
  await db.query(
    'INSERT INTO bili_ticket_messages (ticket_id, sender, content, images) VALUES (?, ?, ?, ?)',
    [ticket.id, 'admin', content, JSON.stringify(images)]
  );
  await db.query('UPDATE bili_tickets SET status = ?, last_reply_by = ? WHERE id = ?', ['pending', 'admin', ticket.id]);
  res.json({ ok: true });
});

// 修改工单状态
router.post('/tickets/:id/status', async (req, res) => {
  if (!TICKET_STATUS.includes(req.body.status)) return res.status(400).json({ ok: false, message: '状态不合法' });
  const ticket = await db.queryOne('SELECT id FROM bili_tickets WHERE id = ?', [req.params.id]);
  if (!ticket) return res.status(404).json({ ok: false, message: '工单不存在' });
  await db.query('UPDATE bili_tickets SET status = ? WHERE id = ?', [req.body.status, ticket.id]);
  res.json({ ok: true });
});

// ============ 友情链接管理 ============
// 获取所有友情链接
router.get('/friend-links', async (req, res) => {
  const links = await db.query('SELECT * FROM bili_friend_links ORDER BY sort_order ASC, id DESC');
  res.json({ ok: true, links });
});

// 新增友情链接
router.post('/friend-links', async (req, res) => {
  const name = String(req.body.name || '').trim();
  const url = String(req.body.url || '').trim();
  const description = String(req.body.description || '').trim();
  const logo = String(req.body.logo || '').trim();
  const sortOrder = Number(req.body.sort_order) || 0;

  if (!name) return res.status(400).json({ ok: false, message: '请输入链接名称' });
  if (!url) return res.status(400).json({ ok: false, message: '请输入链接地址' });
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return res.status(400).json({ ok: false, message: '链接地址必须以 http:// 或 https:// 开头' });
  }

  await db.query(
    'INSERT INTO bili_friend_links (name, url, description, logo, sort_order) VALUES (?, ?, ?, ?, ?)',
    [name, url, description, logo, sortOrder]
  );
  res.json({ ok: true });
});

// 更新友情链接
router.post('/friend-links/:id/update', async (req, res) => {
  const link = await db.queryOne('SELECT id FROM bili_friend_links WHERE id = ?', [req.params.id]);
  if (!link) return res.status(404).json({ ok: false, message: '友情链接不存在' });

  const name = String(req.body.name || '').trim();
  const url = String(req.body.url || '').trim();
  const description = String(req.body.description || '').trim();
  const logo = String(req.body.logo || '').trim();
  const sortOrder = Number(req.body.sort_order) || 0;

  if (!name) return res.status(400).json({ ok: false, message: '请输入链接名称' });
  if (!url) return res.status(400).json({ ok: false, message: '请输入链接地址' });
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return res.status(400).json({ ok: false, message: '链接地址必须以 http:// 或 https:// 开头' });
  }

  await db.query(
    'UPDATE bili_friend_links SET name = ?, url = ?, description = ?, logo = ?, sort_order = ? WHERE id = ?',
    [name, url, description, logo, sortOrder, link.id]
  );
  res.json({ ok: true });
});

// 切换启用状态
router.post('/friend-links/:id/toggle', async (req, res) => {
  const link = await db.queryOne('SELECT id, enabled FROM bili_friend_links WHERE id = ?', [req.params.id]);
  if (!link) return res.status(404).json({ ok: false, message: '友情链接不存在' });
  await db.query('UPDATE bili_friend_links SET enabled = ? WHERE id = ?', [link.enabled ? 0 : 1, link.id]);
  res.json({ ok: true });
});

// 删除友情链接
router.post('/friend-links/:id/delete', async (req, res) => {
  const link = await db.queryOne('SELECT id FROM bili_friend_links WHERE id = ?', [req.params.id]);
  if (!link) return res.status(404).json({ ok: false, message: '友情链接不存在' });
  await db.query('DELETE FROM bili_friend_links WHERE id = ?', [link.id]);
  res.json({ ok: true });
});

// ============ 图床上传 ============
router.post('/upload/image', imageUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, message: '未选择文件' });
    }
    
    // 验证文件大小
    if (!lsky.isValidFileSize(req.file.size)) {
      return res.status(400).json({ ok: false, message: '文件大小不能超过 10MB' });
    }
    
    // 上传到兰空图床
    const result = await lsky.uploadImage(
      req.file.buffer,
      req.file.originalname,
      req.body.strategy_id || null
    );
    
    res.json({
      ok: true,
      url: result.url,
      thumbnail: result.thumbnail,
      data: result.data
    });
  } catch (error) {
    console.error('图片上传失败:', error);
    res.status(500).json({ ok: false, message: error.message });
  }
});

module.exports = router;



