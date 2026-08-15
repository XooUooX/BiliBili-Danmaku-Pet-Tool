import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { usePageTitle } from '@/hooks/use-site-config';
import { PageHeader } from '@/components/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react';

function fmtDate(s) {
  if (!s) return '-';
  return new Date(s).toLocaleString('zh-CN', { hour12: false });
}

function scheduleLabel(t) {
  if (t.schedule_type === 'daily') return '每天一次';
  if (t.schedule_type === 'random') return `${Math.round(t.interval_min / 60)}-${Math.round(t.interval_max / 60)}分钟`;
  return `${t.interval_seconds}s`;
}

const MODE_LABEL = { sequential: '顺序', random: '随机' };

export default function AdminTasks() {
  usePageTitle('任务管理');
  const [tasks, setTasks] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const pageSize = 20;

  const load = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (query) params.set('keyword', query);
    if (statusFilter) params.set('status', statusFilter);
    const d = await api.get(`/api/admin/tasks?${params.toString()}`);
    setTasks(d.tasks || []);
    setTotal(d.total || 0);
  }, [page, query, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const doSearch = () => { setQuery(keyword.trim()); setPage(1); };
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader title="任务管理" count={total} countLabel="条弹幕任务" />

      <Card className="shadow-sm">
        <CardContent className="pt-6 space-y-4">
          <div className="flex flex-col gap-4">
            {/* 筛选工具栏 */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={keyword}
                  onChange={e => setKeyword(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') doSearch(); }}
                  className="h-10 pl-10 rounded-lg"
                />
              </div>
              <Select value={statusFilter} onChange={e => { setPage(1); setStatusFilter(e.target.value); }} className="h-10 w-32 border-dashed rounded-lg">
                <option value="">全部状态</option>
                <option value="1">运行中</option>
                <option value="0">已停用</option>
              </Select>
              {(query || statusFilter) && (
                <Button variant="ghost" size="sm" className="h-10 gap-2 hover:bg-red-500/10 hover:text-red-600" onClick={() => { setKeyword(''); setQuery(''); setStatusFilter(''); setPage(1); }}>
                  <X className="h-4 w-4" /> 重置
                </Button>
              )}
            </div>
          </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>用户</TableHead>
              <TableHead>B站账号</TableHead>
              <TableHead>房间号</TableHead>
              <TableHead>调度</TableHead>
              <TableHead>模式</TableHead>
              <TableHead>弹幕内容</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>最后执行</TableHead>
              <TableHead>成功率</TableHead>
              <TableHead>创建时间</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.map(t => {
              const successRate = t.total_logs > 0 ? Math.round((t.success_count / t.total_logs) * 100) : '-';
              return (
              <TableRow key={t.id}>
                <TableCell>{t.username}</TableCell>
                <TableCell>
                  <div className="text-sm">{t.nickname || '未知'}</div>
                  <div className="font-mono text-xs text-muted-foreground">UID {t.bili_uid || '-'}</div>
                </TableCell>
                <TableCell className="font-mono text-xs">{t.room_id}</TableCell>
                <TableCell>{scheduleLabel(t)}</TableCell>
                <TableCell>{MODE_LABEL[t.mode] || t.mode}</TableCell>
                <TableCell className="max-w-xs truncate text-xs text-muted-foreground" title={t.messages}>
                  {(t.messages || '').split('\n').join(' / ')}
                </TableCell>
                <TableCell>
                  {t.enabled ? <Badge variant="success">运行中</Badge> : <Badge variant="secondary">已停用</Badge>}
                </TableCell>
                <TableCell className="text-xs">
                  <div>{t.last_run_at ? fmtDate(t.last_run_at) : '-'}</div>
                  {t.last_error && <div className="text-red-600 truncate" title={t.last_error}>{t.last_error}</div>}
                </TableCell>
                <TableCell className="text-xs">
                  {successRate === '-' ? '-' : (
                    <span className={successRate === 100 ? 'text-green-600' : 'text-orange-600'}>
                      {successRate}% ({t.success_count}/{t.total_logs})
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">{fmtDate(t.created_at)}</TableCell>
              </TableRow>
            );
            })}
            {tasks.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} className="py-10 text-center text-muted-foreground">暂无任务</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4">
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
