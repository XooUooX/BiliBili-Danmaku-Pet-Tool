import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { usePageTitle } from '@/hooks/use-site-config';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft, Plus, Download, Copy } from 'lucide-react';

async function copyText(text, msg = '已复制') {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(msg);
  } catch {
    toast.error('复制失败');
  }
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function GenerateCards() {
  const navigate = useNavigate();
  usePageTitle('生成卡密');

  const [amount, setAmount] = useState('10');
  const [count, setCount] = useState('10');
  const [maxUses, setMaxUses] = useState('1');
  const [customCode, setCustomCode] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(null);

  const back = () => navigate('/admin/cards');

  const generate = async e => {
    e.preventDefault();
    const amt = parseFloat(amount);
    const cnt = parseInt(count, 10);
    const uses = parseInt(maxUses, 10);
    if (!amt || amt <= 0) return toast.error('面额无效');
    if (!uses || uses < 1) return toast.error('使用次数无效');
    setGenerating(true);
    try {
      const payload = { amount: amt, maxUses: uses };
      const code = customCode.trim();
      if (code) payload.code = code;
      else payload.count = cnt;
      const d = await api.post('/api/admin/cards/generate', payload);
      setGenerated(d.codes || []);
      toast.success(`已生成 ${d.codes.length} 张卡密`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={back}>
          <ArrowLeft className="h-4 w-4" /> 返回
        </Button>
        <div>
          <h1 className="text-xl font-semibold">生成卡密</h1>
          <p className="text-sm text-muted-foreground">每张卡密每人限用一次，所有人都可使用，总次数受使用次数上限约束</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">卡密配置</CardTitle>
          <CardDescription>设置面额、使用次数与生成数量</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={generate} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>面额（元）</Label>
                <Input type="number" min={1} step="0.01" value={amount} onChange={e => setAmount(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>使用次数上限</Label>
                <Input type="number" min={1} value={maxUses} onChange={e => setMaxUses(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>自定义卡密内容（可选）</Label>
              <Input
                value={customCode}
                onChange={e => setCustomCode(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">填写后只生成 1 张该内容的卡密</p>
            </div>
            <div className="space-y-1">
              <Label>数量</Label>
              <Input
                type="number"
                min={1}
                max={200}
                value={count}
                onChange={e => setCount(e.target.value)}
                disabled={!!customCode.trim()}
              />
              <p className="text-xs text-muted-foreground">单次最多 200 张，自定义内容时此项无效</p>
            </div>
            <div className="space-x-2">
              <Button type="submit" disabled={generating}><Plus className="h-4 w-4" /> 生成</Button>
              <Button type="button" variant="outline" onClick={back}>取消</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {generated && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">新生成的卡密</CardTitle>
            <CardDescription>请复制保存，返回后需在列表查看</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea readOnly value={generated.join('\n')} rows={10} />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => downloadText(`cards-${Date.now()}.txt`, generated.join('\n'))}>
                <Download className="h-4 w-4" /> 导出
              </Button>
              <Button onClick={() => copyText(generated.join('\n'), '已复制全部卡密')}>
                <Copy className="h-4 w-4" /> 复制全部
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
