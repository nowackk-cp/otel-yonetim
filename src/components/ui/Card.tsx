import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';

export interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  padded?: boolean;
}

export function Card({ title, subtitle, actions, padded = true, className, children, ...rest }: CardProps) {
  return (
    <div
      className={cn('rounded-2xl border border-slate-200/70 bg-white shadow-soft dark:border-slate-800 dark:bg-slate-900', className)}
      {...rest}
    >
      {(title || actions) && (
        <div className="flex items-center justify-between gap-3 px-5 pt-5">
          <div className="min-w-0">
            {title && <h3 className="truncate text-base font-semibold text-slate-900 dark:text-white">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={cn(padded && 'p-5', (title || actions) && padded && 'pt-4')}>{children}</div>
    </div>
  );
}
