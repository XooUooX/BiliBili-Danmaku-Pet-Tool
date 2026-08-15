import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

const DialogContext = React.createContext({ open: false, setOpen: () => {} });

function Dialog({ open, onOpenChange, children }) {
  return (
    <DialogContext.Provider value={{ open, setOpen: onOpenChange }}>
      {children}
    </DialogContext.Provider>
  );
}

function DialogContent({ className, children }) {
  const { open, setOpen } = React.useContext(DialogContext);
  React.useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    if (open) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, setOpen]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-md animate-in fade-in" />
      <div
        className={cn(
          'relative z-50 grid w-full max-w-lg gap-6 border-2 border-border/40 bg-card/95 p-8 shadow-2xl backdrop-blur-2xl rounded-3xl mx-4 max-h-[85vh] overflow-y-auto',
          className
        )}
      >
        {children}
        <button
          className="absolute right-5 top-5 rounded-xl p-2 opacity-70 transition-all hover:opacity-100 hover:bg-accent hover:shadow-md"
          onClick={() => setOpen(false)}
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

function DialogHeader({ className, ...props }) {
  return <div className={cn('flex flex-col space-y-2.5 text-center sm:text-left', className)} {...props} />;
}

function DialogTitle({ className, ...props }) {
  return <h2 className={cn('text-2xl font-bold leading-tight tracking-tight', className)} {...props} />;
}

function DialogDescription({ className, ...props }) {
  return <p className={cn('text-sm text-muted-foreground leading-relaxed', className)} {...props} />;
}

function DialogFooter({ className, ...props }) {
  return <div className={cn('flex flex-col-reverse gap-3 sm:flex-row sm:justify-end sm:gap-3', className)} {...props} />;
}

export { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter };
