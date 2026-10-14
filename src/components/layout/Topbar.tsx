import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CalendarClock, LogIn, LogOut, Menu, Moon, PackageX, Plane, Search, Sun } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { navGroups } from './nav';
import { formatDate, todayStr } from '../../lib/format';
import { Avatar } from '../ui/Avatar';
import { cn } from '../ui/cn';
import { tr } from 'date-fns/locale';
import { format } from 'date-fns';

interface Props {
  onOpenMobile: () => void;
  dark: boolean;
  onToggleTheme: () => void;
}

function useClickOutside(ref: React.RefObject<HTMLElement>, cb: () => void) {
  useEffect(() => {
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && cb();
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [ref, cb]);
}

export function Topbar({ onOpenMobile, dark, onToggleTheme }: Props) {
  const navigate = useNavigate();
  const inventoryItems = useStore((s) => s.inventoryItems);
  const leaveRequests = useStore((s) => s.leaveRequests);
  const reservations = useStore((s) => s.reservations);
  const guests = useStore((s) => s.guests);
  const rooms = useStore((s) => s.rooms);
  const employees = useStore((s) => s.employees);
  const hotelName = useStore((s) => s.settings.hotelName);

  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const [bellOpen, setBellOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);
  useClickOutside(bellRef, () => setBellOpen(false));

  const [q, setQ] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  useClickOutside(searchRef, () => setSearchOpen(false));

  const notifications = useMemo(() => {
    const today = todayStr();
    const guestName = (id: string) => guests.find((g) => g.id === id)?.fullName ?? '-';
    const roomNo = (id: string) => rooms.find((r) => r.id === id)?.no ?? '-';
    const list: { key: string; icon: typeof Bell; tone: string; text: string; sub: string; to: string }[] = [];
    inventoryItems
      .filter((i) => i.quantity < i.minQuantity)
      .forEach((i) =>
        list.push({ key: `s${i.id}`, icon: PackageX, tone: 'text-rose-500 bg-rose-50 dark:bg-rose-500/15', text: `Düşük stok: ${i.name}`, sub: `${i.quantity} ${i.unit} (min. ${i.minQuantity})`, to: '/inventory' }),
      );
    leaveRequests
      .filter((l) => l.status === 'beklemede')
      .forEach((l) =>
        list.push({ key: `l${l.id}`, icon: Plane, tone: 'text-amber-500 bg-amber-50 dark:bg-amber-500/15', text: 'Bekleyen izin talebi', sub: `${formatDate(l.startDate)} - ${formatDate(l.endDate)}`, to: '/leaves' }),
      );
    reservations
      .filter((r) => r.checkIn === today && (r.status === 'onayli' || r.status === 'opsiyon'))
      .forEach((r) =>
        list.push({ key: `i${r.id}`, icon: LogIn, tone: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/15', text: `Bugün giriş: ${guestName(r.guestId)}`, sub: `Oda ${roomNo(r.roomId)}`, to: '/reservations' }),
      );
    reservations
      .filter((r) => r.checkOut === today && r.status === 'giris_yapti')
      .forEach((r) =>
        list.push({ key: `o${r.id}`, icon: LogOut, tone: 'text-sky-500 bg-sky-50 dark:bg-sky-500/15', text: `Bugün çıkış: ${guestName(r.guestId)}`, sub: `Oda ${roomNo(r.roomId)}`, to: '/reservations' }),
      );
    return list;
  }, [inventoryItems, leaveRequests, reservations, guests, rooms]);

  const results = useMemo(() => {
    const s = q.trim().toLocaleLowerCase('tr-TR');
    if (!s) return [];
    const pages = navGroups.flatMap((g) => g.items.map((i) => ({ type: 'Sayfa', label: i.label, to: i.to })));
    const out = pages.filter((p) => p.label.toLocaleLowerCase('tr-TR').includes(s));
    guests.filter((g) => g.fullName.toLocaleLowerCase('tr-TR').includes(s)).slice(0, 4).forEach((g) => out.push({ type: 'Misafir', label: g.fullName, to: '/guests' }));
    rooms.filter((r) => r.no.includes(s)).slice(0, 3).forEach((r) => out.push({ type: 'Oda', label: `Oda ${r.no}`, to: '/rooms' }));
    const lc = (v: string) => v.toLocaleLowerCase('tr-TR');
    employees.filter((e) => lc(e.fullName).includes(s) || lc(e.position).includes(s)).slice(0, 4).forEach((e) => out.push({ type: 'Çalışan', label: e.fullName, to: '/staff' }));
    reservations
      .filter((r) => {
        const g = guests.find((x) => x.id === r.guestId);
        const room = rooms.find((x) => x.id === r.roomId);
        return lc(g?.fullName ?? '').includes(s) || (room ? room.no === s : false);
      })
      .slice(0, 4)
      .forEach((r) => out.push({ type: 'Rezervasyon', label: `${guests.find((x) => x.id === r.guestId)?.fullName ?? 'Misafir'} · Oda ${rooms.find((x) => x.id === r.roomId)?.no ?? '-'} · ${formatDate(r.checkIn, 'd MMM')}`, to: '/reservations' }));
    return out.slice(0, 12);
  }, [q, guests, rooms, employees, reservations]);

  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 border-b border-slate-200/70 bg-white/80 px-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80 lg:px-6">
      <button onClick={onOpenMobile} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden" aria-label="Menüyü aç">
        <Menu className="h-5 w-5" />
      </button>

      <div ref={searchRef} className="relative hidden max-w-md flex-1 sm:block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setSearchOpen(true);
          }}
          onFocus={() => setSearchOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && results[0]) {
              navigate(results[0].to);
              setQ('');
              setSearchOpen(false);
            }
          }}
          placeholder="Sayfa, misafir veya oda ara..."
          className="h-10 w-full rounded-xl border border-transparent bg-slate-100 pl-9 pr-3 text-sm placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:bg-slate-800 dark:focus:bg-slate-800"
        />
        {searchOpen && results.length > 0 && (
          <div className="anim-pop absolute left-0 right-0 top-12 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-pop dark:border-slate-700 dark:bg-slate-800">
            {results.map((r, i) => (
              <button
                key={i}
                onClick={() => {
                  navigate(r.to);
                  setQ('');
                  setSearchOpen(false);
                }}
                className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                <span>{r.label}</span>
                <span className="text-xs text-slate-400">{r.type}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="ml-auto flex items-center gap-2">
        <div className="hidden items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300 md:flex">
          <CalendarClock className="h-4 w-4 text-indigo-500" />
          <span>{formatDate(now, 'd MMMM yyyy, EEEE')}</span>
          <span className="text-slate-400">·</span>
          <span className="tabular-nums">{format(now, 'HH:mm', { locale: tr })}</span>
        </div>

        <button
          onClick={onToggleTheme}
          className="rounded-xl p-2.5 text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          aria-label="Temayı değiştir"
          title={dark ? 'Açık tema' : 'Koyu tema'}
        >
          {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>

        <div ref={bellRef} className="relative">
          <button onClick={() => setBellOpen((o) => !o)} className="relative rounded-xl p-2.5 text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800" aria-label="Bildirimler">
            <Bell className="h-5 w-5" />
            {notifications.length > 0 && (
              <span className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                {notifications.length}
              </span>
            )}
          </button>
          {bellOpen && (
            <div className="anim-pop absolute right-0 top-12 w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-pop dark:border-slate-700 dark:bg-slate-800">
              <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold dark:border-slate-700">Bildirimler ({notifications.length})</div>
              <div className="max-h-96 overflow-y-auto">
                {notifications.length === 0 && <p className="p-6 text-center text-sm text-slate-400">Yeni bildirim yok</p>}
                {notifications.map((n) => (
                  <button
                    key={n.key}
                    onClick={() => {
                      navigate(n.to);
                      setBellOpen(false);
                    }}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50"
                  >
                    <span className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', n.tone)}>
                      <n.icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{n.text}</span>
                      <span className="block text-xs text-slate-400">{n.sub}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="ml-1 flex items-center gap-3 border-l border-slate-200 pl-3 dark:border-slate-700">
          <Avatar name="Selim Karaca" color="#6366f1" />
          <div className="hidden leading-tight lg:block">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Selim Karaca</p>
            <p className="text-xs text-slate-400">Genel Müdür · {hotelName}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
