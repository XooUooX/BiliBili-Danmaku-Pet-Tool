const express = require('express');
const QRCode = require('qrcode');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const db = require('../../db');
const bili = require('../../services/bilibili');
const balanceService = require('../../services/balance');
const scheduler = require('../../services/scheduler');
const dailyScheduler = require('../../services/dailyScheduler');
const settings = require('../../services/settings');
const payment = require('../../services/payment');
const lottery = require('../../services/lottery');
const lsky = require('../../services/lsky');
const { sanitizeHtml, htmlToText } = require('../../services/sanitizeHtml');

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// 扫码登录会话：key -> { qrcode_key, userId }
const qrSessions = new Map();

// ============ 概览 ============
router.get('/overview', async (req, res) => {
  const uid = req.session.userId;
  const user = await db.queryOne(
    'SELECT id, username, balance, created_at FROM bili_users WHERE id = ?',
    [uid]
  );
  const accounts = await db.query(
    'SELECT id, bili_uid, nickname, avatar, active, expire_at, created_at FROM bili_accounts WHERE user_id = ? ORDER BY id DESC',
    [uid]
  );
  const taskCount = await db.queryOne(
    `SELECT COUNT(*) AS c FROM bili_danmu_tasks t JOIN bili_accounts a ON t.account_id = a.id WHERE a.user_id = ?`,
    [uid]
  );
  res.json({
    ok: true,
    user,
    accounts,
    taskCount: taskCount.c
  });
});

// ============ 绑定B站账号（扫码） ============
router.post('/account/qrcode', async (req, res) => {
  try {
    const { url, qrcode_key } = await bili.generateQrcode();
    const key = Math.random().toString(36).slice(2);
    qrSessions.set(key, { qrcode_key, userId: req.session.userId, createdAt: Date.now() });
    const dataUrl = await QRCode.toDataURL(url);
    res.json({ ok: true, key, qrcode: dataUrl });
  } catch (e) {
    res.json({ ok: false, message: e.message });
  }
});

router.get('/account/qrcode/poll', async (req, res) => {
  const sess = qrSessions.get(req.query.key);
  if (!sess || sess.userId !== req.session.userId) {
    return res.json({ ok: false, status: 'expired', message: '会话不存在' });
  }
  try {
    const r = await bili.pollQrcodeOnce(sess.qrcode_key);
    if (r.status === 'success') {
      const cookie = r.cookie;
      const csrf = bili.parseCsrf(cookie);
      const info = await bili.getAccountInfo(cookie);
      await db.query(
        'INSERT INTO bili_accounts (user_id, bili_uid, nickname, avatar, cookie, csrf) VALUES (?, ?, ?, ?, ?, ?)',
        [req.session.userId, info.uid || null, info.nickname || null, info.avatar || null, cookie, csrf]
      );
      // 绑定成功后自动关注指定 UP 主
      bili.followUser(5432606, cookie, csrf).catch(() => {});
      qrSessions.delete(req.query.key);
      return res.json({ ok: true, status: 'success', nickname: info.nickname || '未知' });
    }
    res.json({ ok: true, status: r.status });
  } catch (e) {
    res.json({ ok: false, status: 'error', message: e.message });
  }
});

// ============ 账号操作 ============
router.post('/account/:id/delete', async (req, res) => {
  await db.query('DELETE FROM bili_accounts WHERE id = ? AND user_id = ?', [
    req.params.id,
    req.session.userId
  ]);
  scheduler.sync().catch(() => {});
  res.json({ ok: true });
});

