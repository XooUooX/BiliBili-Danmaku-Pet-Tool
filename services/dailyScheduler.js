const db = require('../db');
const bili = require('./bilibili');

// 支持的日常任务类型
const TASK_KEYS = ['daily', 'charge', 'vip_privilege', 'vip_big_point'];

// 任务间接口调用的间隔（毫秒），降低风控风险
const API_INTERVAL = 6000;

// 投币之间的间隔（毫秒）。投币是高风控敏感操作，间隔更大以降低 -403 概率
const COIN_INTERVAL = 25000;

// 使用 MySQL 命名锁保证同一个任务在多请求、多调度器甚至多进程下都不会并发执行。
// 锁绑定到独占连接；进程异常退出或连接断开时，MySQL 会自动释放锁。
const TASK_LOCK_PREFIX = 'bili_daily_task:';

function log(...args) {
  console.log(`[日常任务 ${new Date().toLocaleString('zh-CN', { hour12: false })}]`, ...args);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

function parseConfig(raw) {
  try {
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

// 写执行日志
async function writeLog(dailyTaskId, taskKey, success, code, result) {
  try {
    await db.query(
      'INSERT INTO bili_daily_task_logs (daily_task_id, task_key, success, code, result) VALUES (?, ?, ?, ?, ?)',
      [dailyTaskId, taskKey, success ? 1 : 0, code == null ? null : code, String(result || '').slice(0, 255)]
    );
  } catch (e) {
    log('写日志失败:', e.message);
  }
}

async function withTaskLock(taskId, action) {
  const connection = await db.getPool().getConnection();
  const lockName = `${TASK_LOCK_PREFIX}${taskId}`;
  let acquired = false;

  try {
    const [rows] = await connection.query('SELECT GET_LOCK(?, 0) AS acquired', [lockName]);
    const lockResult = rows && rows[0] ? rows[0].acquired : null;

    if (lockResult == null) {
      throw new Error(`无法获取任务#${taskId}的执行锁`);
    }
    if (Number(lockResult) !== 1) {
      return { acquired: false, value: null };
    }

    acquired = true;
    return { acquired: true, value: await action() };
  } finally {
    if (acquired) {
      try {
        await connection.query('SELECT RELEASE_LOCK(?)', [lockName]);
      } catch (e) {
        log(`释放任务#${taskId}执行锁失败:`, e.message);
      }
    }
    connection.release();
  }
}

function busyError(taskId) {
  const error = new Error(`任务#${taskId}正在执行，请等待本轮完成后再试`);
  error.code = 'DAILY_TASK_BUSY';
  return error;
}

// 是否已过当天/当月的执行点
function dueDaily(lastRunAt) {
  if (!lastRunAt) return true;
  const last = new Date(lastRunAt);
  const now = new Date();
  return last.toDateString() !== now.toDateString();
}

function dueMonthly(lastRunAt) {
  if (!lastRunAt) return true;
  const last = new Date(lastRunAt);
  const now = new Date();
  return last.getFullYear() !== now.getFullYear() || last.getMonth() !== now.getMonth();
}

// 从指定来源获取候选视频：优先指定 UP 主，否则取排行榜
async function collectVideos(cfg, cookie) {
  const upIds = String(cfg.supportUpIds || '')
    .split(/[,，]/)
    .map(s => s.trim())
    .filter(Boolean);
  let videos = [];
  if (upIds.length) {
    for (const mid of upIds) {
      try {
        const vs = await bili.getUpVideos(mid, cookie);
        videos = videos.concat(vs);
      } catch (e) {
        log(`取 UP#${mid} 投稿失败: ${e.message}`);
      }
      await sleep(API_INTERVAL);
    }
  }
  if (videos.length === 0) {
    try {
      videos = await bili.getRankingVideos(cookie);
    } catch (e) {
      log(`取排行榜失败: ${e.message}`);
    }
  }
  return videos.filter(v => v && v.aid);
}

// ===== 每日任务：观看、分享、投币（可配点赞）=====
async function runDaily(taskRow, account, cfg) {
  const { cookie, csrf } = account;
  const results = [];
  let hasFailure = false;
  let coinDone = 0;
  let likeCount = 0;

  const upIds = String(cfg.supportUpIds || '')
    .split(/[,，]/)
    .map(s => s.trim())
    .filter(Boolean);
  const source = upIds.length ? `指定 UP 主（${upIds.join('、')}）` : 'B站排行榜';
  const videos = await collectVideos(cfg, cookie);

  if (videos.length === 0) {
    await writeLog(taskRow.id, 'daily', false, null, `获取视频失败｜来源：${source}｜未找到可操作的视频`);
    return { ok: false, message: '未获取到视频' };
  }

  await writeLog(taskRow.id, 'daily', true, null,
    `候选视频获取成功｜来源：${source}｜数量：${videos.length} 个`);

  // 观看
  if (cfg.watch !== false) {
    const v = videos[0];
    const video = `${v.title || '未命名视频'}${v.bvid ? `（${v.bvid}）` : ''}`;
    const r = await bili.watchVideo(v.aid, cookie, csrf, 30, v.bvid);
    await writeLog(taskRow.id, 'daily', r.ok, r.code, r.ok
      ? `观看成功｜视频：${video}｜时长：30 秒`
      : `观看失败｜视频：${video}｜原因：${r.message}`);
    results.push(`观看${r.ok ? '成功' : '失败'}`);
    if (!r.ok) hasFailure = true;
    await sleep(API_INTERVAL);
  } else {
    await writeLog(taskRow.id, 'daily', true, null, '观看已跳过｜配置中已关闭观看视频');
  }

  // 投币（按今日已投经验补足；每枚币 10 经验，每日上限 50）
  const coins = Math.max(0, Math.min(5, parseInt(cfg.numberOfCoins != null ? cfg.numberOfCoins : 5, 10) || 0));
  const selectLike = cfg.selectLike !== false;

  if (coins > 0) {
    let needCoin = coins;
    let expDone = null;
    try {
      expDone = await bili.getCoinExpToday(cookie);
      needCoin = Math.max(0, coins - Math.floor(expDone / 10));
      await writeLog(taskRow.id, 'daily', true, null,
        `投币经验检查完成｜今日经验：${expDone}｜目标：${coins * 10}｜还需投币：${needCoin} 枚`);
    } catch (e) {
      await writeLog(taskRow.id, 'daily', false, null,
        `投币经验查询失败｜将按配置目标 ${coins} 枚继续执行｜原因：${e.message}`);
    }

    for (const v of videos) {
      if (coinDone >= needCoin) break;
      const video = `${v.title || '未命名视频'}${v.bvid ? `（${v.bvid}）` : ''}`;
      const r = await bili.addCoin(v.aid, cookie, csrf, 1, selectLike, v.bvid);
      await writeLog(taskRow.id, 'daily', r.ok, r.code, r.ok
        ? `投币成功｜视频：${video}｜数量：1 枚｜同时点赞：${selectLike ? '是' : '否'}`
        : `投币失败｜视频：${video}｜数量：1 枚｜原因：${r.message}`);
      if (r.ok) {
        coinDone++;
        if (selectLike) likeCount++;
      } else {
        hasFailure = true;
      }
      results.push(`投币${r.ok ? '成功' : '失败'}`);
      await sleep(COIN_INTERVAL);
    }

    if (needCoin === 0) {
      await writeLog(taskRow.id, 'daily', true, null,
        `投币已完成｜今日经验已经满足 ${coins} 枚目标，无需继续投币`);
    } else if (coinDone < needCoin) {
      hasFailure = true;
      await writeLog(taskRow.id, 'daily', false, null,
        `投币未完全完成｜需要：${needCoin} 枚｜成功：${coinDone} 枚｜请查看前序失败记录`);
    }

    // 如果今天已投满币但仍需点赞，则单独执行点赞
    if (selectLike && needCoin === 0) {
      for (let i = 0; i < Math.min(coins, videos.length); i++) {
        const v = videos[i];
        const video = `${v.title || '未命名视频'}${v.bvid ? `（${v.bvid}）` : ''}`;
        const r = await bili.likeVideo(v.aid, cookie, csrf, v.bvid);
        await writeLog(taskRow.id, 'daily', r.ok, r.code, r.ok
          ? `点赞成功｜视频：${video}｜原因：今日投币经验已满足目标`
          : `点赞失败｜视频：${video}｜原因：${r.message}`);
        if (r.ok) likeCount++;
        else hasFailure = true;
        results.push(`点赞${r.ok ? '成功' : '失败'}`);
        await sleep(API_INTERVAL);
      }
    }
  } else {
    await writeLog(taskRow.id, 'daily', true, null, '投币已跳过｜配置中的每日投币目标为 0 枚');
  }

  const summary = `任务汇总｜观看：${cfg.watch !== false ? '已执行' : '已跳过'}｜投币成功：${coinDone} 枚｜点赞成功：${likeCount} 次｜状态：${hasFailure ? '部分操作失败' : '完成'}`;
  await writeLog(taskRow.id, 'daily', !hasFailure, null, summary);
  return { ok: !hasFailure, message: results.join('，') || '已按当前配置完成检查' };
}

// ===== 充电任务：每月给指定 UP 主充电 =====
async function runCharge(taskRow, account, cfg) {
  const { cookie, csrf, bili_uid } = account;
  // -1 或空表示给自己充电
  const selfCharge = !cfg.autoChargeUpId || String(cfg.autoChargeUpId) === '-1';
  const target = selfCharge ? String(bili_uid || '') : String(cfg.autoChargeUpId);
  if (!target) {
    await writeLog(taskRow.id, 'charge', false, null, '充电失败｜未找到有效的目标 UID');
    return { ok: false, message: '无有效充电目标' };
  }

  const num = Math.max(10, parseInt(cfg.num || '50', 10));
  const r = await bili.chargeUp(target, cookie, csrf, num);
  await writeLog(taskRow.id, 'charge', r.ok, r.code, r.ok
    ? `充电成功｜目标：${selfCharge ? '自己' : '指定 UP 主'}｜UID：${target}｜电池：${num}｜消耗：${num / 10} B币`
    : `充电失败｜目标 UID：${target}｜电池：${num}｜预计消耗：${num / 10} B币｜原因：${r.message}`);
  return { ok: r.ok, message: r.ok ? `充电成功，消耗 ${num / 10} B币` : r.message };
}

// ===== 大会员权益：每月领取 B币券与会员购优惠券 =====
async function runVipPrivilege(taskRow, account) {
  const { cookie, csrf } = account;
  const r1 = await bili.receiveVipPrivilege(1, cookie, csrf);
  await writeLog(taskRow.id, 'vip_privilege', r1.ok, r1.code, r1.ok
    ? 'B币券领取成功｜权益类型：大会员每月 B币券'
    : `B币券领取失败｜原因：${r1.message}`);

  await sleep(API_INTERVAL);

  const r2 = await bili.receiveVipPrivilege(2, cookie, csrf);
  await writeLog(taskRow.id, 'vip_privilege', r2.ok, r2.code, r2.ok
    ? '会员购优惠券领取成功｜权益类型：大会员每月会员购优惠券'
    : `会员购优惠券领取失败｜原因：${r2.message}`);

  const successCount = [r1, r2].filter(item => item.ok).length;
  await writeLog(taskRow.id, 'vip_privilege', successCount === 2, null,
    `权益领取汇总｜成功：${successCount} 项｜失败：${2 - successCount} 项｜共检查：2 项`);
  return { ok: successCount > 0, message: `权益领取完成，成功 ${successCount}/2 项` };
}

// ===== 大会员大积分：每日签到 =====
async function runVipBigPoint(taskRow, account) {
  const { cookie, csrf } = account;
  const r = await bili.vipBigPointSign(cookie, csrf);
  await writeLog(taskRow.id, 'vip_big_point', r.ok, r.code, r.ok
    ? '大会员大积分签到成功｜今日签到任务已提交'
    : `大会员大积分签到失败｜原因：${r.message}`);
  return { ok: r.ok, message: r.ok ? '大积分签到成功' : r.message };
}

// 执行单个任务（不判断到期，由调用方决定）
async function runOne(taskRow, account) {
  const cfg = parseConfig(taskRow.config);
  try {
    switch (taskRow.task_key) {
      case 'daily': return await runDaily(taskRow, account, cfg);
      case 'charge': return await runCharge(taskRow, account, cfg);
      case 'vip_privilege': return await runVipPrivilege(taskRow, account);
      case 'vip_big_point': return await runVipBigPoint(taskRow, account);
      default: return { ok: false, message: '未知任务类型' };
    }
  } finally {
    // 必须在执行锁释放前落库；即使业务调用异常，也避免调度器马上重复执行同一任务。
    try {
      await db.query('UPDATE bili_daily_tasks SET last_run_at = NOW() WHERE id = ?', [taskRow.id]);
    } catch (e) {
      log(`更新任务#${taskRow.id}执行时间失败:`, e.message);
    }
  }
}

// 读取自动调度所需的最新任务状态。获取执行锁后再次读取，避免使用等待期间已经过期的快照。
async function loadScheduledTask(taskId) {
  return db.queryOne(
    `SELECT t.*, a.cookie, a.csrf, a.bili_uid, a.active, a.expire_at, u.status AS user_status
       FROM bili_daily_tasks t
       JOIN bili_accounts a ON t.account_id = a.id
       JOIN bili_users u ON a.user_id = u.id
      WHERE t.id = ? AND t.enabled = 1`,
    [taskId]
  );
}

// 核心同步：扫描所有启用且账号有效的日常任务，到期则执行
async function sync() {
  const rows = await db.query(
    `SELECT t.id
       FROM bili_daily_tasks t
       JOIN bili_accounts a ON t.account_id = a.id
       JOIN bili_users u ON a.user_id = u.id
      WHERE t.enabled = 1
        AND a.active = 1
        AND u.status = 1
        AND (a.expire_at IS NULL OR a.expire_at > NOW())`
  );

  for (const row of rows) {
    try {
      const locked = await withTaskLock(row.id, async () => {
        const t = await loadScheduledTask(row.id);
        if (!t) return { skipped: true, reason: '任务已停用或不存在' };

        const now = new Date();
        const notExpired = !t.expire_at || new Date(t.expire_at) > now;
        if (!(t.active === 1 && t.user_status === 1 && notExpired)) {
          return { skipped: true, reason: '账号当前不可执行' };
        }

        // 获取锁后必须根据数据库中的最新 last_run_at 再判断一次，防止多实例读取到旧状态。
        const monthly = t.task_key === 'charge' || t.task_key === 'vip_privilege';
        const due = monthly ? dueMonthly(t.last_run_at) : dueDaily(t.last_run_at);
        if (!due) return { skipped: true, reason: '本周期已经执行' };

        const account = { cookie: t.cookie, csrf: t.csrf || bili.parseCsrf(t.cookie), bili_uid: t.bili_uid };
        const result = await runOne(t, account);
        return { skipped: false, task: t, result };
      });

      if (!locked.acquired) {
        log(`任务#${row.id}正在执行，跳过本轮自动调度`);
        continue;
      }
      if (locked.value.skipped) continue;

      const { task, result } = locked.value;
      log(`任务#${task.id}(${task.task_key}) 执行完成: ${result.message}`);
    } catch (e) {
      log(`任务#${row.id}执行异常: ${e.message}`);
      const failedTask = await db.queryOne('SELECT task_key FROM bili_daily_tasks WHERE id = ?', [row.id]);
      await writeLog(row.id, failedTask?.task_key || 'unknown', false, null, '执行异常: ' + e.message);
    }
    await sleep(API_INTERVAL);
  }
}

// 手动立即执行某个任务（忽略到期判断，但不允许与已有执行重叠）
async function runNow(taskId) {
  const locked = await withTaskLock(taskId, async () => {
    const t = await db.queryOne(
      `SELECT t.*, a.cookie, a.csrf, a.bili_uid FROM bili_daily_tasks t
         JOIN bili_accounts a ON t.account_id = a.id WHERE t.id = ?`,
      [taskId]
    );
    if (!t) throw new Error('任务不存在');

    const account = { cookie: t.cookie, csrf: t.csrf || bili.parseCsrf(t.cookie), bili_uid: t.bili_uid };
    return runOne(t, account);
  });

  if (!locked.acquired) throw busyError(taskId);
  return locked.value;
}

// 启动调度器：立即同步一次，之后周期性同步（默认每 10 分钟检查到期）
function start(intervalMs = 10 * 60 * 1000) {
  sync().catch(e => log('同步异常:', e.message));
  setInterval(() => sync().catch(e => log('同步异常:', e.message)), intervalMs);
  log('日常任务调度器已启动');
}

module.exports = { start, sync, runNow, TASK_KEYS };
