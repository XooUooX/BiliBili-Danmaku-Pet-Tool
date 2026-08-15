const db = require('../db');
const settings = require('./settings');
const balanceService = require('./balance');

// 抽奖配置（存 settings 表）
function getConfig() {
  return {
    cost: Number(settings.getRaw('lottery_cost', '5')) || 0,
    freePerDay: parseInt(settings.getRaw('lottery_free_per_day', '1'), 10) || 0
  };
}

// 今日已抽次数（按本地日期）
async function todayCount(userId) {
  const row = await db.queryOne(
    'SELECT COUNT(*) AS c FROM bili_lottery_records WHERE user_id = ? AND DATE(created_at) = CURDATE()',
    [userId]
  );
  return row ? Number(row.c) : 0;
}

// 加权随机选择一个奖品
function pickPrize(prizes) {
  const pool = prizes.filter(p => p.weight > 0 && p.stock !== 0);
  const total = pool.reduce((s, p) => s + p.weight, 0);
  if (total <= 0) return null;
  let r = Math.random() * total;
  for (const p of pool) {
    r -= p.weight;
    if (r < 0) return p;
  }
  return pool[pool.length - 1];
}

// 执行一次抽奖（事务内：扣费、扣库存、发奖、记录）
async function draw(userId) {
  const cfg = getConfig();
  const used = await todayCount(userId);
  const isFree = used < cfg.freePerDay;
  const cost = isFree ? 0 : cfg.cost;

  const conn = await db.getPool().getConnection();
  try {
    await conn.beginTransaction();

    // 付费抽奖先校验并扣余额
    if (!isFree) {
      const [urows] = await conn.execute('SELECT balance FROM bili_users WHERE id = ? FOR UPDATE', [userId]);
      const balance = urows[0] ? Number(urows[0].balance) : 0;
      if (cost <= 0) throw new Error('未配置付费抽奖价格，今日免费次数已用完');
      if (balance < cost) throw new Error('余额不足，免费次数已用完');
      await conn.execute('UPDATE bili_users SET balance = balance - ? WHERE id = ?', [cost, userId]);
      const [arows] = await conn.execute('SELECT balance FROM bili_users WHERE id = ?', [userId]);
      await conn.execute(
        'INSERT INTO bili_balance_logs (user_id, change_amount, balance_after, type, remark) VALUES (?, ?, ?, ?, ?)',
        [userId, -cost, arows[0].balance, 'lottery', '付费抽奖']
      );
    }

    // 读取可用奖品（锁行以安全扣库存）
    const [prizes] = await conn.execute(
      'SELECT * FROM bili_lottery_prizes WHERE enabled = 1 ORDER BY sort_order ASC, id ASC FOR UPDATE'
    );
    const prize = pickPrize(prizes);
    if (!prize) throw new Error('暂无可抽取的奖品，请稍后再试');

    // 扣库存（-1 表示无限）
    if (prize.stock > 0) {
      await conn.execute('UPDATE bili_lottery_prizes SET stock = stock - 1 WHERE id = ?', [prize.id]);
    }

    // 发奖
    let fulfilled = 1;
    if (prize.type === 'balance' && Number(prize.value) > 0) {
      await conn.execute('UPDATE bili_users SET balance = balance + ? WHERE id = ?', [prize.value, userId]);
      const [arows] = await conn.execute('SELECT balance FROM bili_users WHERE id = ?', [userId]);
      await conn.execute(
        'INSERT INTO bili_balance_logs (user_id, change_amount, balance_after, type, remark) VALUES (?, ?, ?, ?, ?)',
        [userId, prize.value, arows[0].balance, 'lottery_prize', `抽奖中奖：${prize.name}`]
      );
    } else if (prize.type === 'days' && Number(prize.value) > 0) {
      // 给最近一个账号续期，无账号则标记待发放由管理员处理
      const [accs] = await conn.execute(
        'SELECT id, expire_at FROM bili_accounts WHERE user_id = ? ORDER BY id DESC LIMIT 1',
        [userId]
      );
      if (accs.length > 0) {
        const acc = accs[0];
        const base = acc.expire_at && new Date(acc.expire_at) > new Date() ? new Date(acc.expire_at) : new Date();
        base.setDate(base.getDate() + Number(prize.value));
        await conn.execute('UPDATE bili_accounts SET active = 1, expire_at = ? WHERE id = ?', [base, acc.id]);
      } else {
        fulfilled = 0;
      }
    } else if (prize.type === 'physical') {
      // 实物/卡密：记录待发放，管理员后台核销
      fulfilled = 0;
    }

    // 写抽奖记录
    await conn.execute(
      `INSERT INTO bili_lottery_records (user_id, prize_id, prize_name, prize_type, prize_value, cost, is_free, fulfilled)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, prize.id, prize.name, prize.type, prize.value, cost, isFree ? 1 : 0, fulfilled]
    );

    await conn.commit();
    return { prize, isFree, cost, fulfilled };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

module.exports = { getConfig, todayCount, draw };