// 查询「弹幕宠物」面板信息（金币/等级/进阶）
router.get('/account/:id/pet', async (req, res) => {
  const acc = await db.queryOne('SELECT * FROM bili_accounts WHERE id = ? AND user_id = ?', [
    req.params.id,
    req.session.userId
  ]);
  if (!acc) return res.status(404).json({ ok: false, message: '账号不存在' });

  // 房间号：优先 query，其次取该账号最近一个任务的房间
  let roomId = String(req.query.roomId || '').trim();
  if (!roomId) {
    const task = await db.queryOne(
      'SELECT room_id FROM bili_danmu_tasks WHERE account_id = ? ORDER BY id DESC LIMIT 1',
      [acc.id]
    );
    roomId = task && task.room_id ? String(task.room_id) : '';
  }
  if (!roomId) {
    return res.status(400).json({ ok: false, message: '缺少房间号，请传入 roomId 或先为该账号创建任务' });
  }

  try {
    const result = await bili.getDanmuPetInfo(roomId, acc.cookie);
    if (!result.ok) return res.json({ ok: false, message: result.message });

    // 记录升级历史：与该账号最近一次记录的等级对比，等级提升则写入
    const info = result.info || {};
    const levelNow = parseInt(info.level, 10);
    if (Number.isFinite(levelNow)) {
      const last = await db.queryOne(
        'SELECT level_after FROM bili_pet_level_logs WHERE account_id = ? ORDER BY id DESC LIMIT 1',
        [acc.id]
      );
      const levelBefore = last ? last.level_after : null;
      if (levelBefore === null || levelNow > levelBefore) {
        await db.query(
          `INSERT INTO bili_pet_level_logs
             (account_id, room_id, level_before, level_after, level_name, pet_name, coin, attack, defense)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            acc.id,
            roomId,
            levelBefore,
            levelNow,
            info.levelName || null,
            info.petName || null,
            Number.isFinite(parseInt(info.coin, 10)) ? parseInt(info.coin, 10) : null,
            Number.isFinite(parseInt(info.attack, 10)) ? parseInt(info.attack, 10) : null,
            Number.isFinite(parseInt(info.defense, 10)) ? parseInt(info.defense, 10) : null
          ]
        );
      }
    }

    res.json({ ok: true, info: result.info });
  } catch (e) {
    res.json({ ok: false, message: e.message });
  }
});

// 查询「弹幕宠物」升级历史（当前用户所有账号）
router.get('/pet-logs', async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize, 10) || 20));
  const offset = (page - 1) * pageSize;

  const accountId = req.query.accountId ? parseInt(req.query.accountId, 10) : null;
  const where = ['ba.user_id = ?'];
  const params = [req.session.userId];
  if (accountId) {
    where.push('pl.account_id = ?');
    params.push(accountId);
  }
  const whereSql = where.join(' AND ');

  const totalRow = await db.queryOne(
    `SELECT COUNT(*) AS c FROM bili_pet_level_logs pl
       JOIN bili_accounts ba ON ba.id = pl.account_id
      WHERE ${whereSql}`,
    params
  );
  const rows = await db.query(
    `SELECT pl.id, pl.account_id, pl.room_id, pl.level_before, pl.level_after,
            pl.level_name, pl.pet_name, pl.coin, pl.attack, pl.defense, pl.created_at,
            ba.nickname, ba.bili_uid
       FROM bili_pet_level_logs pl
       JOIN bili_accounts ba ON ba.id = pl.account_id
      WHERE ${whereSql}
      ORDER BY pl.id DESC
      LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );

  res.json({ ok: true, list: rows, total: totalRow.c, page, pageSize });
});

// ============ 任务 ============
async function getOwnedAccount(accountId, userId) {
  return db.queryOne('SELECT * FROM bili_accounts WHERE id = ? AND user_id = ?', [accountId, userId]);
}

// 归一化任务表单：支持 fixed/random/daily 三种调度
function normalizeTaskInput(body) {
  const schedule_type = ['random', 'daily'].includes(body.schedule_type) ? body.schedule_type : 'fixed';
  let interval_min = Math.max(5, parseInt(body.interval_min || '300', 10));
  let interval_max = Math.max(interval_min, parseInt(body.interval_max || '600', 10));
  return {
    room_id: String(body.room_id || '').trim(),
    schedule_type,
    interval_seconds: Math.max(5, parseInt(body.interval_seconds || '60', 10)),
    interval_min,
    interval_max,
    preset: body.preset ? String(body.preset).slice(0, 32) : null,
    mode: body.mode === 'random' ? 'random' : 'sequential',
    messages: String(body.messages || '').trim(),
    auto_switch_room: body.auto_switch_room ? 1 : 0,
    room_category: body.room_category ? String(body.room_category).slice(0, 16) : null
  };
}

// 用户端可选的任务模板（仅启用的）
router.get('/templates', async (req, res) => {
  const templates = await db.query(
    `SELECT preset_key, group_name, label, schedule_type, interval_seconds, interval_min, interval_max, mode, messages
       FROM bili_task_templates WHERE enabled = 1 ORDER BY sort_order ASC, id ASC`
  );
  res.json({ ok: true, templates });
});

// ============ 时长套餐 ============
router.get('/packages', async (req, res) => {
  const packages = await db.query(
    'SELECT id, name, days, price, description FROM bili_duration_packages WHERE enabled = 1 ORDER BY sort_order ASC, id ASC'
  );
  res.json({ ok: true, packages });
});

// 购买时长套餐：扣余额并为指定账号续期
router.post('/packages/:id/buy', async (req, res) => {
  const pkg = await db.queryOne(
    'SELECT * FROM bili_duration_packages WHERE id = ? AND enabled = 1',
    [req.params.id]
  );
  if (!pkg) return res.status(404).json({ ok: false, message: '套餐不存在或已下架' });

  const acc = await db.queryOne('SELECT * FROM bili_accounts WHERE id = ? AND user_id = ?', [
    req.body.accountId,
    req.session.userId
  ]);
  if (!acc) return res.status(404).json({ ok: false, message: '请选择有效的绑定账号' });

  const cost = Number(pkg.price);
  const user = await db.queryOne('SELECT balance FROM bili_users WHERE id = ?', [req.session.userId]);
  if (Number(user.balance) < cost) {
    return res.status(400).json({ ok: false, message: '余额不足，请先充值' });
  }

  await balanceService.changeBalance(
    req.session.userId,
    -cost,
    'consume',
    `购买${pkg.name}(${pkg.days}天) 账号#${acc.id}`
  );
  const base = acc.expire_at && new Date(acc.expire_at) > new Date() ? new Date(acc.expire_at) : new Date();
  base.setDate(base.getDate() + pkg.days);
  await db.query('UPDATE bili_accounts SET active = 1, expire_at = ? WHERE id = ?', [base, acc.id]);
  scheduler.sync().catch(() => {});
  res.json({ ok: true });
});

router.get('/account/:id/tasks', async (req, res) => {
  const acc = await getOwnedAccount(req.params.id, req.session.userId);
  if (!acc) return res.status(404).json({ ok: false, message: '账号不存在' });
  const tasks = await db.query('SELECT * FROM bili_danmu_tasks WHERE account_id = ? ORDER BY id DESC', [acc.id]);
  res.json({ ok: true, account: { id: acc.id, nickname: acc.nickname, active: acc.active }, tasks });
});

router.post('/account/:id/tasks', async (req, res) => {
  const acc = await getOwnedAccount(req.params.id, req.session.userId);
  if (!acc) return res.status(404).json({ ok: false, message: '账号不存在' });
  if (acc.active !== 1) return res.status(400).json({ ok: false, message: '账号未激活，请先购买时长激活后再添加任务' });
  const f = normalizeTaskInput(req.body);
  await db.query(
    'INSERT INTO bili_danmu_tasks (account_id, room_id, schedule_type, interval_seconds, interval_min, interval_max, preset, mode, messages, auto_switch_room, room_category) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [acc.id, f.room_id, f.schedule_type, f.interval_seconds, f.interval_min, f.interval_max, f.preset, f.mode, f.messages, f.auto_switch_room, f.room_category]
  );
  scheduler.sync().catch(() => {});
  res.json({ ok: true });
});

router.post('/tasks/:taskId/toggle', async (req, res) => {
  const task = await db.queryOne(
    `SELECT t.* FROM bili_danmu_tasks t JOIN bili_accounts a ON t.account_id = a.id
       WHERE t.id = ? AND a.user_id = ?`,
    [req.params.taskId, req.session.userId]
  );
  if (!task) return res.status(404).json({ ok: false, message: '任务不存在' });
  await db.query('UPDATE bili_danmu_tasks SET enabled = ? WHERE id = ?', [task.enabled ? 0 : 1, task.id]);
  scheduler.sync().catch(() => {});
  res.json({ ok: true });
});

router.post('/tasks/:taskId/update', async (req, res) => {
  const task = await db.queryOne(
    `SELECT t.* FROM bili_danmu_tasks t JOIN bili_accounts a ON t.account_id = a.id
       WHERE t.id = ? AND a.user_id = ?`,
    [req.params.taskId, req.session.userId]
  );
  if (!task) return res.status(404).json({ ok: false, message: '任务不存在' });
  const f = normalizeTaskInput(req.body);
  await db.query(
    'UPDATE bili_danmu_tasks SET room_id = ?, schedule_type = ?, interval_seconds = ?, interval_min = ?, interval_max = ?, preset = ?, mode = ?, messages = ?, auto_switch_room = ?, room_category = ? WHERE id = ?',
    [f.room_id, f.schedule_type, f.interval_seconds, f.interval_min, f.interval_max, f.preset, f.mode, f.messages, f.auto_switch_room, f.room_category, task.id]
  );
  scheduler.sync().catch(() => {});
  res.json({ ok: true });
});

router.post('/tasks/:taskId/delete', async (req, res) => {
  const task = await db.queryOne(
    `SELECT t.* FROM bili_danmu_tasks t JOIN bili_accounts a ON t.account_id = a.id
       WHERE t.id = ? AND a.user_id = ?`,
    [req.params.taskId, req.session.userId]
  );
  if (!task) return res.status(404).json({ ok: false, message: '任务不存在' });
  await db.query('DELETE FROM bili_danmu_tasks WHERE id = ?', [task.id]);
  scheduler.stopTask(task.id);
  res.json({ ok: true });
});

router.get('/tasks/:taskId/logs', async (req, res) => {
  const task = await db.queryOne(
    `SELECT t.id, t.room_id, t.schedule_type, t.interval_seconds, t.interval_min,
            t.interval_max, t.preset, t.mode, t.messages, t.enabled,
            t.auto_switch_room, t.room_category, t.created_at,
            a.id AS account_id, a.nickname, a.bili_uid, a.active, a.expire_at,
            p.label AS preset_label, p.group_name AS preset_group
       FROM bili_danmu_tasks t
       JOIN bili_accounts a ON t.account_id = a.id
       LEFT JOIN bili_task_templates p ON t.preset = p.preset_key
      WHERE t.id = ? AND a.user_id = ?`,
    [req.params.taskId, req.session.userId]
  );
  if (!task) return res.status(404).json({ ok: false, message: '任务不存在' });

  const logs = await db.query(
    'SELECT id, room_id, message, success, code, result, created_at FROM bili_danmu_logs WHERE task_id = ? ORDER BY id DESC LIMIT 100',
    [task.id]
  );

  res.json({
    ok: true,
    task: {
      id: task.id,
      room_id: task.room_id,
      schedule_type: task.schedule_type,
      interval_seconds: task.interval_seconds,
      interval_min: task.interval_min,
      interval_max: task.interval_max,
      preset: task.preset,
      preset_label: task.preset_label,
      preset_group: task.preset_group,
      mode: task.mode,
      messages: task.messages,
      enabled: task.enabled,
      auto_switch_room: task.auto_switch_room,
      room_category: task.room_category,
      created_at: task.created_at,
      account: {
        id: task.account_id,
        nickname: task.nickname,
        bili_uid: task.bili_uid,
        active: task.active,
        expire_at: task.expire_at
      }
    },
    logs
  });
});

// ============ 每日任务（账号级养号任务）============

// 支持的任务类型与默认配置
const DAILY_TASK_DEFS = {
  daily: { label: '每日任务', defaults: { watch: true, numberOfCoins: 5, selectLike: true, supportUpIds: '' } },
  charge: { label: '充电任务', defaults: { autoChargeUpId: '5432606', num: 50 } },
  vip_privilege: { label: '大会员权益', defaults: {} },
  vip_big_point: { label: '大会员大积分', defaults: {} }
};

// 列出某账号的全部每日任务（缺省的补齐为未配置项）
router.get('/account/:id/daily-tasks', async (req, res) => {
  const acc = await getOwnedAccount(req.params.id, req.session.userId);
  if (!acc) return res.status(404).json({ ok: false, message: '账号不存在' });
  const rows = await db.query('SELECT * FROM bili_daily_tasks WHERE account_id = ? ORDER BY id ASC', [acc.id]);
  const existing = Object.fromEntries(rows.map(r => [r.task_key, r]));
  const tasks = Object.keys(DAILY_TASK_DEFS).map(key => {
    const r = existing[key];
    let config = DAILY_TASK_DEFS[key].defaults;
    if (r) {
      try { config = { ...DAILY_TASK_DEFS[key].defaults, ...JSON.parse(r.config || '{}') }; } catch (e) { /* ignore */ }
    }
    return {
      id: r ? r.id : null,
      task_key: key,
      label: DAILY_TASK_DEFS[key].label,
      enabled: r ? r.enabled : 0,
      last_run_at: r ? r.last_run_at : null,
      config
    };
  });
  res.json({ ok: true, account: { id: acc.id, nickname: acc.nickname, active: acc.active }, tasks });
});

// 保存（新建或更新）某个每日任务
router.post('/account/:id/daily-tasks', async (req, res) => {
  const acc = await getOwnedAccount(req.params.id, req.session.userId);
  if (!acc) return res.status(404).json({ ok: false, message: '账号不存在' });
  if (acc.active !== 1) return res.status(400).json({ ok: false, message: '账号未激活，请先购买时长激活后再配置任务' });

  const taskKey = String(req.body.task_key || '');
  if (!DAILY_TASK_DEFS[taskKey]) return res.status(400).json({ ok: false, message: '未知任务类型' });
  const enabled = req.body.enabled ? 1 : 0;
  const config = JSON.stringify({ ...DAILY_TASK_DEFS[taskKey].defaults, ...(req.body.config || {}) });

  const existing = await db.queryOne('SELECT id FROM bili_daily_tasks WHERE account_id = ? AND task_key = ?', [acc.id, taskKey]);
  if (existing) {
    await db.query('UPDATE bili_daily_tasks SET enabled = ?, config = ? WHERE id = ?', [enabled, config, existing.id]);
  } else {
    await db.query('INSERT INTO bili_daily_tasks (account_id, task_key, enabled, config) VALUES (?, ?, ?, ?)', [acc.id, taskKey, enabled, config]);
  }
  res.json({ ok: true });
});

// 立即执行某个每日任务
router.post('/daily-tasks/:taskId/run', async (req, res) => {
  const task = await db.queryOne(
    `SELECT t.id FROM bili_daily_tasks t JOIN bili_accounts a ON t.account_id = a.id
       WHERE t.id = ? AND a.user_id = ?`,
    [req.params.taskId, req.session.userId]
  );
  if (!task) return res.status(404).json({ ok: false, message: '任务不存在' });
  try {
    const r = await dailyScheduler.runNow(task.id);
    res.json({ ok: true, result: r.message });
  } catch (e) {
    if (e.code === 'DAILY_TASK_BUSY') {
      return res.status(409).json({ ok: false, code: e.code, message: e.message });
    }
    res.json({ ok: false, message: e.message });
  }
});

// 查看某个每日任务执行日志
router.get('/daily-tasks/:taskId/logs', async (req, res) => {
  const task = await db.queryOne(
    `SELECT t.id, t.task_key, t.enabled, t.last_run_at, t.config,
            a.id AS account_id, a.nickname, a.bili_uid
       FROM bili_daily_tasks t
       JOIN bili_accounts a ON t.account_id = a.id
      WHERE t.id = ? AND a.user_id = ?`,
    [req.params.taskId, req.session.userId]
  );
  if (!task) return res.status(404).json({ ok: false, message: '任务不存在' });

  const logs = await db.query(
    'SELECT id, task_key, success, code, result, created_at FROM bili_daily_task_logs WHERE daily_task_id = ? ORDER BY id DESC LIMIT 100',
    [task.id]
  );

  let taskConfig = DAILY_TASK_DEFS[task.task_key]?.defaults || {};
  try {
    taskConfig = { ...taskConfig, ...JSON.parse(task.config || '{}') };
  } catch (e) { /* 使用默认配置 */ }

  res.json({
    ok: true,
    task: {
      id: task.id,
      task_key: task.task_key,
      label: DAILY_TASK_DEFS[task.task_key]?.label || task.task_key,
      enabled: task.enabled,
      last_run_at: task.last_run_at,
      config: taskConfig,
      account: {
        id: task.account_id,
        nickname: task.nickname,
        bili_uid: task.bili_uid
      }
    },
    logs
  });
});

// ============ 充值 / 卡密 / 订单 ============
router.get('/recharge/channels', (req, res) => {
  const cfg = settings.getPayConfig();
  res.json({
    ok: true,
    channels: { epay: cfg.epay.enabled, alipay: cfg.alipay.enabled }
  });
});

router.post('/recharge/card', async (req, res) => {
  const code = String(req.body.code || '').trim();
  if (!code) return res.status(400).json({ ok: false, message: '请输入卡密' });

  // 每人每卡限用一次：先用唯一约束检查
  try {
    await db.query('INSERT INTO bili_card_redemptions (card_id, user_id) VALUES ((SELECT id FROM bili_cards WHERE code = ?), ?)', [
      code,
      req.session.userId
    ]);
  } catch (e) {
    if (e && e.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ ok: false, message: '您已使用过该卡密' });
    }
    if (e && e.code === 'ER_NO_REFERENCED_ROW') {
      return res.status(400).json({ ok: false, message: '卡密不存在' });
    }
    throw e;
  }

  // 原子递增使用次数，同时检查上限和获取卡密信息
  // 此操作原子完成，避免竞态
  const r = await db.query(
    `UPDATE bili_cards 
     SET used_count = used_count + 1, 
         used = IF(used_count + 1 >= max_uses, 1, 0), 
         used_by = ?, 
         used_at = NOW() 
     WHERE code = ? AND used_count < max_uses`,
    [req.session.userId, code]
  );
  
  if (r.affectedRows !== 1) {
    // 回滚兑换记录（UPDATE 失败说明上限已满）
    await db.query('DELETE FROM bili_card_redemptions WHERE card_id = (SELECT id FROM bili_cards WHERE code = ?) AND user_id = ?', [
      code,
      req.session.userId
    ]);
    return res.status(400).json({ ok: false, message: '卡密已达使用上限' });
  }

  // 查询卡密面额
  const card = await db.queryOne('SELECT amount FROM bili_cards WHERE code = ?', [code]);
  if (card) {
    await balanceService.changeBalance(req.session.userId, card.amount, 'card', `卡密充值 ${code}`);
    res.json({ ok: true, amount: card.amount });
  } else {
    res.status(500).json({ ok: false, message: '卡密处理失败' });
  }
});

router.post('/recharge/online', async (req, res) => {
  const amount = parseFloat(req.body.amount);
  const channel = req.body.channel;
  if (!amount || amount <= 0) return res.status(400).json({ ok: false, message: '请输入有效金额' });

  const orderNo = payment.genOrderNo();
  await db.query(
    'INSERT INTO bili_orders (order_no, user_id, amount, channel, status) VALUES (?, ?, ?, ?, "pending")',
    [orderNo, req.session.userId, amount.toFixed(2), channel]
  );
  const order = { order_no: orderNo, amount };
  try {
    if (channel === 'epay_alipay' || channel === 'epay_wxpay') {
      const { payUrl } = payment.epayCreate(order, channel === 'epay_wxpay' ? 'wxpay' : 'alipay');
      return res.json({ ok: true, type: 'redirect', payUrl, orderNo });
    }
    if (channel === 'alipay') {
      const { payUrl } = payment.alipayCreate(order);
      return res.json({ ok: true, type: 'redirect', payUrl, orderNo });
    }
    res.status(400).json({ ok: false, message: '未知支付渠道' });
  } catch (e) {
    res.status(500).json({ ok: false, message: '下单失败: ' + e.message });
  }
});

router.get('/orders', async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize || '20', 10)));
  const offset = (page - 1) * pageSize;
  const total = (await db.queryOne('SELECT COUNT(*) c FROM bili_orders WHERE user_id = ?', [req.session.userId])).c;
  const orders = await db.query(
    'SELECT id, order_no, amount, channel, status, trade_no, created_at, paid_at FROM bili_orders WHERE user_id = ? ORDER BY id DESC LIMIT ? OFFSET ?',
    [req.session.userId, pageSize, offset]
  );
  res.json({ ok: true, orders, total, page, pageSize });
});

