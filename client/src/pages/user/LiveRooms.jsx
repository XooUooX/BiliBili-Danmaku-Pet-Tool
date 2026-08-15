import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { usePageTitle } from '@/hooks/use-site-config';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Radio, Cat, ExternalLink, RefreshCw, TvMinimalPlay, Users, Plus, Search } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';

const CATEGORIES = [
  { 
    key: 'danchong', 
    label: '弹宠直播间', 
    icon: Radio,
    color: 'text-blue-500'
  },
  { 
    key: 'maomao', 
    label: '猫猫直播间', 
    icon: Cat,
    color: 'text-pink-500'
  }
];

function RoomCard({ room }) {
  return (
    <a
      href={`https://live.bilibili.com/${room.room_id}`}
      target="_blank"
      rel="noreferrer"
      className="group block"
    >
      <Card className="overflow-hidden transition-all duration-200 hover:shadow-xl hover:border-primary/50">
        {/* 封面图 */}
        <div className="relative aspect-video overflow-hidden bg-muted">
          {room.cover ? (
            <img 
              src={room.cover} 
              alt={room.title || ''} 
              loading="lazy" 
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" 
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <TvMinimalPlay className="h-12 w-12 text-muted-foreground/30" />
            </div>
          )}
          
          {/* 遮罩层 */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
          
          {/* 直播中标签 */}
          <Badge className="absolute left-2 top-2 gap-1 border-0 bg-[#FB7299] px-2 py-0.5 text-xs font-medium text-white">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
            直播中
          </Badge>
          
          {/* 房间号 */}
          <div className="absolute bottom-2 right-2 rounded bg-black/60 px-2 py-0.5 text-xs text-white/90 backdrop-blur-sm">
            {room.room_id}
          </div>
          
          {/* 悬停时的进入提示 */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <div className="flex items-center gap-1.5 rounded-lg bg-black/70 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm">
              <ExternalLink className="h-4 w-4" />
              进入直播间
            </div>
          </div>
        </div>
        
        {/* 信息区 */}
        <CardContent className="p-3">
          <div className="mb-2 line-clamp-2 min-h-[2.5rem] text-sm font-medium leading-tight">
            {room.title || '直播间'}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            <span className="truncate">{room.uname || `房间 ${room.room_id}`}</span>
          </div>
        </CardContent>
      </Card>
    </a>
  );
}

function RoomCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <div className="aspect-video animate-pulse bg-muted" />
      <CardContent className="space-y-2 p-3">
        <div className="space-y-1.5">
          <div className="h-4 w-full animate-pulse rounded bg-muted" />
          <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3.5 w-3.5 animate-pulse rounded-full bg-muted" />
          <div className="h-3 w-20 animate-pulse rounded bg-muted" />
        </div>
      </CardContent>
    </Card>
  );
}

function CategorySection({ category, rooms }) {
  if (rooms.length === 0) return null;
  const Icon = category.icon;
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className={`h-5 w-5 ${category.color}`} />
          {category.label}
          <Badge variant="secondary" className="ml-2 font-normal">
            {rooms.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {rooms.map(r => <RoomCard key={r.room_id} room={r} />)}
      </CardContent>
    </Card>
  );
}

function AddRoomDialog({ open, onOpenChange, onAdded }) {
  const [form, setForm] = useState({ room_id: '', category: 'danchong' });
  const [preview, setPreview] = useState(null);
  const [fetching, setFetching] = useState(false);
  const [saving, setSaving] = useState(false);

  const reset = () => { setForm({ room_id: '', category: 'danchong' }); setPreview(null); };

  const doFetch = async () => {
    const rid = form.room_id.trim();
    if (!rid) return toast.error('请输入房间号');
    setFetching(true);
    try {
      const d = await api.get(`/api/user/live-rooms/fetch?room_id=${encodeURIComponent(rid)}`);
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
    if (!form.room_id.trim()) return toast.error('请输入房间号');
    setSaving(true);
    try {
      await api.post('/api/user/live-rooms', form);
      toast.success('已添加，主播开播后即可在列表中看到');
      reset();
      onOpenChange(false);
      onAdded && onAdded();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>添加直播间</DialogTitle>
          <DialogDescription>输入 B站直播间房间号，添加到公共直播间列表，所有人可见</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div className="space-y-1">
            <Label>房间号</Label>
            <div className="flex gap-2">
              <Input value={form.room_id} placeholder="如：21452505"
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
          <div className="space-y-1">
            <Label>分类</Label>
            <Select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
              <option value="danchong">弹宠直播间</option>
              <option value="maomao">猫猫直播间</option>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { onOpenChange(false); reset(); }}>取消</Button>
            <Button type="submit" disabled={saving}>{saving ? '添加中...' : '添加'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function UserLiveRooms() {
  usePageTitle('在线直播间');
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.get('/api/user/live-rooms');
      setRooms(d.rooms || []);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const roomsByCategory = CATEGORIES.map(cat => ({
    ...cat,
    rooms: rooms.filter(r => r.category === cat.key)
  }));

  const totalRooms = rooms.length;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="在线直播间"
        subtitle={loading ? '仅展示正在直播的直播间，点击卡片进入 B站直播页' : `共 ${totalRooms} 个直播间 · 点击卡片进入 B站直播页`}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={load} disabled={loading}>
              <RefreshCw className={`mr-1 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              刷新
            </Button>
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="mr-1 h-4 w-4" />
              添加直播间
            </Button>
          </div>
        }
      />

      <AddRoomDialog open={addOpen} onOpenChange={setAddOpen} onAdded={load} />

      {/* 内容区 */}
      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => <RoomCardSkeleton key={i} />)}
        </div>
      ) : totalRooms === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <TvMinimalPlay className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-muted-foreground">当前暂无正在直播的直播间</p>
              <p className="mt-1 text-xs text-muted-foreground/70">等待主播开播或稍后刷新</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {roomsByCategory.map(cat => (
            <CategorySection key={cat.key} category={cat} rooms={cat.rooms} />
          ))}
        </div>
      )}
    </div>
  );
}
