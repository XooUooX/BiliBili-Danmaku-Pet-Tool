const axios = require('axios');
const crypto = require('crypto');

// B站接口
const SEND_API = 'https://api.live.bilibili.com/msg/send';
const QR_GENERATE_API = 'https://passport.bilibili.com/x/passport-login/web/qrcode/generate';
const QR_POLL_API = 'https://passport.bilibili.com/x/passport-login/web/qrcode/poll';
const NAV_API = 'https://api.bilibili.com/x/web-interface/nav';
const PET_PANEL_API = 'https://api.live.bilibili.com/xlive/open-platform/v1/game/getAppCustomPanel';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36 Edg/136.0.0.0';

// 从 Cookie 中解析 bili_jct (csrf)
function parseCsrf(cookie) {
  const m = (cookie || '').match(/bili_jct=([^;]+)/);
  return m ? m[1].trim() : '';
}

// 申请登录二维码，返回 { url, qrcode_key }
async function generateQrcode() {
  const res = await axios.get(QR_GENERATE_API, {
    headers: { 'User-Agent': UA },
    timeout: 10000
  });
  if (res.data.code !== 0) {
    throw new Error(`获取二维码失败: ${res.data.message || '未知错误'}`);
  }
  return res.data.data; // { url, qrcode_key }
}

// 从 set-cookie 头拼接 Cookie 字符串
function extractCookie(setCookieArr) {
  if (!Array.isArray(setCookieArr)) return '';
  return setCookieArr
    .map(item => item.split(';')[0].trim())
    .filter(Boolean)
    .join('; ');
}

// 轮询一次扫码状态。返回 { status, cookie }
// status: 'pending' | 'scanned' | 'success' | 'expired'
async function pollQrcodeOnce(qrcodeKey) {
  const res = await axios.get(QR_POLL_API, {
    params: { qrcode_key: qrcodeKey },
    headers: { 'User-Agent': UA },
    timeout: 10000
  });
  const data = res.data.data || {};
  switch (data.code) {
    case 0:
      return { status: 'success', cookie: extractCookie(res.headers['set-cookie']) };
    case 86101:
      return { status: 'pending' };
    case 86090:
      return { status: 'scanned' };
    case 86038:
      return { status: 'expired' };
    default:
      return { status: 'pending' };
  }
}

// 用 Cookie 获取账号信息（昵称、uid），用于绑定时展示
async function getAccountInfo(cookie) {
  const res = await axios.get(NAV_API, {
    headers: { 'User-Agent': UA, Cookie: cookie },
    timeout: 10000
  });
  const d = res.data.data || {};
  if (res.data.code !== 0 || !d.isLogin) {
    return { valid: false };
  }
  return { valid: true, uid: String(d.mid || ''), nickname: d.uname || '', avatar: d.face || '' };
}

// 发送一条弹幕
async function sendDanmu(roomId, message, cookie, csrf) {
  const params = new URLSearchParams({
    color: '16777215',
    fontsize: '25',
    mode: '1',
    msg: message,
    rnd: Math.floor(Date.now() / 1000).toString(),
    roomid: String(roomId),
    csrf: csrf,
    csrf_token: csrf
  });

  const res = await axios.post(SEND_API, params.toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: cookie,
      'User-Agent': UA,
      Referer: `https://live.bilibili.com/${roomId}`
    },
    timeout: 10000
  });

  const data = res.data;
  if (data.code === 0) {
    return { ok: true, message: data.message || '' };
  }
  return { ok: false, code: data.code, message: data.message || data.msg || '未知错误' };
}

