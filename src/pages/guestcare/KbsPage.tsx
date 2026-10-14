import { useMemo, useState } from 'react';
import { AlertTriangle, Download, FileCheck2, LogIn, LogOut, ShieldCheck, Users } from 'lucide-react';
import { Badge, Button, Card, DatePicker, EmptyState, PageHeader, StatCard, useToast } from '../../components/ui';
import { useStore } from '../../store/useStore';
import { formatDate, todayStr } from '../../lib/format';
import type { Guest, Reservation } from '../../types';
import { IDENTITY_LABEL, identityNumberOf, identityTypeOf, missingKbsFields } from './helpers';

type Movement = 'giris' | 'konaklama' | 'cikis';

const MOVEMENT_LABEL: Record<Movement, string> = { giris: 'Giriş', konaklama: 'Konaklıyor', cikis: 'Çıkış' };
const MOVEMENT_COLOR: Record<Movement, 'emerald' | 'indigo' | 'amber'> = { giris: 'emerald', konaklama: 'indigo', cikis: 'amber' };

/** Bildirim satırı. `guest` yoksa kayıt eksiktir ve `missing` içinde işaretlenir. */
interface KbsRow {
  key: string;
  reservation: Reservation;
  guest: Guest | undefined;
  roomNo: string;
  movement: Movement;
  missing: string[];
}

const CSV_HEADERS = [
  'Ad Soyad',
  'Uyruk',
  'Kimlik Tipi',
  'Kimlik / Pasaport No',
  'Doğum Tarihi',
  'Doğum Yeri',
  'Baba Adı',
  'Anne Adı',
  'Oda',
  'Giriş Tarihi',
  'Çıkış Tarihi',
  'Hareket',
  'Eksik Alanlar',
];

/** Excel uyumlu CSV: BOM, noktalı virgül ayracı, alanlar tırnaklı. */
function buildCsv(rows: KbsRow[]): string {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = rows.map((row) => {
    const g = row.guest;
    const cells = [
      g?.fullName ?? '',
      g?.nationality ?? '',
      g ? IDENTITY_LABEL[identityTypeOf(g)] : '',
      g ? identityNumberOf(g) : '',
      g?.birthDate ? formatDate(g.birthDate, 'dd.MM.yyyy') : '',
      g?.birthPlace ?? '',
      g?.fatherName ?? '',
      g?.motherName ?? '',
      row.roomNo,
      formatDate(row.reservation.checkIn, 'dd.MM.yyyy'),
      formatDate(row.reservation.checkOut, 'dd.MM.yyyy'),
      MOVEMENT_LABEL[row.movement],
      row.missing.join(', '),
    ];
    return cells.map((c) => esc(String(c))).join(';');
  });
  return '﻿' + [CSV_HEADERS.map(esc).join(';'), ...lines].join('\r\n');
}

