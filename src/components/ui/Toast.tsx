import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { CheckCircle2, Info, TriangleAlert, XCircle, X } from 'lucide-react';
import { uid } from '../../lib/id';

type ToastKind = 'success' | 'error' | 'info' | 'warning';
interface ToastItem {
  id: string;
  kind: ToastKind;
  message: string;
}

export interface ToastApi {
  toast: (message: string, kind?: ToastKind) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  warning: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const icons = {
  success: <CheckCircle2 className="h-5 w-5 text-emerald-500" />,
  error: <XCircle className="h-5 w-5 text-rose-500" />,
  info: <Info className="h-5 w-5 text-sky-500" />,
  warning: <TriangleAlert className="h-5 w-5 text-amber-500" />,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const dismiss = useCallback((id: string) => setItems((s) => s.filter((t) => t.id !== id)), []);
  const toast = useCallback(
    (message: string, kind: ToastKind = 'success') => {
      const id = uid('t');
      setItems((s) => [...s, { id, kind, message }]);
      setTimeout(() => dismiss(id), 3800);
    },
    [dismiss],
  );
  const api = useMemo<ToastApi>(
    () => ({
      toast,
      success: (m) => toast(m, 'success'),
      error: (m) => toast(m, 'error'),
      info: (m) => toast(m, 'info'),
      warning: (m) => toast(m, 'warning'),
    }),
    [toast],
  );
  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2">
        {items.map((t) => (
          <div key={t.id} className="anim-pop pointer-events-auto flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-pop dark:border-slate-700 dark:bg-slate-800">
            {icons[t.kind]}
            <p className="flex-1 text-sm text-slate-700 dark:text-slate-100">{t.message}</p>
            <button onClick={() => dismiss(t.id)} className="text-slate-400 hover:text-slate-600">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/** const toast = useToast(); toast.success('Kaydedildi'); toast.error('Hata'); */
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast, ToastProvider içinde kullanılmalı');
  return ctx;
}
