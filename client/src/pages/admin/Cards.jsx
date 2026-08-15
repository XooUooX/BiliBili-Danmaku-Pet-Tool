import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useConfirm } from '@/hooks/use-confirm';
import { usePageTitle } from '@/hooks/use-site-config';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TableSkeleton } from '@/components/ui/skeleton';
import { Trash2, Search, X, Copy, Ticket, CheckCircle2, CircleSlash, Wallet, Plus, Download, ChevronLeft, ChevronRight } from 'lucide-react';

function fmtDate(s) {
  if (!s) return '-';
  return new Date(s).toLocaleString('zh-CN', { hour12: false });
}

async function copyText(text, msg = '已复制') {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(msg);
  } catch {
    toast.error('复制失败');
  }
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminCards() {
  usePageTitle('卡密管理');
  const { confirm } = useConfirm();
  const navigate = useNavigate();
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, availableCount: 0, usedCount: 0, availableAmount: 0 });
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // 筛选条件
  const [keyword, setKeyword] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const buildParams = useCallback((extra = {}) => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize), ...extra });
    if (query) params.set('keyword', query);
    if (statusFilter) params.set('status', statusFilter);
    return params;
  }, [page, query, statusFilter]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.get(`/api/admin/cards?${buildParams().toString()}`);
      setCards(d.cards || []);
      setTotal(d.total || 0);
      if (d.stats) setStats(d.stats);
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const isUsedUp = c => c.used_count >= c.max_uses;
  const doSearch = () => { setPage(1); setQuery(keyword.trim()); };

  const openGenerate = () => navigate('/admin/cards/generate');

  const remove = async c => {
    const ok = await confirm({
      title: '删除卡密',
      description: '确认删除该卡密？仅未被兑换过的卡密可删除。',
      confirmText: '删除',
      variant: 'destructive'
    });
    if (!ok) return;
    await api.post(`/api/admin/cards/${c.id}/delete`);
    load();
  };

  const exportCards = async () => {
    const d = await api.get(`/api/admin/cards?${buildParams({ all: '1' }).toString()}`);
    const list = d.cards || [];
    if (!list.length) return toast.error('没有可导出的卡密');
    const lines = ['卡密,面额,使用次数,上限,状态'];
    list.forEach(c => {
      lines.push(`${c.code},${Number(c.amount).toFixed(2)},${c.used_count},${c.max_uses},${isUsedUp(c) ? '已用完' : '可用'}`);
    });
    downloadText(`cards-${Date.now()}.csv`, lines.join('\n'));
    toast.success(`已导出 ${list.length} 张卡密`);
  };

  const STAT_ITEMS = [
    { label: '卡密总数', value: stats.total, icon: Ticket, color: 'text-sky-500 bg-sky-500/10' },
    { label: '可用', value: stats.availableCount, icon: CircleSlash, color: 'text-emerald-500 bg-emerald-500/10' },
    { label: '已用完', value: stats.usedCount, icon: CheckCircle2, color: 'text-violet-500 bg-violet-500/10' },
    { label: '可用面额', value: `¥${stats.availableAmount.toFixed(2)}`, icon: Wallet, color: 'text-amber-500 bg-amber-500/10' }
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="卡密管理"
        count={stats.availableCount}
        countLabel="张可用卡密"
        actions={
          <>
            <Button size="sm" variant="outline" onClick={exportCards}><Download className="h-4 w-4" /> 导出</Button>
            <Button size="sm" onClick={openGenerate}><Plus className="h-4 w-4" /> 生成卡密</Button>
          </>
        }
      />

      {/* 统计卡片 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STAT_ITEMS.map(s => {
          const Icon = s.icon;
          return (
            <Card key={s.label} className="group transition-shadow hover:shadow-md">
              <CardContent className="flex items-center gap-3 p-4">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${s.color}`}>
                  <Icon className="h-5 w-5 transition-transform group-hover:scale-110" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className="text-xl font-semibold tabular-nums">{s.value}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* 卡密列表 */}
      <Card className="shadow-sm">
        <CardContent className="pt-6 space-y-4">
          {/* 筛选工具栏 */}
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="mr-auto text-lg font-semibold">卡密列表（共 {total} 张，第 {page}/{totalPages} 页）</h2>
            <div className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') doSearch(); }}
                className="h-8 pl-8"
              />
            </div>
            <Select value={statusFilter} onChange={e => { setPage(1); setStatusFilter(e.target.value); }} className="h-8 w-auto border-dashed">
              <option value="">全部状态</option>
              <option value="unused">可用</option>
              <option value="used">已用完</option>
            </Select>
            {(query || statusFilter) && (
              <Button variant="ghost" className="h-8 px-2 lg:px-3" onClick={() => { setKeyword(''); setQuery(''); setStatusFilter(''); setPage(1); }}>
                重置 <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>卡密</TableHead>
                <TableHead>面额</TableHead>
                <TableHead>使用次数</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>最近使用</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableSkeleton rows={5} cols={6} />}
              {!loading && cards.map(c => {
                const usedUp = isUsedUp(c);
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-xs">{c.code}</TableCell>
                    <TableCell className="tabular-nums">¥{Number(c.amount).toFixed(2)}</TableCell>
                    <TableCell className="tabular-nums">{c.used_count}/{c.max_uses}</TableCell>
                    <TableCell>{usedUp ? <Badge variant="secondary">已用完</Badge> : <Badge variant="success">可用</Badge>}</TableCell>
                    <TableCell className="text-muted-foreground">{fmtDate(c.used_at)}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-0.5">
                        <IconButton label="复制卡密" onClick={() => copyText(c.code, '卡密已复制')}><Copy className="h-4 w-4" /></IconButton>
                        {c.used_count === 0 && (
                          <IconButton variant="destructive" label="删除" onClick={() => remove(c)}><Trash2 className="h-4 w-4" /></IconButton>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {!loading && cards.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">没有符合条件的卡密</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {/* 分页 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">第 {page} / {totalPages} 页</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                  <ChevronLeft className="h-4 w-4" /> 上一页
                </Button>
                <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
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
