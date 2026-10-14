import { useMemo, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { cn } from './cn';
import { EmptyState } from './EmptyState';

export interface Column<T> {
  key: string;
  header: ReactNode;
  /** Hücre içeriği. Verilmezse row[key] yazılır. */
  render?: (row: T) => ReactNode;
  /** Sıralama için değer. Verilirse kolon sıralanabilir olur. */
  sortValue?: (row: T) => string | number;
  /** Arama metni (arama kutusu bu kolonlarda arar). */
  searchValue?: (row: T) => string;
  align?: 'left' | 'right' | 'center';
  className?: string;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  rowKey: (row: T) => string;
  searchable?: boolean;
  searchPlaceholder?: string;
  pageSize?: number;
  onRowClick?: (row: T) => void;
  /** Arama kutusunun yanına eklenecek filtre/aksiyonlar */
  toolbar?: ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  initialSort?: { key: string; dir: 'asc' | 'desc' };
}

const norm = (s: string) => s.toLocaleLowerCase('tr-TR');

export function DataTable<T>({
  columns,
  data,
  rowKey,
  searchable = true,
  searchPlaceholder = 'Ara...',
  pageSize = 10,
  onRowClick,
  toolbar,
  emptyTitle,
  emptyDescription,
  initialSort,
}: DataTableProps<T>) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(initialSort ?? null);
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const q = norm(query.trim());
    if (!q) return data;
    return data.filter((row) =>
      columns.some((c) => {
        const v = c.searchValue
          ? c.searchValue(row)
          : c.sortValue
            ? String(c.sortValue(row))
            : String((row as Record<string, unknown>)[c.key] ?? '');
        return norm(v).includes(q);
      }),
    );
  }, [data, query, columns]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return filtered;
    const get = col.sortValue;
    return [...filtered].sort((a, b) => {
      const x = get(a);
      const y = get(b);
      const r = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'tr');
      return sort.dir === 'asc' ? r : -r;
    });
  }, [filtered, sort, columns]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const cur = Math.min(page, pageCount - 1);
  const rows = sorted.slice(cur * pageSize, cur * pageSize + pageSize);

  const toggleSort = (c: Column<T>) => {
    if (!c.sortValue) return;
    setSort((s) => (s?.key === c.key ? (s.dir === 'asc' ? { key: c.key, dir: 'desc' } : null) : { key: c.key, dir: 'asc' }));
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-soft dark:border-slate-800 dark:bg-slate-900">
      {(searchable || toolbar) && (
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-4 dark:border-slate-800">
          {searchable && (
            <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(0);
                }}
                placeholder={searchPlaceholder}
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:focus:bg-slate-800"
              />
            </div>
          )}
          {toolbar}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-800/40">
              {columns.map((c) => (
                <th
                  key={c.key}
                  onClick={() => toggleSort(c)}
                  className={cn(
                    'whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400',
                    c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left',
                    c.sortValue && 'cursor-pointer select-none hover:text-slate-800 dark:hover:text-slate-200',
                  )}
                >
                  <span className="inline-flex items-center gap-1">
                    {c.header}
                    {sort?.key === c.key && (sort.dir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  'border-b border-slate-100 last:border-0 dark:border-slate-800',
                  onRowClick && 'cursor-pointer hover:bg-indigo-50/40 dark:hover:bg-slate-800/60',
                )}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={cn(
                      'px-4 py-3 text-slate-700 dark:text-slate-200',
                      c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left',
                      c.className,
                    )}
                  >
                    {c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <EmptyState title={emptyTitle} description={emptyDescription} />}
      </div>
      {sorted.length > pageSize && (
        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm text-slate-500 dark:border-slate-800">
          <span>
            {sorted.length} kayıttan {cur * pageSize + 1}-{Math.min(sorted.length, (cur + 1) * pageSize)} arası
          </span>
          <div className="flex items-center gap-1">
            <button disabled={cur === 0} onClick={() => setPage(cur - 1)} className="rounded-lg p-1.5 hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-slate-800">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-2 text-xs">
              {cur + 1} / {pageCount}
            </span>
            <button disabled={cur >= pageCount - 1} onClick={() => setPage(cur + 1)} className="rounded-lg p-1.5 hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-slate-800">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
