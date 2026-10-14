import { useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { endOfMonth, startOfMonth, subMonths } from 'date-fns';
import { DatePicker, Select } from '../../components/ui';
import { todayStr, toDateStr } from '../../lib/format';

export const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#0ea5e9', '#f43f5e', '#8b5cf6', '#14b8a6', '#64748b'];
export const chartTooltip = { borderRadius: 12, border: '1px solid #cbd5e1', backgroundColor: '#fff', color: '#0f172a' };
export function usePeriod() {
  const [preset, setPreset] = useState('month');
  const [customFrom, setFrom] = useState(toDateStr(startOfMonth(new Date())));
  const [customTo, setTo] = useState(todayStr());
  const now = new Date();
  const previous = subMonths(now, 1);
  const from = preset === 'custom' ? customFrom : preset === 'year' ? `${now.getFullYear()}-01-01` : toDateStr(startOfMonth(preset === 'previous' ? previous : now));
  const to = preset === 'custom' ? customTo : preset === 'previous' ? toDateStr(endOfMonth(previous)) : todayStr();
  return { from, to, valid: !!from && !!to && from <= to, controls: <div className="flex flex-wrap items-end gap-3 print:hidden">
    <Select aria-label="Dönem" value={preset} onChange={(e) => setPreset(e.target.value)} options={[{ value: 'month', label: 'Bu ay' }, { value: 'previous', label: 'Geçen ay' }, { value: 'year', label: 'Bu yıl' }, { value: 'custom', label: 'Özel aralık' }]} />
    {preset === 'custom' && <><DatePicker label="Başlangıç" value={customFrom} onChange={setFrom} /><DatePicker label="Bitiş" value={customTo} min={customFrom} onChange={setTo} /></>}
  </div> };
}
export function groupAmounts<T>(items: T[], name: (item: T) => string, value: (item: T) => number) {
  const map = new Map<string, number>();
  items.forEach((item) => { const key = name(item); map.set(key, (map.get(key) ?? 0) + value(item)); });
  return [...map].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}
export function MoneyRow({ label, value, strong = false }: { label: ReactNode; value: ReactNode; strong?: boolean }) {
  return <div className={`flex items-center justify-between gap-4 border-b border-slate-100 py-3 last:border-0 dark:border-slate-800 ${strong ? 'font-bold text-indigo-600 dark:text-indigo-300' : 'text-slate-600 dark:text-slate-300'}`}><span>{label}</span><span className="whitespace-nowrap tabular-nums">{value}</span></div>;
}
export function PrintPortal({ children }: { children: ReactNode }) {
  return createPortal(<div className="accounting-print-root"><style>{`.accounting-print-root{display:none}@media print{@page{size:A4;margin:14mm}body > *{display:none!important}body > .accounting-print-root{display:block!important;background:white!important;color:#0f172a!important;font:12px Arial,sans-serif}.accounting-print-root *{color:inherit!important;background:transparent!important;box-shadow:none!important}.accounting-print-root table{width:100%;border-collapse:collapse}.accounting-print-root th,.accounting-print-root td{padding:10px 6px;border-bottom:1px solid #e2e8f0;text-align:left}.accounting-print-root tr{break-inside:avoid}.accounting-print-root h1{font-size:28px}.accounting-print-root h2{font-size:18px}.accounting-print-root .print-avoid{break-inside:avoid}}`}</style>{children}</div>, document.body);
}
export function downloadCsv(filename: string, rows: (string | number)[][]) {
  const cell = (v: string | number) => { const str = String(v); return `"${(/^[=+\-@\t\r]/.test(str) ? "'" : '') + str.replace(/"/g, '""')}"`; };
  const url = URL.createObjectURL(new Blob(['\uFEFF' + rows.map((r) => r.map(cell).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a'); link.href = url; link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

