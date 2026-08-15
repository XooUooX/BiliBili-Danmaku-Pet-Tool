import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { usePageTitle } from '@/hooks/use-site-config';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { RichEditor, RichContent } from '@/components/ui/rich-editor';
import { ChevronLeft, ChevronRight, Inbox, Send, RefreshCw, Headset } from 'lucide-react';

const htmlEmpty = html => !String(html || '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();

function needTimeSep(prev, cur) {
  if (!prev) return true;
  const a = new Date(prev.created_at).getTime();
  const b = new Date(cur.created_at).getTime();
  return Math.abs(b - a) > 5 * 60 * 1000;
}

const CAT_LABEL = { recharge: '充值问题', account: '账号问题', feature: '功能建议', other: '其他' };
const STATUS = {
  open: { label: '待处理', variant: 'destructive' },
  pending: { label: '处理中', variant: 'default' },
  resolved: { label: '已解决', variant: 'secondary' },
  closed: { label: '已关闭', variant: 'outline' }
};
const STATUS_OPTIONS = [
  { value: 'open', label: '待处理' },
  { value: 'pending', label: '处理中' },
  { value: 'resolved', label: '已解决' },
  { value: 'closed', label: '已关闭' }
];

function fmt(s) {
  if (!s) return '-';
  return new Date(s).toLocaleString('zh-CN', { hour12: false });
}

// 工单列表项组件
function TicketItem({ ticket, isSelected, onSelect, status }) {
  const st = status[ticket.status] || {};
  return (
    <li>
      <button
        onClick={() => onSelect(ticket.id)}
        className={`w-full rounded-lg border p-3 text-left transition-colors ${isSelected ? 'border-primary bg-primary/5' : 'border-transparent hover:bg-accent'}`}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium">{ticket.title}</span>
          <Badge variant={st.variant}>{st.label || ticket.status}</Badge>
        </div>
        <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
          <span className="truncate">{ticket.username} · {CAT_LABEL[ticket.category] || ticket.category}</span>
          <span className="shrink-0">{ticket.msg_count} 条</span>
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">{fmt(ticket.updated_at)}</div>
      </button>
    </li>
  );
}

// 消息气泡组件
function Message({ message, activeTicket, status, needSeparator }) {
  const isAdmin = message.sender === 'admin';
  return (
    <div>
      {needSeparator && (
        <div className="my-3 text-center">
          <span className="rounded-full bg-foreground/5 px-2 py-0.5 text-xs text-muted-foreground">{fmt(message.created_at)}</span>
        </div>
      )}
      <div className={`flex items-start gap-2 ${isAdmin ? 'flex-row-reverse' : 'flex-row'}`}>
        {isAdmin ? (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
            <Headset className="h-4 w-4" />
          </span>
        ) : activeTicket?.user_avatar ? (
          <img src={activeTicket.user_avatar} alt={activeTicket.username} className="h-9 w-9 shrink-0 rounded-full object-cover" />
        ) : (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
            {(activeTicket?.username || '?').slice(0, 1).toUpperCase()}
          </span>
        )}
        <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm shadow-sm ${isAdmin ? 'rounded-tr-sm bg-primary text-primary-foreground' : 'rounded-tl-sm bg-card'}`}>
          {message.content && <RichContent html={message.content} />}
          {message.images?.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {message.images.map((src, idx) => (
                <a key={idx} href={src} target="_blank" rel="noreferrer">
                  <img src={src} alt="" className="h-16 w-16 rounded object-cover" />
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminTickets() {
  usePageTitle('工单管理');
  const [tickets, setTickets] = useState([]);
  const [filter, setFilter] = useState('');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [activeId, setActiveId] = useState(null);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);
  const scrollRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (filter) params.set('status', filter);
      const d = await api.get(`/api/admin/tickets?${params.toString()}`);
      setTickets(d.tickets || []);
      setTotal(d.total || 0);
    } catch (e) { toast.error(e.message); }
  }, [filter, page]);

  useEffect(() => { setPage(1); }, [filter]);
  useEffect(() => { load(); }, [load]);

  const loadDetail = useCallback(async (id) => {
    try {
      const d = await api.get(`/api/admin/tickets/${id}`);
      setActive(d.ticket || null);
      setMessages(d.messages || []);
    } catch (e) {
      toast.error(e.message);
    }
  }, []);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);

  const openTicket = useCallback(id => {
    setActiveId(id);
    setReply('');
    loadDetail(id);
  }, [loadDetail]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const send = useCallback(async () => {
    if (htmlEmpty(reply)) return toast.error('请输入回复内容');
    setSending(true);
    try {
      await api.post(`/api/admin/tickets/${activeId}/reply`, { content: reply });
      setReply('');
      await loadDetail(activeId);
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSending(false);
    }
  }, [activeId, reply, loadDetail, load]);

  const changeStatus = useCallback(async status => {
    if (!activeId || status === active?.status) return;
    setStatusSaving(true);
    try {
      await api.post(`/api/admin/tickets/${activeId}/status`, { status });
      await loadDetail(activeId);
      load();
      toast.success('状态已更新');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setStatusSaving(false);
    }
  }, [activeId, active?.status, loadDetail, load]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="工单管理"
        count={total}
        countLabel="条待处理工单"
        actions={
          <>
            <Select value={filter} className="w-36" onChange={e => setFilter(e.target.value)}>
              <option value="">全部状态</option>
              {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
            <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4" /></Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
        {/* 列表 */}
        <Card className="flex h-[calc(100vh-12rem)] flex-col">
          <CardContent className="flex-1 overflow-y-auto p-2">
            {tickets.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                <Inbox className="h-8 w-8" /> 暂无工单
              </div>
            ) : (
              <ul className="space-y-1">
                {tickets.map(t => (
                  <TicketItem
                    key={t.id}
                    ticket={t}
                    isSelected={t.id === activeId}
                    onSelect={openTicket}
                    status={STATUS}
                  />
                ))}
              </ul>
            )}
          </CardContent>
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t px-3 py-2 text-xs text-muted-foreground">
              <span>共 {total} 条 · {page}/{totalPages}</span>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </Card>

        {/* 详情 */}
        <Card className="flex h-[calc(100vh-12rem)] flex-col">
          {!active ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
              <Inbox className="h-10 w-10" /> 请选择左侧工单查看详情
            </div>
          ) : (
            <>
              <CardHeader className="flex flex-row items-start justify-between gap-4 border-b">
                <div className="min-w-0">
                  <CardTitle className="truncate">{active.title}</CardTitle>
                  <CardDescription>
                    #{active.id} · {active.username} · {CAT_LABEL[active.category] || active.category} · 创建于 {fmt(active.created_at)}
                  </CardDescription>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-sm text-muted-foreground">状态</span>
                  <Select
                    value={active.status}
                    className="h-8 w-28"
                    disabled={statusSaving}
                    onChange={e => changeStatus(e.target.value)}
                  >
                    {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </Select>
                </div>
              </CardHeader>

              <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto bg-muted/30 p-4">
                {messages.map((m, i) => (
                  <Message
                    key={m.id}
                    message={m}
                    activeTicket={active}
                    status={STATUS}
                    needSeparator={needTimeSep(messages[i - 1], m)}
                  />
                ))}
              </div>

              <div className="border-t p-3">
                {active.status === 'closed' ? (
                  <p className="py-2 text-center text-sm text-muted-foreground">工单已关闭，如需继续处理请改回其他状态</p>
                ) : (
                  <div className="space-y-2">
                    <RichEditor
                      height={180}
                      value={reply}
                      onChange={setReply}
                    />
                    <div className="flex justify-end">
                      <Button onClick={send} disabled={sending}>
                        <Send className="h-4 w-4" /> {sending ? '发送中...' : '发送回复'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
