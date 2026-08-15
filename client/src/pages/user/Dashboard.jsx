import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useConfirm } from '@/hooks/use-confirm';
import { usePageTitle, useSiteConfig } from '@/hooks/use-site-config';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Wallet, Plus, QrCode, Power, Trash2, ListChecks, PawPrint, Radio, CalendarCheck, Megaphone } from 'lucide-react';
import { RichContent } from '@/components/ui/rich-editor';
import { PageHeader } from '@/components/PageHeader';

const STAT_CARDS = [
  { key: 'balance', label: '账户余额', icon: Wallet, color: 'primary', value: data => `¥${Number(data.user.balance).toFixed(2)}` },
  { key: 'accounts', label: '绑定账号', icon: QrCode, color: 'sky', value: data => data.accounts.length },
  { key: 'tasks', label: '弹幕任务', icon: ListChecks, color: 'emerald', value: data => data.taskCount }
];

function fmtDate(s) {
  if (!s) return '-';
  return new Date(s).toLocaleString('zh-CN', { hour12: false });
}

// 计算剩余天数和状态
function getAccountStatus(expireAt) {
  if (!expireAt) return { days: -1, status: 'unknown', label: '未知', color: 'secondary' };
  const now = new Date();
  const expire = new Date(expireAt);
  const diff = expire - now;
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  
  if (days < 0) return { days, status: 'expired', label: '已过期', color: 'destructive' };
  if (days === 0) return { days, status: 'expiring', label: '今日过期', color: 'destructive' };
  if (days <= 3) return { days, status: 'critical', label: `${days}天后过期`, color: 'destructive' };
  if (days <= 7) return { days, status: 'warning', label: `${days}天后过期`, color: 'warning' };
  return { days, status: 'active', label: `还有${days}天`, color: 'success' };
}