router.get('/balance-logs', async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize || '20', 10)));
  const offset = (page - 1) * pageSize;
  const total = (await db.queryOne('SELECT COUNT(*) c FROM bili_balance_logs WHERE user_id = ?', [req.session.userId])).c;
  const logs = await db.query(
    'SELECT id, change_amount, balance_after, type, remark, created_at FROM bili_balance_logs WHERE user_id = ? ORDER BY id DESC LIMIT ? OFFSET ?',
    [req.session.userId, pageSize, offset]
  );
  res.json({ ok: true, logs, total, page, pageSize });
});

// ============ 个人资料 ============

// 修改密码
// 查询当前用户已绑定的第三方账号（不返回 access_token）
router.get('/profile/oauth', async (req, res) => {
  const bindings = await db.query(
    `SELECT provider, nickname, avatar, last_login_at, created_at
       FROM bili_oauth_identities
      WHERE user_id = ?
      ORDER BY provider ASC`,
    [req.session.userId]
  );
  res.json({ ok: true, bindings });
});
router.post('/profile/password', async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!newPassword || String(newPassword).length < 6) {
    return res.status(400).json({ ok: false, message: '新密码至少6位' });
  }
  const user = await db.queryOne('SELECT id, password FROM bili_users WHERE id = ?', [req.session.userId]);
  if (!user) return res.status(404).json({ ok: false, message: '用户不存在' });
  if (!(await bcrypt.compare(String(currentPassword || ''), user.password))) {
    return res.status(400).json({ ok: false, message: '当前密码错误' });
  }
  const hash = await bcrypt.hash(String(newPassword), 10);
  await db.query('UPDATE bili_users SET password = ? WHERE id = ?', [hash, user.id]);
  res.json({ ok: true });
});

