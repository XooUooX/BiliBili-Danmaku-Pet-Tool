import * as React from 'react';

const STORAGE_KEY = 'theme';
const ThemeContext = React.createContext(null);

function systemPrefersDark() {
  return typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function readTheme() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return ['light', 'dark', 'system'].includes(saved) ? saved : 'system';
  } catch {
    return 'system';
  }
}

// 将 light/dark/system 解析为实际应用的 dark 类
function applyTheme(theme) {
  const isDark = theme === 'dark' || (theme === 'system' && systemPrefersDark());
  document.documentElement.classList.toggle('dark', isDark);
  return isDark;
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = React.useState(readTheme);

  React.useEffect(() => {
    applyTheme(theme);
    if (theme !== 'system' || typeof window.matchMedia !== 'function') return undefined;

    // 跟随系统时监听系统偏好变化
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('system');
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, [theme]);

  const setTheme = React.useCallback(next => {
    const safeTheme = ['light', 'dark', 'system'].includes(next) ? next : 'system';
    try {
      localStorage.setItem(STORAGE_KEY, safeTheme);
    } catch {
      // 隐私模式或禁用存储时，主题仍在当前页面内生效。
    }
    setThemeState(safeTheme);
  }, []);

  const value = React.useMemo(() => ({ theme, setTheme }), [theme, setTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}