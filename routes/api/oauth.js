const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../../db');
const settings = require('../../services/settings');
const oauth = require('../../services/oauth');

const router = express.Router();
const OAUTH_STATE_TTL = 10 * 60 * 1000;

function callbackUrl() {
  const siteUrl = String(settings.getRaw('site_url', '') || '').trim().replace(/\/$/, '');
  const fallback = require('../../config').siteUrl;
  return `${siteUrl || fallback}/api/auth/oauth/callback`;
}

function safeMessage(value, fallback = '第三方登录失败') {
  return String(value || fallback).replace(/[\r\n]+/g, ' ').slice(0, 180);
}

function redirectFailure(res, message, mode = 'login') {
  const isBind = mode === 'bind';
  const params = new URLSearchParams({
    [isBind ? 'oauth_bind_error' : 'oauth_error']: safeMessage(message)
  });
  return res.redirect(`${isBind ? '/profile' : '/login'}?${params.toString()}`);
}

function normalizeUsername(value) {
  const clean = String(value || '')
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[\\/@?#%&=+<>:\"'\x60]/g, '')
    .replace(/\s+/g, '_')
    .replace(/^[_\.\-]+|[_\.\-]+$/g, '')
    .slice(0, 48);
  return clean.length >= 3 ? clean : '用户';
}

function identityValues(profile) {
  return [
    String(profile.access_token || '').trim() || null,
    String(profile.nickname || '').trim() || null,
    String(profile.faceimg || '').trim() || null,
    String(profile.gender || '').trim() || null,
    String(profile.location || '').trim() || null,
    String(profile.ip || '').trim() || null
  ];
}

async function uniqueUsername(nickname, provider, socialUid) {
  const base = normalizeUsername(nickname);
  const suffix = crypto.createHash('sha256').update(`${provider}:${socialUid}`).digest('hex').slice(0, 8);
  const candidates = [base, `${base}_${suffix.slice(0, 4)}`, `${provider}_${suffix}`];
  for (const candidate of candidates) {
    const exists = await db.queryOne('SELECT id FROM bili_users WHERE username = ?', [candidate]);
    if (!exists) return candidate;
  }
  for (let i = 0; i < 20; i += 1) {
    const candidate = `${base.slice(0, 38)}_${crypto.randomBytes(4).toString('hex')}`;
    const exists = await db.queryOne('SELECT id FROM bili_users WHERE username = ?', [candidate]);
    if (!exists) return candidate;
  }
  throw new Error('无法生成可用用户名，请稍后重试');
}

async function loginOrCreateUser(profile) {
  const provider = String(profile.type || '').trim().toLowerCase();
  const socialUid = String(profile.social_uid || '').trim();
  if (!provider || !socialUid) throw new Error('第三方平台未返回用户唯一标识');

  let identity = await db.queryOne(
    `SELECT oi.id identity_id, oi.user_id, u.username, u.is_admin, u.status
       FROM bili_oauth_identities oi
       JOIN bili_users u ON u.id = oi.user_id
      WHERE oi.provider = ? AND oi.social_uid = ?`,
    [provider, socialUid]
  );

  if (!identity) {
    const username = await uniqueUsername(profile.nickname, provider, socialUid);
    const randomPassword = crypto.randomBytes(32).toString('hex');
    const passwordHash = await bcrypt.hash(randomPassword, 10);
    const avatar = String(profile.faceimg || '').trim() || null;
    const conn = await db.getPool().getConnection();
    try {
      await conn.beginTransaction();
      const [result] = await conn.execute(
        'INSERT INTO bili_users (username, avatar, password) VALUES (?, ?, ?)',
        [username, avatar, passwordHash]
      );
      await conn.execute(
        `INSERT INTO bili_oauth_identities
           (user_id, provider, social_uid, access_token, nickname, avatar, gender, location, login_ip, last_login_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [result.insertId, provider, socialUid, ...identityValues(profile)]
      );
      await conn.commit();
      identity = { user_id: result.insertId, username, is_admin: 0, status: 1 };
    } catch (error) {
      await conn.rollback();
      if (error.code === 'ER_DUP_ENTRY') {
        identity = await db.queryOne(
          `SELECT oi.user_id, u.username, u.is_admin, u.status
             FROM bili_oauth_identities oi
             JOIN bili_users u ON u.id = oi.user_id
            WHERE oi.provider = ? AND oi.social_uid = ?`,
          [provider, socialUid]
        );
      }
      if (!identity) throw error;
    } finally {
      conn.release();
    }
  } else {
    await db.query(
      `UPDATE bili_oauth_identities
          SET access_token = ?, nickname = ?, avatar = ?, gender = ?, location = ?, login_ip = ?, last_login_at = NOW()
        WHERE provider = ? AND social_uid = ?`,
      [...identityValues(profile), provider, socialUid]
    );
    if (profile.faceimg) {
      await db.query("UPDATE bili_users SET avatar = ? WHERE id = ? AND (avatar IS NULL OR avatar = '')", [String(profile.faceimg), identity.user_id]);
    }
  }

  if (!identity || identity.status !== 1) {
    const err = new Error('账号已被封禁');
    err.status = 403;
    throw err;
  }
  return identity;
}

async function explainDuplicateBinding(provider, socialUid, userId) {
  const identity = await db.queryOne(
    'SELECT user_id FROM bili_oauth_identities WHERE provider = ? AND social_uid = ?',
    [provider, socialUid]
  );
  if (identity && Number(identity.user_id) !== Number(userId)) {
    return '该第三方账号已被其他站内账号绑定';
  }
  const sameProvider = await db.queryOne(
    'SELECT social_uid FROM bili_oauth_identities WHERE user_id = ? AND provider = ?',
    [userId, provider]
  );
  if (sameProvider && String(sameProvider.social_uid) !== socialUid) {
    return '当前账号已绑定该平台的其他账号';
  }
  return '第三方账号绑定冲突，请刷新后重试';
}

async function bindIdentityToUser(profile, userId) {
  const provider = String(profile.type || '').trim().toLowerCase();
  const socialUid = String(profile.social_uid || '').trim();
  if (!provider || !socialUid) throw new Error('第三方平台未返回用户唯一标识');

  const conn = await db.getPool().getConnection();
  try {
    await conn.beginTransaction();

    const [users] = await conn.execute('SELECT id, status FROM bili_users WHERE id = ? FOR UPDATE', [userId]);
    const user = users[0];
    if (!user) throw new Error('当前登录账号不存在');
    if (user.status !== 1) throw new Error('账号已被封禁');

    const [identityRows] = await conn.execute(
      'SELECT id, user_id FROM bili_oauth_identities WHERE provider = ? AND social_uid = ? FOR UPDATE',
      [provider, socialUid]
    );
    const identity = identityRows[0];
    if (identity && Number(identity.user_id) !== Number(userId)) {
      throw new Error('该第三方账号已被其他站内账号绑定');
    }

    const [providerRows] = await conn.execute(
      'SELECT id, social_uid FROM bili_oauth_identities WHERE user_id = ? AND provider = ? FOR UPDATE',
      [userId, provider]
    );
    const existingProvider = providerRows[0];
    if (existingProvider && String(existingProvider.social_uid) !== socialUid) {
      throw new Error('当前账号已绑定该平台的其他账号');
    }

    if (identity) {
      await conn.execute(
        `UPDATE bili_oauth_identities
            SET access_token = ?, nickname = ?, avatar = ?, gender = ?, location = ?, login_ip = ?, last_login_at = NOW()
          WHERE id = ?`,
        [...identityValues(profile), identity.id]
      );
    } else {
      await conn.execute(
        `INSERT INTO bili_oauth_identities
           (user_id, provider, social_uid, access_token, nickname, avatar, gender, location, login_ip, last_login_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [userId, provider, socialUid, ...identityValues(profile)]
      );
    }

    if (profile.faceimg) {
      await conn.execute("UPDATE bili_users SET avatar = ? WHERE id = ? AND (avatar IS NULL OR avatar = '')", [String(profile.faceimg), userId]);
    }
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    if (error.code === 'ER_DUP_ENTRY') {
      throw new Error(await explainDuplicateBinding(provider, socialUid, userId));
    }
    throw error;
  } finally {
    conn.release();
  }
}

router.get('/start/:type', async (req, res) => {
  const mode = req.query.mode === 'bind' ? 'bind' : 'login';
  try {
    if (mode === 'bind' && !req.session.userId) {
      return redirectFailure(res, '请先登录后再绑定第三方账号', 'login');
    }

    const type = oauth.assertProvider(req.params.type);
    const state = crypto.randomBytes(24).toString('hex');
    req.session.oauthState = {
      value: state,
      type,
      createdAt: Date.now(),
      mode,
      userId: mode === 'bind' ? req.session.userId : null
    };
    const result = await oauth.createLogin(type, callbackUrl(), state);
    if (Number(result.code) !== 0 || !result.url) {
      return redirectFailure(res, result.msg || '获取第三方登录地址失败', mode);
    }
    let loginUrl;
    try {
      loginUrl = new URL(result.url);
    } catch {
      return redirectFailure(res, '第三方登录接口返回了无效跳转地址', mode);
    }
    if (!['http:', 'https:'].includes(loginUrl.protocol)) {
      return redirectFailure(res, '第三方登录接口返回了不安全的跳转地址', mode);
    }
    return res.redirect(loginUrl.toString());
  } catch (error) {
    return redirectFailure(res, error.message, mode);
  }
});

router.get('/callback', async (req, res) => {
  const pending = req.session.oauthState;
  delete req.session.oauthState;
  const mode = pending?.mode === 'bind' ? 'bind' : 'login';

  try {
    const type = String(req.query.type || pending?.type || '').trim().toLowerCase();
    const code = String(req.query.code || '').trim();
    const state = String(req.query.state || '').trim();
    if (!pending || !state || state !== pending.value || type !== pending.type) {
      return redirectFailure(res, '登录状态校验失败，请重新发起授权', mode);
    }
    if (Date.now() - Number(pending.createdAt || 0) > OAUTH_STATE_TTL) {
      return redirectFailure(res, '第三方授权请求已过期，请重试', mode);
    }
    if (!code) return redirectFailure(res, req.query.msg || '未收到第三方授权码', mode);

    if (mode === 'bind') {
      if (!req.session.userId || Number(req.session.userId) !== Number(pending.userId)) {
        return redirectFailure(res, '登录会话已变化，请重新登录后绑定', mode);
      }
    }

    const profile = await oauth.exchangeCode(type, code);
    if (Number(profile.code) !== 0) {
      return redirectFailure(res, profile.msg || '获取第三方用户信息失败', mode);
    }

    if (mode === 'bind') {
      await bindIdentityToUser({ ...profile, type }, req.session.userId);
      const params = new URLSearchParams({ oauth_bind: 'success', provider: type });
      return req.session.save(() => res.redirect(`/profile?${params.toString()}`));
    }

    const user = await loginOrCreateUser({ ...profile, type });
    req.session.userId = user.user_id;
    req.session.username = user.username;
    req.session.isAdmin = user.is_admin === 1;
    return req.session.save(() => res.redirect(user.is_admin === 1 ? '/admin' : '/dashboard'));
  } catch (error) {
    return redirectFailure(res, error.message, mode);
  }
});

module.exports = router;
