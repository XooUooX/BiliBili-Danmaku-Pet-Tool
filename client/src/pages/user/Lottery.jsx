import { useEffect, useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { usePageTitle } from '@/hooks/use-site-config';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CardSkeleton } from '@/components/ui/skeleton';
import { Gift, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';

const TYPE_LABEL = { balance: '余额', days: '天', none: '', physical: '' };

// 奖品图标/图片展示
function PrizeIcon({ image }) {
  if (image) return <img src={image} alt="" className="h-10 w-10 rounded object-cover" referrerPolicy="no-referrer" />;
  return <Gift className="h-10 w-10 text-primary" />;
}

function prizeSubtitle(p) {
  if (p.type === 'balance') return `${p.value} 余额`;
  if (p.type === 'days') return `${p.value} 天`;
  if (p.type === 'physical') return '实物/卡密';
  return '谢谢参与';
}

export default function UserLottery() {
  usePageTitle('每日抽奖');
  const [info, setInfo] = useState(null);
  const [drawing, setDrawing] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [result, setResult] = useState(null);
  const [records, setRecords] = useState([]);
  const [recTotal, setRecTotal] = useState(0);
  const [recPage, setRecPage] = useState(1);
  const recPageSize = 20;
  const timer = useRef(null);

  const load = useCallback(async () => {
    try {
      const d = await api.get('/api/user/lottery/info');
      setInfo(d);
    } catch (e) { toast.error(e.message); }
  }, []);

  const loadRecords = useCallback(async () => {
    try {
      const r = await api.get(`/api/user/lottery/records?page=${recPage}&pageSize=${recPageSize}`);
      setRecords(r.records || []);
      setRecTotal(r.total || 0);
    } catch (e) { toast.error(e.message); }
  }, [recPage]);

  useEffect(() => { load(); return () => clearInterval(timer.current); }, [load]);
  useEffect(() => { loadRecords(); }, [loadRecords]);

  const recTotalPages = Math.max(1, Math.ceil(recTotal / recPageSize));

  const draw = async () => {
    if (drawing || !info) return;
    const n = info.prizes.length;
    if (n === 0) return toast.error('暂无奖品');
    if (info.freeLeft <= 0 && info.balance < info.cost) {
      return toast.error('今日免费次数已用完，且余额不足');
    }
    setDrawing(true);
    setResult(null);

    // 先请求结果，再用跑灯动画定格到中奖项
    let res;
    try {
      res = await api.post('/api/user/lottery/draw');
    } catch (e) {
      setDrawing(false);
      return toast.error(e.message);
    }

    const targetIdx = Math.max(0, info.prizes.findIndex(p => p.id === res.prize.id));
    let step = 0;
    const totalSteps = n * 3 + targetIdx + 1; // 转约3圈后停在目标
    clearInterval(timer.current);
    timer.current = setInterval(() => {
      step++;
      setHighlight(step % n);
      if (step >= totalSteps) {
        clearInterval(timer.current);
        setHighlight(targetIdx);
        setResult(res);
        setDrawing(false);
        const win = res.prize.type !== 'none';
        toast[win ? 'success' : 'message'](win ? `恭喜获得：${res.prize.name}` : '谢谢参与，明天再来');
        load();
        if (recPage === 1) loadRecords(); else setRecPage(1);
      }
    }, 80);
  };

  if (!info) return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader title="每日抽奖" subtitle="好运连连 • 每日免费机会" />
      <Card className="shadow-sm"><CardContent className="py-6"><CardSkeleton /></CardContent></Card>
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader title="每日抽奖" subtitle="好运连连 • 每日免费机会" />
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Gift className="h-5 w-5 text-primary" /> 抽奖池</CardTitle>
          <CardDescription>
            每日 {info.freePerDay} 次免费抽奖，剩余 <b className="text-foreground">{info.freeLeft}</b> 次
            {info.cost > 0 && <>；免费用完后每次消耗 <b className="text-foreground">{info.cost}</b> 余额（当前余额 {info.balance}）</>}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {info.prizes.map((p, i) => (
              <div key={p.id}
                className={`relative flex flex-col items-center justify-center gap-1 rounded-xl border-2 p-4 text-center ${
                  highlight === i ? 'scale-105 border-primary bg-primary/10 shadow-lg' : 'border-muted bg-card'
                }`}>
                <PrizeIcon image={p.image} />
                <div className="text-sm font-medium">{p.name}</div>
                <div className="text-xs text-muted-foreground">{prizeSubtitle(p)}</div>
                {result && result.prize.id === p.id && (
                  <Sparkles className="absolute right-2 top-2 h-4 w-4 text-amber-500" />
                )}
              </div>
            ))}
          </div>
          <div className="mt-5 flex flex-col items-center gap-2">
            <Button size="lg" className="px-10" onClick={draw} disabled={drawing}>
              {drawing ? '抽奖中...' : info.freeLeft > 0 ? '免费抽奖' : `付费抽奖（${info.cost}）`}
            </Button>
            {result && (
              <p className="text-sm">
                本次{result.isFree ? '（免费）' : `（消耗 ${result.cost}）`}：
                <b>{result.prize.name}</b>
                {result.fulfilled === 0 && <span className="text-muted-foreground"> · 待管理员发放</span>}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader><CardTitle className="text-base">我的中奖记录</CardTitle></CardHeader>
        <CardContent>
          {records.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">暂无记录</p>
          ) : (
            <div className="divide-y">
              {records.map(r => (
                <div key={r.id} className="flex items-center justify-between py-2 text-sm">
                  <span>{r.prize_name}{r.prize_type === 'balance' ? `（+${r.prize_value}）` : r.prize_type === 'days' ? `（+${r.prize_value}天）` : ''}</span>
                  <span className="text-xs text-muted-foreground">
                    {r.is_free ? '免费' : `消耗${r.cost}`} · {new Date(r.created_at).toLocaleString()}
                    {r.fulfilled === 0 && ' · 待发放'}
                  </span>
                </div>
              ))}
            </div>
          )}
          {recTotalPages > 1 && (
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
