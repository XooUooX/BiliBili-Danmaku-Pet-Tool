import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useSiteConfig, usePageTitle } from '@/hooks/use-site-config';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import {
  PawPrint, SlidersHorizontal, Users, Sparkles, ListChecks, ShieldCheck,
  LayoutDashboard, ArrowRight, ExternalLink
} from 'lucide-react';

const FEATURES = [
  {
    icon: PawPrint,
    title: '弹宠等级管理',
    desc: '集中维护宠物等级、经验与升级条件，配置和调整更加直观。'
  },
  {
    icon: SlidersHorizontal,
    title: '互动内容配置',
    desc: '按直播间需求配置签到、双修、打劫、钓鱼等弹幕互动内容。'
  },
  {
    icon: Sparkles,
    title: '直播间活跃辅助',
    desc: '通过弹宠互动丰富弹幕内容，帮助主播更方便地维护直播间氛围。'
  },
  {
    icon: Users,
    title: '多账号管理',
    desc: '集中绑定和管理多个 BiliBili 账号，快速切换并查看对应直播间。'
  },
  {
    icon: ListChecks,
    title: '任务运行管理',
    desc: '统一设置互动任务、执行间隔与启停状态，减少日常重复操作。'
  },
  {
    icon: ShieldCheck,
    title: '状态记录查询',
    desc: '集中查看任务状态、运行日志、互动记录和宠物等级变化。'
  }
];

export default function Home() {
  const { user } = useAuth();
  const config = useSiteConfig();
  const siteTitle = config?.title || 'BiliBili弹宠小助手';
  const [friendLinks, setFriendLinks] = useState([]);
  usePageTitle();

  useEffect(() => {
    const loadLinks = async () => {
      try {
        const data = await api.get('/api/user/friend-links');
        setFriendLinks(data.links || []);
      } catch (err) {
        console.error('加载友情链接失败:', err);
      }
    };
    loadLinks();
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <PawPrint className="h-5 w-5" />
            </span>
            <span className="truncate">{siteTitle}</span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle />
            {user ? (
              <Link to="/dashboard">
                <Button size="sm">
                  <LayoutDashboard className="h-4 w-4" /> 进入控制台
                </Button>
              </Link>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="ghost" size="sm">登录</Button>
                </Link>
                <Link to="/register">
                  <Button size="sm">注册</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -left-32 top-0 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute -right-32 top-20 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-4 py-20 text-center sm:px-6 sm:py-28">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
            <SlidersHorizontal className="h-3.5 w-3.5 text-primary" /> BiliBili 直播间弹宠管理工具
          </span>
          <h1 className="mt-6 text-4xl font-bold leading-tight tracking-tight sm:text-5xl md:text-6xl">
            一站式管理<br />
            <span className="text-primary">直播间弹幕宠物</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base text-muted-foreground sm:text-lg">
            弹幕宠物小助手是一款面向 BiliBili 直播间的弹宠管理工具，可集中管理账号、宠物等级、互动任务和运行状态，减少重复配置，让直播间弹宠维护更简单。
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link to={user ? '/dashboard' : '/register'}>
              <Button size="lg" className="gap-2">
                {user ? '进入弹宠后台' : '开始使用'} <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            {!user && (
              <Link to="/login">
                <Button size="lg" variant="outline">登录</Button>
              </Link>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <div className="mb-12 text-center">
          <h2 className="text-2xl font-bold sm:text-3xl">弹宠管理功能</h2>
          <p className="mt-3 text-sm text-muted-foreground">集中完成账号绑定、互动配置、任务运行与状态查看</p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(feature => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="group rounded-xl border border-border/60 bg-card/60 p-6 backdrop-blur transition-all hover:border-primary/40 hover:shadow-lg"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-base font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{feature.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-primary/15 via-card/60 to-background p-10 text-center sm:p-16">
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
          <h2 className="relative text-2xl font-bold sm:text-3xl">更方便地管理直播间弹宠</h2>
          <p className="relative mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
            绑定 BiliBili 账号，配置宠物等级与互动任务，在一个后台中查看运行状态和互动记录。
          </p>
          <div className="relative mt-8">
            <Link to={user ? '/dashboard' : '/register'}>
              <Button size="lg" className="gap-2">
                {user ? '进入弹宠后台' : '立即开始'} <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {friendLinks.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
          <div className="mb-12 text-center">
            <h2 className="text-2xl font-bold sm:text-3xl">友情链接</h2>
            <p className="mt-3 text-sm text-muted-foreground">感谢以下伙伴的支持</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            {friendLinks.map(link => (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-3 rounded-xl border border-border/60 bg-card/60 p-4 backdrop-blur transition-all hover:border-primary/40 hover:shadow-lg"
              >
                {link.logo && (
                  <img
                    src={link.logo}
                    alt={link.name}
                    className="h-10 w-10 shrink-0 rounded-lg object-cover"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate font-medium group-hover:text-primary">{link.name}</h3>
                    <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100" />
                  </div>
                  {link.description && (
                    <p className="mt-1 truncate text-xs text-muted-foreground">{link.description}</p>
                  )}
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      <footer className="border-t border-border/60">
        <div className="mx-auto max-w-6xl px-4 py-8 text-center text-xs text-muted-foreground sm:px-6">
          © {new Date().getFullYear()} {siteTitle}
        </div>
      </footer>
    </div>
  );
}