// 统计卡片组件
function StatCard({ card, data, colorMap }) {
  const Icon = card.icon;
  const colorClass = colorMap[card.color];
  return (
    <Card className={`group relative overflow-hidden rounded-xl border-l-4 shadow-sm sm:rounded-2xl transition-all duration-300 sm:hover:-translate-y-1 sm:hover:shadow-xl lg:shadow-lg ${colorClass.border}`}>
      <div className={`absolute inset-0 bg-gradient-to-br opacity-0 transition-opacity duration-300 group-hover:opacity-100 ${colorClass.gradient}`} />
      <CardHeader className="relative flex-col items-center gap-2 space-y-0 p-3 text-center sm:flex-row sm:gap-3 sm:p-4 sm:text-left lg:gap-4 lg:p-6">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-sm ring-1 transition-transform duration-300 sm:h-12 sm:w-12 sm:ring-2 sm:group-hover:scale-105 lg:h-16 lg:w-16 lg:rounded-2xl lg:shadow-md lg:group-hover:scale-110 lg:group-hover:shadow-lg ${colorClass.bg} ${colorClass.ring}`}>
          <Icon className={`h-5 w-5 sm:h-6 sm:w-6 lg:h-8 lg:w-8 ${colorClass.text}`} />
        </div>
        <div className="min-w-0 space-y-0.5 sm:space-y-1 lg:space-y-1.5">
          <CardDescription className="truncate text-[10px] font-semibold tracking-wide sm:text-xs sm:uppercase">{card.label}</CardDescription>
          <CardTitle className="truncate text-lg font-extrabold tabular-nums tracking-tight sm:text-2xl lg:text-3xl">{card.value(data)}</CardTitle>
        </div>
      </CardHeader>
    </Card>
  );
}

// 账号卡片操作区
function AccountActions({ account, isExpired, onNavigateTasks, onNavigateDaily, onNavigatePet, onActivate, onRemove }) {
  const needsActivation = isExpired || account.active !== 1;

  return (
    <div className="space-y-2">
      {!isExpired && (
        <div className="grid grid-cols-3 divide-x overflow-hidden rounded-xl border border-border/60 bg-background/70 shadow-sm">
          <Button
            variant="ghost"
            size="sm"
            className="h-10 min-w-0 gap-1.5 rounded-none px-2 text-xs font-medium text-muted-foreground shadow-none hover:bg-muted/60 hover:text-foreground active:scale-100"
            onClick={() => onNavigateTasks(account.id)}
          >
            <ListChecks className="text-primary/80" />
            <span className="truncate">弹宠任务</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-10 min-w-0 gap-1.5 rounded-none px-2 text-xs font-medium text-muted-foreground shadow-none hover:bg-muted/60 hover:text-foreground active:scale-100"
            onClick={() => onNavigateDaily(account.id)}
          >
            <CalendarCheck className="text-primary/80" />
            <span className="truncate">日常任务</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-10 min-w-0 gap-1.5 rounded-none px-2 text-xs font-medium text-muted-foreground shadow-none hover:bg-muted/60 hover:text-foreground active:scale-100"
            onClick={() => onNavigatePet(account.id)}
          >
            <PawPrint className="text-primary/80" />
            <span className="truncate">宠物信息</span>
          </Button>
        </div>
      )}

      <div className={`flex items-center gap-2 ${needsActivation ? '' : 'justify-end'}`}>
        {needsActivation && (
          <Button
            size="sm"
            className="h-9 flex-1 rounded-lg shadow-sm"
            onClick={() => onActivate(account)}
          >
            {isExpired ? <Plus /> : <Power />}
            {isExpired ? '续费账号' : '激活账号'}
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 rounded-lg px-2.5 text-xs font-normal text-muted-foreground shadow-none hover:bg-destructive/10 hover:text-destructive"
          onClick={() => onRemove(account)}
        >
          <Trash2 className="h-3.5 w-3.5" />
          删除账号
        </Button>
      </div>
    </div>
  );
}

export default function UserDashboard() {
  usePageTitle('仪表盘');
  const { confirm } = useConfirm();
  const siteConfig = useSiteConfig();
  const navigate = useNavigate();
  const [data, setData] = useState(null);

  const colorMap = useMemo(() => ({
    primary: { border: 'border-primary', gradient: 'bg-gradient-to-br from-primary/5 to-transparent', bg: 'bg-gradient-to-br from-primary/20 to-primary/10', text: 'text-primary', ring: 'ring-primary/20' },
    sky: { border: 'border-sky-500', gradient: 'bg-gradient-to-br from-sky-500/5 to-transparent', bg: 'bg-gradient-to-br from-sky-500/20 to-sky-500/10', text: 'text-sky-500', ring: 'ring-sky-500/20' },
    emerald: { border: 'border-emerald-500', gradient: 'bg-gradient-to-br from-emerald-500/5 to-transparent', bg: 'bg-gradient-to-br from-emerald-500/20 to-emerald-500/10', text: 'text-emerald-500', ring: 'ring-emerald-500/20' }
  }), []);

  const load = useCallback(async () => {
    try {
      const d = await api.get('/api/user/overview');
      setData(d);
    } catch (e) {
      toast.error('加载数据失败：' + (e.message || '未知错误'));
    }
  }, []);

  useEffect(() => {
    load();
    // 定时刷新仪表板数据（每45秒）
    const timer = setInterval(load, 45000);
    return () => clearInterval(timer);
  }, [load]);

  const startBind = useCallback(() => navigate('/bind-account'), [navigate]);

  const navigateToTasks = useCallback(accountId => navigate(`/tasks/${accountId}`), [navigate]);
  const navigateToDaily = useCallback(accountId => navigate(`/daily-tasks/${accountId}`), [navigate]);
  const navigateToPet = useCallback(accountId => navigate(`/pet-levels/${accountId}`), [navigate]);

  const activate = useCallback(acc => {
    navigate(`/recharge?account=${acc.id}`);
  }, [navigate]);

  const removeAcc = useCallback(async acc => {
    const ok = await confirm({
      title: '删除账号',
      description: '确认删除该账号及其所有任务？此操作不可恢复。',
      confirmText: '删除',
      variant: 'destructive'
    });
    if (!ok) return;
    try {
      await api.post(`/api/user/account/${acc.id}/delete`);
      toast.success('已删除');
      load();
    } catch (e) {
      toast.error('删除失败：' + (e.message || '未知错误'));
    }
  }, [confirm, load]);

  if (!data) return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="grid grid-cols-3 gap-2 sm:gap-4 lg:gap-5">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="rounded-xl sm:rounded-2xl">
            <CardHeader className="flex-col items-center gap-2 space-y-0 p-3 sm:flex-row sm:gap-3 sm:p-4 lg:gap-4 lg:p-6">
              <Skeleton className="h-10 w-10 rounded-xl sm:h-12 sm:w-12 lg:h-16 lg:w-16 lg:rounded-2xl" />
              <div className="flex w-full flex-col items-center space-y-1.5 sm:w-auto sm:flex-1 sm:items-start sm:space-y-2">
                <Skeleton className="h-2.5 w-12 sm:h-3 sm:w-16 lg:w-20" />
                <Skeleton className="h-5 w-14 sm:h-6 sm:w-20 lg:h-7 lg:w-24" />
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader><Skeleton className="h-6 w-32" /></CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader title="仪表盘" subtitle="欢迎回来 • 实时数据" />
      
      {/* 站点公告 */}
      {siteConfig?.announcement && (
        <Card className="border-primary/20 bg-gradient-to-br from-primary/8 via-primary/4 to-background shadow-lg">
          <CardHeader className="flex-row items-center gap-3 space-y-0 pb-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary/25 to-primary/15 shadow-sm ring-2 ring-primary/20">
              <Megaphone className="h-5 w-5 text-primary" />
            </div>
            <CardTitle className="text-lg font-bold">站点公告</CardTitle>
          </CardHeader>
          <CardContent>
            <RichContent html={siteConfig.announcement} />
          </CardContent>
        </Card>
      )}
      {/* 概览卡片 */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4 lg:gap-5">
        {STAT_CARDS.map(card => (
          <StatCard key={card.key} card={card} data={data} colorMap={colorMap} />
        ))}
      </div>

      {/* 账号列表 */}
      <Card className="shadow-lg">
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 text-primary shadow-sm ring-2 ring-primary/20">
              <Radio className="h-6 w-6" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold">B站账号</CardTitle>
              <CardDescription className="mt-1.5 text-sm">绑定B站账号并购买时长套餐激活后即可创建任务</CardDescription>
            </div>
          </div>
          <Button onClick={startBind} className="gap-2 shadow-md transition-all hover:shadow-lg"><Plus className="h-4 w-4" /> 绑定账号</Button>
        </CardHeader>
        <CardContent>
          {data.accounts.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-5 rounded-2xl border-2 border-dashed bg-muted/40 py-20 text-center transition-colors hover:bg-muted/50">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 shadow-md ring-2 ring-primary/20">
                <QrCode className="h-10 w-10 text-primary" />
              </div>
              <div className="space-y-2">
                <p className="text-lg font-semibold">还没有绑定账号</p>
                <p className="text-sm text-muted-foreground">扫码绑定你的B站账号开始使用</p>
              </div>
              <Button size="sm" onClick={startBind} className="gap-2 shadow-md hover:shadow-lg"><Plus className="h-4 w-4" /> 扫码绑定</Button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {data.accounts.map(acc => {
                const status = getAccountStatus(acc.expire_at);
                const isExpired = status.status === 'expired';
                const statusVariant = status.color === 'success'
                  ? 'success'
                  : status.color === 'warning'
                    ? 'warning'
                    : status.color === 'destructive'
                      ? 'destructive'
                      : 'secondary';

                return (
                  <div
                    key={acc.id}
                    className={`group relative overflow-hidden rounded-2xl border bg-card shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${
                      isExpired ? 'border-destructive/25' : acc.active === 1 ? 'border-emerald-500/20' : 'border-border/70'
                    }`}
                  >
                    <div className={`h-1 w-full ${
                      isExpired
                        ? 'bg-destructive'
                        : acc.active === 1
                          ? 'bg-gradient-to-r from-emerald-500 to-sky-500'
                          : 'bg-muted-foreground/30'
                    }`} />

                    <div className="p-5">
                      <div className="flex items-start gap-4">
                        {acc.avatar ? (
                          <img
                            src={acc.avatar}
                            alt={acc.nickname}
                            referrerPolicy="no-referrer"
                            className="h-14 w-14 shrink-0 rounded-2xl object-cover shadow-sm ring-2 ring-border/60"
                          />
                        ) : (
                          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-lg font-bold text-primary shadow-sm ring-2 ring-primary/15">
                            {(acc.nickname || '?').charAt(0).toUpperCase()}
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate text-base font-bold">{acc.nickname || '未知账号'}</h3>
                            {isExpired
                              ? <Badge variant="destructive">已停用</Badge>
                              : acc.active === 1
                                ? <Badge variant="success">运行中</Badge>
                                : <Badge variant="secondary">未激活</Badge>}
                          </div>
                          <p className="mt-1.5 flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
                            <QrCode className="h-3.5 w-3.5" />UID：{acc.bili_uid || '—'}
                          </p>
                        </div>
                      </div>

                      <div className="mt-5 grid grid-cols-2 gap-2.5">
                        <div className="rounded-xl border border-border/60 bg-muted/25 p-3">
                          <p className="text-xs text-muted-foreground">服务状态</p>
                          <div className="mt-1.5">
                            <Badge variant={statusVariant}>{status.label}</Badge>
                          </div>
                        </div>
                        <div className="rounded-xl border border-border/60 bg-muted/25 p-3">
                          <p className="text-xs text-muted-foreground">到期时间</p>
                          <p className="mt-1.5 text-sm font-semibold leading-5">{fmtDate(acc.expire_at)}</p>
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-border/60 bg-muted/15 p-4">
                      <AccountActions
                        account={acc}
                        isExpired={isExpired}
                        onNavigateTasks={navigateToTasks}
                        onNavigateDaily={navigateToDaily}
                        onNavigatePet={navigateToPet}
                        onActivate={activate}
                        onRemove={removeAcc}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
