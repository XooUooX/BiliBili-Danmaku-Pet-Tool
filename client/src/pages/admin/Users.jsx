import { useEffect, useState, useCallback, useMemo } from 'react';
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
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Coins, KeyRound, Ban, CircleCheck, Trash2, Search, UserPlus, Pencil,
  ChevronLeft, ChevronRight, X
} from 'lucide-react';

function fmtDate(s) {
  if (!s) return '-';
  return new Date(s).toLocaleString('zh-CN', { hour12: false });
}

// 用户行组件
function UserRow({ user, isSelected, onToggleSelect, onEdit, onToggleStatus, onRemove }) {
  const isAdmin = user.is_admin === 1;
  return (
    <TableRow>
      <TableCell>
        {!isAdmin && (
          <input type="checkbox" className="h-4 w-4 accent-primary align-middle" checked={isSelected} onChange={onToggleSelect} />
        )}
      </TableCell>
      <TableCell>{user.id}</TableCell>
      <TableCell className="font-medium">{user.username}</TableCell>
      <TableCell className="text-muted-foreground">{user.email || '-'}</TableCell>
      <TableCell className="tabular-nums">¥{Number(user.balance).toFixed(2)}</TableCell>
      <TableCell>{isAdmin ? <Badge>管理员</Badge> : <Badge variant="secondary">用户</Badge>}</TableCell>
      <TableCell>{user.status === 1 ? <Badge variant="success">正常</Badge> : <Badge variant="destructive">封禁</Badge>}</TableCell>
      <TableCell className="text-muted-foreground">{fmtDate(user.created_at)}</TableCell>
      <TableCell className="text-right whitespace-nowrap">
        <div className="flex items-center justify-end gap-0.5">
          <IconButton label="编辑" onClick={() => onEdit(user)}><Pencil className="h-4 w-4" /></IconButton>
          {!isAdmin && (
            <>
              <IconButton label={user.status === 1 ? '封禁' : '解封'} onClick={() => onToggleStatus(user)}>
                {user.status === 1 ? <Ban className="h-4 w-4" /> : <CircleCheck className="h-4 w-4" />}
              </IconButton>
              <IconButton variant="destructive" label="删除" onClick={() => onRemove(user)}><Trash2 className="h-4 w-4" /></IconButton>
            </>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

// 筛选栏组件
function FilterBar({ keyword, setKeyword, status, setStatus, role, setRole, onSearch, onReset, hasFilters }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex flex-1 flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && onSearch()}
            className="h-8 pl-8"
          />
        </div>
        <Select value={status} onChange={e => setStatus(e.target.value)} className="h-8 w-auto border-dashed">
          <option value="">全部状态</option>
          <option value="1">正常</option>
          <option value="0">封禁</option>
        </Select>
        <Select value={role} onChange={e => setRole(e.target.value)} className="h-8 w-auto border-dashed">
          <option value="">全部角色</option>
          <option value="admin">管理员</option>
          <option value="user">普通用户</option>
        </Select>
        {hasFilters && (
          <Button variant="ghost" className="h-8 px-2 lg:px-3" onClick={onReset}>
            重置 <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

export default function AdminUsers() {
  usePageTitle('用户管理');
  const { confirm } = useConfirm();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // 筛选条件
  const [keyword, setKeyword] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [role, setRole] = useState('');

  // 多选
  const [selected, setSelected] = useState([]);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (query) params.set('keyword', query);
    if (status) params.set('status', status);
    if (role) params.set('role', role);
    const d = await api.get(`/api/admin/users?${params.toString()}`);
    setUsers(d.users || []);
    setTotal(d.total || 0);
    setSelected([]);
  }, [page, query, status, role]);

  useEffect(() => { load(); }, [load]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);

  const doSearch = useCallback(() => {
    setPage(1);
    setQuery(keyword.trim());
  }, [keyword]);

  const toggleStatus = useCallback(async u => {
    try {
      await api.post(`/api/admin/users/${u.id}/status`);
      toast.success(u.status === 1 ? '已封禁' : '已解封');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  }, [load]);

  const removeUser = useCallback(async u => {
    const ok = await confirm({
      title: '删除用户',
      description: `确认删除 ${u.username}？将同时清除其绑定账号、任务、订单与余额记录，操作不可恢复。`,
      confirmText: '删除',
      variant: 'destructive'
    });
    if (!ok) return;
    try {
      await api.post(`/api/admin/users/${u.id}/delete`);
      toast.success('已删除');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  }, [confirm, load]);

  const openCreate = useCallback(() => {
    navigate('/admin/users/new');
  }, [navigate]);

  const openEdit = useCallback(u => {
    navigate(`/admin/users/edit/${u.id}`);
  }, [navigate]);

  const selectableIds = users.filter(u => u.is_admin !== 1).map(u => u.id);
  const allSelected = selectableIds.length > 0 && selectableIds.every(id => selected.includes(id));
  const toggleAll = () => setSelected(allSelected ? [] : selectableIds);
  const toggleOne = id => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

  const batch = useCallback(async action => {
    const labels = { ban: '封禁', unban: '解封', delete: '删除' };
    const ok = await confirm({
      title: `批量${labels[action]}`,
      description: `确认对选中的 ${selected.length} 名用户执行${labels[action]}？${action === 'delete' ? '删除不可恢复。' : ''}`,
      confirmText: labels[action],
      variant: action === 'delete' ? 'destructive' : 'default'
    });
    if (!ok) return;
    try {
      await api.post('/api/admin/users/batch', { action, ids: selected });
      toast.success('操作完成');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  }, [confirm, selected, load]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="用户管理"
        count={total}
        countLabel="名用户"
        actions={<Button onClick={openCreate}><UserPlus className="h-4 w-4" /> 新建用户</Button>}
      />
      <Card className="shadow-sm">
        <CardContent className="pt-6 space-y-4">
          {/* 筛选栏 */}
          <FilterBar
            keyword={keyword}
            setKeyword={setKeyword}
            status={status}
            setStatus={s => { setPage(1); setStatus(s); }}
            role={role}
            setRole={r => { setPage(1); setRole(r); }}
            onSearch={doSearch}
            onReset={() => { setKeyword(''); setQuery(''); setStatus(''); setRole(''); setPage(1); }}
            hasFilters={query || status || role}
          />

          {/* 批量操作栏 */}
          {selected.length > 0 && (
            <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
              <span className="text-sm text-muted-foreground">已选 {selected.length} 项</span>
              <div className="ml-auto flex gap-2">
                <Button size="sm" variant="outline" onClick={() => batch('unban')}><CircleCheck className="h-4 w-4" /> 解封</Button>
                <Button size="sm" variant="outline" onClick={() => batch('ban')}><Ban className="h-4 w-4" /> 封禁</Button>
                <Button size="sm" variant="destructive" onClick={() => batch('delete')}><Trash2 className="h-4 w-4" /> 删除</Button>
              </div>
            </div>
          )}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <input type="checkbox" className="h-4 w-4 accent-primary align-middle" checked={allSelected} onChange={toggleAll} />
                </TableHead>
                <TableHead>ID</TableHead>
                <TableHead>用户名</TableHead>
                <TableHead>邮箱</TableHead>
                <TableHead>余额</TableHead>
                <TableHead>角色</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>注册时间</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map(u => (
                <UserRow
                  key={u.id}
                  user={u}
                  isSelected={selected.includes(u.id)}
                  onToggleSelect={() => toggleOne(u.id)}
                  onEdit={openEdit}
                  onToggleStatus={toggleStatus}
                  onRemove={removeUser}
                />
              ))}
              {users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="py-8 text-center text-sm text-muted-foreground">没有符合条件的用户</TableCell>
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
