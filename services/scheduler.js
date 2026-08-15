const db = require('../db');
const bili = require('./bilibili');

// 运行中的定时器：taskId -> intervalHandle
const timers = new Map();

function log(...args) {
  console.log(`[调度器 ${new Date().toLocaleString('zh-CN', { hour12: false })}]`, ...args);
}

// 写入弹幕发送日志（失败不影响主流程）
async function writeLog(taskId, roomId, message, success, code, result) {
  try {
    await db.query(
      'INSERT INTO bili_danmu_logs (task_id, room_id, message, success, code, result) VALUES (?, ?, ?, ?, ?, ?)',
      [taskId, String(roomId), String(message || '').slice(0, 255), success ? 1 : 0, code == null ? null : code, String(result || '').slice(0, 255)]
    );
  } catch (e) {
    log('写日志失败:', e.message);
  }
}

// 解析任务里的弹幕列表（每行一条）
function parseMessages(raw) {
  return String(raw || '')
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean);
}

// 检查并切换直播间：同账号同分类统一切换到同一个在播房间
// 规范目标 = 该分类下按排序第一个正在直播的房间，保证所有任务（挂机/签到）落在同一房间
async function checkAndSwitchRoom(task) {
  if (!task.auto_switch_room || !task.room_category) return task.room_id;

  try {
    const liveRooms = await db.query(
      'SELECT room_id FROM bili_live_rooms WHERE enabled = 1 AND category = ? ORDER BY sort_order ASC, id ASC',
      [task.room_category]
    );

    if (liveRooms.length === 0) {
      log(`任务#${task.id} 未找到分类${task.room_category}的直播间`);
      return task.room_id;
    }

    // 批量查询同分类所有直播间的状态
    const roomIds = liveRooms.map(r => String(r.room_id));
    const statusMap = await bili.getLiveRoomsStatus(roomIds);

    // 规范目标：按排序取第一个正在直播的房间
    let target = null;
    for (const rid of roomIds) {
      const s = statusMap[rid];
      if (s && s.live_status === 1) { target = rid; break; }
    }

    if (!target) {
      log(`任务#${task.id} 分类${task.room_category}暂无正在直播的房间`);
      return task.room_id;
    }

    // 若当前房间与规范目标不一致，则把同账号同分类下所有自动切换任务统一切到目标房间
    if (String(task.room_id) !== target) {
      await db.query(
        'UPDATE bili_danmu_tasks SET room_id = ? WHERE account_id = ? AND room_category = ? AND auto_switch_room = 1',
        [target, task.account_id, task.room_category]
      );
      task.room_id = target;
      log(`账号#${task.account_id} 分类${task.room_category} 统一切换到房间${target}`);
    }
    return target;
  } catch (e) {
    log(`任务#${task.id} 检查直播间状态失败: ${e.message}`);
    return task.room_id;
  }
}