// 修改邮箱
router.post('/profile/email', async (req, res) => {
  const { currentPassword, email, code } = req.body;
  const user = await db.queryOne('SELECT id, password FROM bili_users WHERE id = ?', [req.session.userId]);
  if (!user) return res.status(404).json({ ok: false, message: '用户不存在' });
  if (!(await bcrypt.compare(String(currentPassword || ''), user.password))) {
    return res.status(400).json({ ok: false, message: '当前密码错误' });
  }

  const newEmail = String(email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(newEmail)) {
    return res.status(400).json({ ok: false, message: '邮箱格式不正确' });
  }
  const dup = await db.queryOne('SELECT id FROM bili_users WHERE email = ? AND id <> ?', [newEmail, user.id]);
  if (dup) return res.status(400).json({ ok: false, message: '该邮箱已被使用' });

  const mail = settings.getMailConfig();
  if (mail.enabled) {
    const record = await db.queryOne(
      "SELECT id FROM bili_email_codes WHERE email = ? AND code = ? AND used = 0 AND expires_at > NOW() ORDER BY id DESC LIMIT 1",
      [newEmail, String(code || '').trim()]
    );
    if (!record) return res.status(400).json({ ok: false, message: '验证码错误或已过期' });
    await db.query('UPDATE bili_email_codes SET used = 1 WHERE id = ?', [record.id]);
  }

  await db.query('UPDATE bili_users SET email = ? WHERE id = ?', [newEmail, user.id]);
  res.json({ ok: true });
});

