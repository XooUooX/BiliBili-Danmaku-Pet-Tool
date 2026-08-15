import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { usePageTitle } from '@/hooks/use-site-config';
import { PageHeader } from '@/components/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChevronLeft, ChevronRight } from 'lucide-react';

function fmtDate(s) {
  if (!s) return '-';
  return new Date(s).toLocaleString('zh-CN', { hour12: false });
}

const ORDER_STATUS = {
  pending: <Badge variant="secondary">待支付</Badge>,
  paid: <Badge variant="success">已支付</Badge>,
  failed: <Badge variant="destructive">失败</Badge>
};

export default function AdminOrders() {
  usePageTitle('订单管理');
  const [orders, setOrders] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const pageSize = 20;

  const load = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (status) params.set('status', status);
    const d = await api.get(`/api/admin/orders?${params.toString()}`);
    setOrders(d.orders || []);
    setTotal(d.total || 0);
  }, [page, status]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader title="订单管理" count={total} countLabel="条订单" />

      <Card className="shadow-sm">
        <CardContent className="pt-6 space-y-4">
          {/* 状态筛选工具栏 */}
          <div className="flex flex-wrap items-center gap-3">
            <Select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }} className="h-10 w-40 border-dashed rounded-lg">
              <option value="">全部状态</option>
              <option value="pending">待支付</option>
              <option value="paid">已支付</option>
              <option value="failed">失败</option>
            </Select>
            {status && (
              <Button variant="ghost" size="sm" className="h-10 hover:bg-red-500/10 hover:text-red-600" onClick={() => { setStatus(''); setPage(1); }}>重置</Button>
            )}
          </div>

          <Table>
          <TableHeader>
            <TableRow>
              <TableHead>订单号</TableHead>
              <TableHead>用户</TableHead>
              <TableHead>金额</TableHead>
              <TableHead>渠道</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>第三方单号</TableHead>
              <TableHead>创建时间</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map(o => (
              <TableRow key={o.id}>
                <TableCell className="font-mono text-xs">{o.order_no}</TableCell>
                <TableCell>{o.username}</TableCell>
                <TableCell>¥{Number(o.amount).toFixed(2)}</TableCell>
                <TableCell>{o.channel}</TableCell>
                <TableCell>{ORDER_STATUS[o.status] || o.status}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{o.trade_no || '-'}</TableCell>
                <TableCell className="text-muted-foreground">{fmtDate(o.created_at)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t">
            <span className="text-sm text-muted-foreground">第 {page} / {totalPages} 页</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="h-4 w-4" /> 上一页
              </Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
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
