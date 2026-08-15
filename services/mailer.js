const nodemailer = require('nodemailer');
const settings = require('./settings');

// 根据当前 SMTP 配置创建 transporter（每次读取，配置改动即生效）
function buildTransport() {
  const cfg = settings.getMailConfig();
  if (!cfg.enabled || !cfg.host || !cfg.user) return null;
  return {
    cfg,
    transporter: nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth: { user: cfg.user, pass: cfg.pass }
    })
  };
}

// 发送验证码邮件
async function sendCode(to, code) {
  const built = buildTransport();
  if (!built) throw new Error('邮件服务未配置');
  const { cfg, transporter } = built;
  const from = cfg.from || cfg.user;
  await transporter.sendMail({
    from,
    to,
    subject: '邮箱验证码',
    text: `您的验证码是 ${code}，10 分钟内有效。如非本人操作请忽略。`,
    html: `<p>您的验证码是 <b style="font-size:18px">${code}</b></p><p>10 分钟内有效。如非本人操作请忽略。</p>`
  });
}

module.exports = { sendCode };
