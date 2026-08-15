import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { usePageTitle } from '@/hooks/use-site-config';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';

export default function FriendLinkForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  usePageTitle(id ? '编辑链接' : '添加链接');

  const [form, setForm] = useState({ id: null, name: '', url: '', description: '', logo: '', sort_order: 0 });
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(!!id);

  const back = () => navigate('/admin/friend-links');

  const loadLink = useCallback(async () => {
    if (!id) return;
    setLoadingData(true);
    try {
      const d = await api.get('/api/admin/friend-links');
      const link = (d.links || []).find(x => String(x.id) === String(id));
      if (!link) {
        toast.error('链接不存在');
        navigate('/admin/friend-links');
        return;
      }
      setForm({
        id: link.id,
        name: link.name,
        url: link.url,
        description: link.description || '',
        logo: link.logo || '',
        sort_order: link.sort_order
      });
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoadingData(false);
    }
  }, [id, navigate]);

  useEffect(() => { loadLink(); }, [loadLink]);

  const save = async () => {
    if (!form.name.trim()) return toast.error('请输入链接名称');
    if (!form.url.trim()) return toast.error('请输入链接地址');
    setLoading(true);
    try {
      if (form.id) {
        await api.post(`/api/admin/friend-links/${form.id}/update`, form);
        toast.success('更新成功');
      } else {
        await api.post('/api/admin/friend-links', form);
        toast.success('添加成功');
      }
      navigate('/admin/friend-links');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={back}>
          <ArrowLeft className="h-4 w-4" /> 返回
        </Button>
        <div>
          <h1 className="text-xl font-semibold">{form.id ? '编辑链接' : '添加链接'}</h1>
          <p className="text-sm text-muted-foreground">填写友情链接的基本信息</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">链接信息</CardTitle>
          <CardDescription>管理首页展示的友情链接</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingData ? (
            <p className="py-10 text-center text-sm text-muted-foreground">加载中...</p>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="link-name">名称 *</Label>
                <Input
                  id="link-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="link-url">链接地址 *</Label>
                <Input
                  id="link-url"
                  value={form.url}
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="link-logo">Logo 地址（可选）</Label>
                <Input
                  id="link-logo"
                  value={form.logo}
                  onChange={(e) => setForm({ ...form, logo: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="link-desc">描述（可选）</Label>
                <Textarea
                  id="link-desc"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="link-sort">排序值</Label>
                <Input
                  id="link-sort"
                  type="number"
                  value={form.sort_order}
                  onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })}
                />
                <p className="text-xs text-muted-foreground">数值越小越靠前</p>
              </div>
              <div className="flex gap-2 pt-2">
                <Button onClick={save} disabled={loading}>
                  {loading ? '保存中...' : '保存'}
                </Button>
                <Button onClick={back} variant="outline">
                  取消
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
