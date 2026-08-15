// 轻量 HTML 富文本净化：白名单标签与属性，剥离脚本与危险协议，防止存储型 XSS
// 用于工单内容、套餐描述、站点公告等用户/管理员录入的富文本

const ALLOWED_TAGS = new Set([
  'p', 'br', 'hr', 'div', 'span', 'b', 'strong', 'i', 'em', 'u', 's', 'strike',
  'sub', 'sup', 'blockquote', 'pre', 'code',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'dl', 'dt', 'dd',
  'a', 'img',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col'
]);

// 各标签允许的属性
const ALLOWED_ATTRS = {
  '*': ['style', 'class', 'align'],
  a: ['href', 'target', 'rel', 'title'],
  img: ['src', 'alt', 'title', 'width', 'height'],
  td: ['colspan', 'rowspan'],
  th: ['colspan', 'rowspan'],
  col: ['span'],
  colgroup: ['span']
};

// style 中允许的属性（其余丢弃）
const ALLOWED_STYLE_PROPS = new Set([
  'color', 'background-color', 'text-align', 'font-weight', 'font-style',
  'text-decoration', 'font-size', 'width', 'height', 'margin', 'padding',
  'border', 'border-collapse', 'list-style-type', 'vertical-align'
]);

const VOID_TAGS = new Set(['br', 'hr', 'img', 'col']);

function isSafeUrl(url) {
  const v = String(url || '').trim();
  if (!v) return false;
  // 允许相对路径、锚点、http(s)、mailto、data:image
  if (/^(https?:|mailto:|tel:)/i.test(v)) return true;
  if (/^data:image\/(png|jpe?g|gif|webp|bmp|svg\+xml);base64,/i.test(v)) return true;
  if (/^[/#.?]/.test(v)) return true;
  if (!/:/.test(v)) return true; // 无协议的相对路径
  return false;
}

function sanitizeStyle(style) {
  return String(style || '')
    .split(';')
    .map(s => s.trim())
    .filter(Boolean)
    .filter(decl => {
      const idx = decl.indexOf(':');
      if (idx < 0) return false;
      const prop = decl.slice(0, idx).trim().toLowerCase();
      const val = decl.slice(idx + 1).trim().toLowerCase();
      if (!ALLOWED_STYLE_PROPS.has(prop)) return false;
      // 拦截 url()/expression() 等危险值
      if (/url\s*\(|expression\s*\(|javascript:/i.test(val)) return false;
      return true;
    })
    .join('; ');
}

// 解析并过滤单个开始标签的属性
function sanitizeAttrs(tag, attrString) {
  const allowed = new Set([...(ALLOWED_ATTRS['*'] || []), ...(ALLOWED_ATTRS[tag] || [])]);
  const out = [];
  const attrRe = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
  let m;
  while ((m = attrRe.exec(attrString))) {
    const name = m[1].toLowerCase();
    let value = m[3] != null ? m[3] : m[4] != null ? m[4] : m[5] != null ? m[5] : '';
    if (name.startsWith('on')) continue; // 事件处理器一律剥离
    if (!allowed.has(name)) continue;
    if ((name === 'href' || name === 'src') && !isSafeUrl(value)) continue;
    if (name === 'style') {
      value = sanitizeStyle(value);
      if (!value) continue;
    }
    // 实体转义引号
    value = value.replace(/"/g, '&quot;');
    out.push(`${name}="${value}"`);
  }
  // 外链统一加 rel，避免 target=_blank 反向篡改
  if (tag === 'a') {
    const hasTarget = /target=/.test(out.join(' '));
    if (hasTarget && !/rel=/.test(out.join(' '))) out.push('rel="noopener noreferrer"');
  }
  return out.length ? ' ' + out.join(' ') : '';
}

function sanitizeHtml(input) {
  let html = String(input == null ? '' : input);
  if (!html.trim()) return '';

  // 整块移除危险元素及其内容
  html = html.replace(/<!--[\s\S]*?-->/g, '');
  html = html.replace(/<(script|style|iframe|object|embed|noscript|template|svg|math|link|meta|base|form|input|button|textarea|select|option)\b[\s\S]*?<\/\1\s*>/gi, '');
  html = html.replace(/<(script|style|iframe|object|embed|noscript|template|svg|math|link|meta|base|form|input|button)\b[^>]*\/?>/gi, '');

  // 逐个标签过滤
  html = html.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)((?:[^<>"']|"[^"]*"|'[^']*')*)\/?>/g, (full, rawTag, attrs) => {
    const tag = rawTag.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) return '';
    const isClose = full.startsWith('</');
    if (isClose) return `</${tag}>`;
    const attrPart = sanitizeAttrs(tag, attrs || '');
    if (VOID_TAGS.has(tag)) return `<${tag}${attrPart} />`;
    return `<${tag}${attrPart}>`;
  });

  return html.trim();
}

// 提取纯文本（用于摘要、空内容判断）
function htmlToText(input) {
  return String(input || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

module.exports = { sanitizeHtml, htmlToText };