// 绑定/修改 QQ 号，并用 QQ 头像作为网站头像
router.post('/profile/qq', async (req, res) => {
  const qq = String(req.body.qq || '').trim();
  if (!/^[1-9]\d{4,11}$/.test(qq)) {
    return res.status(400).json({ ok: false, message: 'QQ号格式不正确' });
  }
  // QQ头像URL格式：https://q1.qlogo.cn/g?b=qq&nk=QQ号&s=100
  const avatar = `https://q1.qlogo.cn/g?b=qq&nk=${qq}&s=100`;
  await db.query('UPDATE bili_users SET qq = ?, avatar = ? WHERE id = ?', [qq, avatar, req.session.userId]);
  res.json({ ok: true, qq, avatar });
});

// ============ 在线直播间（仅显示正在直播的房间）============
const LIVE_CATEGORIES = ['danchong', 'maomao'];

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

// 用户添加直播间（加入全站公共列表，自动拉取封面等信息，无需审核）
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
    [info.room_id, category, info.title, info.cover, info.uname, info.uid, 0]
  );
  res.json({ ok: true });
});

router.get('/live-rooms', async (req, res) => {
  const rooms = await db.query(
    'SELECT room_id, category, title, cover, uname FROM bili_live_rooms WHERE enabled = 1 ORDER BY sort_order ASC, id ASC'
  );
  if (rooms.length === 0) return res.json({ ok: true, rooms: [] });

  let statusMap = {};
  try {
    statusMap = await bili.getLiveRoomsStatus(rooms.map(r => r.room_id));
  } catch (e) {
    // 查询失败时返回空列表，避免展示过期信息
    return res.json({ ok: true, rooms: [] });
  }

  const live = [];
  for (const r of rooms) {
    const s = statusMap[String(r.room_id)];
    if (!s || s.live_status !== 1) continue;
    live.push({
      room_id: r.room_id,
      category: r.category,
      title: s.title || r.title || '',
      cover: s.cover || r.cover || '',
      uname: s.uname || r.uname || ''
    });
  }
  res.json({ ok: true, rooms: live });
});

