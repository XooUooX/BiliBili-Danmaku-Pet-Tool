import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  AlertCircle, Cat, CheckCircle2, Clock, Hash, ListChecks, MessageSquareText,
  Pencil, Plus, Power, PowerOff, Radio, RefreshCw, ScrollText, Shuffle,
  Timer, Trash2
} from 'lucide-react';
import { api } from '@/lib/api';
import { useConfirm } from '@/hooks/use-confirm';
import { usePageTitle } from '@/hooks/use-site-config';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/PageHeader';

function formatDuration(value) {
  const seconds = Math.max(0, Number(value) || 0);
  if (seconds > 0 && seconds % 3600 === 0) return `${seconds / 3600} 小时`;
  if (seconds >= 60 && seconds % 60 === 0) return `${seconds / 60} 分钟`;
  return `${seconds} 秒`;
}

function scheduleLabel(task) {
  if (task.schedule_type === 'daily') return '每天一次';
  if (task.schedule_type === 'random') {
    return `${formatDuration(task.interval_min)} – ${formatDuration(task.interval_max)}`;
  }
  return `每 ${formatDuration(task.interval_seconds)}`;
}

function formatRelativeTime(value) {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return '时间未知';

  const diffMins = Math.max(0, Math.floor((Date.now() - time) / 60000));
  if (diffMins < 5) return '刚刚';
  if (diffMins < 60) return `${diffMins} 分钟前`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} 小时前`;
  return `${Math.floor(diffHours / 24)} 天前`;
}

function getTaskStatus(task) {
  if (Number(task.enabled) !== 1) {
    return { status: 'disabled', label: '已停用', color: 'secondary', icon: PowerOff };
  }
  if (!task.last_run_at) {
    return { status: 'pending', label: '等待首次执行', color: 'info', icon: Clock };
  }

  const relativeTime = formatRelativeTime(task.last_run_at);
  if (task.last_error) {
    return {
      status: 'error',
      label: `执行失败 · ${relativeTime}`,
      color: 'destructive',
      icon: AlertCircle,
      detail: task.last_error
    };
  }

  return {
    status: 'success',
    label: `运行正常 · ${relativeTime}`,
    color: 'success',
    icon: CheckCircle2
  };
}

function getMessageCount(task) {
  return String(task.messages || '')
    .split('\n')
    .map(item => item.trim())
    .filter(Boolean).length;
}

function getTemplateLabel(task, presetMap) {
  return task.preset && presetMap[task.preset]
    ? presetMap[task.preset].label
    : '自定义任务';
}

function StatCard({ icon: Icon, label, value, detail, color }) {
  return (
    <Card className="shadow-sm hover:shadow-md">
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-0.5 text-2xl font-bold tracking-tight">{value}</p>
          <p className="truncate text-xs text-muted-foreground">{detail}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function TaskCard({ task, presetMap, busy, onLogs, onEdit, onToggle, onDelete }) {
  const taskStatus = getTaskStatus(task);
  const StatusIcon = taskStatus.icon;
  const messageCount = getMessageCount(task);

  return (
    <Card className={`group overflow-hidden shadow-sm hover:-translate-y-0.5 hover:shadow-lg ${
      taskStatus.status === 'error' ? 'border-destructive/35' : ''
    }`}>
      <CardHeader className="space-y-4 p-5 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Radio className="h-3.5 w-3.5 text-sky-500" />
              目标直播间
            </div>
            <CardTitle className="mt-1.5 flex items-center gap-2 text-lg">
              <span className="truncate">{getTemplateLabel(task, presetMap)}</span>
            </CardTitle>
          </div>
          <Badge variant={taskStatus.color} className="shrink-0 whitespace-nowrap">
            <StatusIcon className="mr-1 h-3 w-3" />
            {taskStatus.label}
          </Badge>
        </div>

        <button
          type="button"
          onClick={() => onLogs(task)}
          className="group/room flex w-full items-center justify-between rounded-xl border border-border/60 bg-muted/35 px-4 py-3 text-left transition-colors hover:border-primary/30 hover:bg-primary/[0.04]"
        >
          <span className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-300">
              <Hash className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-xs text-muted-foreground">房间号</span>
              <span className="block truncate font-mono text-base font-semibold">{task.room_id}</span>
            </span>
          </span>
          <ScrollText className="h-4 w-4 text-muted-foreground transition-transform group-hover/room:translate-x-0.5 group-hover/room:text-primary" />
        </button>
      </CardHeader>

      <CardContent className="space-y-4 p-5 pt-0">
        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-xl bg-muted/40 p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Timer className="h-3.5 w-3.5" />发送间隔
            </div>
            <p className="mt-1.5 truncate text-sm font-semibold" title={scheduleLabel(task)}>
              {scheduleLabel(task)}
            </p>
          </div>
          <div className="rounded-xl bg-muted/40 p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Shuffle className="h-3.5 w-3.5" />发送模式
            </div>
            <p className="mt-1.5 text-sm font-semibold">
              {task.mode === 'random' ? '随机选取' : '顺序循环'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 px-2.5 py-1.5">
            <MessageSquareText className="h-3.5 w-3.5" />
            {messageCount} 条内容
          </span>
          {task.auto_switch_room ? (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-sky-500/20 bg-sky-500/10 px-2.5 py-1.5 text-sky-700 dark:text-sky-300">
              <Radio className="h-3.5 w-3.5" />自动切换房间
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 px-2.5 py-1.5">
              <Radio className="h-3.5 w-3.5" />固定房间
            </span>
          )}
        </div>

        {taskStatus.detail && (
          <div className="flex gap-2 rounded-xl border border-destructive/20 bg-destructive/[0.05] p-3 text-xs text-destructive">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <p className="line-clamp-2 break-all leading-5" title={taskStatus.detail}>{taskStatus.detail}</p>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-4">
          <Button variant="secondary" size="sm" onClick={() => onLogs(task)}>
            <ScrollText />执行日志
          </Button>
          <div className="flex items-center gap-0.5">
            <IconButton label="编辑任务" onClick={() => onEdit(task)} disabled={busy}>
              <Pencil />
            </IconButton>
            <IconButton
              variant="primary"
              label={Number(task.enabled) === 1 ? '停用任务' : '启用任务'}
              onClick={() => onToggle(task)}
              disabled={busy}
            >
              {busy ? <RefreshCw className="animate-spin" /> : Number(task.enabled) === 1 ? <PowerOff /> : <Power />}
            </IconButton>
            <IconButton variant="destructive" label="删除任务" onClick={() => onDelete(task)} disabled={busy}>
              <Trash2 />
            </IconButton>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TaskGridSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {Array.from({ length: 4 }).map((_, index) => (
        <Card key={index} className="shadow-sm">
          <CardContent className="space-y-4 p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-6 w-40" />
              </div>
              <Skeleton className="h-6 w-24" />
            </div>
            <Skeleton className="h-16 w-full rounded-xl" />
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-16 rounded-xl" />
              <Skeleton className="h-16 rounded-xl" />
            </div>
            <Skeleton className="h-9 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function UserTasks() {
  usePageTitle('弹宠任务');
  const { accountId } = useParams();
  const navigate = useNavigate();
  const { confirm } = useConfirm();

  const [account, setAccount] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyTaskId, setBusyTaskId] = useState(null);

  const load = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    else setRefreshing(true);

    try {
      const data = await api.get(`/api/user/account/${accountId}/tasks`);
      setAccount(data.account || null);
      setTasks(data.tasks || []);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [accountId]);

  useEffect(() => {
    load(true);
    const timer = setInterval(() => load(false), 30000);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    api.get('/api/user/templates')
      .then(data => setTemplates(data.templates || []))
      .catch(() => {});
  }, []);

  const presetMap = useMemo(
    () => Object.fromEntries(templates.map(template => [template.preset_key, template])),
    [templates]
  );

  const stats = useMemo(() => {
    const enabled = tasks.filter(task => Number(task.enabled) === 1);
    return {
      total: tasks.length,
      enabled: enabled.length,
      disabled: tasks.length - enabled.length,
      errors: enabled.filter(task => task.last_error).length
    };
  }, [tasks]);

  const openCreate = useCallback(() => {
    if (account && Number(account.active) !== 1) {
      toast.error('账号未激活，请先购买时长激活');
      navigate(`/recharge?account=${accountId}`);
      return;
    }
    navigate(`/tasks/${accountId}/new`);
  }, [account, accountId, navigate]);

  const editTask = useCallback(task => {
    navigate(`/tasks/${accountId}/edit/${task.id}`);
  }, [accountId, navigate]);

  const toggleTask = useCallback(async task => {
    setBusyTaskId(task.id);
    try {
      await api.post(`/api/user/tasks/${task.id}/toggle`);
      toast.success(Number(task.enabled) === 1 ? '任务已停用' : '任务已启用');
      await load(false);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusyTaskId(null);
    }
  }, [load]);

  const delTask = useCallback(async task => {
    const templateName = getTemplateLabel(task, presetMap);
    const ok = await confirm({
      title: '删除弹宠任务',
      description: `确认删除“${templateName}”（房间 ${task.room_id}）？删除后无法恢复。`,
      confirmText: '删除',
      variant: 'destructive'
    });
    if (!ok) return;

    setBusyTaskId(task.id);
    try {
      await api.post(`/api/user/tasks/${task.id}/delete`);
      toast.success('任务已删除');
      await load(false);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusyTaskId(null);
    }
  }, [confirm, load, presetMap]);

  const openLogs = useCallback(task => {
    navigate(`/tasks/${accountId}/logs/${task.id}?room=${encodeURIComponent(task.room_id)}`);
  }, [accountId, navigate]);

  const accountInactive = account && Number(account.active) !== 1;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title={`弹宠任务${account ? ` · ${account.nickname || '账号'}` : ''}`}
        subtitle="集中管理直播间、发送内容与执行状态，任务状态每 30 秒自动更新。"
        onBack={() => navigate('/dashboard')}
        actions={(
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => load(false)}
              disabled={loading || refreshing}
              aria-label="刷新任务状态"
            >
              <RefreshCw className={refreshing ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">刷新状态</span>
            </Button>
            {accountInactive ? (
              <Button onClick={() => navigate(`/recharge?account=${accountId}`)}>
                <Plus />去激活
              </Button>
            ) : (
              <Button onClick={openCreate}><Plus />新建任务</Button>
            )}
          </>
        )}
      />

      {accountInactive && (
        <div className="flex flex-col gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/[0.07] p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="font-semibold text-amber-800 dark:text-amber-300">该账号尚未激活</p>
              <p className="mt-0.5 text-amber-700/80 dark:text-amber-300/70">现有任务会保留，购买时长激活后即可继续添加和运行任务。</p>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={() => navigate(`/recharge?account=${accountId}`)}>
            查看时长套餐
          </Button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={ListChecks}
          label="全部任务"
          value={stats.total}
          detail="当前账号下的任务"
          color="bg-primary/10 text-primary"
        />
        <StatCard
          icon={Power}
          label="正在运行"
          value={stats.enabled}
          detail={stats.enabled ? '任务已启用' : '暂无启用任务'}
          color="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
        />
        <StatCard
          icon={PowerOff}
          label="已停用"
          value={stats.disabled}
          detail="可随时重新启用"
          color="bg-slate-500/10 text-slate-600 dark:text-slate-300"
        />
        <StatCard
          icon={AlertCircle}
          label="执行异常"
          value={stats.errors}
          detail={stats.errors ? '建议查看执行日志' : '当前没有异常'}
          color={stats.errors
            ? 'bg-destructive/10 text-destructive'
            : 'bg-sky-500/10 text-sky-600 dark:text-sky-300'}
        />
      </div>

      <section className="space-y-4" aria-labelledby="task-list-title">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="task-list-title" className="text-lg font-bold tracking-tight">任务列表</h2>
            <p className="mt-1 text-sm text-muted-foreground">点击房间信息或“执行日志”，查看每次弹幕发送结果。</p>
          </div>
          {!loading && tasks.length > 0 && (
            <Badge variant="outline" className="font-normal">共 {tasks.length} 个任务</Badge>
          )}
        </div>

        {loading ? (
          <TaskGridSkeleton />
        ) : tasks.length === 0 ? (
          <Card className="border-dashed shadow-sm">
            <CardContent className="flex flex-col items-center px-6 py-14 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Cat className="h-7 w-7" />
              </div>
              <h3 className="mt-4 text-base font-semibold">还没有弹宠任务</h3>
              <p className="mt-1 max-w-md text-sm leading-6 text-muted-foreground">
                创建任务并选择直播间、弹幕模板和发送间隔，系统会自动完成弹宠互动。
              </p>
              {accountInactive ? (
                <Button className="mt-5" onClick={() => navigate(`/recharge?account=${accountId}`)}>
                  <Plus />先激活账号
                </Button>
              ) : (
                <Button className="mt-5" onClick={openCreate}>
                  <Plus />创建第一个任务
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {tasks.map(task => (
              <TaskCard
                key={task.id}
                task={task}
                presetMap={presetMap}
                busy={busyTaskId === task.id}
                onLogs={openLogs}
                onEdit={editTask}
                onToggle={toggleTask}
                onDelete={delTask}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

