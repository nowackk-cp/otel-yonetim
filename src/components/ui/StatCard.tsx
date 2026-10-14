import type { ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { cn } from './cn';

export interface StatCardProps {
  title: string;
  value: ReactNode;
  icon?: ReactNode;
  /** Değişim yüzdesi (örn. 12.5 veya -3). */
  change?: number;
  changeLabel?: string;
  /** İkon rengi */
  tone?: 'indigo' | 'emerald' | 'amber' | 'rose' | 'sky' | 'violet' | 'slate';
  className?: string;
  valueClassName?: string;
}

const tones = {
  indigo: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300',
  emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300',
  amber: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300',
  rose: 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300',
  sky: 'bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300',
  violet: 'bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300',
  slate: 'bg-slate-100 text-slate-600 dark:bg-slate-700/50 dark:text-slate-300',
};

export function StatCard({ title, value, icon, change, changeLabel, tone = 'indigo', className, valueClassName }: StatCardProps) {
  const up = (change ?? 0) >= 0;
  return (
    <div className={cn('rounded-2xl border border-slate-200/70 bg-white p-4 sm:p-5 shadow-soft dark:border-slate-800 dark:bg-slate-900', className)}>
      <div className="flex items-start justify-between gap-2.5 sm:gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400" title={title}>{title}</p>
          <div
            className={cn('mt-1.5 sm:mt-2 truncate text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white', valueClassName)}
            title={typeof value === 'string' || typeof value === 'number' ? String(value) : undefined}
          >
            {value}
          </div>
        </div>
        {icon && (
          <div className={cn('flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl [&>svg]:h-4.5 sm:[&>svg]:h-5 [&>svg]:w-4.5 sm:[&>svg]:w-5', tones[tone])}>
            {icon}
          </div>
        )}
      </div>
      {change !== undefined && (
        <div className="mt-3 flex items-center gap-1.5 text-xs">
          <span
            className={cn(
              'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-semibold',
              up ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300',
            )}
          >
            {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            %{Math.abs(change).toLocaleString('tr-TR', { maximumFractionDigits: 1 })}
          </span>
          {changeLabel && <span className="truncate text-slate-400">{changeLabel}</span>}
        </div>
      )}
    </div>
  );
}
