import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Activity, CheckCircle2, XCircle, Percent, Search, RefreshCw,
  User, Clock, Hash, FileText
} from 'lucide-react';
import { api } from '@/lib/api';
import { usePageTitle } from '@/hooks/use-site-config';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import { TableSkeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/PageHeader';
import { TASK_META, fmtDate, nextRunText } from './taskMeta';

function isSuccess(log) {
  return Number(log.success) === 1;
}

function getAction(result = '') {
  const text = String(result);
  if (text.includes('汇总')) return '执行汇总';
  if (text.includes('候选视频') || text.includes('获取视频') || text.includes('视频来源')) return '视频来源';
  if (text.includes('观看')) return '观看视频';
  if (text.includes('投币')) return '投币';
  if (text.includes('点赞')) return '点赞';
  if (text.includes('充电')) return '充电';
  if (text.includes('B币券')) return 'B币券';
  if (text.includes('会员购')) return '会员购优惠券';
  if (text.includes('大积分') || text.includes('签到')) return '每日签到';
  return '系统记录';
}

function getActionClass(action) {
  const classes = {
    执行汇总: 'border-indigo-500/20 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300',
    视频来源: 'border-cyan-500/20 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300',
    观看视频: 'border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300',
    投币: 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300',
    点赞: 'border-pink-500/20 bg-pink-500/10 text-pink-700 dark:text-pink-300',
    充电: 'border-orange-500/20 bg-orange-500/10 text-orange-700 dark:text-orange-300',
    B币券: 'border-violet-500/20 bg-violet-500/10 text-violet-700 dark:text-violet-300',
    会员购优惠券: 'border-purple-500/20 bg-purple-500/10 text-purple-700 dark:text-purple-300',
    每日签到: 'border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300'
  };
  return classes[action] || 'border-border bg-muted/60 text-muted-foreground';
}

function getConfigItems(task) {
  if (!task) return [];
  const config = task.config || {};

  if (task.task_key === 'daily') {
    const upIds = String(config.supportUpIds || '')
      .split(/[,，]/)
      .map(item => item.trim())
      .filter(Boolean);
    return [
      `观看：${config.watch === false ? '关闭' : '开启（约 30 秒）'}`,
      `投币：每日目标 ${Math.max(0, Math.min(5, parseInt(config.numberOfCoins ?? 5, 10) || 0))} 枚`,
      `联动点赞：${config.selectLike === false ? '关闭' : '开启'}`,
      `视频来源：${upIds.length ? `指定 ${upIds.length} 位 UP 主` : 'B站排行榜'}`
    ];
  }

  if (task.task_key === 'charge') {
    const target = String(config.autoChargeUpId ?? '').trim();
    const battery = Math.max(10, parseInt(config.num ?? 50, 10) || 10);
    return [
      `充电目标：${!target || target === '-1' ? '当前账号自己' : `UID ${target}`}`,
      `充电数量：${battery} 电池`,
      `预计消耗：${battery / 10} B币`
    ];
  }

  if (task.task_key === 'vip_privilege') {
    return ['领取当月 B币券', '领取会员购优惠券', '两项权益分别记录执行结果'];
  }

  if (task.task_key === 'vip_big_point') {
    return ['大会员大积分每日签到', '每个自然日自动执行一次'];
  }

  return [];
}

function StatCard({ icon: Icon, label, value, detail, color }) {
  return (
    <Card className="shadow-sm">
      <CardContent className="flex items-center gap-4 p-4">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-0.5 text-2xl font-bold tracking-tight">{value}</p>
          {detail && <p className="mt-0.5 truncate text-xs text-muted-foreground">{detail}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function LogDetails({ result }) {
  const parts = String(result || '未返回详细信息')
    .split('｜')
    .map(part => part.trim())
    .filter(Boolean);

  return (
    <div className="min-w-[280px] space-y-1.5">
      <p className="font-medium leading-5 text-foreground">{parts[0]}</p>
      {parts.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {parts.slice(1).map((part, index) => (
            <span
              key={`${part}-${index}`}
              className="rounded-md border border-border/60 bg-muted/45 px-2 py-1 text-xs leading-4 text-muted-foreground"
            >
              {part}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function DailyTaskLogs() {
  usePageTitle('执行日志');
  const { accountId, taskId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [task, setTask] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [keyword, setKeyword] = useState('');

  const load = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    else setLoading(true);

    try {
      const data = await api.get(`/api/user/daily-tasks/${taskId}/logs`);
      setTask(data.task || null);
      setLogs(data.logs || []);
      if (showRefreshing) toast.success('日志已刷新');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [taskId]);

  useEffect(() => {
    load();
  }, [load]);

  const taskLabel = task?.label || searchParams.get('label') || '任务';
  const meta = TASK_META[task?.task_key] || {};
  const TaskIcon = meta.icon || FileText;
  const configItems = getConfigItems(task);

  const stats = useMemo(() => {
    const success = logs.filter(isSuccess).length;
    const failed = logs.length - success;
    const rate = logs.length ? Math.round((success / logs.length) * 100) : 0;
    return { total: logs.length, success, failed, rate };
  }, [logs]);

  const filteredLogs = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    return logs.filter(log => {
      const success = isSuccess(log);
      if (statusFilter === 'success' && !success) return false;
      if (statusFilter === 'failed' && success) return false;
      if (!normalizedKeyword) return true;

      const searchable = [
        log.id,
        log.code,
        log.result,
        getAction(log.result),
        fmtDate(log.created_at)
      ].join(' ').toLowerCase();
      return searchable.includes(normalizedKeyword);
    });
  }, [logs, statusFilter, keyword]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title={`${taskLabel} · 执行日志`}
        subtitle="展示最近 100 条记录，可查看每一步操作、接口码和具体执行结果"
        onBack={() => navigate(`/daily-tasks/${accountId}`)}
        actions={(
          <Button variant="outline" onClick={() => load(true)} disabled={loading || refreshing}>
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            刷新日志
          </Button>
        )}
      />

      <Card className="overflow-hidden shadow-sm">
        <CardContent className="p-0">
          <div className="flex flex-col gap-5 p-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${meta.ring || 'bg-muted'}`}>
                <TaskIcon className={`h-6 w-6 ${meta.accent || 'text-muted-foreground'}`} />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold">{taskLabel}</h2>
                  {task && (task.enabled
                    ? <Badge variant="success">正在启用</Badge>
                    : <Badge variant="secondary">已停用</Badge>)}
                  {meta.cycle && <Badge variant="outline">{meta.cycle}</Badge>}
                </div>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {meta.desc || '查看该任务的详细执行记录与接口返回信息。'}
                </p>
              </div>
            </div>

            <div className="grid shrink-0 gap-2 text-sm sm:grid-cols-3 lg:min-w-[520px]">
              <div className="rounded-lg border border-border/60 bg-muted/25 px-3 py-2.5">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><User className="h-3.5 w-3.5" />绑定账号</p>
                <p className="mt-1 truncate font-medium">{task?.account?.nickname || '加载中'}</p>
              </div>
              <div className="rounded-lg border border-border/60 bg-muted/25 px-3 py-2.5">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Hash className="h-3.5 w-3.5" />B站 UID</p>
                <p className="mt-1 truncate font-medium">{task?.account?.bili_uid || '—'}</p>
              </div>
              <div className="rounded-lg border border-border/60 bg-muted/25 px-3 py-2.5">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Clock className="h-3.5 w-3.5" />上次执行</p>
                <p className="mt-1 truncate font-medium">{task ? fmtDate(task.last_run_at) : '加载中'}</p>
              </div>
            </div>
          </div>

          {task && (
            <div className="border-t border-border/60 bg-muted/20 px-5 py-4">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
                <span><span className="font-medium text-foreground">调度状态：</span>{nextRunText(task.task_key, task.last_run_at, task.enabled)}</span>
                {configItems.map(item => (
                  <span key={item} className="rounded-md border border-border/60 bg-background/70 px-2.5 py-1.5">{item}</span>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Activity}
          label="日志总数"
          value={stats.total}
          detail="当前保留的最近执行记录"
          color="bg-sky-500/10 text-sky-600 dark:text-sky-400"
        />
        <StatCard
          icon={CheckCircle2}
          label="成功记录"
          value={stats.success}
          detail="接口调用或操作执行成功"
          color="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
        />
        <StatCard
          icon={XCircle}
          label="失败记录"
          value={stats.failed}
          detail="包含接口拒绝与执行异常"
          color="bg-red-500/10 text-red-600 dark:text-red-400"
        />
        <StatCard
          icon={Percent}
          label="记录成功率"
          value={`${stats.rate}%`}
          detail={stats.total ? `${stats.success} / ${stats.total} 条成功` : '暂无可统计记录'}
          color="bg-violet-500/10 text-violet-600 dark:text-violet-400"
        />
      </div>

      <Card className="shadow-sm">
        <CardHeader className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">详细执行记录</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                当前显示 {filteredLogs.length} 条，共 {logs.length} 条记录
              </p>
            </div>
          </div>

          <div className="grid gap-3 border-t border-border/60 pt-4 sm:grid-cols-[minmax(0,1fr)_180px]">
            <label className="space-y-1.5">
              <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Search className="h-3.5 w-3.5" />关键词搜索
              </span>
              <Input
                value={keyword}
                onChange={event => setKeyword(event.target.value)}
                aria-label="搜索日志关键词"
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">执行状态</span>
              <Select
                className="h-11 rounded-xl border-2 border-border/60 bg-background/50"
                value={statusFilter}
                onChange={event => setStatusFilter(event.target.value)}
                aria-label="筛选执行状态"
              >
                <option value="all">全部状态</option>
                <option value="success">仅看成功</option>
                <option value="failed">仅看失败</option>
              </Select>
            </label>
          </div>
        </CardHeader>
        <CardContent>
          {!loading && logs.length === 0 ? (
            <div className="py-14 text-center">
              <FileText className="mx-auto h-10 w-10 text-muted-foreground/40" />
              <p className="mt-3 text-sm font-medium">该任务还没有执行记录</p>
              <p className="mt-1 text-xs text-muted-foreground">启用任务或点击立即执行后，具体步骤会显示在这里。</p>
            </div>
          ) : !loading && filteredLogs.length === 0 ? (
            <div className="py-14 text-center">
              <Search className="mx-auto h-10 w-10 text-muted-foreground/40" />
              <p className="mt-3 text-sm font-medium">没有符合筛选条件的记录</p>
              <p className="mt-1 text-xs text-muted-foreground">请调整关键词或执行状态后再查看。</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border/60">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/35">
                    <TableHead className="w-24">日志 ID</TableHead>
                    <TableHead className="w-48">执行时间</TableHead>
                    <TableHead className="w-36">操作类型</TableHead>
                    <TableHead className="w-24">状态</TableHead>
                    <TableHead className="w-24">接口码</TableHead>
                    <TableHead>详细信息</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && <TableSkeleton rows={8} cols={6} />}
                  {!loading && filteredLogs.map(log => {
                    const action = getAction(log.result);
                    return (
                      <TableRow key={log.id} className="align-top">
                        <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                          #{log.id}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                          {fmtDate(log.created_at)}
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-medium ${getActionClass(action)}`}>
                            {action}
                          </span>
                        </TableCell>
                        <TableCell>
                          {isSuccess(log)
                            ? <Badge variant="success">成功</Badge>
                            : <Badge variant="destructive">失败</Badge>}
                        </TableCell>
                        <TableCell>
                          {log.code == null
                            ? <span className="text-sm text-muted-foreground">—</span>
                            : <code className="rounded-md bg-muted px-2 py-1 text-xs">{log.code}</code>}
                        </TableCell>
                        <TableCell className="text-sm">
                          <LogDetails result={log.result} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}