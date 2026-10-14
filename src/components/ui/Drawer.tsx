import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from './cn';

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  width?: 'md' | 'lg' | 'xl';
  footer?: ReactNode;
  children?: ReactNode;
}

const widths = { md: 'max-w-md', lg: 'max-w-xl', xl: 'max-w-3xl' };

/** Sağdan açılan panel */
export function Drawer({ open, onClose, title, description, width = 'md', footer, children }: DrawerProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="anim-fade absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <aside className={cn('anim-slide absolute right-0 top-0 flex h-full w-full flex-col bg-white shadow-pop dark:border-l dark:border-slate-800 dark:bg-slate-900', widths[width])}>
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-4 dark:border-slate-800">
          <div>
            {title && <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h2>}
            {description && <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{description}</p>}
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800" aria-label="Kapat">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4 dark:border-slate-800">{footer}</div>}
      </aside>
    </div>
  );
}
