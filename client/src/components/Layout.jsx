import { useState, useCallback, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import { useSiteConfig } from '@/hooks/use-site-config';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import {
  LogOut, LayoutDashboard, Shield, Menu, X,
  ListChecks, Wallet, Receipt, Users, CreditCard, Settings, User, Package, Tv, Gift, Ticket, Activity, PawPrint, Link2, UserSearch
} from 'lucide-react';
import { cn } from '@/lib/utils';

const ADMIN_NAV_ITEMS = [
  { to: '/admin', label: '仪表盘', exact: true, icon: LayoutDashboard },
  { to: '/admin/users', label: '用户管理', icon: Users },
  { to: '/admin/bili-accounts', label: 'B站账号', icon: UserSearch },
  { to: '/admin/tasks', label: '任务管理', icon: Activity },
  { to: '/admin/templates', label: '任务模板', icon: ListChecks },
  { to: '/admin/live-rooms', label: '直播间', icon: Tv },
  { to: '/admin/lottery', label: '每日抽奖', icon: Gift },
  { to: '/admin/packages', label: '时长套餐', icon: Package },
  { to: '/admin/orders', label: '订单管理', icon: Receipt },
  { to: '/admin/cards', label: '卡密管理', icon: CreditCard },
  { to: '/admin/tickets', label: '工单管理', icon: Ticket },
  { to: '/admin/friend-links', label: '友情链接', icon: Link2 },
  { to: '/admin/settings', label: '系统设置', icon: Settings }
];

const USER_NAV_ITEMS = [
  { to: '/dashboard', label: '账号任务', exact: true, icon: ListChecks },
  { to: '/pet-levels', label: '宠物升级', icon: PawPrint },
  { to: '/live-rooms', label: '在线直播间', icon: Tv },
  { to: '/lottery', label: '每日抽奖', icon: Gift },
  { to: '/recharge', label: '在线充值', icon: Wallet },
  { to: '/orders', label: '购买记录', icon: Receipt },
  { to: '/tickets', label: '在线工单', icon: Ticket },
  { to: '/profile', label: '个人资料', icon: User }
];

export default function Layout({ children, admin = false }) {
  const { user, logout } = useAuth();
  const config = useSiteConfig();
  const navigate = useNavigate();
  const location = useLocation();
  const siteTitle = config?.title || 'BiliBili弹宠小助手';
  const [open, setOpen] = useState(false);

  const navItems = useMemo(() => admin ? ADMIN_NAV_ITEMS : USER_NAV_ITEMS, [admin]);

  const isActive = useCallback(item => 
    item.exact ? location.pathname === item.to : location.pathname.startsWith(item.to),
    [location.pathname]
  );

  const handleLogout = useCallback(async () => {
    await logout();
    navigate('/login');
  }, [logout, navigate]);

  const toggleSidebar = useCallback(() => setOpen(prev => !prev), []);
  const closeSidebar = useCallback(() => setOpen(false), []);

  const NavLinks = useCallback(() => (
    <nav className="flex flex-col gap-1">
      {navItems.map(item => {
        const Icon = item.icon;
        const active = isActive(item);
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={closeSidebar}
            className={cn(
              'group relative flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all',
              active
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
            )}
          >
            {active && <span className="absolute inset-y-1 left-0 w-1 rounded-full bg-primary" />}
            <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-primary' : 'group-hover:text-foreground')} />
            <span className={cn(active && 'font-semibold')}>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  ), [navItems, isActive, closeSidebar]);

  return (
    <div className="min-h-screen bg-background">
      {/* 移动端遮罩 */}
      {open && (
        <div 
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden" 
          onClick={closeSidebar}
          aria-label="Close sidebar"
        />
      )}

      {/* 左侧边栏 */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-56 flex-col border-r border-border/60 bg-card/70 backdrop-blur-xl transition-transform duration-300 md:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-14 items-center justify-between border-b border-border/60 px-4">
          <Link 
            to={admin ? '/admin' : '/dashboard'} 
            className="flex items-center gap-2 font-semibold transition-opacity hover:opacity-80"
            onClick={closeSidebar}
          >
            <span className={cn(
              'flex h-8 w-8 items-center justify-center rounded-lg transition-transform hover:scale-105',
              admin ? 'bg-foreground/10 text-foreground' : 'bg-primary/15 text-primary'
            )}>
              {admin ? <Shield className="h-4 w-4" /> : <PawPrint className="h-4 w-4" />}
            </span>
            <span className="truncate text-sm">{admin ? '管理后台' : '控制台'}</span>
          </Link>
          <Button 
            variant="ghost" 
            size="icon" 
            className="md:hidden" 
            onClick={closeSidebar}
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3 scrollbar-thin">
          <NavLinks />
        </div>

        <div className="border-t border-border/60 bg-muted/30 p-3 space-y-2">
          {user?.is_admin === 1 && !admin && (
            <Link to="/admin" onClick={closeSidebar}>
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full justify-start gap-2"
              >
                <LayoutDashboard className="h-4 w-4" /> 管理后台
              </Button>
            </Link>
          )}
          {admin && (
            <Link to="/dashboard" onClick={closeSidebar}>
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full justify-start gap-2"
              >
                <PawPrint className="h-4 w-4" /> 返回前台
              </Button>
            </Link>
          )}
          <Button 
            variant="ghost" 
            size="sm" 
            className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" /> 退出登录
          </Button>
        </div>
      </aside>

      {/* 主内容区 */}
      <div className="flex min-h-screen flex-col md:pl-56">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border/60 bg-background/70 px-4 backdrop-blur-xl">
          <Button 
            variant="ghost" 
            size="icon" 
            className="md:hidden"
            onClick={toggleSidebar}
            aria-label="Open sidebar"
          >
            <Menu className="h-4 w-4" />
          </Button>
          <span className="font-semibold md:hidden text-sm">{admin ? '管理后台' : siteTitle}</span>
          <div className="ml-auto flex items-center gap-3">
            <ThemeToggle />
            <div className="flex items-center gap-2">
              <Link 
                to="/profile" 
                className="flex items-center gap-2 rounded-lg px-2 py-1 transition-all hover:bg-muted/50"
              >
                {user?.avatar ? (
                  <img src={user.avatar} alt="Avatar" className="h-8 w-8 rounded-full object-cover" />
                ) : (
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
                    {(user?.username || '?').slice(0, 1).toUpperCase()}
                  </span>
                )}
                <span className="hidden text-sm font-medium sm:block">
                  {user?.username}
                  {user?.is_admin === 1 && (
                    <span className="ml-2 rounded-md bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary">
                      管理员
                    </span>
                  )}
                </span>
              </Link>
            </div>
          </div>
        </header>
        <main 
          key={location.pathname} 
          className="flex-1 animate-fade-in p-4 md:p-6 overflow-auto"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
