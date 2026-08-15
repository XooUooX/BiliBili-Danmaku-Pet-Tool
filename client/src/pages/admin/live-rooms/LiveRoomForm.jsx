import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { usePageTitle } from '@/hooks/use-site-config';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft, Search } from 'lucide-react';

const EMPTY = { room_id: '', category: 'danchong', sort_order: 0 };

export default function LiveRoomForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;
  usePageTitle(isEdit ? '编辑直播间' : '添加直播间');

  const [form, setForm] = useState({ ...EMPTY });
  const [editRoom, setEditRoom] = useState(null);
  const [preview, setPreview] = useState(null);
  const [fetching, setFetching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);

  const back = () => navigate('/admin/live-rooms');

  const loadRoom = useCallback(async () => {
    if (!isEdit) return;
    setLoading(true);
    try {
      const d = await api.get('/api/admin/live-rooms');
      const r = (d.rooms || []).find(x => String(x.id) === String(id));
      if (!r) {
        toast.error('直播间不存在');
        navigate('/admin/live-rooms');
        return;
      }
      setEditRoom(r);
      setForm({ room_id: r.room_id, category: r.category, sort_order: r.sort_order ?? 0 });
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [id, isEdit, navigate]);

  useEffect(() => { loadRoom(); }, [loadRoom]);

  const doFetch = async () => {
    const rid = form.room_id.trim();
    if (!rid) return toast.error('请输入房间号');
    setFetching(true);
    try {
      const d = await api.get(`/api/admin/live-rooms/fetch?room_id=${encodeURIComponent(rid)}`);
      setPreview(d.info);
    } catch (e) {
      setPreview(null);
      toast.error(e.message);
    } finally {
      setFetching(false);
    }
  };

  const submit = async e => {
    e.preventDefault();
    setSaving(true);
    try {
      if (isEdit) {
        await api.post(`/api/admin/live-rooms/${editRoom.id}/update`, { category: form.category, sort_order: form.sort_order });
        toast.success('已保存');
      } else {
        if (!form.room_id.trim()) return toast.error('请输入房间号');
        await api.post('/api/admin/live-rooms', form);
        toast.success('已添加');
      }
      navigate('/admin/live-rooms');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={back}>
          <ArrowLeft className="h-4 w-4" /> 返回
        </Button>
        <div>
          <h1 className="text-xl font-semibold">{isEdit ? '编辑直播间' : '添加直播间'}</h1>
          <p className="text-sm text-muted-foreground">
            {isEdit ? `房间号 ${editRoom?.room_id || ''}「${editRoom?.title || ''}」` : '输入 B站直播间房间号，可先预览再添加'}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">直播间信息</CardTitle>
          <CardDescription>按分类维护直播间，添加时自动拉取封面与主播信息</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-10 text-center text-sm text-muted-foreground">加载中...</p>
          ) : (
            <form onSubmit={submit} className="grid gap-3">
              {!isEdit && (
                <>
                  <div className="space-y-1">
                    <Label>房间号</Label>
                    <div className="flex gap-2">
                      <Input value={form.room_id}
                        onChange={e => { setForm({ ...form, room_id: e.target.value }); setPreview(null); }} />
                      <Button type="button" variant="outline" onClick={doFetch} disabled={fetching}>
                        <Search className="h-4 w-4" /> {fetching ? '获取中' : '预览'}
                      </Button>
                    </div>
                  </div>
                  {preview && (
                    <div className="flex gap-3 rounded-lg border bg-muted/30 p-3">
                      {preview.cover && <img src={preview.cover} alt="" referrerPolicy="no-referrer" className="h-16 w-28 rounded object-cover" />}
                      <div className="min-w-0 text-sm">
                        <div className="truncate font-medium">{preview.title || '无标题'}</div>
                        <div className="text-muted-foreground">主播：{preview.uname || '-'}</div>
                        <div className="text-xs text-muted-foreground">房间号 {preview.room_id}</div>
                      </div>
                    </div>
                  )}
                </>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>分类</Label>
                  <Select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                    <option value="danchong">弹宠直播间</option>
                    <option value="maomao">猫猫直播间</option>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>排序（小的靠前）</Label>
                  <Input type="number" value={form.sort_order} onChange={e => setForm({ ...form, sort_order: e.target.value })} />
                </div>
              </div>
              <div className="space-x-2 pt-1">
                <Button type="submit" disabled={saving}>{saving ? '保存中...' : (isEdit ? '保存' : '添加')}</Button>
                <Button type="button" variant="outline" onClick={back}>取消</Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
