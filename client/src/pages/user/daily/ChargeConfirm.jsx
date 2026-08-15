import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { usePageTitle } from '@/hooks/use-site-config';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/PageHeader';

export default function ChargeConfirm() {
  usePageTitle('启用充电任务');
  const { accountId } = useParams();
  const navigate = useNavigate();

  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const back = () => navigate(`/daily-tasks/${accountId}`);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.get(`/api/user/account/${accountId}/daily-tasks`);
      const t = (d.tasks || []).find(x => x.task_key === 'charge');
      if (!t) {
        toast.error('未找到充电任务');
        navigate(`/daily-tasks/${accountId}`);
        return;
      }
      setTask(t);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [accountId, navigate]);

  useEffect(() => { load(); }, [load]);

  const confirmEnable = async () => {
    if (!task) return;
    setSubmitting(true);
    try {
      await api.post(`/api/user/account/${accountId}/daily-tasks`, {
        task_key: 'charge',
        enabled: 1,
        config: task.config
      });
      toast.success('充电任务已启用');
      navigate(`/daily-tasks/${accountId}`);
    } catch (e) {
      toast.error(e.message);
      setSubmitting(false);
    }
  };

  const battery = Math.max(10, parseInt(task?.config?.num ?? 50, 10) || 50);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="启用充电任务"
        subtitle="充电会真实消耗账号 B币，请确认后启用"
        onBack={back}
      />

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">确认信息</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-10 text-center text-sm text-muted-foreground">加载中...</p>
          ) : (
            <div className="space-y-4">
              <p className="rounded-md bg-amber-50/60 px-4 py-3 text-sm text-amber-700">
                充电会真实消耗账号 B币，每月自动执行一次。请确认下方信息无误后启用。
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-md border border-border/60 p-3">
                  <p className="text-xs text-muted-foreground">目标 UP 主</p>
                  <p className="mt-1 font-medium">{task?.config?.autoChargeUpId ?? '-'}</p>
                </div>
                <div className="rounded-md border border-border/60 p-3">
                  <p className="text-xs text-muted-foreground">充电数量与预计消耗</p>
                  <p className="mt-1 font-medium">{battery} 电池（{battery / 10} B币）</p>
                </div>
              </div>
              <div className="space-x-2">
                <Button onClick={confirmEnable} disabled={submitting}>
                  {submitting ? '启用中...' : '确认启用'}
                </Button>
                <Button variant="outline" onClick={back} disabled={submitting}>取消</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
