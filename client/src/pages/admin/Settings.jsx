import { useEffect, useState, useMemo } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { usePageTitle } from '@/hooks/use-site-config';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { RichEditor } from '@/components/ui/rich-editor';
import { Globe, CreditCard, Wallet, Mail, Save, Check, Image, LogIn } from 'lucide-react';
import { cn } from '@/lib/utils';

// 将后端 nested 配置拍平为表单字段
function flatten(d) {
  const cfg = d.cfg || {};
  const epay = cfg.epay || {};
  const alipay = cfg.alipay || {};
  const meta = d.meta || {};
  const mail = d.mail || {};
  const emailFilter = d.emailFilter || {};
  const oauth = d.oauth || {};
  const lsky = d.lsky || {};
  const oauthProviders = Array.isArray(oauth.providers)
    ? oauth.providers.map(item => typeof item === 'string' ? item : item.type).filter(Boolean).join(',')
    : String(oauth.providers || '');

  return {
    site_url: cfg.siteUrl || '',
    site_title: meta.title || '',
    site_subtitle: meta.subtitle || '',
    site_description: meta.description || '',
    site_keywords: meta.keywords || '',
    site_announcement: meta.announcement || '',
    epay_enabled: !!epay.enabled,
    epay_api_url: epay.apiUrl || '',
    epay_pid: epay.pid || '',
    epay_key: epay.key || '',
    alipay_enabled: !!alipay.enabled,
    alipay_app_id: alipay.appId || '',
    alipay_private_key: alipay.privateKey || '',
    alipay_public_key: alipay.publicKey || '',
    alipay_gateway: alipay.gateway || '',
    mail_enabled: !!mail.enabled,
    smtp_host: mail.host || '',
    smtp_port: mail.port == null ? '' : String(mail.port),
    smtp_secure: mail.secure !== false,
    smtp_user: mail.user || '',
    smtp_pass: mail.pass || '',
    smtp_from: mail.from || '',
    email_filter_mode: emailFilter.mode || '',
    email_filter_list: emailFilter.list || '',
    oauth_enabled: !!oauth.enabled,
    oauth_api_url: oauth.apiUrl || '',
    oauth_appid: oauth.appId || '',
    oauth_appkey: oauth.appKey || '',
    oauth_providers: oauthProviders,
    lsky_enabled: !!lsky.enabled,
    lsky_api_url: lsky.apiUrl || '',
    lsky_token: lsky.token || '',
    lsky_strategy_id: lsky.strategyId == null ? '' : String(lsky.strategyId)
  };
}

const SECTIONS = {
  site: {
    id: 'site',
    label: '站点信息',
    icon: Globe,
    desc: '用于 SEO 展示；站点地址用于生成支付回调',
    toggleable: false
  },
  epay: {
    id: 'epay',
    label: '易支付',
    icon: CreditCard,
    desc: '对接第三方易支付平台',
    flag: 'epay_enabled',
    toggleable: true
  },
  alipay: {
    id: 'alipay',
    label: '支付宝',
    icon: Wallet,
    desc: '使用支付宝开放平台接口',
    flag: 'alipay_enabled',
    toggleable: true
  },
  mail: {
    id: 'mail',
    label: '邮箱验证',
    icon: Mail,
    desc: '开启后注册需邮箱验证码',
    flag: 'mail_enabled',
    toggleable: true
  },
  oauth: {
    id: 'oauth',
    label: '第三方登录',
    icon: LogIn,
    desc: '通过聚合接口接入 QQ、微信、微博、百度等账号',
    flag: 'oauth_enabled',
    toggleable: true
  },
  lsky: {
    id: 'lsky',
    label: '图床上传',
    icon: Image,
    desc: '图片上传到兰空图床，文档：https://docs.lsky.pro/',
    flag: 'lsky_enabled',
    toggleable: true
  }
};

const NAV = Object.values(SECTIONS);