// 获取「弹幕宠物」面板信息（金币/等级/进阶）
// 流程：直播间页面提取 game_id -> 开放平台换取面板 token -> 抓取第三方面板 HTML 解析
async function getDanmuPetInfo(roomId, cookie) {
  // 1. 从直播间页面提取 game_id（需主播正在使用弹幕宠物应用）
  const liveRes = await axios.get(`https://live.bilibili.com/${roomId}`, {
    headers: { 'User-Agent': UA },
    timeout: 10000
  });
  const gameIdMatch = String(liveRes.data).match(/"game_id":"(.*?)","game_name"/);
  if (!gameIdMatch) {
    return { ok: false, message: '未找到 game_id，请确认该直播间正在开播且已开启弹幕宠物' };
  }
  const gameId = gameIdMatch[1];

  // 2. 用账号 cookie 换取面板 token
  const panelRes = await axios.get(PET_PANEL_API, {
    params: { game_id: gameId },
    headers: { 'User-Agent': UA, Cookie: cookie },
    timeout: 10000
  });
  const panel = panelRes.data || {};
  if (panel.message === '不在游戏时间内') {
    return { ok: false, message: 'game_id 已过期（不在游戏时间内）' };
  }
  const panelUrl = panel.data && panel.data.panel_url;
  if (!panelUrl) {
    return { ok: false, message: panel.message || '获取面板 token 失败，cookie 可能已失效' };
  }
  const token = new URL(panelUrl).searchParams.get('token');
  if (!token) {
    return { ok: false, message: '面板 URL 中未解析到 token' };
  }

  // 3. 请求第三方面板页面并解析字段（用 Session 自动跟随重定向，避免硬编码会话）
  const session = axios.create({
    headers: { 'User-Agent': UA },
    timeout: 10000,
    maxRedirects: 5
  });
  const petRes = await session.get('https://petpanel.heikeyun.com/Main.aspx', {
    params: { token },
    responseType: 'arraybuffer'
  });
  // 第三方面板返回 UTF-8 字节，但响应头可能误声明 charset，统一按 UTF-8 解码
  const html = Buffer.from(petRes.data).toString('utf8');

  // 按元素 id 提取「直接文本」（去掉嵌套标签）
  const pick = id => {
    const m = html.match(new RegExp(`id="${id}"[^>]*>([\\s\\S]*?)</`, 'i'));
    return m ? m[1].replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim() : '';
  };
  const num = id => {
    const v = (pick(id).match(/-?\d+/) || [''])[0];
    return v === '' ? null : parseInt(v, 10);
  };

  const coin = num('lblUserMoney');
  const level = pick('lblUserLevel');
  const levelName = pick('lblUserLevelName');
  const energyCurrent = num('lblUserEnergy2');
  const energyFull = num('lblUserEnergyDown');

  if (coin == null && !level) {
    return { ok: false, message: '面板解析失败，第三方页面结构可能已变化或会话失效' };
  }

  return {
    ok: true,
    info: {
      petName: pick('lblUserPetName'),
      coin: coin == null ? '' : String(coin),
      level,
      levelName,
      levelDown: pick('lblUserLevelDown'),
      levelDownName: pick('lblUserLevelNameDown'),
      trueEnergy: num('lblUserEnergy'),
      attack: num('lblUserAttack'),
      defense: num('lblUserDefense'),
      sect: pick('lblZmValue'),
      shield: pick('lblhdValue'),
      swimRing: pick('lblyqValue'),
      energyCurrent,
      energyFull
    }
  };
}

// ===================== 日常任务相关 API =====================

// 通用请求头（referer 可指向具体视频页，写操作风控更宽松）
function webHeaders(cookie, referer) {
  return {
    'User-Agent': UA,
    Cookie: cookie,
    Referer: referer || 'https://www.bilibili.com',
    Origin: 'https://www.bilibili.com'
  };
}

// 视频页 Referer
function videoReferer(bvid, aid) {
  if (bvid) return `https://www.bilibili.com/video/${bvid}`;
  return `https://www.bilibili.com/video/av${aid}`;
}

// ---- WBI 签名（部分接口需要，如按 UP 主搜索投稿）----
const MIXIN_KEY_ENC_TAB = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49,
  33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40,
  61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11,
  36, 20, 34, 44, 52
];

function getMixinKey(orig) {
  return MIXIN_KEY_ENC_TAB.map(n => orig[n]).join('').slice(0, 32);
}

