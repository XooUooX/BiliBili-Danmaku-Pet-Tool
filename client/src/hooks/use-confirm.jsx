import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog';

const DialogContext = React.createContext(null);

// 全局命令式确认/输入对话框，替代原生 confirm/prompt
export function ConfirmProvider({ children }) {
  const [state, setState] = React.useState(null);
  const [value, setValue] = React.useState('');
  const resolver = React.useRef(null);

  const close = result => {
    resolver.current && resolver.current(result);
    resolver.current = null;
    setState(null);
  };

  // confirm({ title, description, confirmText, cancelText, variant })
  const confirm = opts =>
    new Promise(resolve => {
      resolver.current = resolve;
      setState({ kind: 'confirm', ...opts });
    });

  // prompt({ title, description, label, placeholder, defaultValue, confirmText })
  const prompt = opts =>
    new Promise(resolve => {
      resolver.current = resolve;
      setValue(opts.defaultValue ?? '');
      setState({ kind: 'prompt', ...opts });
    });

  const open = !!state;
  const isPrompt = state?.kind === 'prompt';

  return (
    <DialogContext.Provider value={{ confirm, prompt }}>
      {children}
      <Dialog open={open} onOpenChange={v => !v && close(isPrompt ? null : false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{state?.title || '确认'}</DialogTitle>
            {state?.description && <DialogDescription>{state.description}</DialogDescription>}
          </DialogHeader>
          {isPrompt && (
            <div className="space-y-2">
              {state?.label && <Label>{state.label}</Label>}
              <Input
                autoFocus
                value={value}
                onChange={e => setValue(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && close(value)}
              />
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => close(isPrompt ? null : false)}>
              {state?.cancelText || '取消'}
            </Button>
            <Button
              variant={state?.variant === 'destructive' ? 'destructive' : 'default'}
              onClick={() => close(isPrompt ? value : true)}
            >
              {state?.confirmText || '确定'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DialogContext.Provider>
  );
}

export function useConfirm() {
  return React.useContext(DialogContext);
}
