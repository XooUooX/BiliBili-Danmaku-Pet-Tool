import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { usePageTitle } from '@/hooks/use-site-config';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, RefreshCw, Smartphone } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';

export default function BindAccount() {
  usePageTitle('扫码绑定');
  const navigate = useNavigate();
  const [qr, setQr] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | waiting | scanned | expired | done
  const pollRef = useRef(null);

  const back = () => navigate('/dashboard');

  const pollBind = useCallback(async key => {
    try {
      const r = await api.get('/api/user/account/qrcode/poll?key=' + encodeURIComponent(key));
      if (r.status === 'success') {
        clearInterval(pollRef.current);
        setStatus('done');
        toast.success('绑定成功：' + (r.nickname || ''));
        navigate('/dashboard');
      } else if (r.status === 'scanned') {
        setStatus('scanned');
      } else if (r.status === 'expired' || r.status === 'error') {
        clearInterval(pollRef.current);
        setStatus('expired');
        toast.error(r.message || '二维码已失效，请点击刷新');
      }
    } catch (e) {
      // 忽略单次轮询错误
    }
  }, [navigate]);

  const startBind = useCallback(async () => {
    setStatus('loading');
    setQr(null);
    try {
      const d = await api.post('/api/user/account/qrcode');
      if (!d.ok) {
        toast.error(d.message || '获取二维码失败');
        return;
      }
      setQr(d.qrcode);
      setStatus('waiting');
      pollRef.current && clearInterval(pollRef.current);
      pollRef.current = setInterval(() => pollBind(d.key), 2000);
    } catch (e) {
      toast.error(e.message);
    }
  }, [pollBind]);

  useEffect(() => {
    startBind();
    return () => pollRef.current && clearInterval(pollRef.current);
  }, [startBind]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="扫码绑定"
        subtitle="用B站手机客户端扫码登录"
        onBack={back}
      />

      <Card className="mx-auto max-w-md shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">扫描二维码</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-center rounded-lg bg-muted/30 p-6">
            <div className="relative h-48 w-48">
              {qr ? (
                <img
                  src={qr}
                  alt="二维码"
                  className={`h-48 w-48 rounded-lg shadow-sm transition ${
                    status === 'scanned' || status === 'expired' ? 'blur-sm opacity-40' : ''
                  }`}
                />
              ) : (
                <div className="flex h-48 w-48 items-center justify-center">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              )}
              {status === 'scanned' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-lg">
                  <CheckCircle2 className="h-12 w-12 text-green-500" />
                  <span className="text-sm font-medium text-green-600">扫码成功</span>
                </div>
              )}
              {status === 'expired' && (
                <button
                  type="button"
                  onClick={startBind}
                  className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-lg"
                >
                  <RefreshCw className="h-10 w-10 text-primary" />
                  <span className="text-sm font-medium text-foreground">已失效，点击刷新</span>
                </button>
              )}
            </div>
          </div>
          <p className="flex items-center justify-center gap-1.5 text-center text-sm text-muted-foreground">
            {status === 'scanned' ? (
              <>
                <Smartphone className="h-4 w-4" /> 请在手机上点击「确认登录」
              </>
            ) : status === 'expired' ? (
              '二维码已过期，请刷新后重新扫码'
            ) : (
              '用B站手机客户端扫码后，在手机上确认登录'
            )}
          </p>
          <div className="flex justify-center">
            <Button variant="outline" size="sm" onClick={startBind}>
              <RefreshCw className="h-4 w-4" /> 刷新二维码
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