export default function KbsPage() {
  const reservations = useStore((s) => s.reservations);
  const guests = useStore((s) => s.guests);
  const rooms = useStore((s) => s.rooms);
  const log = useStore((s) => s.log);
  const toast = useToast();

  const [date, setDate] = useState(todayStr());

  const guestMap = useMemo(() => new Map(guests.map((g) => [g.id, g])), [guests]);
  const roomMap = useMemo(() => new Map(rooms.map((r) => [r.id, r.no])), [rooms]);

  /** Seçili günde giriş yapan, konaklayan veya o gün çıkan misafirler (iptal/no-show/opsiyon hariç). */
  const rows = useMemo<KbsRow[]>(() => {
    return reservations
      .filter((r) => !['iptal', 'no_show', 'opsiyon'].includes(r.status) && r.checkIn <= date && date <= r.checkOut)
      .map((r) => {
        const guest = guestMap.get(r.guestId);
        const movement: Movement = r.checkIn === date ? 'giris' : r.checkOut === date ? 'cikis' : 'konaklama';
        const missing = guest ? missingKbsFields(guest) : ['Misafir kaydı'];
        return { key: r.id, reservation: r, guest, roomNo: roomMap.get(r.roomId) ?? '-', movement, missing };
      })
      .sort((a, b) => a.roomNo.localeCompare(b.roomNo, 'tr', { numeric: true }));
  }, [reservations, guestMap, roomMap, date]);

  const incomplete = rows.filter((r) => r.missing.length > 0).length;

  const download = () => {
    const csv = buildCsv(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kbs-bildirim-${date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    log(`KBS bildirim listesi indirildi (${date}, ${rows.length} kayıt)`, 'on_buro');
    if (incomplete > 0) toast.warning(`${incomplete} kayıt eksik bilgi içeriyor; dosyada "Eksik Alanlar" sütununda işaretli.`);
    else toast.success('KBS dosyası indirildi');
  };

  return (
    <div>
      <PageHeader
        title="Emniyet Bildirimi (KBS)"
        description="Seçili gün için misafir bildirim listesi. Dosya yerel olarak hazırlanır; emniyete gönderim yapılmaz."
        actions={
          <div className="flex items-end gap-2">
            <div className="w-44">
              <DatePicker
                label="Tarih"
                value={date}
                onChange={(v) => {
                  if (v) setDate(v);
                }}
              />
            </div>
            <Button icon={<Download className="h-4 w-4" />} onClick={download} disabled={rows.length === 0}>
              CSV indir
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Bildirilecek Misafir" value={rows.length} icon={<Users />} tone="indigo" changeLabel={formatDate(date)} />
        <StatCard title="Giriş" value={rows.filter((r) => r.movement === 'giris').length} icon={<LogIn />} tone="emerald" />
        <StatCard title="Çıkış" value={rows.filter((r) => r.movement === 'cikis').length} icon={<LogOut />} tone="amber" />
        <StatCard
          title="Eksik Bilgi"
          value={incomplete}
          icon={incomplete ? <AlertTriangle /> : <FileCheck2 />}
          tone={incomplete ? 'rose' : 'emerald'}
          changeLabel={incomplete ? 'düzeltilmeli' : 'tümü tamam'}
        />
      </div>

      <div className="mt-6">
        <Card
          title="Misafir Bildirim Listesi"
          subtitle="Giriş yapan, konaklayan veya o gün çıkan misafirler"
          padded={false}
          actions={<ShieldCheck className="h-5 w-5 text-slate-400" />}
        >
          {rows.length === 0 ? (
            <EmptyState title="Bu gün için kayıt yok" description="Seçili tarihte giriş, konaklama veya çıkış yapan misafir bulunmuyor." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-y border-slate-100 bg-slate-50/60 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-800/40">
                    <th className="px-5 py-3">Ad Soyad</th>
                    <th className="px-3 py-3">Uyruk</th>
                    <th className="px-3 py-3">Kimlik / Pasaport</th>
                    <th className="px-3 py-3">Doğum</th>
                    <th className="px-3 py-3">Oda</th>
                    <th className="px-3 py-3">Giriş → Çıkış</th>
                    <th className="px-5 py-3">Hareket</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const g = row.guest;
                    const bad = row.missing.length > 0;
                    return (
                      <tr
                        key={row.key}
                        className={
                          bad
                            ? 'border-b border-rose-200 bg-rose-50/70 last:border-0 dark:border-rose-900/50 dark:bg-rose-500/10'
                            : 'border-b border-slate-100 last:border-0 dark:border-slate-800'
                        }
                      >
                        <td className="px-5 py-3">
                          <p className={bad ? 'font-semibold text-rose-700 dark:text-rose-300' : 'font-medium text-slate-900 dark:text-white'}>
                            {g?.fullName ?? 'Misafir kaydı yok'}
                          </p>
                          {bad && (
                            <p className="mt-1 flex items-center gap-1 text-xs font-medium text-rose-600 dark:text-rose-300" title={row.missing.join(', ')}>
                              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                              Eksik: {row.missing.join(', ')}
                            </p>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-slate-600 dark:text-slate-300">{g?.nationality || <Missing />}</td>
                        <td className="whitespace-nowrap px-3 py-3">
                          {g ? (
                            <>
                              <p className="font-mono text-slate-700 dark:text-slate-200">{identityNumberOf(g) || <Missing />}</p>
                              <p className="text-xs text-slate-400">{IDENTITY_LABEL[identityTypeOf(g)]}</p>
                            </>
                          ) : (
                            <Missing />
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-slate-600 dark:text-slate-300">
                          {g?.birthDate ? formatDate(g.birthDate, 'dd.MM.yyyy') : <Missing />}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 font-semibold text-slate-800 dark:text-slate-100">{row.roomNo}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-slate-600 dark:text-slate-300">
                          {formatDate(row.reservation.checkIn, 'dd.MM.yyyy')} → {formatDate(row.reservation.checkOut, 'dd.MM.yyyy')}
                        </td>
                        <td className="px-5 py-3">
                          <Badge color={MOVEMENT_COLOR[row.movement]} dot>
                            {MOVEMENT_LABEL[row.movement]}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function Missing() {
  return <span className="text-rose-500">—</span>;
}
