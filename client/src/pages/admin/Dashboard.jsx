import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { usePageTitle } from '@/hooks/use-site-config';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, Radio, Activity, ListChecks, Receipt, Wallet, Ticket } from 'lucide-react';

const ITEMS = [
  { key: 'users', label: '用户数', icon: Users, color: 'text-sky-500 bg-sky-500/10' },
  { key: 'accounts', label: '绑定账号', icon: Radio, color: 'text-primary bg-primary/10' },
  { key: 'activeAccounts', label: '运行中账号', icon: Activity, color: 'text-emerald-500 bg-emerald-500/10' },
  { key: 'tasks', label: '弹幕任务', icon: ListChecks, color: 'text-violet-500 bg-violet-500/10' },
  { key: 'paidOrders', label: '已支付订单', icon: Receipt, color: 'text-amber-500 bg-amber-500/10' },
  { key: 'income', label: '总收入(元)', icon: Wallet, money: true, color: 'text-rose-500 bg-rose-500/10' },
  { key: 'unusedCards', label: '未使用卡密', icon: Ticket, color: 'text-cyan-500 bg-cyan-500/10' }
];

export default function AdminDashboard() {
  usePageTitle('管理后台');
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get('/api/admin/stats').then(d => setStats(d.stats));
  }, []);

  if (!stats) return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">数据概览</h1>
        <p className="text-sm text-muted-foreground">平台整体运营数据</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-9 w-9 rounded-lg" />
            </CardHeader>
            <CardContent><Skeleton className="h-8 w-20" /></CardContent>
          </Card>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-1 rounded-full bg-gradient-to-b from-primary to-primary/40" />
          <h1 className="text-4xl font-black bg-clip-text text-transparent bg-gradient-to-r from-primary via-purple-600 to-rose-600">数据概览</h1>
        </div>
        <p className="text-base text-muted-foreground ml-4">平台整体运营数据 • 实时更新</p>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {ITEMS.map(item => {
          const Icon = item.icon;
          const val = stats[item.key];
          return (
            <Card key={item.key} className={`group relative overflow-hidden shadow-md hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 ${item.borderColor}`}>
              <div className="absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{backgroundImage: `linear-gradient(135deg, transparent 0%, ${item.color.split('bg-')[1]?.split('/')[0] || 'transparent'} 100%)`}} />
              <CardHeader className="relative flex-row items-center justify-between space-y-0 pb-3">
                <CardDescription className="font-semibold text-xs uppercase tracking-widest">{item.label}</CardDescription>
                <span className={`flex h-12 w-12 items-center justify-center rounded-xl shadow-lg ring-2 ring-white/20 transition-all duration-300 group-hover:scale-110 group-hover:shadow-xl ${item.color}`}>
                  <Icon className="h-6 w-6" />
                </span>
              </CardHeader>
              <CardContent className="relative">
                <CardTitle className="text-3xl font-extrabold tabular-nums bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/80">
                  {item.money ? '¥' + Number(val).toFixed(2) : val}
                </CardTitle>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
