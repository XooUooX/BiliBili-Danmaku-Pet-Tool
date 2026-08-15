import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { usePageTitle } from '@/hooks/use-site-config';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft, ImagePlus, X } from 'lucide-react';

const EMPTY = { id: null, name: '', type: 'balance', value: '', weight: 10, stock: -1, image: '', sort_order: 0 };

function ImageField({ value, onChange }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const pick = async e => {
    const file = (e.target.files || [])[0];
    if (!file) return;
    setBusy(true);
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const d = await api.post('/api/user/upload', { data: dataUrl });
      onChange(d.url);
    } catch (err) { toast.error(err.message); } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };
  return (
    <div className="flex items-center gap-2">
      {value ? (
        <div className="relative">
          <img src={value} alt="" className="h-16 w-16 rounded object-cover" referrerPolicy="no-referrer" />
          <button type="button" onClick={() => onChange('')}
            className="absolute -right-1 -top-1 rounded-full bg-destructive p-0.5 text-white">
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => inputRef.current?.click()} disabled={busy}
          className="flex h-16 w-16 flex-col items-center justify-center rounded border border-dashed text-muted-foreground hover:border-primary hover:text-primary">
          <ImagePlus className="h-5 w-5" />
          <span className="text-[10px]">{busy ? '上传中' : '上传'}</span>
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/*" hidden onChange={pick} />
    </div>
  );
}

export default function PrizeForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  usePageTitle(id ? '编辑奖品' : '添加奖品');

  const [form, setForm] = useState({ ...EMPTY });
  const [loading, setLoading] = useState(!!id);

  const back = () => navigate('/admin/lottery');

  const loadPrize = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const d = await api.get('/api/admin/lottery/prizes');
      const p = (d.prizes || []).find(x => String(x.id) === String(id));
      if (!p) {
        toast.error('奖品不存在');
        navigate('/admin/lottery');
        return;
      }
      setForm({ id: p.id, name: p.name, type: p.type, value: p.value, weight: p.weight,
        stock: p.stock, image: p.image || '', sort_order: p.sort_order ?? 0 });
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => { loadPrize(); }, [loadPrize]);

  const submit = async e => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('请填写奖品名称');
    try {
      if (form.id) await api.post(`/api/admin/lottery/prizes/${form.id}/update`, form);
      else await api.post('/api/admin/lottery/prizes', form);
      toast.success('已保存');
      navigate('/admin/lottery');
    } catch (err) { toast.error(err.message); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={back}>
          <ArrowLeft className="h-4 w-4" /> 返回
        </Button>
        <div>
          <h1 className="text-xl font-semibold">{form.id ? '编辑奖品' : '添加奖品'}</h1>
          <p className="text-sm text-muted-foreground">类型为余额/账号天数时填写面值，谢谢参与/实物可不填</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">奖品信息</CardTitle>
          <CardDescription>权重越大中奖概率越高</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-10 text-center text-sm text-muted-foreground">加载中...</p>
          ) : (
            <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-2">
                <Label>奖品名称</Label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>类型</Label>
                <Select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                  <option value="balance">余额</option>
                  <option value="days">账号天数</option>
                  <option value="none">谢谢参与</option>
                  <option value="physical">实物/卡密</option>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>面值（余额金额 / 天数）</Label>
                <Input type="number" step="0.01" value={form.value}
                  disabled={form.type === 'none' || form.type === 'physical'}
                  onChange={e => setForm({ ...form, value: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>权重（概率占比）</Label>
                <Input type="number" value={form.weight} onChange={e => setForm({ ...form, weight: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>库存（-1 无限）</Label>
                <Input type="number" value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>奖品图标/图片</Label>
                <ImageField value={form.image} onChange={url => setForm({ ...form, image: url })} />
              </div>
              <div className="space-y-1">
                <Label>排序</Label>
                <Input type="number" value={form.sort_order} onChange={e => setForm({ ...form, sort_order: e.target.value })} />
              </div>
              <div className="sm:col-span-2 space-x-2 pt-1">
                <Button type="submit">保存</Button>
                <Button type="button" variant="outline" onClick={back}>取消</Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
