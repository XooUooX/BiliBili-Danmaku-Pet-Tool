import { useEffect, useState, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { usePageTitle } from '@/hooks/use-site-config';
import { useConfirm } from '@/hooks/use-confirm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select } from '@/components/ui/select';
import { RichContent } from '@/components/ui/rich-editor';
import { Gift, CreditCard, Package, Wallet, Check } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';

const CHANNEL_LABELS = {
  epay_alipay: '易支付-支付宝',
  epay_wxpay: '易支付-微信',
  alipay: '支付宝'
};

// 套餐卡片组件
function PackageCard({ pkg, isActive, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(String(pkg.id))}
      className={`relative flex flex-col rounded-xl border p-4 text-left transition ${isActive ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:border-primary/40 hover:bg-muted/40'}`}
    >
      {isActive && (
        <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Check className="h-3 w-3" />
        </span>
      )}
      <span className="text-sm font-medium">{pkg.name}</span>
      <span className="mt-1 text-xs text-muted-foreground">{pkg.days} 天</span>
      <span className="mt-3 text-xl font-semibold text-primary">¥{Number(pkg.price).toFixed(2)}</span>
    </button>
  );
}

export default function UserRecharge() {
  usePageTitle('充值');
  const { confirm } = useConfirm();
  const [channels, setChannels] = useState({ epay: false, alipay: false });
  const [code, setCode] = useState('');
  const [amount, setAmount] = useState('10');
  const [channel, setChannel] = useState('');
  const [loading, setLoading] = useState(false);

  // 时长套餐购买
  const [packages, setPackages] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [balance, setBalance] = useState(0);
  const [pkgId, setPkgId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [buying, setBuying] = useState(false);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const acc = searchParams.get('account');
    if (acc) setAccountId(acc);
  }, [searchParams]);

  const available = useMemo(() => {
    const arr = [];
    if (channels.epay) arr.push('epay_alipay', 'epay_wxpay');
    if (channels.alipay) arr.push('alipay');
    return arr;
  }, [channels]);

  const selectedPkg = useMemo(() => packages.find(p => String(p.id) === pkgId), [packages, pkgId]);

  const refreshBalance = useCallback(async () => {
    try {
      const d = await api.get('/api/user/overview');
      if (d.user) setBalance(Number(d.user.balance) || 0);
    } catch (e) {
      toast.error('刷新余额失败: ' + e.message);
    }
  }, []);

  useEffect(() => {
    api.get('/api/user/recharge/channels').then(d => {
      setChannels(d.channels);
      const first = d.channels.epay ? 'epay_alipay' : d.channels.alipay ? 'alipay' : '';
      setChannel(first);
    });
    api.get('/api/user/packages').then(d => setPackages(d.packages || [])).catch(() => {});
    api.get('/api/user/overview').then(d => {
      setAccounts(d.accounts || []);
      if (d.user) setBalance(Number(d.user.balance) || 0);
    }).catch(() => {});
    
    // 定时刷新余额（每30秒）
    const timer = setInterval(refreshBalance, 30000);
    return () => clearInterval(timer);
  }, [refreshBalance]);

  const redeemCard = useCallback(async e => {
    e.preventDefault();
    if (!code.trim()) return toast.error('请输入卡密');
    try {
      const d = await api.post('/api/user/recharge/card', { code: code.trim() });
      const ok = await confirm({
        title: '充值成功',
        description: `成功充值 ¥${d.amount}，你的账户余额已更新`,
        confirmText: '继续',
        variant: 'success'
      });
      setCode('');
      await refreshBalance();
    } catch (err) {
      toast.error(err.message);
    }
  }, [code, refreshBalance, confirm]);

  const buyPackage = useCallback(async e => {
    e.preventDefault();
    if (!pkgId) return toast.error('请选择时长套餐');
    if (!accountId) return toast.error('请选择绑定账号');
    setBuying(true);
    try {
      const result = await api.post(`/api/user/packages/${pkgId}/buy`, { accountId });
      const ok = await confirm({
        title: '购买成功',
        description: `已为账号添加 ${result.daysAdded || '时长'}，账户余额已扣费`,
        confirmText: '返回',
        variant: 'success'
      });
      setPkgId('');
      setAccountId('');
      await refreshBalance();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBuying(false);
    }
  }, [pkgId, accountId, refreshBalance, confirm]);

  const payOnline = useCallback(async e => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return toast.error('请输入有效金额');
    if (!channel) return toast.error('请选择支付渠道');
    setLoading(true);
    try {
      const d = await api.post('/api/user/recharge/online', { amount: amt, channel });
      if (d.type === 'redirect') {
        window.location.href = d.payUrl;
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [amount, channel]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title="账户充值" subtitle="快速充值 • 多种支付方式" />

      {/* 余额条 */}
      <div className="flex items-center justify-between rounded-xl border bg-gradient-to-r from-emerald-500/10 to-emerald-500/5 p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Wallet className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">当前余额</p>
            <p className="text-2xl font-semibold tracking-tight">¥{balance.toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* 购买时长 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Package className="h-5 w-5 text-primary" /> 购买时长</CardTitle>
          <CardDescription>选择套餐与绑定账号，使用余额为账号续期</CardDescription>
        </CardHeader>
        <CardContent>
          {packages.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">管理员尚未配置时长套餐</p>
          ) : (
            <form onSubmit={buyPackage} className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {packages.map(p => (
                  <PackageCard
                    key={p.id}
                    pkg={p}
                    isActive={String(p.id) === pkgId}
                    onSelect={setPkgId}
                  />
                ))}
              </div>

              {selectedPkg?.description && (
                <div className="rounded-lg border bg-muted/30 p-4">
                  <RichContent html={selectedPkg.description} />
                </div>
              )}

              <div className="space-y-2 border-t pt-4">
                <Label>绑定账号</Label>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Select className="flex-1" value={accountId} onChange={e => setAccountId(e.target.value)}>
                    <option value="">请选择账号</option>
                    {accounts.map(a => (
                      <option key={a.id} value={a.id}>{a.nickname || a.bili_uid || `账号#${a.id}`}</option>
                    ))}
                  </Select>
                  <Button type="submit" className="sm:w-40" disabled={buying || !selectedPkg}>
                    {buying ? '购买中...' : selectedPkg ? `支付 ¥${Number(selectedPkg.price).toFixed(2)}` : '立即购买'}
                  </Button>
                </div>
                {accounts.length === 0 && (
                  <p className="text-xs text-muted-foreground">暂无绑定账号，请先在「账号任务」中添加</p>
                )}
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      {/* 卡密 + 在线充值 并排 */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Gift className="h-5 w-5 text-primary" /> 卡密充值</CardTitle>
            <CardDescription>输入卡密兑换额度，立即到账</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={redeemCard} className="flex gap-2">
              <Input value={code} onChange={e => setCode(e.target.value)} placeholder="请输入卡密" />
              <Button type="submit">兑换</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5 text-primary" /> 在线充值</CardTitle>
            <CardDescription>选择支付渠道在线充值</CardDescription>
          </CardHeader>
          <CardContent>
            {available.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">管理员尚未开启任何在线支付渠道</p>
            ) : (
              <form onSubmit={payOnline} className="space-y-4">
                <div className="space-y-2">
                  <Label>充值金额（元）</Label>
                  <Input type="number" min={1} step="0.01" value={amount} onChange={e => setAmount(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>支付渠道</Label>
                  <Tabs value={channel} onValueChange={setChannel}>
                    <TabsList className="flex-wrap h-auto">
                      {available.map(c => (
                        <TabsTrigger key={c} value={c}>{CHANNEL_LABELS[c]}</TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? '下单中...' : '立即支付'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
