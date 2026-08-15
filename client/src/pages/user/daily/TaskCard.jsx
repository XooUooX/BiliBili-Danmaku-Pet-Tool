import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Power, PowerOff, Play, ScrollText, Save, Settings2, Loader2, Clock, X,
  Eye, Coins, ThumbsUp, ListVideo, ListChecks, Info, BatteryCharging,
  Crown, Gift, Star, CalendarDays, Wallet
} from 'lucide-react';
import { TASK_META, fmtDate, nextRunText } from './taskMeta';

function normalizeCoinCount(value) {
  const parsed = parseInt(value ?? 5, 10);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(5, parsed)) : 0;
}

function getSupportUpIds(value) {
  return String(value || '')
    .split(/[,，]/)
    .map(item => item.trim())
    .filter(Boolean);
}

function ConfigSwitch({ checked, onChange, title, description }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/60 bg-background/70 p-3 transition-colors hover:bg-accent/40">
      <input
        type="checkbox"
        className="mt-1 h-4 w-4 accent-primary"
        checked={checked}
        onChange={onChange}
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium">{title}</span>
        <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{description}</span>
      </span>
    </label>
  );
}

// 每日任务的内联配置字段
function DailyFields({ form, setForm }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <ConfigSwitch
          checked={form.watch !== false}
          onChange={e => setForm({ ...form, watch: e.target.checked })}
          title="观看视频"
          description="从候选视频中选择一个，模拟观看约 30 秒。"
        />
        <ConfigSwitch
          checked={form.selectLike !== false}
          onChange={e => setForm({ ...form, selectLike: e.target.checked })}
          title="投币时同时点赞"
          description="投币时联动点赞；今日投币经验已满时会改为单独点赞。"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs">每日投币目标</Label>
          <Input
            type="number"
            min={0}
            max={5}
            value={form.numberOfCoins ?? 5}
            onChange={e => setForm({ ...form, numberOfCoins: normalizeCoinCount(e.target.value) })}
          />
          <p className="text-xs leading-5 text-muted-foreground">
            可设置 0–5 枚。执行时先查询今日投币经验，只补足尚未完成的数量。
          </p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">指定 UP 主 UID</Label>
          <Input
            value={form.supportUpIds || ''}
            onChange={e => setForm({ ...form, supportUpIds: e.target.value })}
          />
          <p className="text-xs leading-5 text-muted-foreground">
            多个 UID 使用英文或中文逗号分隔；留空或获取失败时自动使用排行榜视频。
          </p>
        </div>
      </div>
    </div>
  );
}

// 充电任务的内联配置字段
function ChargeFields({ form, setForm }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1">
        <Label className="text-xs">充电目标 UP 主 UID（-1 给自己）</Label>
        <Input value={form.autoChargeUpId ?? '5432606'}
          onChange={e => setForm({ ...form, autoChargeUpId: e.target.value })} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">充电电池数（10 电池 = 1 B币）</Label>
        <Input type="number" min={10} step={10} value={form.num ?? 50}
          onChange={e => setForm({ ...form, num: Math.max(10, parseInt(e.target.value || '10', 10)) })} />
      </div>
      <p className="sm:col-span-2 text-xs text-amber-600">
        充电会消耗 B币，请确认账号余额充足；每月执行一次。
      </p>
    </div>
  );
}