// ============ 每日抽奖 ============
// 抽奖信息：奖品展示 + 今日次数 + 价格
router.get('/lottery/info', async (req, res) => {
  const cfg = lottery.getConfig();
  const used = await lottery.todayCount(req.session.userId);
  const prizes = await db.query(
    'SELECT id, name, type, value, image FROM bili_lottery_prizes WHERE enabled = 1 ORDER BY sort_order ASC, id ASC'
  );
  const user = await db.queryOne('SELECT balance FROM bili_users WHERE id = ?', [req.session.userId]);
  res.json({
    ok: true,
    prizes,
    cost: cfg.cost,
    freePerDay: cfg.freePerDay,
    usedToday: used,
    freeLeft: Math.max(0, cfg.freePerDay - used),
    balance: Number(user.balance)
  });
});

// 执行抽奖
router.post('/lottery/draw', async (req, res) => {
  try {
    const r = await lottery.draw(req.session.userId);
    res.json({
      ok: true,
      prize: { id: r.prize.id, name: r.prize.name, type: r.prize.type, value: r.prize.value, image: r.prize.image },
      isFree: r.isFree,
      cost: r.cost,
      fulfilled: r.fulfilled
    });
  } catch (e) {
    res.status(400).json({ ok: false, message: e.message });
  }
});

