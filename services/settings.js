const db = require('../db');
const config = require('../config');

// 内存缓存：键 -> 值
let cache = null;

// 从数据库加载所有设置到缓存
async function load() {
  const rows = await db.query('SELECT skey, svalue FROM bili_settings');
  cache = {};
  for (const r of rows) {
    cache[r.skey] = r.svalue;
  }
  return cache;
}

// 确保缓存已加载
async function ensure() {
  if (!cache) await load();
  return cache;
}

function getRaw(key, fallback = '') {
  if (!cache) return fallback;
  return cache[key] != null ? cache[key] : fallback;
}

function getBool(key, fallback = false) {
  const v = getRaw(key, null);
  if (v == null) return fallback;
  return String(v).toLowerCase() === 'true' || v === '1';
}

// 批量写入设置并刷新缓存
async function setMany(pairs) {
  for (const [key, value] of Object.entries(pairs)) {
    await db.query(
      'INSERT INTO bili_settings (skey, svalue) VALUES (?, ?) ON DUPLICATE KEY UPDATE svalue = VALUES(svalue)',
      [key, value == null ? '' : String(value)]
    );
  }
  await load();
}

// 组装支付配置：数据库优先，缺省回退 .env
function getPayConfig() {
  return {
    siteUrl: getRaw('site_url', config.siteUrl) || config.siteUrl,
    epay: {
      enabled: getBool('epay_enabled', config.epay.enabled),
      apiUrl: (getRaw('epay_api_url', config.epay.apiUrl) || '').replace(/\/$/, ''),
      pid: getRaw('epay_pid', config.epay.pid),
      key: getRaw('epay_key', config.epay.key)
    },
    alipay: {
      enabled: getBool('alipay_enabled', config.alipay.enabled),
      appId: getRaw('alipay_app_id', config.alipay.appId),
      privateKey: getRaw('alipay_private_key', config.alipay.privateKey),
      publicKey: getRaw('alipay_public_key', config.alipay.publicKey),
      gateway: getRaw('alipay_gateway', config.alipay.gateway)
    }
  };
}

// 站点 TDK（标题/描述/关键词）
function getSiteMeta() {
  return {
    title: getRaw('site_title', 'BiliBili弹宠小助手'),
    subtitle: getRaw('site_subtitle', '一站式管理直播间弹幕宠物'),
    description: getRaw('site_description', '面向 BiliBili 直播间的弹幕宠物配置与管理工具'),
    keywords: getRaw('site_keywords', 'BiliBili,弹幕宠物,弹宠管理,直播间工具,直播互动'),
    announcement: getRaw('site_announcement', '')
  };
}

// 邮件（SMTP）配置
function getMailConfig() {
  return {
    enabled: getBool('mail_enabled', false),
    host: getRaw('smtp_host', ''),
    port: parseInt(getRaw('smtp_port', '465'), 10) || 465,
    secure: getBool('smtp_secure', true),
    user: getRaw('smtp_user', ''),
    pass: getRaw('smtp_pass', ''),
    from: getRaw('smtp_from', '')
  };
}

// 邮箱过滤：mode = off | blacklist | whitelist；list 为换行分隔的域名
function getEmailFilter() {
  return {
    mode: getRaw('email_filter_mode', 'off'),
    list: getRaw('email_filter_list', '')
  };
}


// 聚合第三方登录配置
function getOauthConfig() {
  const SUPPORTED_PROVIDERS = [
    { type: 'qq', name: 'QQ' }, { type: 'wx', name: '微信' }, { type: 'alipay', name: '支付宝' },
    { type: 'sina', name: '微博' }, { type: 'baidu', name: '百度' }, { type: 'douyin', name: '抖音' },
    { type: 'huawei', name: '华为' }, { type: 'xiaomi', name: '小米' }, { type: 'google', name: 'Google' },
    { type: 'microsoft', name: 'Microsoft' }, { type: 'twitter', name: 'Twitter' }, { type: 'dingtalk', name: '钉钉' },
    { type: 'gitee', name: 'Gitee' }, { type: 'github', name: 'GitHub' }
  ];
  const enabledTypes = String(getRaw('oauth_providers', config.oauth.providers) || '')
    .split(/[\s,]+/)
    .map(v => v.trim().toLowerCase())
    .filter(Boolean);
  const enabledSet = new Set(enabledTypes);
  return {
    enabled: getBool('oauth_enabled', config.oauth.enabled),
    apiUrl: (getRaw('oauth_api_url', config.oauth.apiUrl) || '').replace(/\/$/, ''),
    appId: getRaw('oauth_appid', config.oauth.appId),
    appKey: getRaw('oauth_appkey', config.oauth.appKey),
    providers: SUPPORTED_PROVIDERS.filter(item => enabledSet.has(item.type))
  };
}
// 兰空图床配置
function getLskyConfig() {
  return {
    enabled: getBool('lsky_enabled', false),
    apiUrl: (getRaw('lsky_api_url', '') || '').replace(/\/$/, ''),
    token: getRaw('lsky_token', ''),
    strategyId: getRaw('lsky_strategy_id', '') || null
  };
}

// 管理后台表单只展示数据库中已保存的值，不把运行时/.env 默认值填入输入框。
// 未保存过的字段保持为空；不会影响前台运行时继续使用原有默认配置。
function getAdminSettings() {
  const providers = String(getRaw('oauth_providers', '') || '')
    .split(/[\s,]+/)
    .map(value => value.trim().toLowerCase())
    .filter(Boolean);

  return {
    cfg: {
      siteUrl: getRaw('site_url', ''),
      epay: {
        enabled: getBool('epay_enabled', false),
        apiUrl: getRaw('epay_api_url', ''),
        pid: getRaw('epay_pid', ''),
        key: getRaw('epay_key', '')
      },
      alipay: {
        enabled: getBool('alipay_enabled', false),
        appId: getRaw('alipay_app_id', ''),
        privateKey: getRaw('alipay_private_key', ''),
        publicKey: getRaw('alipay_public_key', ''),
        gateway: getRaw('alipay_gateway', '')
      }
    },
    meta: {
      title: getRaw('site_title', ''),
      subtitle: getRaw('site_subtitle', ''),
      description: getRaw('site_description', ''),
      keywords: getRaw('site_keywords', ''),
      announcement: getRaw('site_announcement', '')
    },
    mail: {
      enabled: getBool('mail_enabled', false),
      host: getRaw('smtp_host', ''),
      port: getRaw('smtp_port', ''),
      secure: getBool('smtp_secure', false),
      user: getRaw('smtp_user', ''),
      pass: getRaw('smtp_pass', ''),
      from: getRaw('smtp_from', '')
    },
    emailFilter: {
      mode: getRaw('email_filter_mode', ''),
      list: getRaw('email_filter_list', '')
    },
    oauth: {
      enabled: getBool('oauth_enabled', false),
      apiUrl: getRaw('oauth_api_url', ''),
      appId: getRaw('oauth_appid', ''),
      appKey: getRaw('oauth_appkey', ''),
      providers
    },
    lsky: {
      enabled: getBool('lsky_enabled', false),
      apiUrl: getRaw('lsky_api_url', ''),
      token: getRaw('lsky_token', ''),
      strategyId: getRaw('lsky_strategy_id', '')
    }
  };
}
module.exports = {
  load,
  ensure,
  getRaw,
  getBool,
  setMany,
  getPayConfig,
  getSiteMeta,
  getMailConfig,
  getEmailFilter,
  getOauthConfig,
  getLskyConfig,
  getAdminSettings
};