// 启动单个任务
function startTask(task, account) {
  if (timers.has(task.id)) return;

  const messages = parseMessages(task.messages);
  if (messages.length === 0) return;

  const csrf = account.csrf || bili.parseCsrf(account.cookie);
  let index = 0;
  const mode = task.mode === 'random' ? 'random' : 'sequential';
  const scheduleType = ['random', 'daily'].includes(task.schedule_type) ? task.schedule_type : 'fixed';
  const modeDescription = mode === 'random' ? '随机选取' : '顺序轮播';
  const scheduleDescription = scheduleType === 'daily'
    ? '每 24 小时一次'
    : scheduleType === 'random'
      ? `随机间隔 ${Math.max(5, task.interval_min || 300)}-${Math.max(Math.max(5, task.interval_min || 300), task.interval_max || task.interval_min || 300)} 秒`
      : `固定间隔 ${Math.max(5, task.interval_seconds || 60)} 秒`;

  // 计算下一次发送的延迟（毫秒）
  function nextDelay() {
    if (scheduleType === 'random') {
      const min = Math.max(5, task.interval_min || 300);
      const max = Math.max(min, task.interval_max || min);
      return (min + Math.floor(Math.random() * (max - min + 1))) * 1000;
    }
    return Math.max(5, task.interval_seconds) * 1000;
  }

  async function send(presetRoomId) {
    // 已解析房间则直接用（避免重复查询），否则检查并切换直播间
    const currentRoomId = presetRoomId != null ? presetRoomId : await checkAndSwitchRoom(task);
    
    const message =
      mode === 'random'
        ? messages[Math.floor(Math.random() * messages.length)]
        : messages[index++ % messages.length];
    try {
      const r = await bili.sendDanmu(currentRoomId, message, account.cookie, csrf);
      if (r.ok) {
        log(`任务#${task.id} 房间${currentRoomId} 发送成功: ${message}`);
        await writeLog(
          task.id,
          currentRoomId,
          message,
          true,
          r.code != null ? r.code : 0,
          `弹幕发送成功｜直播间：${currentRoomId}｜调度：${scheduleDescription}｜内容模式：${modeDescription}｜接口信息：${r.message || '发送成功'}`
        );
        return true;
      }
      log(`任务#${task.id} 房间${currentRoomId} 发送失败(${r.code}): ${r.message}`);
      await writeLog(
        task.id,
        currentRoomId,
        message,
        false,
        r.code,
        `弹幕发送失败｜直播间：${currentRoomId}｜调度：${scheduleDescription}｜内容模式：${modeDescription}｜原因：${r.message || '接口未返回失败原因'}`
      );
      return false;
    } catch (e) {
      log(`任务#${task.id} 请求异常: ${e.message}`);
      await writeLog(
        task.id,
        currentRoomId,
        message,
        false,
        null,
        `弹幕发送异常｜直播间：${currentRoomId}｜调度：${scheduleDescription}｜内容模式：${modeDescription}｜异常：${e.message}`
      );
      return false;
    }
  }

  if (scheduleType === 'daily') {
    // 每天发送一次：每分钟检查距上次成功是否已满 24 小时；
    // 若启用自动切换且当前房间与上次成功签到的房间不同，则每换一个直播间补发一次
    async function dailyCheck() {
      if (!timers.has(task.id)) return;
      try {
        const currentRoomId = await checkAndSwitchRoom(task);
        const last = await db.queryOne(
          'SELECT created_at, room_id FROM bili_danmu_logs WHERE task_id = ? AND success = 1 ORDER BY id DESC LIMIT 1',
          [task.id]
        );
        const overdue = !last || (Date.now() - new Date(last.created_at).getTime()) >= 24 * 60 * 60 * 1000;
        const roomChanged = last && String(last.room_id) !== String(currentRoomId);
        if (overdue || roomChanged) await send(currentRoomId);
      } catch (e) {
        log(`任务#${task.id} 签到检查异常: ${e.message}`);
      }
      if (timers.has(task.id)) {
        timers.set(task.id, setTimeout(dailyCheck, 60 * 1000));
      }
    }
    timers.set(task.id, setTimeout(dailyCheck, 1000));
    log(`任务#${task.id} 已启动（每日签到模式）`);
    return;
  }

  // fixed / random：发送后按延迟安排下一次
  async function tick() {
    if (!timers.has(task.id)) return;
    await send();
    if (timers.has(task.id)) {
      timers.set(task.id, setTimeout(tick, nextDelay()));
    }
  }
  timers.set(task.id, setTimeout(tick, nextDelay()));
  log(`任务#${task.id} 已启动（${scheduleType === 'random' ? '随机' : '固定'}间隔）`);
}

// 停止单个任务
function stopTask(taskId) {
  const h = timers.get(taskId);
  if (h) {
    clearTimeout(h);
    timers.delete(taskId);
    log(`任务#${taskId} 已停止`);
  }
}

// 核心同步：根据数据库状态决定哪些任务该跑
// 条件：任务 enabled + 账号 active + 账号未过期 + 用户状态正常
async function sync() {
  const now = new Date();
  const tasks = await db.query(
    `SELECT t.*, a.cookie, a.csrf, a.active, a.expire_at, u.status AS user_status
       FROM bili_danmu_tasks t
       JOIN bili_accounts a ON t.account_id = a.id
       JOIN bili_users u ON a.user_id = u.id`
  );

  const shouldRun = new Set();
  for (const t of tasks) {
    const notExpired = !t.expire_at || new Date(t.expire_at) > now;
    if (t.enabled && t.active && t.user_status === 1 && notExpired) {
      shouldRun.add(t.id);
      startTask(t, { cookie: t.cookie, csrf: t.csrf });
    }
  }

  // 停掉不该跑的
  for (const taskId of timers.keys()) {
    if (!shouldRun.has(taskId)) {
      stopTask(taskId);
    }
  }
}

// 启动调度器：立即同步一次，之后周期性同步
function start(intervalMs = 30000) {
  sync().catch(e => log('同步异常:', e.message));
  setInterval(() => sync().catch(e => log('同步异常:', e.message)), intervalMs);
  log('弹幕任务调度器已启动');
}

module.exports = { start, sync, stopTask, parseMessages };
