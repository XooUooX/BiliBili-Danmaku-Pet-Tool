import * as React from 'react';
import { cn } from '@/lib/utils';

const Input = React.forwardRef(({ className, type, ...props }, ref) => (
  <input
    type={type}
    ref={ref}
    className={cn(
      'flex h-11 w-full rounded-xl border-2 border-border/60 bg-background/50 px-4 py-3 text-sm shadow-sm backdrop-blur-sm transition-all duration-200 file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:border-primary/60 focus-visible:ring-4 focus-visible:ring-primary/10 focus-visible:shadow-md disabled:cursor-not-allowed disabled:opacity-50 hover:border-border',
      className
    )}
    {...props}
  />
));
Input.displayName = 'Input';

export { Input };