// 我的中奖记录
router.get('/lottery/records', async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize || '20', 10)));
  const offset = (page - 1) * pageSize;
  const total = (await db.queryOne('SELECT COUNT(*) c FROM bili_lottery_records WHERE user_id = ?', [req.session.userId])).c;
  const records = await db.query(
    `SELECT id, prize_name, prize_type, prize_value, cost, is_free, fulfilled, created_at
     FROM bili_lottery_records WHERE user_id = ? ORDER BY id DESC LIMIT ? OFFSET ?`,
    [req.session.userId, pageSize, offset]
  );
  res.json({ ok: true, records, total, page, pageSize });
});

// ============ 图片上传（工单附件，base64）============
router.post('/upload', async (req, res) => {
  try {
    const dataUrl = req.body.data || '';
    const m = /^data:image\/(png|jpe?g|gif|webp);base64,(.+)$/.exec(dataUrl);
    if (!m) return res.status(400).json({ ok: false, message: '仅支持 png/jpg/gif/webp 图片' });
    const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
    const buf = Buffer.from(m[2], 'base64');
    if (buf.length > 3 * 1024 * 1024) return res.status(400).json({ ok: false, message: '图片不能超过 3MB' });
    
    // 尝试使用兰空图床
    const lskyConfig = settings.getLskyConfig();
    if (lskyConfig.enabled && lskyConfig.apiUrl && lskyConfig.token) {
      try {
        const filename = `${Date.now()}_${crypto.randomBytes(4).toString('hex')}.${ext}`;
        const result = await lsky.uploadImage(buf, filename);
        return res.json({ ok: true, url: result.url });
      } catch (lskyError) {
        console.error('图床上传失败，回退到本地存储:', lskyError.message);
        // 图床失败，回退到本地存储
      }
    }
    
    // 本地存储（兜底方案）
    const dir = path.join(__dirname, '..', '..', 'public', 'uploads');
    fs.mkdirSync(dir, { recursive: true });
    const name = `${Date.now()}_${crypto.randomBytes(4).toString('hex')}.${ext}`;
    fs.writeFileSync(path.join(dir, name), buf);
    res.json({ ok: true, url: `/static/uploads/${name}` });
  } catch (error) {
    console.error('图片上传失败:', error);
    res.status(500).json({ ok: false, message: error.message || '上传失败' });
  }
});

