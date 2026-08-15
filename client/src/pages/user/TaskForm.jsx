import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { usePageTitle } from '@/hooks/use-site-config';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/PageHeader';
import { Plus, Pencil } from 'lucide-react';

// 弹宠挂机的可选弹幕组合：每个组合内用 / 分隔的词条会按顺序逐条发送
const PET_IDLE_COMBOS = ['修炼/双修/突破', '修仙/双修/突破', '修炼/突破', '修仙/突破', '双修/突破', '修炼', '修仙', '双修', '突破'];
const comboToMessages = c => c.split('/').join('\n');
const EMPTY_TASK = { room_id: '', schedule_type: 'fixed', interval_seconds: 60, interval_min: 300, interval_max: 600, mode: 'sequential', messages: '', preset: '', auto_switch_room: false, room_category: '' };

export default function TaskForm() {
  const { accountId, taskId } = useParams();
  const navigate = useNavigate();
  const editId = taskId || null;
  usePageTitle(editId ? '编辑任务' : '新建任务');

  const [form, setForm] = useState({ ...EMPTY_TASK });
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(!!editId);
  const [submitting, setSubmitting] = useState(false);
  const [liveRooms, setLiveRooms] = useState([]);

  // 加载任务模板（后台维护）
  useEffect(() => {
    api.get('/api/user/templates')
      .then(d => setTemplates(d.templates || []))
      .catch(() => {});
  }, []);

  // 加载直播间列表
  useEffect(() => {
    api.get('/api/user/live-rooms')
      .then(d => setLiveRooms(d.rooms || []))
      .catch(() => {});
  }, []);

  // 编辑模式：加载已有任务数据
  const loadTask = useCallback(async () => {
    if (!editId) return;
    setLoading(true);
    try {
      const d = await api.get(`/api/user/account/${accountId}/tasks`);
      const t = (d.tasks || []).find(x => String(x.id) === String(editId));
      if (!t) {
        toast.error('任务不存在');
        navigate(`/tasks/${accountId}`);
        return;
      }
      setForm({
        room_id: t.room_id,
        schedule_type: t.schedule_type || 'fixed',
        interval_seconds: t.interval_seconds,
        interval_min: t.interval_min ?? 300,
        interval_max: t.interval_max ?? 600,
        mode: t.mode,
        messages: t.messages || '',
        preset: t.preset || '',
        auto_switch_room: !!t.auto_switch_room,
        room_category: t.room_category || ''
      });
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [accountId, editId, navigate]);

  useEffect(() => { loadTask(); }, [loadTask]);

  // 模板按分组聚合 + 标识映射
  const presetMap = Object.fromEntries(templates.map(t => [t.preset_key, t]));
  const presetGroups = templates.reduce((acc, t) => {
    const g = acc.find(x => x.group === t.group_name);
    if (g) g.items.push(t);
    else acc.push({ group: t.group_name, items: [t] });
    return acc;
  }, []);

  // 根据选中分类过滤直播间
  const categoryRooms = useMemo(() => {
    if (!form.room_category) return [];
    return liveRooms.filter(r => r.category === form.room_category);
  }, [form.room_category, liveRooms]);

  // 选择预设模板：自动填充调度方式与弹幕内容，保留已填房间号
  const applyPreset = key => {
    if (!key) {
      setForm(f => ({ ...EMPTY_TASK, room_id: f.room_id, preset: '' }));
      return;
    }
    const p = presetMap[key];
    if (!p) return;
    
    // 根据模板的 group_name 自动设置直播间分类
    let roomCategory = '';
    const g = p.group_name || '';
    if (g.includes('猫')) {
      roomCategory = 'maomao';
    } else if (g.includes('弹') || g.includes('宠')) {
      roomCategory = 'danchong';
    }
    
    setForm(f => ({
      ...EMPTY_TASK,
      room_id: f.room_id,
      preset: key,
      schedule_type: p.schedule_type,
      mode: p.mode,
      messages: p.messages,
      interval_seconds: p.interval_seconds ?? EMPTY_TASK.interval_seconds,
      interval_min: p.interval_min ?? EMPTY_TASK.interval_min,
      interval_max: p.interval_max ?? EMPTY_TASK.interval_max,
      room_category: roomCategory,  // 自动设置分类
      auto_switch_room: !!roomCategory  // 有分类则自动开启统一切换直播间
    }));
  };

  const submitTask = async e => {
    e.preventDefault();
    
    // 验证房间号
    const roomId = form.room_id.trim();
    if (!roomId) return toast.error('请填写直播间号');
    if (!/^\d+$/.test(roomId)) return toast.error('直播间号只能是数字');
    if (roomId.length > 20) return toast.error('直播间号不能超过20位');
    
    // 验证弹幕内容
    const messages = form.messages.trim();
    if (!messages) return toast.error('弹幕内容不能为空，请至少输入一条弹幕');
    
    if (form.auto_switch_room && !form.room_category) {
      return toast.error('启用自动切换直播间时，请选择直播间分类');
    }
    
    setSubmitting(true);
    try {
      if (editId) {
        await api.post(`/api/user/tasks/${editId}/update`, form);
        toast.success('任务已更新');
      } else {
        await api.post(`/api/user/account/${accountId}/tasks`, form);
        toast.success('任务已添加');
      }
      navigate(`/tasks/${accountId}`);
    } catch (err) {
      toast.error('保存失败：' + (err.message || '未知错误'));
      // 提供重试选项
      setTimeout(() => {
        const retry = window.confirm('是否重试保存？');
        if (retry) submitTask(e);
      }, 500);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title={editId ? '编辑任务' : '新建任务'}
        subtitle="选择模板自动填充，或自定义调度方式与弹幕内容"
        onBack={() => navigate(`/tasks/${accountId}`)}
      />

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">任务配置</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-10 text-center text-sm text-muted-foreground">加载中...</p>
          ) : (
            <form onSubmit={submitTask} className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2 rounded-lg border-2 border-primary/30 bg-primary/5 p-4">
                <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-primary"
                    checked={form.auto_switch_room}
                    onChange={e => setForm({ ...form, auto_switch_room: e.target.checked })}
                  />
                  自动切换直播间
                </label>
                <p className="mt-1 pl-6 text-xs text-muted-foreground">当前直播间下播时，自动切换到同分类正在直播的房间</p>
                {form.auto_switch_room && (
                  <div className="mt-3 space-y-1 pl-6">
                    <Label>直播间分类</Label>
                    <Select value={form.room_category} onChange={e => setForm({ ...form, room_category: e.target.value })}>
                      <option value="">请选择分类</option>
                      <option value="danchong">弹宠直播间</option>
                      <option value="maomao">猫猫直播间</option>
                    </Select>
                  </div>
                )}
              </div>
              <div className={`space-y-1 ${form.preset === 'pet_idle' ? '' : 'sm:col-span-2'}`}>
                <Label>任务模板</Label>
                <Select value={form.preset} onChange={e => applyPreset(e.target.value)}>
                  <option value="">自定义</option>
                  {presetGroups.map(g => (
                    <optgroup key={g.group} label={g.group}>
                      {g.items.map(it => (
                        <option key={it.preset_key} value={it.preset_key}>{g.group} - {it.label}</option>
                      ))}
                    </optgroup>
                  ))}
                </Select>
              </div>
              {form.preset === 'pet_idle' && (
                <div className="space-y-1">
                  <Label>弹幕组合（按顺序逐条发送，可在下方自定义）</Label>
                  <Select
                    value={form.messages.split('\n').join('/')}
                    onChange={e => setForm({ ...form, messages: comboToMessages(e.target.value) })}
                  >
                    {PET_IDLE_COMBOS.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </Select>
                </div>
              )}
              <div className="space-y-1">
                <Label>直播间房间号</Label>
                {form.auto_switch_room && form.room_category ? (
                  <div className="space-y-2">
                    {categoryRooms.length > 0 ? (
                      <>
                        <Select 
                          value={form.room_id} 
                          onChange={e => setForm({ ...form, room_id: e.target.value })}
                        >
                          <option value="">从列表中选择直播间</option>
                          {categoryRooms.map(r => (
                            <option key={r.room_id} value={r.room_id}>
                              {r.uname ? `${r.uname} (${r.room_id})` : r.room_id}
                            </option>
                          ))}
                        </Select>
                        <p className="text-xs text-muted-foreground">或继续在下方自定义输入房间号</p>
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground">该分类暂无直播间，请自定义输入房间号</p>
                    )}
                  </div>
                ) : null}
                <Input 
                  value={form.room_id} 
                  onChange={e => setForm({ ...form, room_id: e.target.value })}
                  placeholder={form.auto_switch_room ? '输入房间号（或从上方列表选择）' : '请输入房间号'}
                />
              </div>
              <div className="space-y-1">
                <Label>调度方式</Label>
                <Select value={form.schedule_type} onChange={e => setForm({ ...form, schedule_type: e.target.value, preset: '' })}>
                  <option value="fixed">固定间隔</option>
                  <option value="random">随机间隔</option>
                  <option value="daily">每天一次</option>
                </Select>
              </div>
              {form.schedule_type === 'fixed' && (
                <div className="space-y-1">
                  <Label>发送间隔（秒）</Label>
                  <Input type="number" min={5} value={form.interval_seconds} onChange={e => setForm({ ...form, interval_seconds: e.target.value })} />
                </div>
              )}
              {form.schedule_type === 'random' && (
                <>
                  <div className="space-y-1">
                    <Label>最小间隔（秒）</Label>
                    <Input type="number" min={5} value={form.interval_min} onChange={e => setForm({ ...form, interval_min: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label>最大间隔（秒）</Label>
                    <Input type="number" min={5} value={form.interval_max} onChange={e => setForm({ ...form, interval_max: e.target.value })} />
                  </div>
                </>
              )}
              {form.schedule_type === 'daily' && (
                <div className="space-y-1">
                  <Label>说明</Label>
                  <p className="pt-2 text-sm text-muted-foreground">每 24 小时自动发送一次</p>
                </div>
              )}
              <div className="space-y-1">
                <Label>发送模式</Label>
                <Select value={form.mode} onChange={e => setForm({ ...form, mode: e.target.value })}>
                  <option value="sequential">顺序</option>
                  <option value="random">随机</option>
                </Select>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>弹幕内容（每行一条）</Label>
                <Textarea rows={4} value={form.messages} onChange={e => setForm({ ...form, messages: e.target.value })} placeholder={'第一条弹幕\n第二条弹幕'} />
              </div>
              <div className="sm:col-span-2 space-x-2">
                <Button type="submit" disabled={submitting}>
                  {submitting 
                    ? editId ? '保存中...' : '添加中...'
                    : editId ? <><Pencil className="h-4 w-4" /> 保存修改</> : <><Plus className="h-4 w-4" /> 添加任务</>}
                </Button>
                <Button type="button" variant="outline" onClick={() => navigate(`/tasks/${accountId}`)} disabled={submitting}>取消</Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
