import { Eye, BatteryCharging, Crown, Star } from 'lucide-react';

// 各日常任务的展示元数据：图标、配色、周期、描述、是否可配置
export const TASK_META = {
  daily: {
    icon: Eye,
    accent: 'text-sky-500',
    ring: 'bg-sky-500/10',
    cycle: '每天一次',
    desc: '按每日目标自动完成视频观看、投币经验补足与联动点赞，并记录每一步执行结果',
    configurable: true
  },
  charge: {
    icon: BatteryCharging,
    accent: 'text-amber-500',
    ring: 'bg-amber-500/10',
    cycle: '每月一次',
    desc: '每月给指定 UP 主自动充电（-1 表示给自己）',
    configurable: true
  },
  vip_privilege: {
    icon: Crown,
    accent: 'text-violet-500',
    ring: 'bg-violet-500/10',
    cycle: '每月一次',
    desc: '每月自动领取大会员 B币券与会员购优惠券',
    configurable: false
  },
  vip_big_point: {
    icon: Star,
    accent: 'text-rose-500',
    ring: 'bg-rose-500/10',
    cycle: '每天一次',
    desc: '每天自动完成大会员大积分签到',
    configurable: false
  }
};

const MONTHLY = new Set(['charge', 'vip_privilege']);

export function fmtDate(s) {
  if (!s) return '从未执行';
  return new Date(s).toLocaleString('zh-CN', { hour12: false });
}

// 根据周期与上次执行时间，推算下次执行时间的友好文案
export function nextRunText(taskKey, lastRunAt, enabled) {
  if (!enabled) return '已停用';
  const now = new Date();
  const last = lastRunAt ? new Date(lastRunAt) : null;

  if (MONTHLY.has(taskKey)) {
    const ranThisMonth =
      last && last.getFullYear() === now.getFullYear() && last.getMonth() === now.getMonth();
    if (!ranThisMonth) return '待执行（本月未跑）';
    const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return `下次 ${next.toLocaleDateString('zh-CN')}`;
  }

  // 每日任务
  const ranToday = last && last.toDateString() === now.toDateString();
  if (!ranToday) return '待执行（今日未跑）';
  const next = new Date(now);
  next.setDate(now.getDate() + 1);
  next.setHours(0, 0, 0, 0);
  return `下次 ${next.toLocaleDateString('zh-CN')} 00:00`;
}
