import { Button } from '@/components/ui/button';
import { useTheme } from '@/hooks/use-theme';
import { Sun, Moon, Monitor } from 'lucide-react';

const THEME_CYCLE = { light: 'dark', dark: 'system', system: 'light' };
const THEME_META = {
  light: { icon: Sun, label: '浅色' },
  dark: { icon: Moon, label: '深色' },
  system: { icon: Monitor, label: '跟随系统' }
};

export function ThemeToggle({ className }) {
  const { theme, setTheme } = useTheme();
  const Icon = THEME_META[theme].icon;
  return (
    <Button
      variant="ghost"
      size="icon"
      className={className}
      onClick={() => setTheme(THEME_CYCLE[theme])}
      title={`主题：${THEME_META[theme].label}`}
    >
      <Icon className="h-5 w-5" />
    </Button>
  );
}
