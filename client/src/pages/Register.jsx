import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/use-auth';
import { useSiteConfig, usePageTitle } from '@/hooks/use-site-config';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ThemeToggle } from '@/components/theme-toggle';
import { PawPrint, Eye, EyeOff } from 'lucide-react';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const config = useSiteConfig();
  usePageTitle('注册');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [email, setEmail] = useState('');
  const [qq, setQq] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const emailRequired = !!config?.emailRequired;

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const sendCode = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast.error('请输入正确的邮箱');
      return;
    }
    setSending(true);
    try {
      await api.post('/api/auth/send-code', { email: email.trim() });
      toast.success('验证码已发送，请查收邮件');
      setCooldown(60);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSending(false);
    }
  };

  const doSubmit = async () => {
    if (username.trim().length < 3 || password.length < 6) {
      toast.error('用户名至少3位，密码至少6位');
      return;
    }
    if (emailRequired && (!email.trim() || !code.trim())) {
      toast.error('请填写邮箱和验证码');
      return;
    }
    setLoading(true);
    try {
      await register({
        username: username.trim(),
        password,
        email: email.trim(),
        qq: qq.trim(),
        code: code.trim()
      });
      toast.success('注册成功');
      navigate('/dashboard', { replace: true });
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
          <h2 className="text-4xl font-bold leading-tight">创建账号<br />开始管理弹宠</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            绑定 BiliBili 账号，在一个后台中配置弹宠互动任务并查看运行状态。
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
            <CardTitle className="text-2xl">创建账号</CardTitle>
            <CardDescription>注册一个新账号开始使用</CardDescription>
          </CardHeader>
          <CardContent>
            <form id="registerForm" onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">用户名</Label>
                <Input id="username" value={username} onChange={e => setUsername(e.target.value)} placeholder="至少3位" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">密码</Label>
                <div className="relative">
                  <Input id="password" type={showPwd ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="至少6位" className="pr-10" required />
                  <button type="button" onClick={() => setShowPwd(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1} aria-label={showPwd ? '隐藏密码' : '显示密码'}>
                    {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="qq">QQ号</Label>
                <Input 
                  id="qq" 
                  type="text" 
                  value={qq} 
                  onChange={e => setQq(e.target.value)} 
                  pattern="[0-9]*"
                />
              </div>
              {emailRequired && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="email">邮箱</Label>
                    <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="用于接收验证码" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="code">邮箱验证码</Label>
                    <div className="flex gap-2">
                      <Input id="code" value={code} onChange={e => setCode(e.target.value)} placeholder="6位验证码" required />
                      <Button type="button" variant="outline" className="shrink-0" onClick={sendCode} disabled={sending || cooldown > 0}>
                        {cooldown > 0 ? `${cooldown}s` : sending ? '发送中' : '获取验证码'}
                      </Button>
                    </div>
                  </div>
                </>
              )}
              <Button id="register-submit" type="submit" className="w-full" disabled={loading}>
                {loading ? '注册中...' : '注册'}
              </Button>
            </form>
            <p className="mt-6 text-center text-sm text-muted-foreground">
              已有账号？<Link to="/login" className="font-medium text-primary underline-offset-4 hover:underline">立即登录</Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
