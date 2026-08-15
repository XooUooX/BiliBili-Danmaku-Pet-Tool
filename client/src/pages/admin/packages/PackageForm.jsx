import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { usePageTitle } from '@/hooks/use-site-config';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { RichEditor } from '@/components/ui/rich-editor';
import { ArrowLeft } from 'lucide-react';

const EMPTY = { id: null, name: '', days: 30, price: '', sort_order: 0, description: '' };

export default function PackageForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  usePageTitle(id ? '编辑套餐' : '新建套餐');

  const [form, setForm] = useState({ ...EMPTY });
  const [loading, setLoading] = useState(!!id);

  const back = () => navigate('/admin/packages');

  const loadPackage = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const d = await api.get('/api/admin/packages');
      const p = (d.packages || []).find(x => String(x.id) === String(id));
      if (!p) {
        toast.error('套餐不存在');
        navigate('/admin/packages');
        return;
      }
      setForm({ id: p.id, name: p.name, days: p.days, price: p.price, sort_order: p.sort_order ?? 0, description: p.description || '' });
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => { loadPackage(); }, [loadPackage]);

  const submit = async e => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('请填写套餐名称');
    try {
      if (form.id) {
        await api.post(`/api/admin/packages/${form.id}/update`, form);
        toast.success('已保存');
      } else {
        await api.post('/api/admin/packages', form);
        toast.success('已创建');
      }
      navigate('/admin/packages');
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={back}>
          <ArrowLeft className="h-4 w-4" /> 返回
        </Button>
        <div>
          <h1 className="text-xl font-semibold">{form.id ? '编辑套餐' : '新建套餐'}</h1>
          <p className="text-sm text-muted-foreground">设置套餐名称、时长与价格</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">套餐信息</CardTitle>
          <CardDescription>配置用户可购买的时长套餐</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-10 text-center text-sm text-muted-foreground">加载中...</p>
          ) : (
            <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-2">
                <Label>套餐名称</Label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>时长（天）</Label>
                <Input type="number" min={1} value={form.days} onChange={e => setForm({ ...form, days: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>价格（元）</Label>
                <Input type="number" min={0} step="0.01" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>排序（小的靠前）</Label>
                <Input type="number" value={form.sort_order} onChange={e => setForm({ ...form, sort_order: e.target.value })} />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>套餐描述（可选）</Label>
                <RichEditor height={220} value={form.description} onChange={v => setForm({ ...form, description: v })} />
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
