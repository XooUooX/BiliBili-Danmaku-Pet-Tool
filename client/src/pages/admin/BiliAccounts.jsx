import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { usePageTitle } from '@/hooks/use-site-config';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { CardSkeleton } from '@/components/ui/skeleton';
import { UserSearch, ChevronLeft, ChevronRight, Search, X } from 'lucide-react';

function fmtDate(s) {
  if (!s) return '-';
  const d = new Date(s);
  if (isNaN(d)) return s;
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function expireInfo(s) {
  if (!s) return { label: '永久', expired: false };
  const d = new Date(s);
  const expired = d.getTime() < Date.now();
  return { label: fmtDate(s), expired };
}

export default function AdminBiliAccounts() {
  usePageTitle('B站账号管理');
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  
  const [keyword, setKeyword] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (query) params.set('keyword', query);
      if (statusFilter) params.set('status', statusFilter);
      const d = await api.get(`/api/admin/bili-accounts?${params.toString()}`);
      setAccounts(d.accounts || []);
      setTotal(d.total || 0);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [page, query, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const doSearch = () => { setQuery(keyword.trim()); setPage(1); };
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  if (loading) {
    return <div className="space-y-4"><CardSkeleton /><CardSkeleton /></div>;
  }
  
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader title="B站账号管理" count={total} countLabel="个账号" />

      <Card className="shadow-sm">
        <CardContent className="pt-6 space-y-4">
          {/* 筛选工具栏 */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && doSearch()}
                className="h-10 pl-10 rounded-lg"
              />
            </div>
            <Button onClick={doSearch} className="h-10 gap-2" size="sm">
              <Search className="h-4 w-4" /> 搜索
            </Button>
            <Select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} className="h-10 w-32 border-dashed rounded-lg">
              <option value="">全部状态</option>
              <option value="active">生效中</option>
              <option value="expired">已过期</option>
            </Select>
            {(query || statusFilter) && (
              <Button variant="ghost" size="sm" className="h-10 gap-2 hover:bg-red-500/10 hover:text-red-600" onClick={() => { setKeyword(''); setQuery(''); setStatusFilter(''); setPage(1); }}>
                <X className="h-4 w-4" /> 重置
              </Button>
            )}
          </div>

          {accounts.length === 0 ? (
            <div className="py-12 text-center">
              <UserSearch className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
              <p className="text-sm text-muted-foreground">暂无数据</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/60">
                    <TableHead className="font-bold">B站账号</TableHead>
                    <TableHead className="font-bold">UID</TableHead>
                    <TableHead className="font-bold">所属用户</TableHead>
                    <TableHead className="font-bold">状态</TableHead>
                    <TableHead className="font-bold">到期时间</TableHead>
                    <TableHead className="font-bold">绑定时间</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accounts.map(a => {
                    const exp = expireInfo(a.expire_at);
                    return (
                      <TableRow key={a.id} className="transition-colors hover:bg-muted/40">
                        <TableCell className="flex items-center gap-3">
                          {a.avatar && (
                            <img src={a.avatar} alt="avatar" className="h-9 w-9 rounded-lg object-cover ring-2 ring-border/50" referrerPolicy="no-referrer" />
                          )}
                          <span className="font-semibold">{a.nickname || '-'}</span>
                        </TableCell>
                        <TableCell className="font-mono text-sm text-muted-foreground">{a.bili_uid}</TableCell>
                        <TableCell className="flex items-center gap-2">
                          {a.user_avatar && (
                            <img src={a.user_avatar} alt="user" className="h-7 w-7 rounded-full ring-2 ring-border/50" referrerPolicy="no-referrer" />
                          )}
                          <span className="font-medium">{a.username}</span>
                        </TableCell>
                        <TableCell>
                          {a.active ? (
                            exp.expired ? (
                              <Badge variant="destructive" className="font-semibold">已过期</Badge>
                            ) : (
                              <Badge className="bg-emerald-500 font-semibold">生效中</Badge>
                            )
                          ) : (
                            <Badge variant="secondary" className="font-semibold">未激活</Badge>
                          )}
                        </TableCell>
                        <TableCell className={`text-sm font-medium ${exp.expired && a.active ? 'text-red-600' : 'text-muted-foreground'}`}>
                          {exp.label}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{fmtDate(a.created_at)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="gap-2"
          >
            <ChevronLeft className="h-4 w-4" /> 上一页
          </Button>
          <span className="text-sm text-muted-foreground font-semibold">
            第 {page} / {totalPages} 页
          </span>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="gap-2"
          >
            下一页 <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
