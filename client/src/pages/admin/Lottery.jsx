import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useConfirm } from '@/hooks/use-confirm';
import { usePageTitle } from '@/hooks/use-site-config';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Power, PowerOff, Trash2, Pencil, Check, Gift, ChevronLeft, ChevronRight } from 'lucide-react';

const TYPE_LABEL = { balance: '余额', days: '账号天数', none: '谢谢参与', physical: '实物/卡密' };

function PrizeIcon({ image, className = 'h-8 w-8' }) {
  if (image) return <img src={image} alt="" className={`${className} rounded object-cover`} referrerPolicy="no-referrer" />;
  return <Gift className={`${className} text-muted-foreground`} />;
}

// 奖品行组件
function PrizeRow({ prize, totalWeight, onEdit, onToggle, onRemove, pct }) {
  return (
    <TableRow>
      <TableCell>
        <span className="inline-flex items-center gap-2">
          <PrizeIcon image={prize.image} className="h-8 w-8" />
          {prize.name}
        </span>
      </TableCell>
      <TableCell>{TYPE_LABEL[prize.type] || prize.type}</TableCell>
      <TableCell>{prize.type === 'balance' || prize.type === 'days' ? prize.value : '-'}</TableCell>
      <TableCell>{prize.weight}</TableCell>
      <TableCell>{prize.enabled ? pct(prize.weight, totalWeight) : '-'}</TableCell>
      <TableCell>{prize.stock < 0 ? '无限' : prize.stock}</TableCell>
      <TableCell><Badge variant={prize.enabled ? 'default' : 'secondary'}>{prize.enabled ? '启用' : '停用'}</Badge></TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-0.5">
          <IconButton label="编辑" onClick={() => onEdit(prize)}><Pencil /></IconButton>
          <IconButton label={prize.enabled ? '停用' : '启用'} onClick={() => onToggle(prize)}>
            {prize.enabled ? <PowerOff /> : <Power />}
          </IconButton>
          <IconButton variant="destructive" label="删除" onClick={() => onRemove(prize)}><Trash2 /></IconButton>
        </div>
      </TableCell>
    </TableRow>
  );
}

// 中奖记录行组件
function RecordRow({ record, onFulfill }) {
  return (
    <TableRow>
      <TableCell>{record.username}</TableCell>
      <TableCell>{record.prize_name}</TableCell>
      <TableCell>{TYPE_LABEL[record.prize_type] || record.prize_type}</TableCell>
      <TableCell>{record.is_free ? '免费' : `-${record.cost}`}</TableCell>
      <TableCell>
        {record.fulfilled ? <Badge>已发放</Badge> : <Badge variant="secondary">待发放</Badge>}
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">{new Date(record.created_at).toLocaleString()}</TableCell>
      <TableCell className="text-right">
        {!record.fulfilled && <Button size="sm" variant="outline" onClick={() => onFulfill(record)}><Check className="mr-1 h-3 w-3" /> 标记发放</Button>}
      </TableCell>
    </TableRow>
  );
}

