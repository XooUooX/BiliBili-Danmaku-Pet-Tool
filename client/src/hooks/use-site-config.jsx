import * as React from 'react';
import { api } from '@/lib/api';

// 更新或创建 meta 标签
function setMeta(selector, attr, value) {
  if (!value) return;
  let el = document.head.querySelector(selector);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(selector.includes('property') ? 'property' : 'name', attr);
    document.head.appendChild(el);
  }
  el.setAttribute('content', value);
}

// 根据站点配置同步页面 meta（description/keywords/og 等）
function applyTDK(config) {
  if (!config) return;
  setMeta('meta[name="description"]', 'description', config.description);
  setMeta('meta[name="keywords"]', 'keywords', config.keywords);
  setMeta('meta[property="og:title"]', 'og:title', config.title);
  setMeta('meta[property="og:description"]', 'og:description', config.description);
  setMeta('meta[name="twitter:title"]', 'twitter:title', config.title);
  setMeta('meta[name="twitter:description"]', 'twitter:description', config.description);
}

// 共享缓存：多个组件复用同一次请求结果
let cachedConfig = null;
let pendingPromise = null;

function fetchConfig() {
  if (cachedConfig) return Promise.resolve(cachedConfig);
  if (pendingPromise) return pendingPromise;
  pendingPromise = api.get('/api/auth/config')
    .then(d => {
      cachedConfig = d.config || null;
      applyTDK(cachedConfig);
      return cachedConfig;
    })
    .catch(() => null)
    .finally(() => {
      pendingPromise = null;
    });
  return pendingPromise;
}

// Fetch public site configuration
export function useSiteConfig() {
  const [config, setConfig] = React.useState(cachedConfig);

  React.useEffect(() => {
    let active = true;
    fetchConfig().then(cfg => active && setConfig(cfg));
    return () => {
      active = false;
    };
  }, []);

  return config;
}

// 设置页面标题，格式：「页面名 - 站点名」或首页「站点标题 - 副标题」
export function usePageTitle(pageName) {
  const config = useSiteConfig();

  React.useEffect(() => {
    const siteName = config?.title || 'BiliBili弹宠小助手';
    const subtitle = config?.subtitle || '';
    
    if (pageName) {
      // 非首页：页面名 - 站点名
      document.title = `${pageName} - ${siteName}`;
    } else {
      // 首页：站点标题 - 副标题
      document.title = subtitle ? `${siteName} - ${subtitle}` : siteName;
    }
  }, [pageName, config]);
}