function DetailItem({ icon: Icon, label, value, active = true, description, accent = 'text-sky-500' }) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/80 p-3">
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${active ? accent : 'text-muted-foreground'}`} />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="mt-1.5 text-sm font-semibold">{value}</p>
      {description && <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>}
    </div>
  );
}

function DailyTaskDetails({ config = {} }) {
  const watch = config.watch !== false;
  const coins = normalizeCoinCount(config.numberOfCoins);
  const selectLike = config.selectLike !== false;
  const upIds = getSupportUpIds(config.supportUpIds);
  const sourceText = upIds.length ? `指定 ${upIds.length} 位 UP 主` : 'B站排行榜';
  const sourceDetail = upIds.length
    ? `UID：${upIds.slice(0, 4).join('、')}${upIds.length > 4 ? ` 等 ${upIds.length} 个` : ''}`
    : '未指定 UP 主时，从排行榜获取候选视频';
  const likeActive = selectLike && coins > 0;

  return (
    <div className="border-t border-sky-500/15 bg-sky-500/[0.035] px-5 py-4">
      <div className="mb-3 flex items-center gap-2">
        <ListChecks className="h-4 w-4 text-sky-500" />
        <p className="text-sm font-semibold">当前执行内容</p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <DetailItem
          icon={Eye}
          label="观看视频"
          value={watch ? '已开启' : '已关闭'}
          active={watch}
          description={watch ? '每次选择 1 个视频，观看约 30 秒' : '自动执行时跳过观看步骤'}
        />
        <DetailItem
          icon={Coins}
          label="每日投币"
          value={coins > 0 ? `目标 ${coins} 枚` : '不投币'}
          active={coins > 0}
          description={coins > 0 ? '先读取今日经验，再补足剩余数量' : '投币数量为 0，跳过投币'}
        />
        <DetailItem
          icon={ThumbsUp}
          label="联动点赞"
          value={likeActive ? '已开启' : '不执行'}
          active={likeActive}
          description={likeActive
            ? '随投币点赞；投币经验已满时单独点赞'
            : selectLike ? '投币数量为 0，因此不会执行' : '配置中已关闭点赞'}
        />
        <DetailItem
          icon={ListVideo}
          label="视频来源"
          value={sourceText}
          description={sourceDetail}
        />
      </div>

      <div className="mt-3 rounded-lg border border-sky-500/15 bg-background/60 px-4 py-3">
        <div className="flex items-start gap-2">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-500" />
          <div className="space-y-1 text-xs leading-5 text-muted-foreground">
            <p><span className="font-medium text-foreground">自动执行：</span>后台约每 10 分钟检查一次，每个自然日自动执行一次。</p>
            <p><span className="font-medium text-foreground">立即执行：</span>忽略今日是否已经执行，会立刻再次运行，请避免重复投币。</p>
            <p><span className="font-medium text-foreground">风控间隔：</span>不同操作之间会主动等待，投币之间约间隔 25 秒，因此任务可能需要几分钟完成。</p>
            <p><span className="font-medium text-foreground">执行记录：</span>观看、投币、点赞的成功或失败结果都会分别写入任务日志。</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function TaskRuleBlock({ accent, children }) {
  return (
    <div className="mt-3 rounded-lg border border-border/60 bg-background/60 px-4 py-3">
      <div className="flex items-start gap-2">
        <Info className={`mt-0.5 h-4 w-4 shrink-0 ${accent}`} />
        <div className="space-y-1 text-xs leading-5 text-muted-foreground">{children}</div>
      </div>
    </div>
  );
}

function ChargeTaskDetails({ config = {} }) {
  const rawTarget = String(config.autoChargeUpId ?? '').trim();
  const selfCharge = !rawTarget || rawTarget === '-1';
  const battery = Math.max(10, parseInt(config.num ?? 50, 10) || 10);
  const cost = battery / 10;

  return (
    <div className="border-t border-amber-500/15 bg-amber-500/[0.035] px-5 py-4">
      <div className="mb-3 flex items-center gap-2">
        <BatteryCharging className="h-4 w-4 text-amber-500" />
        <p className="text-sm font-semibold">当前执行内容</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <DetailItem
          icon={Crown}
          label="充电目标"
          value={selfCharge ? '当前账号自己' : `UP 主 UID ${rawTarget}`}
          description={selfCharge ? '使用当前绑定账号的 B站 UID 作为充电目标' : '每月向该 UID 对应的 UP 主充电'}
          accent="text-amber-500"
        />
        <DetailItem
          icon={Wallet}
          label="单次消耗"
          value={`${battery} 电池 / ${cost} B币`}
          description="10 电池等于 1 B币，执行后会真实扣除账号 B币"
          accent="text-amber-500"
        />
      </div>
      <TaskRuleBlock accent="text-amber-500">
        <p><span className="font-medium text-foreground">自动执行：</span>每个自然月执行一次，后台约每 10 分钟检查本月是否已经运行。</p>
        <p><span className="font-medium text-foreground">立即执行：</span>不会检查本月是否已经充电，会立刻再次扣除 B币，请谨慎操作。</p>
        <p><span className="font-medium text-foreground">资格要求：</span>账号需要有足够 B币，目标 UID 也必须能够正常接收充电。</p>
        <p><span className="font-medium text-foreground">执行记录：</span>日志会记录目标 UID、电池数量、实际 B币消耗、接口码和失败原因。</p>
      </TaskRuleBlock>
    </div>
  );
}

function VipPrivilegeDetails() {
  return (
    <div className="border-t border-violet-500/15 bg-violet-500/[0.035] px-5 py-4">
      <div className="mb-3 flex items-center gap-2">
        <Crown className="h-4 w-4 text-violet-500" />
        <p className="text-sm font-semibold">当前执行内容</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <DetailItem
          icon={Wallet}
          label="每月权益一"
          value="领取 B币券"
          description="调用大会员权益接口领取当月可用的 B币券"
          accent="text-violet-500"
        />
        <DetailItem
          icon={Gift}
          label="每月权益二"
          value="领取会员购优惠券"
          description="完成 B币券检查后，再检查并领取会员购优惠券"
          accent="text-violet-500"
        />
      </div>
      <TaskRuleBlock accent="text-violet-500">
        <p><span className="font-medium text-foreground">执行顺序：</span>先领取 B币券，等待约 6 秒后再领取会员购优惠券。</p>
        <p><span className="font-medium text-foreground">自动执行：</span>每个自然月检查一次；已经领取或不满足资格时以 B站接口结果为准。</p>
        <p><span className="font-medium text-foreground">立即执行：</span>可以重新检查权益，但不会绕过 B站的会员资格和每月领取限制。</p>
        <p><span className="font-medium text-foreground">执行记录：</span>两项权益分别写入日志，并额外记录本次成功、失败数量汇总。</p>
      </TaskRuleBlock>
    </div>
  );
}

function VipBigPointDetails() {
  return (
    <div className="border-t border-rose-500/15 bg-rose-500/[0.035] px-5 py-4">
      <div className="mb-3 flex items-center gap-2">
        <Star className="h-4 w-4 text-rose-500" />
        <p className="text-sm font-semibold">当前执行内容</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <DetailItem
          icon={CalendarDays}
          label="任务内容"
          value="大积分每日签到"
          description="每天调用一次大会员大积分签到接口"
          accent="text-rose-500"
        />
        <DetailItem
          icon={Star}
          label="执行周期"
          value="每个自然日一次"
          description="今日执行完成后，次日重新进入待执行状态"
          accent="text-rose-500"
        />
      </div>
      <TaskRuleBlock accent="text-rose-500">
        <p><span className="font-medium text-foreground">自动执行：</span>后台约每 10 分钟检查一次，当天尚未执行时自动签到。</p>
        <p><span className="font-medium text-foreground">立即执行：</span>会再次提交签到请求，重复签到结果由 B站接口返回。</p>
        <p><span className="font-medium text-foreground">资格要求：</span>账号需要具备对应的大会员大积分活动资格。</p>
        <p><span className="font-medium text-foreground">执行记录：</span>日志会展示签到状态、接口返回码及具体失败原因。</p>
      </TaskRuleBlock>
    </div>
  );
}

function TaskDetails({ task }) {
  switch (task.task_key) {
    case 'daily': return <DailyTaskDetails config={task.config} />;
    case 'charge': return <ChargeTaskDetails config={task.config} />;
    case 'vip_privilege': return <VipPrivilegeDetails />;
    case 'vip_big_point': return <VipBigPointDetails />;
    default: return null;
  }
}
export default function TaskCard({ task, locked, busy, onToggle, onSave, onRun, onLogs }) {
  const meta = TASK_META[task.task_key] || {};
  const Icon = meta.icon;
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ ...task.config });
  const [saving, setSaving] = useState(false);

  const openEdit = () => { setForm({ ...task.config }); setEditing(true); };

  const submit = async e => {
    e.preventDefault();
    setSaving(true);
    const ok = await onSave(task, task.enabled || 1, form);
    setSaving(false);
    if (ok) setEditing(false);
  };

  const running = busy === 'run';
  const toggling = busy === 'toggle';

  return (
    <Card className={`overflow-hidden ${task.task_key === 'daily' ? 'lg:col-span-2' : ''}`}>
      <div className="flex items-start gap-4 p-5">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${meta.ring}`}>
          {Icon && <Icon className={`h-6 w-6 ${meta.accent}`} />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{task.label}</h3>
            {task.enabled
              ? <Badge variant="success">启用</Badge>
              : <Badge variant="secondary">停用</Badge>}
            <Badge variant="outline" className="font-normal">{meta.cycle}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{meta.desc}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" /> 上次：{fmtDate(task.last_run_at)}
            </span>
            <span>{nextRunText(task.task_key, task.last_run_at, task.enabled)}</span>
          </div>
        </div>
      </div>

      <TaskDetails task={task} />

      {editing && (
        <form onSubmit={submit} className="border-t bg-muted/30 p-5">
          <div className="mb-4">
            <h4 className="text-sm font-semibold">任务配置</h4>
            <p className="mt-1 text-xs text-muted-foreground">保存后会同时启用该任务，新的配置将在下一次执行时生效。</p>
          </div>
          {task.task_key === 'daily' && <DailyFields form={form} setForm={setForm} />}
          {task.task_key === 'charge' && <ChargeFields form={form} setForm={setForm} />}
          <div className="mt-4 flex gap-2">
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              保存并启用
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
              <X className="h-4 w-4" /> 取消
            </Button>
          </div>
        </form>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t bg-card px-5 py-3">
        {meta.configurable && !editing && (
          <Button size="sm" variant="outline" onClick={openEdit} disabled={locked}>
            <Settings2 className="h-4 w-4" /> 配置
          </Button>
        )}
        <Button size="sm" variant={task.enabled ? 'outline' : 'default'}
          onClick={() => onToggle(task)} disabled={locked || toggling}>
          {toggling
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : task.enabled ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
          {task.enabled ? '停用' : '启用'}
        </Button>
        <Button size="sm" variant="outline" onClick={() => onRun(task)} disabled={running}>
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          {running ? '执行中' : '立即执行'}
        </Button>
        <Button size="sm" variant="ghost" className="ml-auto" onClick={() => onLogs(task)}>
          <ScrollText className="h-4 w-4" /> 日志
        </Button>
      </div>
    </Card>
  );
}