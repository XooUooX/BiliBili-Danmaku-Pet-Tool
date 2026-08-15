import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { usePageTitle } from '@/hooks/use-site-config';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CardSkeleton } from '@/components/ui/skeleton';
import { ListChecks } from 'lucide-react';
import TaskCard from './daily/TaskCard';
import { PageHeader } from '@/components/PageHeader';

export default function UserDailyTasks() {
  usePageTitle('日常任务');
  const { accountId } = useParams();
  const navigate = useNavigate();

  const [account, setAccount] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null); // `${task_key}:${action}`
  const runningTaskIds = useRef(new Set());

  const locked = !!account && account.active !== 1;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.get(`/api/user/account/${accountId}/daily-tasks`);
      setAccount(d.account || null);
      setTasks(d.tasks || []);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => { 
    load(); 
    // 定时刷新日常任务状态（每60秒）
    const timer = setInterval(load, 60000);
    return () => clearInterval(timer);
  }, [load]);

  // 保存任务，返回是否成功（供卡片内联表单收起判断）
  const saveTask = async (t, enabled, config) => {
    try {
      await api.post(`/api/user/account/${accountId}/daily-tasks`, {
        task_key: t.task_key,
        enabled,
        config: config != null ? config : t.config
      });
      toast.success('已保存');
      await load();
      return true;
    } catch (e) {
      toast.error(e.message);
      return false;
    }
  };

  const doToggle = async t => {
    setBusyId(`${t.task_key}:toggle`);
    await saveTask(t, t.enabled ? 0 : 1, t.config);
    setBusyId(null);
  };

  // 充电任务启用前二次确认（会消耗 B币）
  const toggleTask = t => {
    if (t.task_key === 'charge' && !t.enabled) { navigate(`/daily-tasks/${accountId}/charge-confirm`); return; }
    doToggle(t);
  };

  const runTask = async t => {
    if (!t.id) return toast.error('请先保存并启用该任务');
    if (runningTaskIds.current.has(t.id)) return;

    runningTaskIds.current.add(t.id);
    setBusyId(`${t.task_key}:run`);
    try {
      const d = await api.post(`/api/user/daily-tasks/${t.id}/run`);
      if (d.ok) toast.success('执行完成：' + (d.result || ''));
      else toast.error(d.message || '执行失败');
      await load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      runningTaskIds.current.delete(t.id);
      setBusyId(null);
    }
  };

  const openLogs = t => {
    if (!t.id) return toast.error('该任务暂无日志');
    navigate(`/daily-tasks/${accountId}/logs/${t.id}?label=${encodeURIComponent(t.label)}`);
  };

  const enabledCount = tasks.filter(t => t.enabled).length;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title={`日常任务${account ? ` · ${account.nickname || '账号'}` : ''}`}
        subtitle="查看每项任务的执行内容、当前配置、运行周期和详细日志"
        onBack={() => navigate('/dashboard')}
        actions={!loading && (
          <div className="flex items-center gap-2 rounded-lg border bg-card px-4 py-2 text-sm">
            <ListChecks className="h-4 w-4 text-primary" />
            <span className="font-medium">{enabledCount}</span>
            <span className="text-muted-foreground">/ {tasks.length} 已启用</span>
          </div>
        )}
      />

      {locked && (
        <Card className="border-amber-300/60 bg-amber-50/60">
          <CardContent className="py-3 text-sm text-amber-700">
            该账号未激活，请先购买时长套餐激活后再配置任务。
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><CardContent className="py-6"><CardSkeleton /></CardContent></Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {tasks.map(t => (
            <TaskCard
              key={t.task_key}
              task={t}
              locked={locked}
              busy={busyId && busyId.startsWith(`${t.task_key}:`) ? busyId.split(':')[1] : null}
              onToggle={toggleTask}
              onSave={saveTask}
              onRun={runTask}
              onLogs={openLogs}
            />
          ))}
        </div>
      )}
    </div>
  );
}
