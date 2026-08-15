import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { usePageTitle } from '@/hooks/use-site-config';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Link2, Plus, Pencil, Trash2, ToggleLeft, ToggleRight, ExternalLink } from 'lucide-react';

export default function AdminFriendLinks() {
  usePageTitle('友情链接管理');
  const navigate = useNavigate();
  const [links, setLinks] = useState([]);

  const load = async () => {
    const data = await api.get('/api/admin/friend-links');
    setLinks(data.links || []);
  };

  useEffect(() => {
    load();
  }, []);

  const openAdd = () => {
    navigate('/admin/friend-links/new');
  };

  const openEdit = (link) => {
    navigate(`/admin/friend-links/edit/${link.id}`);
  };

  const toggleLink = async (link) => {
    try {
      await api.post(`/api/admin/friend-links/${link.id}/toggle`);
      toast.success(link.enabled ? '已禁用' : '已启用');
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const deleteLink = async (link) => {
    if (!confirm(`确认删除友情链接「${link.name}」？`)) return;
    try {
      await api.post(`/api/admin/friend-links/${link.id}/delete`);
      toast.success('删除成功');
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="友情链接管理"
        count={links.length}
        countLabel="个链接"
        actions={<Button onClick={openAdd}><Plus className="mr-2 h-4 w-4" /> 添加链接</Button>}
      />
      <Card className="shadow-sm">
        <CardContent className="pt-6">
          {links.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed bg-muted/30 py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 ring-2 ring-primary/20">
                <Link2 className="h-8 w-8 text-primary" />
              </div>
              <div className="space-y-1">
                <p className="font-medium">还没有友情链接</p>
                <p className="text-sm text-muted-foreground">添加友情链接将在首页展示</p>
              </div>
              <Button size="sm" onClick={openAdd} className="shadow-sm">
                <Plus className="mr-2 h-4 w-4" /> 添加链接
              </Button>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold">名称</TableHead>
                    <TableHead className="font-semibold">链接地址</TableHead>
                    <TableHead className="font-semibold">描述</TableHead>
                    <TableHead className="font-semibold">排序</TableHead>
                    <TableHead className="font-semibold">状态</TableHead>
                    <TableHead className="text-right font-semibold">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {links.map((link) => (
                    <TableRow key={link.id} className="transition-colors hover:bg-muted/30">
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {link.logo && (
                            <img src={link.logo} alt={link.name} className="h-6 w-6 rounded object-cover" />
                          )}
                          {link.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                        >
                          <span className="max-w-xs truncate">{link.url}</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-muted-foreground">
                        {link.description || '-'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{link.sort_order}</TableCell>
                      <TableCell>
                        {link.enabled ? (
                          <Badge variant="success" className="shadow-sm">已启用</Badge>
                        ) : (
                          <Badge variant="secondary" className="shadow-sm">已禁用</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => toggleLink(link)}
                            className="h-8 w-8 p-0"
                          >
                            {link.enabled ? (
                              <ToggleRight className="h-4 w-4 text-green-600" />
                            ) : (
                              <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openEdit(link)}
                            className="h-8 w-8 p-0"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deleteLink(link)}
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
