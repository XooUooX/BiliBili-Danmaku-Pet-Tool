import { useEffect, useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { usePageTitle } from '@/hooks/use-site-config';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { RichEditor, RichContent } from '@/components/ui/rich-editor';
import { useAuth } from '@/hooks/use-auth';
import { Plus, Inbox, Send, RefreshCw, Headset } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';

const CAT_LABEL = { recharge: '充值问题', account: '账号问题', feature: '功能建议', other: '其他' };

// 判断富文本是否为空（去标签后无文字）
const htmlEmpty = html => !String(html || '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
const STATUS = {
  open: { label: '待处理', variant: 'destructive' },
  pending: { label: '客服已回复', variant: 'default' },
  resolved: { label: '已解决', variant: 'secondary' },
  closed: { label: '已关闭', variant: 'outline' }
};

function fmt(s) {
  if (!s) return '-';
  return new Date(s).toLocaleString('zh-CN', { hour12: false });
}

const EMPTY_FORM = { category: 'recharge', title: '', content: '' };

// 是否需要在两条消息之间显示时间分隔（间隔超过5分钟或首条）
function needTimeSep(prev, cur) {
  if (!prev) return true;
  const a = new Date(prev.created_at).getTime();
  const b = new Date(cur.created_at).getTime();
  return Math.abs(b - a) > 5 * 60 * 1000;
}

export default function UserTickets() {
  usePageTitle('在线工单');
  const { user } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [activeId, setActiveId] = useState(null);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const d = await api.get('/api/user/tickets');
      setTickets(d.tickets || []);
    } catch (e) { toast.error(e.message); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const loadDetail = useCallback(async id => {
    try {
      const d = await api.get(`/api/user/tickets/${id}`);
      setActive(d.ticket);
      setMessages(d.messages || []);
    } catch (e) { toast.error(e.message); }
  }, []);

  const openTicket = id => {
    setCreating(false);
    setActiveId(id);
    setReply('');
    loadDetail(id);
  };

  const startCreate = () => {
    setCreating(true);
    setActiveId(null);
    setActive(null);
    setMessages([]);
    setForm(EMPTY_FORM);
  };

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const submit = async e => {
    e.preventDefault();
    if (!form.title.trim()) return toast.error('请填写标题');
    if (htmlEmpty(form.content)) return toast.error('请填写问题描述');
    setSubmitting(true);
    try {
      const d = await api.post('/api/user/tickets', form);
      toast.success('工单已提交');
      setCreating(false);
      setForm(EMPTY_FORM);
      await load();
      if (d?.id) openTicket(d.id);
    } catch (err) { toast.error(err.message); } finally { setSubmitting(false); }
  };

  const send = async () => {
    if (htmlEmpty(reply)) return toast.error('请输入内容');
    setSending(true);
    try {
      await api.post(`/api/user/tickets/${activeId}/reply`, { content: reply });
      setReply('');
      await loadDetail(activeId);
      load();
    } catch (e) { toast.error(e.message); } finally { setSending(false); }
  };

  const close = async () => {
    try {
      await api.post(`/api/user/tickets/${activeId}/close`);
      await loadDetail(activeId);
      load();
      toast.success('工单已关闭');
    } catch (e) { toast.error(e.message); }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="在线工单"
        subtitle="遇到问题可提交工单，客服会尽快回复"
        actions={<>
          <Button variant="outline" size="icon" onClick={load}><RefreshCw className="h-4 w-4" /></Button>
          <Button onClick={startCreate}><Plus className="mr-1 h-4 w-4" /> 新建工单</Button>
        </>}
      />

      <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
        {/* 列表：移动端在新建/查看详情时隐藏 */}
        <Card className={`flex-col lg:flex lg:h-[calc(100vh-12rem)] ${(creating || active) ? 'hidden' : 'flex'}`}>
          <CardContent className="flex-1 overflow-y-auto p-2">
            {tickets.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                <Inbox className="h-8 w-8" /> 暂无工单
              </div>
            ) : (
              <ul className="space-y-1">
                {tickets.map(t => {
                  const st = STATUS[t.status] || {};
                  const selected = t.id === activeId;
                  return (
                    <li key={t.id}>
                      <button
                        onClick={() => openTicket(t.id)}
                        className={`w-full rounded-lg border p-3 text-left transition-colors ${selected ? 'border-primary bg-primary/5' : 'border-transparent hover:bg-accent'}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-medium">{t.title}</span>
                          <Badge variant={st.variant}>{st.label || t.status}</Badge>
                        </div>
                        <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                          <span className="truncate">{CAT_LABEL[t.category] || t.category}</span>
                          <span className="shrink-0">{t.msg_count} 条</span>
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">{fmt(t.updated_at)}</div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* 右侧面板：新建 / 详情 / 占位（移动端空闲时隐藏） */}
        <Card className={`flex-col lg:flex lg:h-[calc(100vh-12rem)] ${(creating || active) ? 'flex' : 'hidden lg:flex'}`}>
          {creating ? (
            <form onSubmit={submit} className="flex h-full flex-col">
              <div className="border-b p-4">
                <h2 className="font-semibold">新建工单</h2>
                <p className="text-sm text-muted-foreground">请尽量详细描述遇到的问题</p>
              </div>
              <div className="flex-1 space-y-4 overflow-y-auto p-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>问题分类</Label>
                    <Select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                      <option value="recharge">充值问题</option>
                      <option value="account">账号问题</option>
                      <option value="feature">功能建议</option>
                      <option value="other">其他</option>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>标题</Label>
                    <Input value={form.title} maxLength={120} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="一句话概括问题" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>问题描述</Label>
                  <RichEditor height={260} value={form.content} onChange={v => setForm({ ...form, content: v })} placeholder="请尽量详细描述遇到的问题..." />
                </div>
              </div>
              <div className="flex justify-end gap-2 border-t p-3">
                <Button type="button" variant="outline" onClick={() => setCreating(false)}>取消</Button>
                <Button type="submit" disabled={submitting}>{submitting ? '提交中...' : '提交工单'}</Button>
              </div>
            </form>
          ) : !active ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
              <Inbox className="h-10 w-10" /> 请选择左侧工单查看详情，或新建工单
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-4 border-b p-4">
                <div className="min-w-0">
                  <Button variant="ghost" size="sm" className="mb-1 -ml-2 h-7 px-2 lg:hidden" onClick={() => { setActive(null); setActiveId(null); }}>← 返回列表</Button>
                  <h2 className="truncate font-semibold">{active.title}</h2>
                  <p className="text-sm text-muted-foreground">
                    {CAT_LABEL[active.category] || active.category} · 创建于 {fmt(active.created_at)}
                  </p>
                </div>
                <Badge variant={(STATUS[active.status] || {}).variant} className="shrink-0">
                  {(STATUS[active.status] || {}).label || active.status}
                </Badge>
              </div>

              <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto bg-muted/30 p-4">
                {messages.map((m, i) => {
                  const mine = m.sender === 'user';
                  const showTime = needTimeSep(messages[i - 1], m);
                  return (
                    <div key={m.id}>
                      {showTime && (
                        <div className="my-3 text-center">
                          <span className="rounded-full bg-foreground/5 px-2 py-0.5 text-xs text-muted-foreground">{fmt(m.created_at)}</span>
                        </div>
                      )}
                      <div className={`flex items-start gap-2 ${mine ? 'flex-row-reverse' : 'flex-row'}`}>
                        {/* 头像 */}
                        {mine ? (
                          user?.avatar ? (
                            <img src={user.avatar} alt="我" className="h-9 w-9 shrink-0 rounded-full object-cover" />
                          ) : (
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
                              {(user?.username || '?').slice(0, 1).toUpperCase()}
                            </span>
                          )
                        ) : (
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
                            <Headset className="h-4 w-4" />
                          </span>
                        )}
                        {/* 气泡 */}
                        <div className={`group relative max-w-[75%] rounded-2xl px-3 py-2 text-sm shadow-sm ${mine ? 'rounded-tr-sm bg-primary text-primary-foreground' : 'rounded-tl-sm bg-card'}`}>
                          {m.content && <RichContent html={m.content} />}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="border-t p-3">
                {active.status === 'closed' ? (
                  <p className="py-2 text-center text-sm text-muted-foreground">工单已关闭</p>
                ) : (
                  <div className="space-y-2">
                    <RichEditor
                      height={180}
                      placeholder="继续补充问题描述..."
                      value={reply}
                      onChange={setReply}
                    />
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={close}>关闭工单</Button>
                      <Button onClick={send} disabled={sending}>
                        <Send className="h-4 w-4" /> {sending ? '发送中...' : '发送'}
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