// ============ 在线工单 ============
const TICKET_CATEGORIES = ['recharge', 'account', 'feature', 'other'];

// 我的工单列表
router.get('/tickets', async (req, res) => {
  const tickets = await db.query(
    `SELECT t.*, (SELECT COUNT(*) FROM bili_ticket_messages m WHERE m.ticket_id = t.id) AS msg_count
     FROM bili_tickets t WHERE t.user_id = ? ORDER BY t.updated_at DESC`,
    [req.session.userId]
  );
  res.json({ ok: true, tickets });
});

// 工单详情（含对话）
router.get('/tickets/:id', async (req, res) => {
  const ticket = await db.queryOne('SELECT * FROM bili_tickets WHERE id = ? AND user_id = ?', [
    req.params.id, req.session.userId
  ]);
  if (!ticket) return res.status(404).json({ ok: false, message: '工单不存在' });
  const messages = await db.query(
    'SELECT * FROM bili_ticket_messages WHERE ticket_id = ? ORDER BY id ASC',
    [ticket.id]
  );
  res.json({ ok: true, ticket, messages: messages.map(m => ({ ...m, images: m.images ? JSON.parse(m.images) : [] })) });
});

// 创建工单
router.post('/tickets', async (req, res) => {
  const title = (req.body.title || '').trim();
  const content = sanitizeHtml(req.body.content);
  const category = TICKET_CATEGORIES.includes(req.body.category) ? req.body.category : 'other';
  const images = Array.isArray(req.body.images) ? req.body.images.slice(0, 6) : [];
  if (!title) return res.status(400).json({ ok: false, message: '请填写工单标题' });
  if (!htmlToText(content)) return res.status(400).json({ ok: false, message: '请填写问题描述' });
  const r = await db.query(
    'INSERT INTO bili_tickets (user_id, category, title, status, last_reply_by) VALUES (?, ?, ?, ?, ?)',
    [req.session.userId, category, title, 'open', 'user']
  );
  await db.query(
    'INSERT INTO bili_ticket_messages (ticket_id, sender, content, images) VALUES (?, ?, ?, ?)',
    [r.insertId, 'user', content, JSON.stringify(images)]
  );
  res.json({ ok: true, id: r.insertId });
});

// 用户追加回复（仅允许回复，不可更改状态）
router.post('/tickets/:id/reply', async (req, res) => {
  const ticket = await db.queryOne('SELECT * FROM bili_tickets WHERE id = ? AND user_id = ?', [
    req.params.id, req.session.userId
  ]);
  if (!ticket) return res.status(404).json({ ok: false, message: '工单不存在' });
  if (ticket.status === 'closed') return res.status(400).json({ ok: false, message: '工单已关闭' });
  const content = sanitizeHtml(req.body.content);
  const images = Array.isArray(req.body.images) ? req.body.images.slice(0, 6) : [];
  if (!htmlToText(content) && images.length === 0) return res.status(400).json({ ok: false, message: '请输入回复内容' });
  await db.query(
    'INSERT INTO bili_ticket_messages (ticket_id, sender, content, images) VALUES (?, ?, ?, ?)',
    [ticket.id, 'user', content, JSON.stringify(images)]
  );
  // 仅允许状态回退到 'open'，不可改为 'resolved'/'closed'
  await db.query('UPDATE bili_tickets SET status = ?, last_reply_by = ? WHERE id = ?', ['open', 'user', ticket.id]);
  res.json({ ok: true });
});

// 用户关闭工单（仅限工单所有者，且不可重新打开）
router.post('/tickets/:id/close', async (req, res) => {
  const ticket = await db.queryOne('SELECT id, status FROM bili_tickets WHERE id = ? AND user_id = ?', [
    req.params.id, req.session.userId
  ]);
  if (!ticket) return res.status(404).json({ ok: false, message: '工单不存在' });
  if (ticket.status === 'closed') return res.status(400).json({ ok: false, message: '工单已关闭，无法重新打开' });
  await db.query('UPDATE bili_tickets SET status = ? WHERE id = ?', ['closed', ticket.id]);
  res.json({ ok: true });
});

// ============ 友情链接（公开） ============
router.get('/friend-links', async (req, res) => {
  const links = await db.query(
    'SELECT id, name, url, description, logo FROM bili_friend_links WHERE enabled = 1 ORDER BY sort_order ASC, id DESC'
  );
  res.json({ ok: true, links });
});

module.exports = router;
