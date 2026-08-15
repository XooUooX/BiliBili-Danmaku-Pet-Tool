require('dotenv').config();

function bool(v) {
  return String(v).toLowerCase() === 'true';
}

module.exports = {
  port: parseInt(process.env.PORT || '3000', 10),
  sessionSecret: process.env.SESSION_SECRET || 'change_me',
  siteUrl: (process.env.SITE_URL || 'http://localhost:3000').replace(/\/$/, ''),
  schedulerEnabled: process.env.SCHEDULER_ENABLED == null ? true : bool(process.env.SCHEDULER_ENABLED),

  oauth: {
    enabled: bool(process.env.OAUTH_ENABLED),
    apiUrl: (process.env.OAUTH_API_URL || 'https://u.zevost.com').replace(/\/$/, ''),
    appId: process.env.OAUTH_APPID || '',
    appKey: process.env.OAUTH_APPKEY || '',
    providers: process.env.OAUTH_PROVIDERS || 'qq,wx,sina,baidu'
  },

  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'bilibili_danmu'
  },

  admin: {
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD || 'admin888'
  },

  epay: {
    enabled: bool(process.env.EPAY_ENABLED),
    apiUrl: (process.env.EPAY_API_URL || '').replace(/\/$/, ''),
    pid: process.env.EPAY_PID || '',
    key: process.env.EPAY_KEY || ''
  },

  alipay: {
    enabled: bool(process.env.ALIPAY_ENABLED),
    appId: process.env.ALIPAY_APP_ID || '',
    privateKey: process.env.ALIPAY_PRIVATE_KEY || '',
    publicKey: process.env.ALIPAY_PUBLIC_KEY || '',
    gateway: process.env.ALIPAY_GATEWAY || 'https://openapi.alipay.com/gateway.do'
  }
};

