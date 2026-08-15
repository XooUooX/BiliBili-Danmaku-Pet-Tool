const crypto = require('crypto');
const axios = require('axios');
const settings = require('./settings');

// 生成订单号
function genOrderNo() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  const ts =
    d.getFullYear() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds());
  const rand = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
  return `${ts}${rand}`;
}

// ============ 易支付 ============
// 易支付签名：参数按字典序拼接 + KEY 做 md5
function epaySign(params, key) {
  const list = Object.keys(params)
    .filter(k => k !== 'sign' && k !== 'sign_type' && params[k] !== '' && params[k] != null)
    .sort();
  const str = list.map(k => `${k}=${params[k]}`).join('&') + key;
  return crypto.createHash('md5').update(str, 'utf8').digest('hex');
}

// 易支付下单：返回跳转支付的 URL（页面跳转方式）
function epayCreate(order, payType = 'alipay') {
  const cfg = settings.getPayConfig();
  const params = {
    pid: cfg.epay.pid,
    type: payType, // alipay / wxpay
    out_trade_no: order.order_no,
    notify_url: `${cfg.siteUrl}/pay/notify/epay`,
    return_url: `${cfg.siteUrl}/user/orders`,
    name: `账户充值-${order.order_no}`,
    money: Number(order.amount).toFixed(2)
  };
  params.sign = epaySign(params, cfg.epay.key);
  params.sign_type = 'MD5';
  const qs = new URLSearchParams(params).toString();
  return { payUrl: `${cfg.epay.apiUrl}/submit.php?${qs}` };
}

// 校验易支付异步回调
function epayVerify(params) {
  const cfg = settings.getPayConfig();
  const sign = params.sign;
  return sign && sign === epaySign(params, cfg.epay.key);
}

// ============ 支付宝官方（手机/电脑网站支付 RSA2） ============
function formatKey(key, type) {
  // 支持已带 PEM 头或纯 base64 两种形式
  if (key.includes('BEGIN')) return key;
  const head = type === 'private' ? 'PRIVATE KEY' : 'PUBLIC KEY';
  const body = key.replace(/\s+/g, '').match(/.{1,64}/g).join('\n');
  return `-----BEGIN ${head}-----\n${body}\n-----END ${head}-----`;
}

function alipaySign(params, privateKey) {
  const keys = Object.keys(params)
    .filter(k => k !== 'sign' && params[k] !== '' && params[k] != null)
    .sort();
  const str = keys.map(k => `${k}=${params[k]}`).join('&');
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(str, 'utf8');
  return signer.sign(formatKey(privateKey, 'private'), 'base64');
}

// 支付宝下单：返回跳转网关的支付 URL
function alipayCreate(order) {
  const cfg = settings.getPayConfig();
  const bizContent = {
    out_trade_no: order.order_no,
    total_amount: Number(order.amount).toFixed(2),
    subject: `账户充值-${order.order_no}`,
    product_code: 'FAST_INSTANT_TRADE_PAY'
  };
  const params = {
    app_id: cfg.alipay.appId,
    method: 'alipay.trade.page.pay',
    format: 'JSON',
    charset: 'utf-8',
    sign_type: 'RSA2',
    timestamp: new Date().toLocaleString('zh-CN', { hour12: false }).replace(/\//g, '-'),
    version: '1.0',
    notify_url: `${cfg.siteUrl}/pay/notify/alipay`,
    return_url: `${cfg.siteUrl}/user/orders`,
    biz_content: JSON.stringify(bizContent)
  };
  params.sign = alipaySign(params, cfg.alipay.privateKey);
  const qs = new URLSearchParams(params).toString();
  return { payUrl: `${cfg.alipay.gateway}?${qs}` };
}

// 校验支付宝异步回调签名
function alipayVerify(params) {
  const cfg = settings.getPayConfig();
  const sign = params.sign;
  const keys = Object.keys(params)
    .filter(k => k !== 'sign' && k !== 'sign_type' && params[k] !== '' && params[k] != null)
    .sort();
  const str = keys.map(k => `${k}=${params[k]}`).join('&');
  try {
    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(str, 'utf8');
    return verifier.verify(formatKey(cfg.alipay.publicKey, 'public'), sign, 'base64');
  } catch (e) {
    return false;
  }
}

module.exports = {
  genOrderNo,
  epayCreate,
  epayVerify,
  alipayCreate,
  alipayVerify
};
