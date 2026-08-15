import * as React from 'react';
import { cn } from '@/lib/utils';

const variants = {
  default: 'text-muted-foreground hover:text-foreground hover:bg-accent',
  primary: 'text-muted-foreground hover:text-primary hover:bg-primary/10',
  destructive: 'text-muted-foreground hover:text-destructive hover:bg-destructive/10'
};

const IconButton = React.forwardRef(
  ({ className, variant = 'default', label, children, ...props }, ref) => (
    <span className="group/icbtn relative inline-flex">
      <button
        ref={ref}
        type="button"
        aria-label={label}
        className={cn(
          'inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
          variants[variant],
          className
        )}
        {...props}
      >
        {children}
      </button>
      {label && (
        <span
          role="tooltip"
          className="pointer-events-none absolute -top-1 left-1/2 z-50 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md bg-popover px-2 py-1 text-xs font-medium text-popover-foreground opacity-0 shadow-md ring-1 ring-border transition-opacity duration-150 group-hover/icbtn:opacity-100"
        >
          {label}
        </span>
      )}
    </span>
  )
);
IconButton.displayName = 'IconButton';

export { IconButton };
