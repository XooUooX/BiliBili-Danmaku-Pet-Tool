import { useState, useRef } from 'react';
import { Upload, X, Loader2, ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Button } from './button';
import { cn } from '@/lib/utils';

/**
 * 图片上传组件
 * @param {Object} props
 * @param {Function} props.onUploadSuccess - 上传成功回调 (url, data) => void
 * @param {string} props.value - 当前图片 URL
 * @param {Function} props.onChange - 图片 URL 变化回调
 * @param {string} props.className - 自定义样式
 * @param {boolean} props.multiple - 是否支持多图上传
 */
export function ImageUploader({ onUploadSuccess, value, onChange, className, multiple = false }) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(value || '');
  const fileInputRef = useRef(null);

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    setUploading(true);
    try {
      for (const file of files) {
        // 验证文件类型
        if (!file.type.startsWith('image/')) {
          toast.error('仅支持图片格式');
          continue;
        }

        // 验证文件大小
        if (file.size > 10 * 1024 * 1024) {
          toast.error('图片大小不能超过 10MB');
          continue;
        }

        // 创建 FormData
        const formData = new FormData();
        formData.append('file', file);

        // 上传到后端
        const res = await api.post('/api/admin/upload/image', formData);

        if (res.ok) {
          const imageUrl = res.url;
          setPreview(imageUrl);
          onChange?.(imageUrl);
          onUploadSuccess?.(imageUrl, res.data);
          toast.success('图片上传成功');
        } else {
          toast.error(res.message || '上传失败');
        }
      }
    } catch (error) {
      console.error('图片上传失败:', error);
      toast.error(error.message || '上传失败，请稍后重试');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemove = () => {
    setPreview('');
    onChange?.('');
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className={cn('space-y-2', className)}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple={multiple}
        onChange={handleFileSelect}
        className="hidden"
      />

      {preview ? (
        <div className="relative inline-block">
          <img
            src={preview}
            alt="预览"
            className="max-w-full h-auto max-h-64 rounded-lg border border-border"
          />
          <button
            type="button"
            onClick={handleRemove}
            className="absolute top-2 right-2 p-1 bg-black/60 hover:bg-black/80 text-white rounded-full transition-colors"
            title="删除图片"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleClick}
          disabled={uploading}
          className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-border rounded-lg hover:border-primary hover:bg-accent/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploading ? (
            <>
              <Loader2 className="w-8 h-8 text-muted-foreground animate-spin mb-2" />
              <span className="text-sm text-muted-foreground">上传中...</span>
            </>
          ) : (
            <>
              <ImageIcon className="w-8 h-8 text-muted-foreground mb-2" />
              <span className="text-sm text-muted-foreground">点击上传图片</span>
              <span className="text-xs text-muted-foreground mt-1">
                支持 JPG/PNG/GIF/WebP，最大 10MB
              </span>
            </>
          )}
        </button>
      )}

      {!preview && !uploading && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleClick}
          className="w-full"
        >
          <Upload className="w-4 h-4 mr-2" />
          选择图片
        </Button>
      )}
    </div>
  );
}

/**
 * 简单的图片上传按钮（用于富文本编辑器等场景）
 */
export function ImageUploadButton({ onUploadSuccess, children, className }) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('仅支持图片格式');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('图片大小不能超过 10MB');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await api.post('/api/admin/upload/image', formData);

      if (res.ok) {
        onUploadSuccess?.(res.url, res.data);
        toast.success('图片上传成功');
      } else {
        toast.error(res.message || '上传失败');
      }
    } catch (error) {
      console.error('图片上传失败:', error);
      toast.error(error.message || '上传失败');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />
      <Button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className={className}
      >
        {uploading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            上传中...
          </>
        ) : (
          children || (
            <>
              <Upload className="w-4 h-4 mr-2" />
              上传图片
            </>
          )
        )}
      </Button>
    </>
  );
}