// 从 nav 接口获取 img_key / sub_key
let wbiCache = { key: '', ts: 0 };
async function getWbiMixinKey(cookie) {
  if (wbiCache.key && Date.now() - wbiCache.ts < 30 * 60 * 1000) return wbiCache.key;
  const res = await axios.get(NAV_API, { headers: webHeaders(cookie), timeout: 10000 });
  const wbi = (res.data.data && res.data.data.wbi_img) || {};
  const imgKey = (wbi.img_url || '').split('/').pop().split('.')[0];
  const subKey = (wbi.sub_url || '').split('/').pop().split('.')[0];
  const mixin = getMixinKey(imgKey + subKey);
  wbiCache = { key: mixin, ts: Date.now() };
  return mixin;
}

// 对参数进行 WBI 签名，返回带 w_rid 和 wts 的查询串
async function encWbi(params, cookie) {
  const mixinKey = await getWbiMixinKey(cookie);
  const wts = Math.round(Date.now() / 1000);
  const query = { ...params, wts };
  const sorted = Object.keys(query).sort();
  const str = sorted
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(String(query[k]).replace(/[!'()*]/g, ''))}`)
    .join('&');
  const wRid = crypto.createHash('md5').update(str + mixinKey).digest('hex');
  return `${str}&w_rid=${wRid}`;
}

// 获取指定 UP 主最新投稿（WBI 签名），返回视频列表 [{aid, bvid, title}]
async function getUpVideos(mid, cookie, pageSize = 30) {
  const qs = await encWbi({ mid, ps: pageSize, pn: 1, order: 'pubdate', platform: 'web' }, cookie);
  const res = await axios.get(`https://api.bilibili.com/x/space/wbi/arc/search?${qs}`, {
    headers: webHeaders(cookie),
    timeout: 10000
  });
  const list = (res.data.data && res.data.data.list && res.data.data.list.vlist) || [];
  return list.map(v => ({ aid: v.aid, bvid: v.bvid, title: v.title }));
}

// 获取排行榜视频（无需指定 UP 主时的兜底来源）
async function getRankingVideos(cookie) {
  const res = await axios.get('https://api.bilibili.com/x/web-interface/ranking/v2?rid=0&type=all', {
    headers: webHeaders(cookie),
    timeout: 10000
  });
  const list = (res.data.data && res.data.data.list) || [];
  return list.map(v => ({ aid: v.aid, bvid: v.bvid, title: v.title }));
}

// 上报视频观看心跳（模拟观看）
async function watchVideo(aid, cookie, csrf, playedTime = 30, bvid) {
  const params = new URLSearchParams({
    aid: String(aid),
    played_time: String(playedTime),
    csrf
  });
  const res = await axios.post('https://api.bilibili.com/x/click-interface/web/heartbeat', params.toString(), {
    headers: { ...webHeaders(cookie, videoReferer(bvid, aid)), 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 10000
  });
  return res.data.code === 0
    ? { ok: true }
    : { ok: false, code: res.data.code, message: res.data.message };
}

// 点赞视频
async function likeVideo(aid, cookie, csrf, bvid) {
  const params = new URLSearchParams({ aid: String(aid), like: '1', csrf });
  const res = await axios.post('https://api.bilibili.com/x/web-interface/archive/like', params.toString(), {
    headers: { ...webHeaders(cookie, videoReferer(bvid, aid)), 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 10000
  });
  // code 65006 表示已点赞过，视为成功
  if (res.data.code === 0 || res.data.code === 65006) return { ok: true };
  return { ok: false, code: res.data.code, message: res.data.message };
}

// 关注指定 UP 主（fid 目标 uid，act=1 关注）
async function followUser(fid, cookie, csrf) {
  const params = new URLSearchParams({ fid: String(fid), act: '1', re_src: '11', csrf });
  const res = await axios.post('https://api.bilibili.com/x/relation/modify', params.toString(), {
    headers: { ...webHeaders(cookie, 'https://space.bilibili.com/' + fid), 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 10000
  });
  // code 22014 表示已关注，视为成功
  if (res.data.code === 0 || res.data.code === 22014) return { ok: true };
  return { ok: false, code: res.data.code, message: res.data.message };
}

// 给视频投币（multiply 投币数 1-2，selectLike 是否同时点赞）
async function addCoin(aid, cookie, csrf, multiply = 1, selectLike = true, bvid) {
  const params = new URLSearchParams({
    aid: String(aid),
    multiply: String(multiply),
    select_like: selectLike ? '1' : '0',
    csrf
  });
  const res = await axios.post('https://api.bilibili.com/x/web-interface/coin/add', params.toString(), {
    headers: { ...webHeaders(cookie, videoReferer(bvid, aid)), 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 10000
  });
  return res.data.code === 0
    ? { ok: true }
    : { ok: false, code: res.data.code, message: res.data.message };
}

// 查询今日已投币经验（每日上限 50，即 5 枚币）
async function getCoinExpToday(cookie) {
  const res = await axios.get('https://api.bilibili.com/x/web-interface/coin/today/exp', {
    headers: webHeaders(cookie),
    timeout: 10000
  });
  return res.data.code === 0 ? Number(res.data.data || 0) : 0;
}

// 查询账号硬币余额
async function getCoinBalance(cookie) {
  const res = await axios.get('https://account.bilibili.com/site/getCoin', {
    headers: webHeaders(cookie),
    timeout: 10000
  });
  return res.data.code === 0 ? Number((res.data.data && res.data.data.money) || 0) : 0;
}

// 给 UP 主充电（默认给自己充电时 upMid 传自身 uid）。num 为电池数（B币×10）
async function chargeUp(upMid, cookie, csrf, num = 50) {
  const params = new URLSearchParams({
    bp_num: String(Math.floor(num / 10)),
    is_bp_remains_prior: 'true',
    up_mid: String(upMid),
    otype: 'up',
    oid: String(upMid),
    csrf
  });
  const res = await axios.post('https://api.bilibili.com/x/ugcpay/web/v2/trade/elec/pay/quick', params.toString(), {
    headers: { ...webHeaders(cookie), 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 10000
  });
  if (res.data.code === 0) {
    return { ok: true, orderNo: res.data.data && res.data.data.order_no };
  }
  return { ok: false, code: res.data.code, message: res.data.message };
}

// 领取大会员每月权益（type=1 B币券，type=2 会员购优惠券）
async function receiveVipPrivilege(type, cookie, csrf) {
  const params = new URLSearchParams({ type: String(type), csrf });
  const res = await axios.post('https://api.bilibili.com/x/vip/privilege/receive', params.toString(), {
    headers: { ...webHeaders(cookie), 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 10000
  });
  // 73000 表示已领取过
  if (res.data.code === 0 || res.data.code === 73000) return { ok: true, code: res.data.code };
  return { ok: false, code: res.data.code, message: res.data.message };
}

// 查询大会员权益领取状态（list 中含各类型 state）
async function getVipPrivilegeState(cookie) {
  const res = await axios.get('https://api.bilibili.com/x/vip/privilege/my', {
    headers: webHeaders(cookie),
    timeout: 10000
  });
  return res.data.code === 0 ? (res.data.data || {}) : {};
}

// 批量查询直播间实时状态（开播状态/标题/封面/主播）
// 传入 room_id 数组，返回 { [room_id]: { live_status, title, cover, uname } }
async function getLiveRoomsStatus(roomIds) {
  const ids = (roomIds || []).map(String).filter(Boolean);
  if (ids.length === 0) return {};
  const query = ids.map(id => `room_ids=${encodeURIComponent(id)}`).join('&');
  const res = await axios.get(
    `https://api.live.bilibili.com/xlive/web-room/v1/index/getRoomBaseInfo?${query}&req_biz=video`,
    { headers: { 'User-Agent': UA }, timeout: 10000 }
  );
  if (res.data.code !== 0) throw new Error(res.data.message || '查询直播间状态失败');
  const out = {};
  const byRoom = (res.data.data && res.data.data.by_room_ids) || {};
  for (const key of Object.keys(byRoom)) {
    const r = byRoom[key];
    // 真实房间号与短号都映射，便于上层按存库 room_id 命中
    const entry = {
      live_status: r.live_status,
      title: r.title || '',
      cover: r.cover || '',
      uname: r.uname || ''
    };
    out[String(r.room_id)] = entry;
    if (r.short_id) out[String(r.short_id)] = entry;
  }
  return out;
}

// 获取直播间信息（封面/标题/开播状态/主播）
// 输入短号或长号均可，返回 { room_id, title, cover, uname, uid, live_status }
async function getLiveRoomInfo(roomId) {
  const infoRes = await axios.get(
    'https://api.live.bilibili.com/room/v1/Room/get_info',
    { params: { room_id: roomId }, headers: { 'User-Agent': UA }, timeout: 10000 }
  );
  if (infoRes.data.code !== 0) {
    throw new Error(infoRes.data.message || '直播间不存在');
  }
  const d = infoRes.data.data;
  const result = {
    room_id: String(d.room_id),
    uid: String(d.uid),
    title: d.title || '',
    cover: d.user_cover || d.keyframe || '',
    live_status: d.live_status,
    uname: ''
  };
  // 取主播昵称（失败不致命）
  try {
    const mRes = await axios.get(
      'https://api.live.bilibili.com/live_user/v1/Master/info',
      { params: { uid: d.uid }, headers: { 'User-Agent': UA }, timeout: 10000 }
    );
    if (mRes.data.code === 0) result.uname = (mRes.data.data.info || {}).uname || '';
  } catch (e) { /* ignore */ }
  return result;
}


// 大会员大积分每日签到（web 端）
async function vipBigPointSign(cookie, csrf) {
  const res = await axios.post(
    'https://api.bilibili.com/pgc/activity/score/task/sign',
    `csrf=${encodeURIComponent(csrf)}`,
    {
      headers: { ...webHeaders(cookie), 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 10000
    }
  );
  // 6018003 表示今日已签到
  if (res.data.code === 0 || res.data.code === 6018003) return { ok: true, code: res.data.code };
  return { ok: false, code: res.data.code, message: res.data.message };
}

// 通过第三方 API 查询 B 站账号公开信息（按 UID）
async function getBiliUserInfo(uid) {
  const res = await axios.get('https://uapis.cn/api/v1/social/bilibili/userinfo', {
    params: { uid },
    headers: { 'User-Agent': UA },
    timeout: 10000
  });
  const d = res.data || {};
  if (!d || d.mid === undefined || d.mid === null || d.code) {
    throw new Error(d.msg || d.message || '未查询到该 UID 的账号信息');
  }
  return {
    mid: String(d.mid),
    name: d.name || '',
    sex: d.sex || '保密',
    face: d.face || '',
    sign: d.sign || '',
    level: d.level ?? null,
    birthday: d.birthday || '',
    vip_type: d.vip_type ?? 0,
    vip_status: d.vip_status ?? 0,
    following: d.following ?? 0,
    follower: d.follower ?? 0,
    archive_count: d.archive_count ?? 0,
    article_count: d.article_count ?? 0
  };
}

module.exports = {
  parseCsrf,
  generateQrcode,
  pollQrcodeOnce,
  getAccountInfo,
  sendDanmu,
  getDanmuPetInfo,
  getUpVideos,
  getRankingVideos,
  watchVideo,
  likeVideo,
  followUser,
  addCoin,
  getCoinExpToday,
  getCoinBalance,
  chargeUp,
  receiveVipPrivilege,
  getVipPrivilegeState,
  vipBigPointSign,
  getLiveRoomInfo,
  getLiveRoomsStatus,
  getBiliUserInfo
};


