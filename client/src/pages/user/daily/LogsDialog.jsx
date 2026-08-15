import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import { ScrollText } from 'lucide-react';
import { fmtDate } from './taskMeta';

export default function LogsDialog({ open, onOpenChange, title, logs, loading }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScrollText className="h-5 w-5" /> {title || '执行日志'}
          </DialogTitle>
          <DialogDescription>最近 100 条执行记录</DialogDescription>
        </DialogHeader>
        <div className="max-h-96 overflow-y-auto">
          {loading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">加载中...</p>
          ) : logs.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">暂无日志</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>时间</TableHead>
                  <TableHead>结果</TableHead>
                  <TableHead>详情</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map(l => (
                  <TableRow key={l.id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{fmtDate(l.created_at)}</TableCell>
                    <TableCell>
                      {l.success
                        ? <Badge variant="success">成功</Badge>
                        : <Badge variant="destructive">失败</Badge>}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {l.code != null ? `[${l.code}] ` : ''}{l.result || '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
