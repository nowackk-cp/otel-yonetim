import type { ReactNode } from 'react';
import { cn } from './cn';

export type BadgeColor = 'slate' | 'indigo' | 'emerald' | 'amber' | 'rose' | 'sky' | 'violet' | 'orange' | 'teal';

const colors: Record<BadgeColor, string> = {
  slate: 'bg-slate-100 text-slate-700 dark:bg-slate-700/50 dark:text-slate-300',
  indigo: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300',
  emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  amber: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  rose: 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
  sky: 'bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
  violet: 'bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
  orange: 'bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300',
  teal: 'bg-teal-50 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300',
};

export interface BadgeProps {
  color?: BadgeColor;
  dot?: boolean;
  className?: string;
  children: ReactNode;
}

export function Badge({ color = 'slate', dot, className, children }: BadgeProps) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium', colors[color], className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}
