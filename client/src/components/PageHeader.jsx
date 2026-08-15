import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';

export function PageHeader({ title, count, countLabel, subtitle, actions, onBack }) {
  const hasMeta = subtitle || count !== undefined || countLabel;

  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex min-w-0 items-start gap-3">
        {onBack && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            aria-label="返回上一页"
            title="返回"
            className="group mt-0.5 h-9 w-9 shrink-0 rounded-lg bg-muted/70 text-muted-foreground shadow-none hover:bg-primary/10 hover:text-primary"
          >
            <ChevronLeft className="h-5 w-5 transition-transform duration-200 group-hover:-translate-x-0.5" />
          </Button>
        )}

        <div className="min-w-0">
          <h1 className="text-2xl font-bold leading-10 tracking-tight sm:text-3xl">
            {title}
          </h1>
          {hasMeta && (
            <p className="mt-1 text-sm leading-5 text-muted-foreground">
              {subtitle || `${count} ${countLabel}`}
            </p>
          )}
        </div>
      </div>

      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
