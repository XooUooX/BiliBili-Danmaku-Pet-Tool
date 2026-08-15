import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useConfirm } from '@/hooks/use-confirm';
import { usePageTitle } from '@/hooks/use-site-config';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TableSkeleton } from '@/components/ui/skeleton';
import { Plus, Power, PowerOff, Trash2, RefreshCw, Pencil } from 'lucide-react';

export default function AdminLiveRooms() {
  usePageTitle('在线直播间');
  const { confirm } = useConfirm();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.get('/api/admin/live-rooms');
      setRooms(d.rooms || []);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    navigate('/admin/live-rooms/new');
  };

  const refresh = async r => {
    try {
      await api.post(`/api/admin/live-rooms/${r.id}/refresh`);
      toast.success('已刷新封面');
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const changeCategory = async (r, category) => {
    try {
      await api.post(`/api/admin/live-rooms/${r.id}/update`, { category, sort_order: r.sort_order });
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const openEdit = r => {
    navigate(`/admin/live-rooms/edit/${r.id}`);
  };

  const toggle = async r => {
    try {
      await api.post(`/api/admin/live-rooms/${r.id}/toggle`);
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const remove = async r => {
    if (!(await confirm({ title: '删除直播间', description: `确定删除房间 ${r.room_id}「${r.title || ''}」吗？` }))) return;
    try {
      await api.post(`/api/admin/live-rooms/${r.id}/delete`);
      toast.success('已删除');
      load();
    } catch (err) {
      // 若返回 warning 字段，说明有关联任务，需二次确认
      if (err.warning && err.taskCount) {
        const forceDelete = await confirm({
          title: '存在关联任务',
          description: `该直播间有 ${err.taskCount} 个任务使用，确认继续删除吗？（关联任务将被禁用）`,
          confirmText: '继续删除',
          variant: 'destructive'
        });
        if (forceDelete) {
          try {
            await api.post(`/api/admin/live-rooms/${r.id}/delete`, { force: true });
            toast.success(err.message || '已删除直播间并禁用关联任务');
            load();
          } catch (e) {
            toast.error(e.message);
          }
        }
      } else {
        toast.error(err.message);
      }
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="在线直播间"
        count={rooms.length}
        countLabel="个直播间"
        actions={<Button onClick={openCreate}><Plus className="mr-1 h-4 w-4" /> 添加直播间</Button>}
      />
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>直播间列表</CardTitle>
          <CardDescription>按分类维护直播间，添加时自动拉取封面与主播信息</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>封面</TableHead>
                <TableHead>房间号 / 标题</TableHead>
                <TableHead>主播</TableHead>
                <TableHead>分类</TableHead>
                <TableHead>排序</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableSkeleton rows={4} cols={7} />
              ) : rooms.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">暂无直播间</TableCell></TableRow>
              ) : rooms.map(r => (
                <TableRow key={r.id}>
                  <TableCell>
                    {r.cover
                      ? <img src={r.cover} alt="" referrerPolicy="no-referrer" className="h-12 w-20 rounded object-cover" />
                      : <div className="h-12 w-20 rounded bg-muted" />}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{r.room_id}</div>
                    <div className="max-w-[16rem] truncate text-xs text-muted-foreground">{r.title || '-'}</div>
                  </TableCell>
                  <TableCell>{r.uname || '-'}</TableCell>
                  <TableCell>
                    <Select value={r.category} className="h-8 w-32" onChange={e => changeCategory(r, e.target.value)}>
                      <option value="danchong">弹宠直播间</option>
                      <option value="maomao">猫猫直播间</option>
                    </Select>
                  </TableCell>
                  <TableCell>{r.sort_order}</TableCell>
                  <TableCell>
                    <Badge variant={r.enabled ? 'default' : 'secondary'}>{r.enabled ? '显示' : '隐藏'}</Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(r)} title="编辑"><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => refresh(r)} title="刷新封面"><RefreshCw className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => toggle(r)}>
                      {r.enabled ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(r)}><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
