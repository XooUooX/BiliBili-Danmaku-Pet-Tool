import { useEffect, useState, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/use-auth';
import { useSiteConfig, usePageTitle } from '@/hooks/use-site-config';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Mail, Wallet, CalendarDays, ShieldCheck, User, KeyRound, Sparkles, Crown, MessageSquare, AlertTriangle, Link2 } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const QQ_REGEX = /^[1-9]\d{4,11}$/;
const OAUTH_PROVIDER_NAMES = {
  qq: 'QQ', wx: '微信', alipay: '支付宝', sina: '微博', baidu: '百度', douyin: '抖音',
  huawei: '华为', xiaomi: '小米', google: 'Google', microsoft: 'Microsoft', twitter: 'Twitter',
  dingtalk: '钉钉', gitee: 'Gitee', github: 'GitHub'
};

function fmtDate(s) {
  if (!s) return '-';
  return new Date(s).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function fmtDateTime(s) {
  if (!s) return '-';
  return new Date(s).toLocaleString('zh-CN', { hour12: false });
}

// 检查账户风险
function getAccountRisks(user) {
  const risks = [];
  if (!user) return risks;
  
  if (!user.email) risks.push({ level: 'warning', text: '未绑定邮箱，无法找回账号' });
  if (!user.qq) risks.push({ level: 'info', text: '未绑定QQ，无法同步头像' });
  if (user.balance < 0.01) risks.push({ level: 'warning', text: '账户余额不足，部分功能受限' });
  
  return risks;
}

// 概览卡片组件
function InfoCard({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border p-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}

// 字段行：标签 + 控件 + 说明
function Field({ label, hint, children, className }) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label className="text-sm font-medium leading-none">{label}</label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

// 模块标题：图标 + 标题 + 副标题
function SectionHead({ icon: Icon, title, desc }) {
  return (
    <div className="flex items-start gap-3 border-b pb-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <h2 className="text-base font-semibold leading-tight">{title}</h2>
        {desc && <p className="mt-0.5 text-sm text-muted-foreground">{desc}</p>}
      </div>
    </div>
  );
}

const NAV = [
  { id: 'overview', label: '个人概览', icon: User },
  { id: 'password', label: '修改密码', icon: KeyRound },
  { id: 'email', label: '修改邮箱', icon: Mail },
  { id: 'qq', label: '绑定QQ', icon: MessageSquare },
  { id: 'oauth', label: '第三方账号', icon: Link2 }
];

export default function UserProfile() {
  usePageTitle('个人资料');
  const { user, refresh } = useAuth();
  const config = useSiteConfig();
  const emailRequired = !!config?.emailRequired;

  const [active, setActive] = useState('overview');

  // 修改密码
  const [pwd, setPwd] = useState({ current: '', next: '', confirm: '' });
  const [pwdLoading, setPwdLoading] = useState(false);

  // 修改邮箱
  const [emailForm, setEmailForm] = useState({ password: '', email: '', code: '' });
  const [emailLoading, setEmailLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // 绑定/修改 QQ
  const [qq, setQq] = useState('');
  const [qqLoading, setQqLoading] = useState(false);

  // 第三方账号绑定
  const [oauthBindings, setOauthBindings] = useState([]);
  const [oauthLoading, setOauthLoading] = useState(true);
  const [oauthStarting, setOauthStarting] = useState('');

  useEffect(() => {
    if (user?.qq) setQq(String(user.qq));
  }, [user?.qq]);

  const loadOauthBindings = useCallback(async () => {
    setOauthLoading(true);
    try {
      const data = await api.get('/api/user/profile/oauth');
      setOauthBindings(Array.isArray(data.bindings) ? data.bindings : []);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setOauthLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOauthBindings();
  }, [loadOauthBindings]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const success = params.get('oauth_bind') === 'success';
    const error = params.get('oauth_bind_error');
    if (!success && !error) return;

    setActive('oauth');
    if (success) {
      const provider = params.get('provider') || '';
      toast.success(`${OAUTH_PROVIDER_NAMES[provider] || provider || '第三方账号'}绑定成功`);
      loadOauthBindings();
      refresh();
    } else {
      toast.error(error);
    }

    params.delete('oauth_bind');
    params.delete('oauth_bind_error');
    params.delete('provider');
    const query = params.toString();
    window.history.replaceState({}, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`);
  }, [loadOauthBindings, refresh]);

  const oauthProviders = useMemo(() => {
    const configured = Array.isArray(config?.oauth?.providers) ? config.oauth.providers : [];
    const result = configured.map(provider => ({ ...provider, configured: true }));
    const known = new Set(result.map(provider => provider.type));
    for (const binding of oauthBindings) {
      if (!known.has(binding.provider)) {
        result.push({
          type: binding.provider,
          name: OAUTH_PROVIDER_NAMES[binding.provider] || binding.provider,
          configured: false
        });
      }
    }
    return result;
  }, [config?.oauth?.providers, oauthBindings]);

  const startOauthBind = useCallback(type => {
    setOauthStarting(type);
    window.location.assign(`/api/auth/oauth/start/${encodeURIComponent(type)}?mode=bind`);
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const changePassword = useCallback(async e => {
    e.preventDefault();
    if (pwd.next.length < 6) return toast.error('新密码至少6位');
    if (pwd.next !== pwd.confirm) return toast.error('两次输入的新密码不一致');
    setPwdLoading(true);
    try {
      await api.post('/api/user/profile/password', {
        currentPassword: pwd.current,
        newPassword: pwd.next
      });
      toast.success('密码修改成功');
      setPwd({ current: '', next: '', confirm: '' });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setPwdLoading(false);
    }
  }, [pwd]);

  const sendCode = useCallback(async () => {
    const email = emailForm.email.trim();
    if (!EMAIL_REGEX.test(email)) return toast.error('请输入正确的邮箱');
    setSending(true);
    try {
      await api.post('/api/auth/send-code', { email });
      toast.success('验证码已发送，请查收邮件');
      setCooldown(60);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSending(false);
    }
  }, [emailForm.email]);

  const changeEmail = useCallback(async e => {
    e.preventDefault();
    const email = emailForm.email.trim();
    if (!EMAIL_REGEX.test(email)) return toast.error('请输入正确的邮箱');
    if (emailRequired && !emailForm.code.trim()) return toast.error('请填写验证码');
    setEmailLoading(true);
    try {
      await api.post('/api/user/profile/email', {
        currentPassword: emailForm.password,
        email,
        code: emailForm.code.trim()
      });
      toast.success('邮箱修改成功');
      setEmailForm({ password: '', email: '', code: '' });
      await refresh();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setEmailLoading(false);
    }
  }, [emailForm, emailRequired, refresh]);

  const changeQq = useCallback(async e => {
    e.preventDefault();
    const val = qq.trim();
    if (!QQ_REGEX.test(val)) return toast.error('请输入正确的QQ号');
    setQqLoading(true);
    try {
      await api.post('/api/user/profile/qq', { qq: val });
      toast.success('QQ绑定成功，已同步头像');
      await refresh();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setQqLoading(false);
    }
  }, [qq, refresh]);

  const initial = (user?.username || '?').charAt(0).toUpperCase();

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader title="个人资料" subtitle="管理你的账户信息" />

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* 左侧导航 */}
        <aside className="lg:w-56 lg:shrink-0">
          <div className="lg:sticky lg:top-6">
            <nav className="flex gap-1 overflow-x-auto lg:flex-col">
            {NAV.map(n => {
              const Icon = n.icon;
              const on = active === n.id;
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => setActive(n.id)}
                  className={cn(
                    'flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    on ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="flex-1 text-left">{n.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* 右侧内容 */}
      <div className="min-w-0 flex-1">
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          {active === 'overview' && (
            <div className="space-y-6">
              <SectionHead icon={User} title="个人概览" desc="你的账户基本信息" />
              
              {/* 账户风险提醒 */}
              {user && getAccountRisks(user).length > 0 && (
                <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900/30 dark:bg-amber-950/20">
                  {getAccountRisks(user).map((risk, idx) => (
                    <div key={idx} className="flex items-start gap-2.5 text-sm">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-500" />
                      <span className="text-amber-900 dark:text-amber-100">{risk.text}</span>
                    </div>
                  ))}
                </div>
              )}
              
              <div className="flex items-center gap-4">
                {user?.avatar ? (
                  <img src={user.avatar} alt="头像" className="h-16 w-16 rounded-full border object-cover" />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-2xl font-semibold text-primary">
                    {initial}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-lg font-semibold">{user?.username || '-'}</span>
                    {user?.is_admin ? (
                      <Badge className="gap-1"><Crown className="h-3 w-3" />管理员</Badge>
                    ) : (
                      <Badge variant="secondary" className="gap-1"><Sparkles className="h-3 w-3" />普通用户</Badge>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {user?.status === 1 ? '账户状态正常' : '账户已停用'}
                  </p>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <InfoCard icon={Wallet} label="账户余额" value={`¥ ${Number(user?.balance || 0).toFixed(2)}`} />
                <InfoCard icon={Mail} label="绑定邮箱" value={user?.email || '未绑定'} />
                <InfoCard icon={MessageSquare} label="QQ 账号" value={user?.qq || '未绑定'} />
                <InfoCard icon={CalendarDays} label="注册时间" value={fmtDate(user?.created_at)} />
              </div>
            </div>
          )}

          {active === 'password' && (
            <form onSubmit={changePassword} className="space-y-6">
              <SectionHead icon={KeyRound} title="修改密码" desc="定期更换密码以保护账户安全" />
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="当前密码" className="sm:col-span-2">
                  <Input type="password" value={pwd.current} onChange={e => setPwd(p => ({ ...p, current: e.target.value }))} placeholder="请输入当前密码" />
                </Field>
                <Field label="新密码" hint="至少 6 位">
                  <Input type="password" value={pwd.next} onChange={e => setPwd(p => ({ ...p, next: e.target.value }))} placeholder="请输入新密码" />
                </Field>
                <Field label="确认新密码">
                  <Input type="password" value={pwd.confirm} onChange={e => setPwd(p => ({ ...p, confirm: e.target.value }))} placeholder="请再次输入新密码" />
                </Field>
              </div>
              <div className="flex justify-end border-t pt-4">
                <Button type="submit" disabled={pwdLoading}>{pwdLoading ? '提交中...' : '保存密码'}</Button>
              </div>
            </form>
          )}

          {active === 'email' && (
            <form onSubmit={changeEmail} className="space-y-6">
              <SectionHead icon={Mail} title="修改邮箱" desc={emailRequired ? '需要验证码确认' : '更换账户绑定邮箱'} />
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="当前密码" className="sm:col-span-2">
                  <Input type="password" value={emailForm.password} onChange={e => setEmailForm(f => ({ ...f, password: e.target.value }))} placeholder="请输入当前密码" />
                </Field>
                <Field label="新邮箱" className={emailRequired ? undefined : 'sm:col-span-2'}>
                  <Input type="email" value={emailForm.email} onChange={e => setEmailForm(f => ({ ...f, email: e.target.value }))} placeholder="new@example.com" />
                </Field>
                {emailRequired && (
                  <Field label="验证码">
                    <div className="flex gap-2">
                      <Input value={emailForm.code} onChange={e => setEmailForm(f => ({ ...f, code: e.target.value }))} placeholder="6 位验证码" />
                      <Button type="button" variant="outline" className="shrink-0" onClick={sendCode} disabled={sending || cooldown > 0}>
                        {cooldown > 0 ? `${cooldown}s` : sending ? '发送中' : '获取验证码'}
                      </Button>
                    </div>
                  </Field>
                )}
              </div>
              <div className="flex justify-end border-t pt-4">
                <Button type="submit" disabled={emailLoading}>{emailLoading ? '提交中...' : '保存邮箱'}</Button>
              </div>
            </form>
          )}

          {active === 'qq' && (
            <form onSubmit={changeQq} className="space-y-6">
              <SectionHead icon={MessageSquare} title="绑定 QQ" desc="绑定后将使用 QQ 头像作为网站头像" />
              <div className="flex items-center gap-4">
                <img
                  src={QQ_REGEX.test(qq.trim()) ? `https://q1.qlogo.cn/g?b=qq&nk=${qq.trim()}&s=100` : (user?.avatar || '')}
                  alt="QQ头像预览"
                  className="h-16 w-16 rounded-full border object-cover"
                  style={{ display: (QQ_REGEX.test(qq.trim()) || user?.avatar) ? 'block' : 'none' }}
                />
                <p className="text-sm text-muted-foreground">输入正确的 QQ 号后自动预览头像</p>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="QQ 号" hint="5-12 位数字" className="sm:col-span-2">
                  <Input value={qq} onChange={e => setQq(e.target.value)} placeholder="请输入 QQ 号" />
                </Field>
              </div>
              <div className="flex justify-end border-t pt-4">
                <Button type="submit" disabled={qqLoading}>{qqLoading ? '提交中...' : '绑定并同步头像'}</Button>
              </div>
            </form>
          )}

          {active === 'oauth' && (
            <div className="space-y-6">
              <SectionHead icon={Link2} title="第三方账号" desc="绑定后可直接使用第三方平台账号登录当前站内账号" />

              {config && !config.oauth?.enabled && (
                <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 text-sm text-amber-900 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-100">
                  管理员尚未启用第三方登录，现有绑定仍可查看，但暂时不能新增绑定。
                </div>
              )}

              {oauthLoading ? (
                <div className="py-10 text-center text-sm text-muted-foreground">正在加载绑定信息...</div>
              ) : oauthProviders.length === 0 ? (
                <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                  暂无可绑定的第三方平台，请联系管理员在系统设置中启用。
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {oauthProviders.map(provider => {
                    const binding = oauthBindings.find(item => item.provider === provider.type);
                    const enabled = !!config?.oauth?.enabled && provider.configured;
                    return (
                      <div key={provider.type} className="flex items-center gap-4 rounded-lg border p-4">
                        {binding?.avatar ? (
                          <img src={binding.avatar} alt={`${provider.name}头像`} className="h-12 w-12 shrink-0 rounded-full border object-cover" />
                        ) : (
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <Link2 className="h-5 w-5" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium">{provider.name}</p>
                            {binding && <Badge variant="secondary">已绑定</Badge>}
                            {!provider.configured && <Badge variant="outline">平台已停用</Badge>}
                          </div>
                          <p className="mt-1 truncate text-sm text-muted-foreground">
                            {binding?.nickname || (binding ? '已授权账号' : '尚未绑定')}
                          </p>
                          {binding && (
                            <p className="mt-1 text-xs text-muted-foreground">最近授权：{fmtDateTime(binding.last_login_at || binding.created_at)}</p>
                          )}
                        </div>
                        {!binding && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={!enabled || !!oauthStarting}
                            onClick={() => startOauthBind(provider.type)}
                          >
                            {oauthStarting === provider.type ? '跳转中...' : '绑定'}
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <p className="border-t pt-4 text-xs text-muted-foreground">
                为避免仅使用第三方登录注册的账号在解绑后无法再次登录，当前暂不提供解绑功能。
              </p>
            </div>
          )}        </div>
      </div>
    </div>
  </div>
);
}
