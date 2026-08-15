import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { usePageTitle } from '@/hooks/use-site-config';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';

const EMPTY = {
  id: null, preset_key: '', group_name: '', label: '',
  schedule_type: 'fixed', interval_seconds: 60, interval_min: 300, interval_max: 600,
  mode: 'sequential', messages: '', sort_order: 0
};

export default function TemplateForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  usePageTitle(id ? '编辑模板' : '新建模板');

  const [form, setForm] = useState({ ...EMPTY });
  const [loading, setLoading] = useState(!!id);

  const back = () => navigate('/admin/templates');

  const loadTemplate = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const d = await api.get('/api/admin/templates');
      const t = (d.templates || []).find(x => String(x.id) === String(id));
      if (!t) {
        toast.error('模板不存在');
        navigate('/admin/templates');
        return;
      }
      setForm({
        id: t.id,
        preset_key: t.preset_key,
        group_name: t.group_name,
        label: t.label,
        schedule_type: t.schedule_type || 'fixed',
        interval_seconds: t.interval_seconds,
        interval_min: t.interval_min ?? 300,
        interval_max: t.interval_max ?? 600,
        mode: t.mode,
        messages: t.messages || '',
        sort_order: t.sort_order ?? 0
      });
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => { loadTemplate(); }, [loadTemplate]);

  const submit = async e => {
    e.preventDefault();
    if (!form.label.trim() || !form.messages.trim()) {
      return toast.error('请填写名称与弹幕内容');
    }
    try {
      if (form.id) {
        await api.post(`/api/admin/templates/${form.id}/update`, form);
        toast.success('已保存');
      } else {
        await api.post('/api/admin/templates', form);
        toast.success('已创建');
      }
      navigate('/admin/templates');
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={back}>
          <ArrowLeft className="h-4 w-4" /> 返回
        </Button>
        <div>
          <h1 className="text-xl font-semibold">{form.id ? '编辑模板' : '新建模板'}</h1>
          <p className="text-sm text-muted-foreground">配置用户端可选的任务预设</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">模板配置</CardTitle>
          <CardDescription>设置分组、调度方式与弹幕内容</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-10 text-center text-sm text-muted-foreground">加载中...</p>
          ) : (
            <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>分组名称</Label>
                <Input value={form.group_name} onChange={e => setForm({ ...form, group_name: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>模板名称</Label>
                <Input value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>模板标识（留空自动生成，仅字母数字下划线）</Label>
                <Input
                  value={form.preset_key}
                  onChange={e => setForm({ ...form, preset_key: e.target.value })}
                  disabled={!!form.id}
                />
              </div>
              <div className="space-y-1">
                <Label>排序（小的靠前）</Label>
                <Input type="number" value={form.sort_order} onChange={e => setForm({ ...form, sort_order: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>调度方式</Label>
                <Select value={form.schedule_type} onChange={e => setForm({ ...form, schedule_type: e.target.value })}>
                  <option value="fixed">固定间隔</option>
                  <option value="random">随机间隔</option>
                  <option value="daily">每天一次</option>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>发送模式</Label>
                <Select value={form.mode} onChange={e => setForm({ ...form, mode: e.target.value })}>
                  <option value="sequential">顺序</option>
                  <option value="random">随机</option>
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
              <div className="space-y-1 sm:col-span-2">
                <Label>弹幕内容（每行一条）</Label>
                <Textarea rows={5} value={form.messages} onChange={e => setForm({ ...form, messages: e.target.value })} />
              </div>
              <div className="sm:col-span-2 space-x-2">
                <Button type="submit">{form.id ? '保存' : '创建'}</Button>
                <Button type="button" variant="outline" onClick={back}>取消</Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
