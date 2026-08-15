import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useConfirm } from '@/hooks/use-confirm';
import { usePageTitle } from '@/hooks/use-site-config';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TableSkeleton } from '@/components/ui/skeleton';
import { Plus, Power, PowerOff, Trash2, Pencil } from 'lucide-react';

function scheduleLabel(t) {
  if (t.schedule_type === 'daily') return '每天一次';
  if (t.schedule_type === 'random') return `${Math.round(t.interval_min / 60)}-${Math.round(t.interval_max / 60)}分钟`;
  return `${t.interval_seconds}s`;
}

export default function AdminTemplates() {
  usePageTitle('任务模板');
  const { confirm } = useConfirm();
  const navigate = useNavigate();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.get('/api/admin/templates');
      setTemplates(d.templates || []);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    navigate('/admin/templates/new');
  };

  const openEdit = t => {
    navigate(`/admin/templates/edit/${t.id}`);
  };

  const toggle = async t => {
    await api.post(`/api/admin/templates/${t.id}/toggle`);
    load();
  };

  const remove = async t => {
    const ok = await confirm({
      title: '删除模板',
      description: `确认删除「${t.label}」？已使用该模板的用户任务不受影响。`,
      confirmText: '删除',
      variant: 'destructive'
    });
    if (!ok) return;
    await api.post(`/api/admin/templates/${t.id}/delete`);
    load();
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="任务模板"
        count={templates.length}
        countLabel="个模板"
        actions={<Button onClick={openCreate}><Plus className="h-4 w-4" /> 新建模板</Button>}
      />
      <Card className="shadow-sm">
        <CardContent className="pt-6">
          {!loading && templates.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">暂无模板</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>分组</TableHead>
                  <TableHead>名称</TableHead>
                  <TableHead>标识</TableHead>
                  <TableHead>调度</TableHead>
                  <TableHead>模式</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && <TableSkeleton rows={5} cols={7} />}
                {!loading && templates.map(t => (
                  <TableRow key={t.id}>
                    <TableCell>{t.group_name}</TableCell>
                    <TableCell className="font-medium">{t.label}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{t.preset_key}</TableCell>
                    <TableCell>{scheduleLabel(t)}</TableCell>
                    <TableCell>{t.mode === 'random' ? '随机' : '顺序'}</TableCell>
                    <TableCell>
                      {t.enabled ? <Badge variant="success">启用</Badge> : <Badge variant="secondary">停用</Badge>}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-0.5">
                        <IconButton label="编辑" onClick={() => openEdit(t)}><Pencil className="h-4 w-4" /></IconButton>
                        <IconButton label={t.enabled ? '停用' : '启用'} onClick={() => toggle(t)}>
                          {t.enabled ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                        </IconButton>
                        <IconButton variant="destructive" label="删除" onClick={() => remove(t)}><Trash2 className="h-4 w-4" /></IconButton>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
