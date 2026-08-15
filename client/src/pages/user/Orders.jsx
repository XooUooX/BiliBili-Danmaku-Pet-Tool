import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { usePageTitle } from '@/hooks/use-site-config';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';

function fmtDate(s) {
  if (!s) return '-';
  return new Date(s).toLocaleString('zh-CN', { hour12: false });
}

const ORDER_STATUS = {
  pending: <Badge variant="secondary">待支付</Badge>,
  paid: <Badge variant="success">已支付</Badge>,
  failed: <Badge variant="destructive">失败</Badge>
};

const LOG_TYPE = {
  card: '卡密',
  recharge: '在线充值',
  consume: '消费',
  admin: '管理员调整'
};

export default function UserOrders() {
  usePageTitle('我的订单');
  const [orders, setOrders] = useState([]);
  const [logs, setLogs] = useState([]);
  const pageSize = 20;
  const [orderTotal, setOrderTotal] = useState(0);
  const [orderPage, setOrderPage] = useState(1);
  const [logTotal, setLogTotal] = useState(0);
  const [logPage, setLogPage] = useState(1);

  const loadOrders = useCallback(async () => {
    const d = await api.get(`/api/user/orders?page=${orderPage}&pageSize=${pageSize}`);
    setOrders(d.orders || []);
    setOrderTotal(d.total || 0);
  }, [orderPage]);

  const loadLogs = useCallback(async () => {
    const d = await api.get(`/api/user/balance-logs?page=${logPage}&pageSize=${pageSize}`);
    setLogs(d.logs || []);
    setLogTotal(d.total || 0);
  }, [logPage]);

  useEffect(() => { loadOrders(); }, [loadOrders]);
  useEffect(() => { loadLogs(); }, [loadLogs]);

  const orderPages = Math.max(1, Math.ceil(orderTotal / pageSize));
  const logPages = Math.max(1, Math.ceil(logTotal / pageSize));

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader title="我的订单" subtitle="充值订单与余额明细" />
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>充值订单</CardTitle>
          <CardDescription>共 {orderTotal} 条在线支付订单</CardDescription>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">暂无订单</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>订单号</TableHead>
                  <TableHead>金额</TableHead>
                  <TableHead>渠道</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>创建时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map(o => (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono text-xs">{o.order_no}</TableCell>
                    <TableCell>¥{Number(o.amount).toFixed(2)}</TableCell>
                    <TableCell>{o.channel}</TableCell>
                    <TableCell>{ORDER_STATUS[o.status] || o.status}</TableCell>
                    <TableCell className="text-muted-foreground">{fmtDate(o.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {orderPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <span className="text-sm text-muted-foreground">第 {orderPage} / {orderPages} 页</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={orderPage <= 1} onClick={() => setOrderPage(p => p - 1)}>
                  <ChevronLeft className="h-4 w-4" /> 上一页
                </Button>
                <Button variant="outline" size="sm" disabled={orderPage >= orderPages} onClick={() => setOrderPage(p => p + 1)}>
                  下一页 <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>余额明细</CardTitle>
          <CardDescription>共 {logTotal} 条余额变动记录</CardDescription>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">暂无记录</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>类型</TableHead>
                  <TableHead>变动</TableHead>
                  <TableHead>变动后余额</TableHead>
                  <TableHead>备注</TableHead>
                  <TableHead>时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map(l => (
                  <TableRow key={l.id}>
                    <TableCell>{LOG_TYPE[l.type] || l.type}</TableCell>
                    <TableCell className={Number(l.change_amount) >= 0 ? 'text-emerald-500' : 'text-destructive'}>
                      {Number(l.change_amount) >= 0 ? '+' : ''}{Number(l.change_amount).toFixed(2)}
                    </TableCell>
                    <TableCell>¥{Number(l.balance_after).toFixed(2)}</TableCell>
                    <TableCell className="text-muted-foreground">{l.remark}</TableCell>
                    <TableCell className="text-muted-foreground">{fmtDate(l.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {logPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <span className="text-sm text-muted-foreground">第 {logPage} / {logPages} 页</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={logPage <= 1} onClick={() => setLogPage(p => p - 1)}>
                  <ChevronLeft className="h-4 w-4" /> 上一页
                </Button>
                <Button variant="outline" size="sm" disabled={logPage >= logPages} onClick={() => setLogPage(p => p + 1)}>
                  下一页 <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
