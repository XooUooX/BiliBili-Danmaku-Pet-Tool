import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Activity, Cat, CheckCircle2, Clock, FileText, Hash, MessageSquareText,
  Percent, Radio, RefreshCw, Search, Shuffle, User, XCircle
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

function fmtDate(value, emptyText = '从未执行') {
  if (!value) return emptyText;
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
}

function isSuccess(log) {
  return Number(log.success) === 1;
}

function getScheduleText(task) {
  if (!task) return '加载中';
  if (task.schedule_type === 'daily') return '每 24 小时发送一次';
  if (task.schedule_type === 'random') {
    return `随机间隔 ${task.interval_min || 300}–${task.interval_max || 600} 秒`;
  }
  return `固定间隔 ${task.interval_seconds || 60} 秒`;
}

function getModeText(task) {
  return task?.mode === 'random' ? '随机选取内容' : '按顺序循环发送';
}

function getCategoryText(category) {
  const labels = { maomao: '猫猫任务房间', danchong: '弹宠任务房间' };
  return labels[category] || category || '未指定分类';
}

function getMessageCount(task) {
  return String(task?.messages || '')
    .split('\n')
    .map(item => item.trim())
    .filter(Boolean).length;
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
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{detail}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function LogDetails({ result }) {
  const parts = String(result || '接口未返回详细信息')
    .split('｜')
    .map(part => part.trim())
    .filter(Boolean);

  return (
    <div className="min-w-[320px] space-y-1.5">
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

export default function TaskLogs() {
  usePageTitle('弹宠任务执行日志');
  const { accountId, taskId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [task, setTask] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [roomFilter, setRoomFilter] = useState('all');
  const [keyword, setKeyword] = useState('');

  const load = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    else setLoading(true);

    try {
      const data = await api.get(`/api/user/tasks/${taskId}/logs`);
      setTask(data.task || null);
      setLogs(data.logs || []);
      if (showRefreshing) toast.success('执行日志已刷新');
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

  const rooms = useMemo(
    () => [...new Set(logs.map(log => String(log.room_id || '')).filter(Boolean))],
    [logs]
  );

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
      if (roomFilter !== 'all' && String(log.room_id) !== roomFilter) return false;
      if (!normalizedKeyword) return true;

      const searchable = [
        log.id,
        log.room_id,
        log.message,
        log.code,
        log.result,
        fmtDate(log.created_at, '')
      ].join(' ').toLowerCase();
      return searchable.includes(normalizedKeyword);
    });
  }, [logs, statusFilter, roomFilter, keyword]);

  const fallbackRoomId = searchParams.get('room') || '';
  const currentRoomId = task?.room_id || fallbackRoomId || '—';
  const latestLog = logs[0] || null;
  const messageCount = getMessageCount(task);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="弹宠任务 · 执行日志"
        subtitle="查看弹幕发送内容、目标直播间、调度方式、接口返回码和具体失败原因"
        onBack={() => navigate(`/tasks/${accountId}`)}
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
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-pink-500/10 text-pink-600 dark:text-pink-400">
                <Cat className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold">
                    {task?.preset_label || (task?.preset ? task.preset : '自定义弹宠任务')}
                  </h2>
                  {task && (task.enabled
                    ? <Badge variant="success">任务已启用</Badge>
                    : <Badge variant="secondary">任务已停用</Badge>)}
                  {task?.account && (task.account.active
                    ? <Badge variant="info">账号服务正常</Badge>
                    : <Badge variant="warning">账号未激活</Badge>)}
                </div>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  当前向直播间 {currentRoomId} 发送弹宠互动内容，共配置 {messageCount} 条弹幕。
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
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Clock className="h-3.5 w-3.5" />最近执行</p>
                <p className="mt-1 truncate font-medium">{fmtDate(latestLog?.created_at)}</p>
              </div>
            </div>
          </div>

          {task && (
            <div className="border-t border-border/60 bg-muted/20 px-5 py-4">
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-background/70 px-2.5 py-1.5">
                  <Radio className="h-3.5 w-3.5" />当前房间：{task.room_id}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-background/70 px-2.5 py-1.5">
                  <Clock className="h-3.5 w-3.5" />{getScheduleText(task)}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-background/70 px-2.5 py-1.5">
                  <Shuffle className="h-3.5 w-3.5" />{getModeText(task)}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-background/70 px-2.5 py-1.5">
                  <MessageSquareText className="h-3.5 w-3.5" />弹幕内容：{messageCount} 条
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-background/70 px-2.5 py-1.5">
                  自动切换：{task.auto_switch_room ? `开启（${getCategoryText(task.room_category)}）` : '关闭'}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Activity}
          label="发送记录"
          value={stats.total}
          detail="当前加载的最近 100 条记录"
          color="bg-sky-500/10 text-sky-600 dark:text-sky-400"
        />
        <StatCard
          icon={CheckCircle2}
          label="发送成功"
          value={stats.success}
          detail="B站接口确认发送成功"
          color="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
        />
        <StatCard
          icon={XCircle}
          label="发送失败"
          value={stats.failed}
          detail="包含接口拒绝和请求异常"
          color="bg-red-500/10 text-red-600 dark:text-red-400"
        />
        <StatCard
          icon={Percent}
          label="发送成功率"
          value={`${stats.rate}%`}
          detail={stats.total ? `${stats.success} / ${stats.total} 条成功` : '暂无可统计记录'}
          color="bg-violet-500/10 text-violet-600 dark:text-violet-400"
        />
      </div>

      <Card className="shadow-sm">
        <CardHeader className="space-y-4">
          <div>
            <CardTitle className="text-base">详细发送记录</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              当前显示 {filteredLogs.length} 条，共 {logs.length} 条记录
            </p>
          </div>

          <div className="grid gap-3 border-t border-border/60 pt-4 md:grid-cols-[minmax(0,1fr)_180px_180px]">
            <label className="space-y-1.5">
              <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Search className="h-3.5 w-3.5" />关键词搜索
              </span>
              <Input
                value={keyword}
                onChange={event => setKeyword(event.target.value)}
                aria-label="搜索弹幕内容、房间号或返回信息"
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">发送状态</span>
              <Select
                className="h-11 rounded-xl border-2 border-border/60 bg-background/50"
                value={statusFilter}
                onChange={event => setStatusFilter(event.target.value)}
                aria-label="筛选发送状态"
              >
                <option value="all">全部状态</option>
                <option value="success">仅看成功</option>
                <option value="failed">仅看失败</option>
              </Select>
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">目标直播间</span>
              <Select
                className="h-11 rounded-xl border-2 border-border/60 bg-background/50"
                value={roomFilter}
                onChange={event => setRoomFilter(event.target.value)}
                aria-label="筛选目标直播间"
              >
                <option value="all">全部直播间</option>
                {rooms.map(roomId => <option key={roomId} value={roomId}>房间 {roomId}</option>)}
              </Select>
            </label>
          </div>
        </CardHeader>

        <CardContent>
          {!loading && logs.length === 0 ? (
            <div className="py-14 text-center">
              <FileText className="mx-auto h-10 w-10 text-muted-foreground/40" />
              <p className="mt-3 text-sm font-medium">该弹宠任务还没有执行记录</p>
              <p className="mt-1 text-xs text-muted-foreground">任务启用并完成首次发送后，详细结果会显示在这里。</p>
            </div>
          ) : !loading && filteredLogs.length === 0 ? (
            <div className="py-14 text-center">
              <Search className="mx-auto h-10 w-10 text-muted-foreground/40" />
              <p className="mt-3 text-sm font-medium">没有符合筛选条件的记录</p>
              <p className="mt-1 text-xs text-muted-foreground">请调整关键词、发送状态或直播间筛选。</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border/60">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/35">
                    <TableHead className="w-24">日志 ID</TableHead>
                    <TableHead className="w-48">执行时间</TableHead>
                    <TableHead className="w-32">直播间</TableHead>
                    <TableHead className="min-w-[220px]">发送内容</TableHead>
                    <TableHead className="w-24">状态</TableHead>
                    <TableHead className="w-24">接口码</TableHead>
                    <TableHead>详细信息</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && <TableSkeleton rows={8} cols={7} />}
                  {!loading && filteredLogs.map(log => (
                    <TableRow key={log.id} className={`align-top ${isSuccess(log) ? '' : 'bg-destructive/[0.025]'}`}>
                      <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">#{log.id}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{fmtDate(log.created_at)}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1 rounded-md border border-sky-500/20 bg-sky-500/10 px-2 py-1 text-xs font-medium text-sky-700 dark:text-sky-300">
                          <Radio className="h-3 w-3" />{log.room_id || '—'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <p className="max-w-[360px] whitespace-pre-wrap break-words text-sm font-medium leading-5">
                          {log.message || '未记录发送内容'}
                        </p>
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
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}