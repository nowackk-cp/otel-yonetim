import type { ReactNode } from 'react';
import { cn } from './cn';

export interface TabItem {
  key: string;
  label: ReactNode;
  count?: number;
}

export interface TabsProps {
  tabs: TabItem[];
  active: string;
  onChange: (key: string) => void;
  className?: string;
}

export function Tabs({ tabs, active, onChange, className }: TabsProps) {
  return (
    <div className={cn('inline-flex max-w-full gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 dark:bg-slate-800', className)}>
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={cn(
            'flex items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-1.5 text-sm font-medium transition',
            active === t.key
              ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-900 dark:text-indigo-300'
              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200',
          )}
        >
          {t.label}
          {t.count !== undefined && <span className="rounded-full bg-slate-200/70 px-1.5 text-xs dark:bg-slate-700">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}
