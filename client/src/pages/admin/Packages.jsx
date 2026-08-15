import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useConfirm } from '@/hooks/use-confirm';
import { usePageTitle } from '@/hooks/use-site-config';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TableSkeleton } from '@/components/ui/skeleton';
import { Plus, Power, PowerOff, Trash2, Pencil } from 'lucide-react';

export default function AdminPackages() {
  usePageTitle('时长套餐');
  const { confirm } = useConfirm();
  const navigate = useNavigate();
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.get('/api/admin/packages');
      setPackages(d.packages || []);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    navigate('/admin/packages/new');
  };

  const openEdit = p => {
    navigate(`/admin/packages/edit/${p.id}`);
  };

  const toggle = async p => {
    try {
      await api.post(`/api/admin/packages/${p.id}/toggle`);
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const remove = async p => {
    if (!(await confirm({ title: '删除套餐', description: `确定删除「${p.name}」吗？` }))) return;
    try {
      await api.post(`/api/admin/packages/${p.id}/delete`);
      toast.success('已删除');
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="时长套餐"
        count={packages.length}
        countLabel="个套餐"
        actions={<Button onClick={openCreate}><Plus className="mr-1 h-4 w-4" /> 新建套餐</Button>}
      />
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>配置套餐</CardTitle>
          <CardDescription>配置用户可购买的时长套餐与价格</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>名称</TableHead>
                <TableHead>时长</TableHead>
                <TableHead>价格</TableHead>
                <TableHead>排序</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableSkeleton rows={4} cols={6} />
              ) : packages.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">暂无套餐</TableCell></TableRow>
              ) : packages.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>{p.days} 天</TableCell>
                  <TableCell>¥{Number(p.price).toFixed(2)}</TableCell>
                  <TableCell>{p.sort_order}</TableCell>
                  <TableCell>
                    <Badge variant={p.enabled ? 'default' : 'secondary'}>{p.enabled ? '已上架' : '已下架'}</Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => toggle(p)}>
                      {p.enabled ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(p)}><Trash2 className="h-4 w-4" /></Button>
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
