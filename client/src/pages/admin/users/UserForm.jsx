import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useConfirm } from '@/hooks/use-confirm';
import { usePageTitle } from '@/hooks/use-site-config';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Coins, KeyRound } from 'lucide-react';

function fmtDate(s) {
  if (!s) return '-';
  return new Date(s).toLocaleString('zh-CN', { hour12: false });
}

const ORDER_STATUS = {
  pending: { label: '待支付', variant: 'secondary' },
  paid: { label: '已支付', variant: 'success' },
  failed: { label: '失败', variant: 'destructive' }
};

// 统计卡片组件
function StatCard({ label, value }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

// 绑定账号行组件
function AccountRow({ account }) {
  return (
    <TableRow>
      <TableCell>{account.nickname || '未知'}</TableCell>
      <TableCell className="text-muted-foreground">{account.bili_uid || '-'}</TableCell>
      <TableCell>{account.active === 1 ? <Badge variant="success">运行中</Badge> : <Badge variant="secondary">停用</Badge>}</TableCell>
      <TableCell>{account.task_count}</TableCell>
      <TableCell className="text-muted-foreground">{fmtDate(account.expire_at)}</TableCell>
    </TableRow>
  );
}

// 订单行组件
function OrderRow({ order }) {
  const status = ORDER_STATUS[order.status] || { label: order.status, variant: 'default' };
  return (
    <TableRow>
      <TableCell className="font-mono text-xs">{order.order_no}</TableCell>
      <TableCell>¥{Number(order.amount).toFixed(2)}</TableCell>
      <TableCell>{order.channel}</TableCell>
      <TableCell><Badge variant={status.variant}>{status.label}</Badge></TableCell>
      <TableCell className="text-muted-foreground">{fmtDate(order.created_at)}</TableCell>
    </TableRow>
  );
}

// 余额流水行组件
function BalanceLogRow({ log }) {
  const isPositive = Number(log.change_amount) >= 0;
  return (
    <TableRow>
      <TableCell>{log.type}</TableCell>
      <TableCell className={isPositive ? 'text-emerald-500' : 'text-destructive'}>
        {isPositive ? '+' : ''}{Number(log.change_amount).toFixed(2)}
      </TableCell>
      <TableCell>¥{Number(log.balance_after).toFixed(2)}</TableCell>
      <TableCell className="text-muted-foreground">{log.remark || '-'}</TableCell>
      <TableCell className="text-muted-foreground">{fmtDate(log.created_at)}</TableCell>
    </TableRow>
  );
}

export default function UserForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { prompt } = useConfirm();
  const mode = id ? 'edit' : 'create';
  usePageTitle(mode === 'create' ? '新建用户' : '用户管理');

  const [form, setForm] = useState({ username: '', password: '', email: '', is_admin: false });
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(mode === 'edit');

  const loadUser = useCallback(async () => {
    if (mode !== 'edit') return;
    setLoading(true);
    try {
      const d = await api.get(`/api/admin/users/${id}`);
      setForm({ username: d.user.username, password: '', email: d.user.email || '', is_admin: d.user.is_admin === 1 });
      setDetail(d);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [id, mode]);

  useEffect(() => { loadUser(); }, [loadUser]);

  const back = useCallback(() => navigate('/admin/users'), [navigate]);

  const submitForm = useCallback(async e => {
    e.preventDefault();
    try {
      if (mode === 'create') {
        await api.post('/api/admin/users', {
          username: form.username.trim(),
          password: form.password,
          email: form.email.trim(),
          is_admin: form.is_admin
        });
        toast.success('已创建');
        navigate('/admin/users');
      } else {
        await api.post(`/api/admin/users/${id}/profile`, {
          email: form.email.trim(),
          is_admin: form.is_admin
        });
        toast.success('已保存');
        loadUser();
      }
    } catch (e) {
      toast.error(e.message);
    }
  }, [form, mode, id, loadUser, navigate]);

  const adjustBalance = useCallback(async () => {
    const input = await prompt({
      title: '调整余额',
      label: `调整 ${form.username} 的余额（正数增加，负数扣减）`,
      defaultValue: '0',
      confirmText: '确认调整'
    });
    if (input === null) return;
    const amount = parseFloat(input);
    if (isNaN(amount) || amount === 0) return toast.error('金额无效');
    try {
      await api.post(`/api/admin/users/${id}/balance`, { amount });
      toast.success('已调整');
      loadUser();
    } catch (e) {
      toast.error(e.message);
    }
  }, [form.username, id, prompt, loadUser]);

  const resetPassword = useCallback(async () => {
    const input = await prompt({
      title: '重置密码',
      label: `为 ${form.username} 设置新密码（至少6位）`,
      confirmText: '确认重置'
    });
    if (input === null) return;
    if (input.length < 6) return toast.error('密码至少6位');
    try {
      await api.post(`/api/admin/users/${id}/password`, { password: input });
      toast.success('密码已重置');
    } catch (e) {
      toast.error(e.message);
    }
  }, [form.username, id, prompt]);

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={back}>
          <ArrowLeft className="h-4 w-4" /> 返回
        </Button>
        <div>
          <h1 className="text-xl font-semibold">{mode === 'create' ? '新建用户' : form.username}</h1>
          <p className="text-sm text-muted-foreground">{mode === 'create' ? '创建一个新账号' : '用户信息管理'}</p>
        </div>
      </div>

      {mode === 'create' ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">用户信息</CardTitle>
            <CardDescription>填写用户名与密码</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submitForm} className="space-y-4">
              <div className="space-y-1">
                <Label>用户名</Label>
                <Input value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} required />
              </div>
              <div className="space-y-1">
                <Label>密码</Label>
                <Input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required />
              </div>
              <div className="space-y-1">
                <Label>邮箱（可选）</Label>
                <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="h-4 w-4 accent-primary" checked={form.is_admin} onChange={e => setForm({ ...form, is_admin: e.target.checked })} />
                设为管理员
              </label>
              <div className="space-x-2">
                <Button type="submit">创建</Button>
                <Button type="button" variant="outline" onClick={back}>取消</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : loading ? (
        <p className="py-10 text-center text-sm text-muted-foreground">加载中...</p>
      ) : (
        <Tabs defaultValue="info" className="space-y-4">
          <TabsList>
            <TabsTrigger value="info">基本信息</TabsTrigger>
            <TabsTrigger value="accounts">绑定账号</TabsTrigger>
            <TabsTrigger value="orders">订单记录</TabsTrigger>
            <TabsTrigger value="balance">余额流水</TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <StatCard label="余额" value={`¥${Number(detail?.user.balance || 0).toFixed(2)}`} />
              <StatCard
                label="角色"
                value={detail?.user.is_admin === 1 ? <Badge>管理员</Badge> : <Badge variant="secondary">用户</Badge>}
              />
              <StatCard label="注册时间" value={fmtDate(detail?.user.created_at)} />
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">编辑信息</CardTitle>
                <CardDescription>修改邮箱与管理员权限</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={submitForm} className="space-y-4">
                  <div className="space-y-1">
                    <Label>邮箱（可选）</Label>
                    <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" className="h-4 w-4 accent-primary" checked={form.is_admin} onChange={e => setForm({ ...form, is_admin: e.target.checked })} />
                    设为管理员
                  </label>
                  <Button type="submit">保存</Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">快捷操作</CardTitle>
                <CardDescription>调整余额与重置密码</CardDescription>
              </CardHeader>
              <CardContent className="flex gap-2">
                <Button variant="outline" onClick={adjustBalance}>
                  <Coins className="h-4 w-4" /> 调整余额
                </Button>
                <Button variant="outline" onClick={resetPassword}>
                  <KeyRound className="h-4 w-4" /> 重置密码
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="accounts">
            <Card>
              <CardHeader><CardTitle className="text-base">绑定账号（{detail?.accounts.length || 0}）</CardTitle></CardHeader>
              <CardContent>
                {!detail?.accounts.length ? (
                  <p className="text-sm text-muted-foreground">无</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>昵称</TableHead><TableHead>UID</TableHead>
                        <TableHead>状态</TableHead><TableHead>任务数</TableHead><TableHead>到期</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detail.accounts.map(a => (
                        <AccountRow key={a.id} account={a} />
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="orders">
            <Card>
              <CardHeader><CardTitle className="text-base">最近订单</CardTitle></CardHeader>
              <CardContent>
                {!detail?.orders.length ? (
                  <p className="text-sm text-muted-foreground">无</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>订单号</TableHead><TableHead>金额</TableHead>
                        <TableHead>渠道</TableHead><TableHead>状态</TableHead><TableHead>时间</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detail.orders.map(o => (
                        <OrderRow key={o.id} order={o} />
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="balance">
            <Card>
              <CardHeader><CardTitle className="text-base">余额流水</CardTitle></CardHeader>
              <CardContent>
                {!detail?.balanceLogs.length ? (
                  <p className="text-sm text-muted-foreground">无</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>类型</TableHead><TableHead>变动</TableHead>
                        <TableHead>余额</TableHead><TableHead>备注</TableHead><TableHead>时间</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detail.balanceLogs.map(l => (
                        <BalanceLogRow key={l.id} log={l} />
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
