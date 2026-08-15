const axios = require('axios');
const settings = require('./settings');
const config = require('../config');

const SUPPORTED_PROVIDERS = Object.freeze([
  { type: 'qq', name: 'QQ' },
  { type: 'wx', name: '微信' },
  { type: 'alipay', name: '支付宝' },
  { type: 'sina', name: '微博' },
  { type: 'baidu', name: '百度' },
  { type: 'douyin', name: '抖音' },
  { type: 'huawei', name: '华为' },
  { type: 'xiaomi', name: '小米' },
  { type: 'google', name: 'Google' },
  { type: 'microsoft', name: 'Microsoft' },
  { type: 'twitter', name: 'Twitter' },
  { type: 'dingtalk', name: '钉钉' },
  { type: 'gitee', name: 'Gitee' },
  { type: 'github', name: 'GitHub' }
]);

const PROVIDER_TYPES = new Set(SUPPORTED_PROVIDERS.map(item => item.type));

function normalizeApiUrl(value) {
  const url = String(value || '').trim().replace(/\/+$/, '');
  if (!url) return 'https://u.zevost.com/connect.php';
  return /\/connect\.php$/i.test(url) ? url : `${url}/connect.php`;
}

function parseProviders(value) {
  const requested = String(value || '')
    .split(/[\s,]+/)
    .map(item => item.trim().toLowerCase())
    .filter(Boolean);
  const enabled = new Set(requested);
  return SUPPORTED_PROVIDERS.filter(item => enabled.has(item.type));
}

function getConfig() {
  return {
    enabled: settings.getBool('oauth_enabled', config.oauth.enabled),
    apiUrl: normalizeApiUrl(settings.getRaw('oauth_api_url', config.oauth.apiUrl)),
    appId: String(settings.getRaw('oauth_appid', config.oauth.appId) || '').trim(),
    appKey: String(settings.getRaw('oauth_appkey', config.oauth.appKey) || '').trim(),
    providers: parseProviders(settings.getRaw('oauth_providers', config.oauth.providers))
  };
}

function assertProvider(type, config = getConfig()) {
  const normalized = String(type || '').trim().toLowerCase();
  if (!PROVIDER_TYPES.has(normalized) || !config.providers.some(item => item.type === normalized)) {
    const err = new Error('不支持或未启用该第三方登录方式');
    err.status = 400;
    throw err;
  }
  return normalized;
}

function assertConfigured(config = getConfig()) {
  if (!config.enabled) {
    const err = new Error('第三方登录尚未启用');
    err.status = 404;
    throw err;
  }
  if (!config.appId || !config.appKey) {
    const err = new Error('第三方登录 AppID 或 AppKey 未配置');
    err.status = 503;
    throw err;
  }
}

async function request(params, config = getConfig()) {
  try {
    const response = await axios.get(config.apiUrl, {
      params,
      timeout: 10000,
      responseType: 'json',
      validateStatus: status => status >= 200 && status < 500
    });
    const data = response.data;
    if (!data || typeof data !== 'object') throw new Error('接口返回了无效数据');
    return data;
  } catch (error) {
    if (error.response?.data && typeof error.response.data === 'object') return error.response.data;
    throw new Error(`第三方登录接口请求失败：${error.message}`);
  }
}

async function createLogin(type, redirectUri, state) {
  const config = getConfig();
  assertConfigured(config);
  const provider = assertProvider(type, config);
  return request({
    act: 'login',
    appid: config.appId,
    appkey: config.appKey,
    type: provider,
    redirect_uri: redirectUri,
    state
  }, config);
}

async function exchangeCode(type, code) {
  const config = getConfig();
  assertConfigured(config);
  const provider = assertProvider(type, config);
  return request({
    act: 'callback',
    appid: config.appId,
    appkey: config.appKey,
    type: provider,
    code
  }, config);
}

module.exports = {
  SUPPORTED_PROVIDERS,
  getConfig,
  assertProvider,
  createLogin,
  exchangeCode
};


