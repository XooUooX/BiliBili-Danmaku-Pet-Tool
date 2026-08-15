import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/use-auth';
import { useSiteConfig, usePageTitle } from '@/hooks/use-site-config';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ThemeToggle } from '@/components/theme-toggle';
import { PawPrint, Eye, EyeOff, LoaderCircle } from 'lucide-react';


const OAUTH_ICONS = {
  qq: '/oauth-icons/QQ.png',
  wx: '/oauth-icons/WeChat.png',
  alipay: '/oauth-icons/Alipay.png',
  sina: '/oauth-icons/Weibo.png',
  baidu: '/oauth-icons/Baidu.png',
  douyin: '/oauth-icons/douyin.png',
  huawei: '/oauth-icons/HuaWei.png',
  xiaomi: '/oauth-icons/Mi.png',
  google: '/oauth-icons/Google.png',
  microsoft: '/oauth-icons/Windows.png',
  dingtalk: '/oauth-icons/Dingding.png',
  gitee: '/oauth-icons/Gitee.png',
  github: '/oauth-icons/Github.png'
};

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const config = useSiteConfig();
  usePageTitle('登录');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState('');

  const doSubmit = async () => {
    setLoading(true);
    try {
      const data = await login(username.trim(), password);
      toast.success('登录成功');
      const from = location.state?.from?.pathname;
      navigate(from || (data.isAdmin ? '/admin' : '/dashboard'), { replace: true });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };
  const onSubmit = e => {
    e.preventDefault();
    doSubmit();
  };

  useEffect(() => {
    const message = new URLSearchParams(location.search).get('oauth_error');
    if (!message) return;
    toast.error(message);
    navigate('/login', { replace: true });
  }, [location.search, navigate]);

  const startOauth = type => {
    setOauthLoading(type);
    window.location.assign(`/api/auth/oauth/start/${encodeURIComponent(type)}`);
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <ThemeToggle className="fixed right-4 top-4 z-10" />
      {/* 左侧品牌区 */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-primary/25 via-background to-background p-12 text-foreground lg:flex">
        <div className="pointer-events-none absolute -left-24 top-1/3 h-72 w-72 rounded-full bg-primary/30 blur-3xl" />
        <div className="relative flex items-center gap-2 text-lg font-semibold">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <PawPrint className="h-5 w-5" />
          </span>
          {config?.title || 'BiliBili弹宠小助手'}
        </div>
        <div className="relative space-y-4">
          <h2 className="text-4xl font-bold leading-tight">一站式管理<br />直播间弹宠</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            集中管理账号、宠物等级、互动任务与运行状态，让日常维护更简单。
          </p>
        </div>
        <p className="relative text-xs text-muted-foreground">© {new Date().getFullYear()} {config?.title || 'BiliBili弹宠小助手'}</p>
      </div>

      {/* 右侧表单区 */}
      <div className="flex items-center justify-center p-6">
        <Card className="w-full max-w-sm border-border/60 bg-card/60 shadow-xl backdrop-blur-xl">
          <CardHeader className="space-y-1">
            <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-accent lg:hidden">
              <PawPrint className="h-5 w-5 text-primary" />
            </div>
            <CardTitle className="text-2xl">欢迎回来</CardTitle>
            <CardDescription>登录到 {config?.title || 'BiliBili弹宠小助手'}</CardDescription>
          </CardHeader>
          <CardContent>
            <form id="loginForm" onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">用户名</Label>
                <Input id="username" value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">密码</Label>
                <div className="relative">
                  <Input id="password" type={showPwd ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" className="pr-10" required />
                  <button type="button" onClick={() => setShowPwd(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1} aria-label={showPwd ? '隐藏密码' : '显示密码'}>
                    {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <Button id="login-submit" type="submit" className="w-full" disabled={loading}>
                {loading ? '登录中...' : '登录'}
              </Button>
            </form>
            {config?.oauth?.enabled && config.oauth.providers?.length > 0 && (
              <div className="mt-6 space-y-3">
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="h-px flex-1 bg-border" />
                  <span>其他方式登录</span>
                  <span className="h-px flex-1 bg-border" />
                </div>
                <div className="flex flex-wrap justify-center gap-3">
                  {config.oauth.providers.map(provider => {
                    const icon = OAUTH_ICONS[provider.type];
                    const isLoading = oauthLoading === provider.type;

                    return (
                      <button
                        key={provider.type}
                        type="button"
                        title={`使用${provider.name}登录`}
                        aria-label={`使用${provider.name}登录`}
                        aria-busy={isLoading}
                        disabled={!!oauthLoading}
                        onClick={() => startOauth(provider.type)}
                        className="group relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border/70 bg-background/80 shadow-sm backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-accent/60 hover:shadow-lg hover:shadow-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 active:translate-y-0 active:scale-95 disabled:pointer-events-none disabled:translate-y-0 disabled:opacity-50"
                      >
                        {icon ? (
                          <img
                            src={icon}
                            alt=""
                            aria-hidden="true"
                            className="h-7 w-7 object-contain transition-transform duration-200 group-hover:scale-110"
                          />
                        ) : (
                          <span aria-hidden="true" className="text-base font-bold text-foreground">
                            {provider.type === 'twitter' ? 'X' : provider.name.charAt(0)}
                          </span>
                        )}
                        {isLoading && (
                          <span className="absolute inset-0 flex items-center justify-center bg-background/85" aria-hidden="true">
                            <LoaderCircle className="h-5 w-5 animate-spin text-primary" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <p className="mt-6 text-center text-sm text-muted-foreground">
              还没有账号？<Link to="/register" className="font-medium text-primary underline-offset-4 hover:underline">立即注册</Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

