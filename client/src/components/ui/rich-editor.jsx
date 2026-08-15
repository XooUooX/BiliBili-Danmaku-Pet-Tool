import { useEffect, useRef, useId } from 'react';
import { useTheme } from '@/hooks/use-theme';

// 自托管 TinyMCE 基础路径（client/public/tinymce -> 构建后 /tinymce）
const BASE = '/tinymce';
let loaderPromise = null;

// 仅加载一次 tinymce.min.js
function loadTinyMCE() {
  if (window.tinymce) return Promise.resolve(window.tinymce);
  if (loaderPromise) return loaderPromise;
  loaderPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = `${BASE}/tinymce.min.js`;
    s.referrerPolicy = 'origin';
    s.onload = () => resolve(window.tinymce);
    s.onerror = () => { loaderPromise = null; reject(new Error('TinyMCE 加载失败')); };
    document.head.appendChild(s);
  });
  return loaderPromise;
}

function isDarkMode() {
  return document.documentElement.classList.contains('dark');
}

export function RichEditor({ value, onChange, height = 320, placeholder = '', toolbar }) {
  const editorRef = useRef(null);
  const containerRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const valueRef = useRef(value);
  const rawId = useId();
  const id = 'rte-' + rawId.replace(/[:]/g, '');
  const { theme } = useTheme();

  onChangeRef.current = onChange;
  valueRef.current = value;

  useEffect(() => {
    let disposed = false;
    let editor = null;
    const dark = isDarkMode();

    loadTinyMCE().then(tinymce => {
      if (disposed || !tinymce) return;
      tinymce.init({
        selector: `#${id}`,
        base_url: BASE,
        suffix: '.min',
        license_key: 'gpl',
        height,
        menubar: false,
        branding: false,
        promotion: false,
        statusbar: false,
        language: 'zh-CN',
        language_url: `${BASE}/langs/zh-CN.js`,
        skin: dark ? 'oxide-dark' : 'oxide',
        content_css: dark ? 'dark' : 'default',
        placeholder,
        plugins: 'advlist autolink lists link image table code codesample quickbars searchreplace wordcount emoticons fullscreen',
        toolbar: toolbar || 'undo redo | blocks | bold italic underline strikethrough forecolor backcolor | alignleft aligncenter alignright | bullist numlist | link image table emoticons | code fullscreen',
        quickbars_selection_toolbar: 'bold italic | quicklink',
        quickbars_insert_toolbar: false,
        contextmenu: false,
        convert_urls: false,
        setup: ed => {
          editor = ed;
          editorRef.current = ed;
          ed.on('init', () => {
            ed.setContent(valueRef.current || '');
          });
          const emit = () => onChangeRef.current?.(ed.getContent());
          ed.on('change keyup undo redo SetContent', emit);
        }
      });
    }).catch(() => {});

    return () => {
      disposed = true;
      if (editor) editor.remove();
      editorRef.current = null;
    };
    // 主题变化时重建编辑器以切换皮肤
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, theme]);

  // 外部 value 变化时同步（避免与编辑中内容冲突）
  useEffect(() => {
    const ed = editorRef.current;
    if (ed && ed.initialized && value !== ed.getContent()) {
      ed.setContent(value || '');
    }
  }, [value]);

  return (
    <div ref={containerRef} className="overflow-hidden rounded-md border">
      <textarea id={id} defaultValue={value} />
    </div>
  );
}

// 只读展示：渲染已净化的 HTML（服务端已做白名单过滤）
export function RichContent({ html, className = '' }) {
  if (!html) return null;
  return (
    <div
      className={`rich-content ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
