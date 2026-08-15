import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { usePageTitle } from '@/hooks/use-site-config';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PawPrint, Coins, TrendingUp } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';

// 宠物属性卡片组件
function PetAttributeCard({ label, value }) {
  return (
    <Card className="border-2">
      <CardContent className="pt-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-2 text-xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

// 账号选择器组件
function AccountSelector({ accounts, onSelectAccount, navigate }) {
  if (accounts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-14">
        <p className="text-lg font-semibold">还没有绑定账号</p>
        <p className="mt-1 text-sm text-muted-foreground">请先到仪表盘绑定 B 站账号</p>
        <Button className="mt-4" onClick={() => navigate('/dashboard')}>
          返回仪表盘
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="mb-3 text-sm font-medium text-muted-foreground">请选择账号查看宠物信息</p>
      {accounts.map(acc => (
        <button
          key={acc.id}
          onClick={() => onSelectAccount(acc.id)}
          className="flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors hover:bg-muted/50"
        >
          {acc.avatar ? (
            <img
              src={acc.avatar}
              alt={acc.nickname}
              referrerPolicy="no-referrer"
              className="h-10 w-10 rounded-lg object-cover ring-2 ring-border/50"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary ring-2 ring-border/50">
              {(acc.nickname || '?').charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{acc.nickname || '未知'}</p>
            <p className="font-mono text-xs text-muted-foreground">UID: {acc.bili_uid || '-'}</p>
          </div>
          <PawPrint className="h-5 w-5 text-primary" />
        </button>
      ))}
    </div>
  );
}

function fmtDate(s) {
  if (!s) return '-';
  return new Date(s).toLocaleString('zh-CN', { hour12: false });
}

export default function PetLevels() {
  usePageTitle('宠物升级');
  const { accountId } = useParams();
  const navigate = useNavigate();
  const [account, setAccount] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [petInfo, setPetInfo] = useState(null);
  const [petLoading, setPetLoading] = useState(false);
  const [roomId, setRoomId] = useState('');
  const [logs, setLogs] = useState([]);
  const [logsPage, setLogsPage] = useState(1);
  const [logsTotal, setLogsTotal] = useState(0);

  const loadAccounts = useCallback(async () => {
    try {
      const data = await api.get('/api/user/overview');
      setAccounts(data.accounts || []);
    } catch (e) {
      toast.error(e.message);
    }
  }, []);

  const loadAccount = useCallback(async () => {
    try {
      const data = await api.get('/api/user/overview');
      const acc = data.accounts.find(a => a.id === parseInt(accountId, 10));
      if (!acc) {
        toast.error('账号不存在');
        navigate('/dashboard');
        return;
      }
      setAccount(acc);
    } catch (e) {
      toast.error(e.message);
    }
  }, [accountId, navigate]);

  const loadLogs = useCallback(async (page) => {
    try {
      const params = accountId ? `?accountId=${accountId}&page=${page}&pageSize=10` : `?page=${page}&pageSize=10`;
      const data = await api.get(`/api/user/pet-logs${params}`);
      if (data.ok) {
        setLogs(data.list || []);
        setLogsTotal(data.total || 0);
        setLogsPage(page);
      }
    } catch (e) {
      toast.error(e.message);
    }
  }, [accountId]);

  useEffect(() => {
    if (accountId) {
      loadAccount();
      loadLogs(1);
    } else {
      loadAccounts();
    }
  }, [accountId, loadAccounts, loadAccount, loadLogs]);

  const fetchPet = useCallback(async () => {
    if (!account) return;
    if (!roomId.trim()) {
      toast.error('请输入正在直播的房间号');
      return;
    }
    setPetLoading(true);
    setPetInfo(null);
    try {
      const data = await api.get(`/api/user/account/${account.id}/pet?roomId=${encodeURIComponent(roomId.trim())}`);
      if (!data || !data.ok) {
        toast.error(data?.message || '查询失败');
        return;
      }
      setPetInfo(data.info);
      toast.success('查询成功');
      // 刷新升级记录
      loadLogs(1);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setPetLoading(false);
    }
  }, [account, roomId, loadLogs]);

  if (!accountId) {
    return (
      <div className="mx-auto max-w-7xl space-y-6">
        <PageHeader title="宠物升级" subtitle="查看弹幕宠物信息和升级历史" />
        <Card className="shadow-sm">
          <CardContent className="py-6">
            <AccountSelector
              accounts={accounts}
              onSelectAccount={acc => navigate('/pet-levels/' + acc)}
              navigate={navigate}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title={`宠物升级 - ${account?.nickname || '加载中...'}`}
        subtitle="查看弹幕宠物信息和升级历史"
        onBack={() => navigate('/pet-levels')}
      />

      {/* 查询面板 */}
      <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>查询宠物信息</CardTitle>
            <CardDescription>需该直播间正在开播且已开启弹幕宠物</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-end gap-3">
              <div className="flex-1 space-y-2">
                <Label htmlFor="roomId">直播间房间号</Label>
                <Input
                  id="roomId"
                  placeholder="请输入正在直播的房间号"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchPet()}
                />
              </div>
              <Button onClick={fetchPet} disabled={petLoading || !account || !roomId.trim()} className="gap-2">
                {petLoading ? '查询中...' : '查询'}
              </Button>
            </div>

            {/* 宠物信息展示 */}
            {petInfo && (
              <div className="mt-6 space-y-4">
                {/* 金币 */}
                <div className="flex items-center justify-between rounded-xl border bg-gradient-to-br from-primary/10 to-primary/5 p-6 shadow-sm">
                  <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Coins className="h-5 w-5 text-primary" /> 金币
                  </span>
                  <span className="text-3xl font-bold text-primary">{petInfo.coin || '-'}</span>
                </div>

                {/* 属性网格 */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <PetAttributeCard label="皮肤" value={petInfo.petName || '-'} />
                  <PetAttributeCard label="等级" value={`[${petInfo.level || '-'}] ${petInfo.levelName || ''}`} />
                  <PetAttributeCard label="真元" value={petInfo.trueEnergy ?? '-'} />
                  <PetAttributeCard label="攻击" value={petInfo.attack ?? '-'} />
                  <PetAttributeCard label="防御" value={petInfo.defense ?? '-'} />
                  <PetAttributeCard label="宗门" value={petInfo.sect || '-'} />
                </div>

                {/* 进阶进度 */}
                <Card className="border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
                  <CardContent className="space-y-3 pt-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-primary" />
                        <span className="font-semibold">进阶进度</span>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        下级: [{petInfo.levelDown || '-'}] {petInfo.levelDownName || ''}
                      </span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">
                          {petInfo.energyCurrent ?? '-'} / {petInfo.energyFull ?? '-'}
                        </span>
                        {petInfo.energyFull != null && petInfo.energyCurrent != null && (
                          <span className="text-muted-foreground">
                            还差 {Math.max(0, petInfo.energyFull - petInfo.energyCurrent)} 升级
                          </span>
                        )}
                      </div>
                      {petInfo.energyFull != null && petInfo.energyCurrent != null && (
                        <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-primary to-primary/80 transition-all"
                            style={{
                              width: `${Math.min(100, (petInfo.energyCurrent / petInfo.energyFull) * 100)}%`
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 升级历史 */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>升级历史</CardTitle>
            <CardDescription>记录宠物等级提升的历史</CardDescription>
          </CardHeader>
          <CardContent>
            {logs.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">暂无升级记录</div>
            ) : (
              <div className="space-y-4">
                {logs.map((log) => (
                  <Card key={log.id} className="border-l-4 border-primary">
                    <CardContent className="flex items-center justify-between p-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-3">
                          <span className="font-semibold">{log.nickname}</span>
                          <span className="text-sm text-muted-foreground">房间: {log.room_id}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-muted-foreground">
                            等级: {log.level_before ?? '初始'} → {log.level_after}
                          </span>
                          <span className="font-medium text-primary">{log.level_name}</span>
                          {log.pet_name && <span className="text-muted-foreground">({log.pet_name})</span>}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          {log.coin != null && <span>金币: {log.coin}</span>}
                          {log.attack != null && <span>攻击: {log.attack}</span>}
                          {log.defense != null && <span>防御: {log.defense}</span>}
                        </div>
                      </div>
                      <div className="text-right text-xs text-muted-foreground">{fmtDate(log.created_at)}</div>
                    </CardContent>
                  </Card>
                ))}
                {logsTotal > 10 && (
                  <div className="flex items-center justify-center gap-2 pt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={logsPage === 1}
                      onClick={() => loadLogs(logsPage - 1)}
                    >
                      上一页
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      第 {logsPage} 页 / 共 {Math.ceil(logsTotal / 10)} 页
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={logsPage >= Math.ceil(logsTotal / 10)}
                      onClick={() => loadLogs(logsPage + 1)}
                    >
                      下一页
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
    </div>
  );
}