// 开关
function Switch({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        checked ? 'bg-primary' : 'bg-input'
      )}
    >
      <span className={cn('inline-block h-5 w-5 transform rounded-full bg-background shadow transition-transform', checked ? 'translate-x-5' : 'translate-x-0.5')} />
    </button>
  );
}

// 字段行：标签 + 说明 + 控件
function Field({ label, hint, children, className }) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label className="text-sm font-medium leading-none">{label}</label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

// 模块标题：图标 + 标题 + 副标题 +（可选）启用开关
function SectionHead({ icon: Icon, title, desc, enabled, onToggle }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b pb-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-base font-semibold leading-tight">{title}</h2>
          {desc && <p className="mt-0.5 text-sm text-muted-foreground">{desc}</p>}
        </div>
      </div>
      {onToggle && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{enabled ? '已启用' : '未启用'}</span>
          <Switch checked={enabled} onChange={onToggle} />
        </div>
      )}
    </div>
  );
}
export default function AdminSettings() {
  usePageTitle('系统设置');
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [dirtyFields, setDirtyFields] = useState(() => new Set());
  const [active, setActive] = useState('site');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const d = await api.get('/api/admin/settings');
        setForm(flatten(d));
      } catch (e) {
        toast.error('加载配置失败：' + (e.message || '未知错误'));
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, []);

  const set = (k, v) => {
    setForm(f => ({ ...f, [k]: v }));
    setDirtyFields(fields => {
      const next = new Set(fields);
      next.add(k);
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = Object.fromEntries(
        Array.from(dirtyFields, key => [key, form[key]])
      );
      await api.post('/api/admin/settings', payload);
      toast.success('配置已保存');
      setDirtyFields(new Set());
    } catch (e) {
      toast.error('保存失败：' + (e.message || '未知错误'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center py-12"><div className="text-muted-foreground">加载中...</div></div>;
  if (!form) return <div className="text-muted-foreground">加载失败</div>;

  const currentSection = SECTIONS[active];
  const sectionEnabled = currentSection.flag ? form[currentSection.flag] : true;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader title="系统设置" count={Object.keys(form || {}).length} countLabel="项配置" />

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* 左侧导航 */}
        <aside className="lg:w-56 lg:shrink-0">
          <div className="lg:sticky lg:top-6">
            <p className="mb-4 text-sm text-muted-foreground">保存后立即生效</p>
            <nav className="flex gap-1 overflow-x-auto lg:flex-col">
            {NAV.map(n => {
              const Icon = n.icon;
              const isActive = active === n.id;
              const isEnabled = n.flag ? form[n.flag] : true;
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => setActive(n.id)}
                  className={cn(
                    'flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="flex-1 text-left">{n.label}</span>
                  {n.toggleable && isEnabled && <span className={cn('h-1.5 w-1.5 rounded-full', isActive ? 'bg-primary-foreground' : 'bg-emerald-500')} />}
                </button>
              );
            })}
            </nav>
          </div>
        </aside>

      {/* 右侧内容 */}
      <div className="min-w-0 flex-1">
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          {active === 'site' && (
            <div className="space-y-6">
              <SectionHead icon={SECTIONS.site.icon} title="站点信息 (TDK)" desc={SECTIONS.site.desc} />
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="站点标题 (Title)">
                  <Input value={form.site_title} onChange={e => set('site_title', e.target.value)} />
                </Field>
                <Field label="站点副标题 (Subtitle)" hint="显示在首页标题下方">
                  <Input value={form.site_subtitle} onChange={e => set('site_subtitle', e.target.value)} />
                </Field>
                <Field label="站点地址 (Site URL)">
                  <Input value={form.site_url} onChange={e => set('site_url', e.target.value)} />
                </Field>
                <Field label="站点描述 (Description)" className="sm:col-span-2">
                  <Textarea rows={2} value={form.site_description} onChange={e => set('site_description', e.target.value)} />
                </Field>
                <Field label="关键词 (Keywords)" hint="多个关键词用英文逗号分隔" className="sm:col-span-2">
                  <Input value={form.site_keywords} onChange={e => set('site_keywords', e.target.value)} />
                </Field>
                <Field label="站点公告" hint="支持富文本，展示在用户控制台首页；留空则不显示" className="sm:col-span-2">
                  <RichEditor height={260} value={form.site_announcement} onChange={v => set('site_announcement', v)} />
                </Field>
              </div>
            </div>
          )}

          {active === 'epay' && (
            <div className="space-y-6">
              <SectionHead icon={SECTIONS.epay.icon} title="易支付" desc={SECTIONS.epay.desc} enabled={form.epay_enabled} onToggle={v => set('epay_enabled', v)} />
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="API 地址" className="sm:col-span-2">
                  <Input value={form.epay_api_url} onChange={e => set('epay_api_url', e.target.value)} />
                </Field>
                <Field label="商户 PID">
                  <Input value={form.epay_pid} onChange={e => set('epay_pid', e.target.value)} />
                </Field>
                <Field label="商户密钥">
                  <Input value={form.epay_key} onChange={e => set('epay_key', e.target.value)} />
                </Field>
              </div>
            </div>
          )}

          {active === 'alipay' && (
            <div className="space-y-6">
              <SectionHead icon={SECTIONS.alipay.icon} title="支付宝官方" desc={SECTIONS.alipay.desc} enabled={form.alipay_enabled} onToggle={v => set('alipay_enabled', v)} />
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="App ID">
                  <Input value={form.alipay_app_id} onChange={e => set('alipay_app_id', e.target.value)} />
                </Field>
                <Field label="网关地址">
                  <Input value={form.alipay_gateway} onChange={e => set('alipay_gateway', e.target.value)} />
                </Field>
                <Field label="应用私钥" className="sm:col-span-2">
                  <Textarea rows={4} value={form.alipay_private_key} onChange={e => set('alipay_private_key', e.target.value)} />
                </Field>
                <Field label="支付宝公钥" className="sm:col-span-2">
                  <Textarea rows={4} value={form.alipay_public_key} onChange={e => set('alipay_public_key', e.target.value)} />
                </Field>
              </div>
            </div>
          )}

          {active === 'mail' && (
            <div className="space-y-6">
              <SectionHead icon={SECTIONS.mail.icon} title="邮箱验证" desc={SECTIONS.mail.desc} enabled={form.mail_enabled} onToggle={v => set('mail_enabled', v)} />
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="SMTP 服务器">
                  <Input value={form.smtp_host} onChange={e => set('smtp_host', e.target.value)} />
                </Field>
                <Field label="SMTP 端口">
                  <Input value={form.smtp_port} onChange={e => set('smtp_port', e.target.value)} />
                </Field>
                <Field label="发件邮箱账号">
                  <Input value={form.smtp_user} onChange={e => set('smtp_user', e.target.value)} />
                </Field>
                <Field label="邮箱密码 / 授权码">
                  <Input type="password" value={form.smtp_pass} onChange={e => set('smtp_pass', e.target.value)} />
                </Field>
                <Field label="发件人地址 (From)" hint="留空则使用发件邮箱账号" className="sm:col-span-2">
                  <Input value={form.smtp_from} onChange={e => set('smtp_from', e.target.value)} />
                </Field>
                <div className="flex items-center gap-3 sm:col-span-2">
                  <Switch checked={form.smtp_secure} onChange={v => set('smtp_secure', v)} />
                  <span className="text-sm font-medium">使用 SSL/TLS（端口 465 开启）</span>
                </div>
                <Field label="邮箱过滤模式" className="sm:col-span-2">
                  <Select value={form.email_filter_mode} onChange={e => set('email_filter_mode', e.target.value)}>
                    <option value="">请选择</option>
                    <option value="off">不限制</option>
                    <option value="whitelist">白名单（仅允许列表内域名）</option>
                    <option value="blacklist">黑名单（禁止列表内域名）</option>
                  </Select>
                </Field>
                <Field label="域名列表" hint="每行一个，如 qq.com" className="sm:col-span-2">
                  <Textarea rows={4} value={form.email_filter_list} onChange={e => set('email_filter_list', e.target.value)} disabled={form.email_filter_mode === 'off'} />
                </Field>
              </div>
            </div>
          )}


          {active === 'oauth' && (
            <div className="space-y-6">
              <SectionHead icon={SECTIONS.oauth.icon} title="聚合第三方登录" desc={SECTIONS.oauth.desc} enabled={form.oauth_enabled} onToggle={v => set('oauth_enabled', v)} />
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="API 地址" hint="填写聚合平台根地址或 connect.php 地址" className="sm:col-span-2">
                  <Input value={form.oauth_api_url} onChange={e => set('oauth_api_url', e.target.value)} />
                </Field>
                <Field label="App ID">
                  <Input value={form.oauth_appid} onChange={e => set('oauth_appid', e.target.value)} autoComplete="off" />
                </Field>
                <Field label="App Key">
                  <Input type="password" value={form.oauth_appkey} onChange={e => set('oauth_appkey', e.target.value)} autoComplete="new-password" />
                </Field>
                <Field label="启用的登录方式" hint="英文逗号分隔；支持 qq, wx, alipay, sina, baidu, douyin, huawei, xiaomi, google, microsoft, twitter, dingtalk, gitee, github" className="sm:col-span-2">
                  <Input value={form.oauth_providers} onChange={e => set('oauth_providers', e.target.value)} />
                </Field>
                <div className="sm:col-span-2 rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground">
                  <strong className="text-foreground">回调地址：</strong>
                  <code className="ml-1 break-all">{`${form.site_url || window.location.origin}/api/auth/oauth/callback`}</code>
                  <br />请保证站点地址可从公网访问，并在聚合平台应用中使用同一域名。
                </div>
              </div>
            </div>
          )}
          {active === 'lsky' && (
            <div className="space-y-6">
              <SectionHead icon={SECTIONS.lsky.icon} title="兰空图床 (Lsky Pro)" desc={SECTIONS.lsky.desc} enabled={form.lsky_enabled} onToggle={v => set('lsky_enabled', v)} />
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="API 地址" hint="不含结尾斜杠，如 https://img.example.com" className="sm:col-span-2">
                  <Input value={form.lsky_api_url} onChange={e => set('lsky_api_url', e.target.value)} />
                </Field>
                <Field label="API Token" hint="在兰空图床后台获取" className="sm:col-span-2">
                  <Input type="password" value={form.lsky_token} onChange={e => set('lsky_token', e.target.value)} />
                </Field>
                <Field label="存储策略 ID" hint="可选，留空使用默认策略" className="sm:col-span-2">
                  <Input value={form.lsky_strategy_id} onChange={e => set('lsky_strategy_id', e.target.value)} />
                </Field>
                <div className="sm:col-span-2 rounded-lg border border-primary/20 bg-primary/5 p-4">
                  <p className="text-sm text-muted-foreground">
                    <strong className="text-foreground">使用说明：</strong><br />
                    1. 在兰空图床后台创建 API Token<br />
                    2. 填写 API 地址（不含 /api/v1/upload）<br />
                    3. 填写 Token 令牌<br />
                    4. 存储策略 ID 可选，留空使用默认策略<br />
                    5. 支持格式：jpg/jpeg/png/gif/webp/bmp，最大 10MB
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 保存栏 */}
        <div className="sticky bottom-0 mt-4 flex items-center justify-end gap-3 rounded-xl border bg-background/80 px-4 py-3 backdrop-blur">
          <span className="mr-auto text-sm text-muted-foreground">修改后请点击保存</span>
          <Button onClick={save} disabled={saving}>
            {saving ? <Check className="h-4 w-4 animate-pulse" /> : <Save className="h-4 w-4" />}
            {saving ? '保存中...' : '保存设置'}
          </Button>
        </div>
      </div>
      </div>
    </div>
  );
}