export default function AdminLottery() {
  usePageTitle('每日抽奖');
  const { confirm } = useConfirm();
  const navigate = useNavigate();
  const [prizes, setPrizes] = useState([]);
  const [totalWeight, setTotalWeight] = useState(0);
  const [records, setRecords] = useState([]);
  const [recTotal, setRecTotal] = useState(0);
  const [recPage, setRecPage] = useState(1);
  const recPageSize = 20;
  const [cfg, setCfg] = useState({ cost: 0, free_per_day: 1 });

  const load = useCallback(async () => {
    try {
      const [p, c] = await Promise.all([
        api.get('/api/admin/lottery/prizes'),
        api.get('/api/admin/lottery/config')
      ]);
      setPrizes(p.prizes || []);
      setTotalWeight(p.totalWeight || 0);
      setCfg(c.config);
    } catch (e) {
      toast.error(e.message);
    }
  }, []);

  const loadRecords = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(recPage), pageSize: String(recPageSize) });
      const r = await api.get(`/api/admin/lottery/records?${params.toString()}`);
      setRecords(r.records || []);
      setRecTotal(r.total || 0);
    } catch (e) {
      toast.error(e.message);
    }
  }, [recPage]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadRecords(); }, [loadRecords]);

  const recTotalPages = useMemo(() => Math.max(1, Math.ceil(recTotal / recPageSize)), [recTotal, recPageSize]);

  const openCreate = useCallback(() => navigate('/admin/lottery/prizes/new'), [navigate]);
  const openEdit = useCallback(p => navigate(`/admin/lottery/prizes/edit/${p.id}`), [navigate]);

  const saveCfg = useCallback(async () => {
    try {
      await api.post('/api/admin/lottery/config', cfg);
      toast.success('配置已保存');
    } catch (e) {
      toast.error(e.message);
    }
  }, [cfg]);

  const toggle = useCallback(async p => {
    try {
      await api.post(`/api/admin/lottery/prizes/${p.id}/toggle`);
      load();
    } catch (e) {
      toast.error(e.message);
    }
  }, [load]);

  const remove = useCallback(async p => {
    if (!(await confirm({ title: '删除奖品', description: `确定删除「${p.name}」吗？` }))) return;
    try {
      await api.post(`/api/admin/lottery/prizes/${p.id}/delete`);
      toast.success('已删除');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  }, [confirm, load]);

  const fulfill = useCallback(async r => {
    try {
      await api.post(`/api/admin/lottery/records/${r.id}/fulfill`);
      toast.success('已标记发放');
      loadRecords();
    } catch (e) {
      toast.error(e.message);
    }
  }, [loadRecords]);

  const pct = useCallback((w, total) => (total > 0 ? ((w / total) * 100).toFixed(2) + '%' : '-'), []);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader title="每日抽奖" count={prizes.length} countLabel="个奖品" />
      
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>抽奖配置</CardTitle>
          <CardDescription>设置每日免费次数与付费续抽价格</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-4">
          <div className="space-y-1">
            <Label>每日免费次数</Label>
            <Input type="number" className="w-32" value={cfg.free_per_day}
              onChange={e => setCfg({ ...cfg, free_per_day: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>付费续抽价格（余额）</Label>
            <Input type="number" step="0.01" className="w-40" value={cfg.cost}
              onChange={e => setCfg({ ...cfg, cost: e.target.value })} />
          </div>
          <Button onClick={saveCfg}>保存配置</Button>
        </CardContent>
      </Card>

      <Tabs defaultValue="prizes">
        <TabsList>
          <TabsTrigger value="prizes">奖品概率</TabsTrigger>
          <TabsTrigger value="records">中奖记录</TabsTrigger>
        </TabsList>

        <TabsContent value="prizes">
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>奖品列表</CardTitle>
                <CardDescription>权重越大中奖概率越高，当前总权重 {totalWeight}（库存 -1 表示无限）</CardDescription>
              </div>
              <Button onClick={openCreate}><Plus className="mr-1 h-4 w-4" /> 添加奖品</Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>名称</TableHead>
                    <TableHead>类型</TableHead>
                    <TableHead>面值</TableHead>
                    <TableHead>权重</TableHead>
                    <TableHead>概率</TableHead>
                    <TableHead>库存</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {prizes.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">暂无奖品</TableCell></TableRow>
                  ) : prizes.map(p => (
                    <PrizeRow
                      key={p.id}
                      prize={p}
                      totalWeight={totalWeight}
                      onEdit={openEdit}
                      onToggle={toggle}
                      onRemove={remove}
                      pct={pct}
                    />
                  ))}
                </TableBody>
              </Table>
              <div className="flex items-center justify-between pt-4">
                <span className="text-sm text-muted-foreground">第 {recPage} / {recTotalPages} 页</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={recPage <= 1} onClick={() => setRecPage(p => p - 1)}>
                    <ChevronLeft className="h-4 w-4" /> 上一页
                  </Button>
                  <Button variant="outline" size="sm" disabled={recPage >= recTotalPages} onClick={() => setRecPage(p => p + 1)}>
                    下一页 <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="records">
          <Card className="shadow-sm">
            <CardHeader><CardTitle>中奖记录</CardTitle><CardDescription>共 {recTotal} 条，实物/卡密类需手动标记发放</CardDescription></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>用户</TableHead>
                    <TableHead>奖品</TableHead>
                    <TableHead>类型</TableHead>
                    <TableHead>消耗</TableHead>
                    <TableHead>发放</TableHead>
                    <TableHead>时间</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">暂无记录</TableCell></TableRow>
                  ) : records.map(r => (
                    <RecordRow key={r.id} record={r} onFulfill={fulfill} />
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
