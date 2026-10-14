import { useEffect, useMemo, useState } from 'react';
import { Clock3, Coffee, LogIn, LogOut, Play, Timer, UserCheck } from 'lucide-react';
import { Avatar, Badge, Button, Card, DataTable, Input, PageHeader, Select, StatCard, useToast } from '../../components/ui';
import { useStore } from '../../store/useStore';
import type { Attendance } from '../../types';
import { addDaysStr, formatDate, formatMinutes, todayStr } from '../../lib/format';
import { attendanceComparison, breakUsed, departmentOptions, departments, workedMinutes } from './hrUtils';
import { overtimeByAttendance } from './payrollCalc';

export default function AttendancePage() {
  const employees = useStore(s => s.employees); const attendance = useStore(s => s.attendance); const shifts = useStore(s => s.shifts);
  const [now, setNow] = useState(new Date()); const [department, setDepartment] = useState(''); const [from, setFrom] = useState(() => addDaysStr(todayStr(), -6)); const [to, setTo] = useState(todayStr); const toast = useToast();
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 1000); return () => window.clearInterval(timer); }, []);
  const today = todayStr(); const clock = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  const team = useMemo(() => employees.filter(e => e.active && (!department || e.department === department)), [employees, department]);
  const currentRecord = (id: string) => attendance.find(a => a.employeeId === id && a.checkIn && !a.checkOut) ?? attendance.find(a => a.employeeId === id && a.date === today);
  const overtime = useMemo(() => Object.assign({}, ...employees.map(e => overtimeByAttendance(attendance, e.id))) as Record<string, number>, [employees, attendance]);
  const history = useMemo(() => {
    const rows: Attendance[] = attendance.filter(a => a.date >= from && a.date <= to && (!department || employees.find(e => e.id === a.employeeId)?.department === department));
    const covered = new Set(rows.map(a => `${a.employeeId}/${a.date}`));
    for (const s of shifts) { const key = `${s.employeeId}/${s.date}`; if (s.date >= from && s.date <= to && !covered.has(key) && (!department || employees.find(e => e.id === s.employeeId)?.department === department)) { rows.push({ id: `missing-${key}`, employeeId: s.employeeId, date: s.date, breaks: [] }); covered.add(key); } }
    return rows.sort((a, b) => b.date.localeCompare(a.date));
  }, [attendance, shifts, employees, department, from, to]);
  function action(employeeId: string, kind: 'in' | 'break' | 'back' | 'out') {
    const store = useStore.getState(); const date = todayStr(); const time = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    const record = store.attendance.find(a => a.employeeId === employeeId && a.checkIn && !a.checkOut) ?? store.attendance.find(a => a.employeeId === employeeId && a.date === date);
    if (record?.checkIn && !record.checkOut && record.date < addDaysStr(date, -1)) return toast.error('Önceki günlerden açık kalan kayıt var. Tarihi belirsiz çıkış kaydedilemez.');
    if (kind === 'in') { if (record?.checkIn) return; if (record) store.update('attendance', record.id, { checkIn: time }); else store.add('attendance', { employeeId, date, checkIn: time, breaks: [] }); }
    else {
      if (!record?.checkIn || record.checkOut) return;
      const activeBreak = record.breaks.some(b => !b.end);
      if (kind === 'break') { if (activeBreak) return; store.update('attendance', record.id, { breaks: [...record.breaks, { start: time }] }); }
      if (kind === 'back') { if (!activeBreak) return; store.update('attendance', record.id, { breaks: record.breaks.map(b => b.end ? b : { ...b, end: time }) }); }
      if (kind === 'out') store.update('attendance', record.id, { checkOut: time, breaks: record.breaks.map(b => b.end ? b : { ...b, end: time }) });
    }
    const label = { in: 'Giriş yapıldı', break: 'Mola başladı', back: 'Mola tamamlandı', out: 'Çıkış yapıldı' }[kind]; store.log(`${store.employees.find(e => e.id === employeeId)?.fullName}: ${label} (${time})`, 'ik'); toast.success(label);
  }
  const inside = team.filter(e => { const a = currentRecord(e.id); return a?.checkIn && !a.checkOut; }).length;
  const onBreak = team.filter(e => currentRecord(e.id)?.breaks.some(b => !b.end)).length;
  return <div className="space-y-6"><PageHeader title="Çalışma günü, canlı takip" description="Girişler, molalar ve gerçekleşen çalışma süreleri." actions={<div className="rounded-2xl border border-indigo-100 bg-white px-5 py-2 dark:border-indigo-900 dark:bg-slate-900"><span className="mr-3 inline-flex items-center gap-1 text-xs text-emerald-600"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" /> CANLI</span><span className="font-mono text-xl font-semibold tabular-nums">{now.toLocaleTimeString('tr-TR')}</span></div>} />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard title="Oteldeki personel" value={inside} tone="emerald" icon={<UserCheck size={21} />} /><StatCard title="Molada" value={onBreak} tone="amber" icon={<Coffee size={21} />} /><StatCard title="Seçili aralık · çalışma" value={formatMinutes(history.reduce((n, a) => n + workedMinutes(a), 0))} icon={<Clock3 size={21} />} /><StatCard title="Seçili aralık · fazla mesai" value={formatMinutes(history.reduce((n, a) => n + (overtime[a.id] ?? 0), 0))} tone="violet" icon={<Timer size={21} />} /></div>
    <Card title={`Bugün · ${formatDate(today, 'd MMMM yyyy, EEEE')}`} subtitle="Gece başlayan açık vardiyalar ertesi gün aynı kayıt üzerinden kapanır." actions={<Select aria-label="Departman filtresi" options={[{ value: '', label: 'Tüm departmanlar' }, ...departmentOptions]} value={department} onChange={e => setDepartment(e.target.value)} />}>
      <div className="divide-y divide-slate-100 dark:divide-slate-800">{team.map(e => { const a = currentRecord(e.id); const entered = !!a?.checkIn; const closed = !!a?.checkOut; const paused = !!a?.breaks.some(b => !b.end); const stale = !!a?.checkIn && !closed && a.date < addDaysStr(today, -1); return <div key={e.id} className="flex flex-wrap items-center justify-between gap-4 py-4"><div className="flex min-w-56 items-center gap-3"><Avatar name={e.fullName} /><div><p className="font-semibold">{e.fullName}</p><p className="text-xs text-slate-500">{departments[e.department]} · {e.position}</p></div></div><div className="min-w-32 text-sm"><Badge color={closed ? 'slate' : paused ? 'amber' : entered ? 'emerald' : 'slate'} dot>{closed ? 'Günü tamamladı' : paused ? 'Molada' : entered ? 'Çalışıyor' : 'Giriş bekleniyor'}</Badge><p className="mt-1 text-xs text-slate-500">{entered ? `${a!.checkIn} ${closed ? '→ ' + a!.checkOut : 'giriş'} · ${formatMinutes(workedMinutes(a!, closed ? undefined : clock))}` : '—'}{a && a.date !== today ? ` · ${formatDate(a.date, 'd MMM')}` : ''}</p></div><div className="text-xs text-slate-500">Mola: {a ? breakUsed(a, entered && !closed ? clock : undefined) : 0} / {e.breakMinutes} dk{stale && <p className="text-rose-500">Eski açık kayıt</p>}</div><div className="flex flex-wrap gap-2"><Button size="sm" variant="secondary" icon={<LogIn size={14} />} disabled={entered} onClick={() => action(e.id, 'in')}>Giriş yap</Button><Button size="sm" variant="secondary" icon={<Coffee size={14} />} disabled={!entered || closed || paused || stale} onClick={() => action(e.id, 'break')}>Molaya çık</Button><Button size="sm" variant="secondary" icon={<Play size={14} />} disabled={!entered || closed || !paused || stale} onClick={() => action(e.id, 'back')}>Moladan dön</Button><Button size="sm" variant="secondary" icon={<LogOut size={14} />} disabled={!entered || closed || stale} onClick={() => action(e.id, 'out')}>Çıkış yap</Button></div></div>; })}{team.length === 0 && <p className="py-6 text-center text-slate-500">Bu filtreye uygun aktif personel yok.</p>}</div>
    </Card>
    <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-lg font-semibold">Puantaj geçmişi</h2><p className="text-sm text-slate-500">Planlanan ve gerçekleşen çalışma karşılaştırması</p></div><div className="flex gap-3"><Input label="Başlangıç" type="date" value={from} max={to} onChange={e => e.target.value && setFrom(e.target.value)} /><Input label="Bitiş" type="date" value={to} min={from} onChange={e => e.target.value && setTo(e.target.value)} /></div></div>
    <DataTable data={history} rowKey={a => a.id} searchPlaceholder="Personel ara…" columns={[
      { key: 'employee', header: 'Personel', searchValue: a => employees.find(e => e.id === a.employeeId)?.fullName ?? '', render: a => <span className="font-medium">{employees.find(e => e.id === a.employeeId)?.fullName ?? 'Silinmiş personel'}</span> },
      { key: 'date', header: 'Tarih', sortValue: a => a.date, render: a => formatDate(a.date) },
      { key: 'planned', header: 'Planlanan', render: a => { const c = attendanceComparison(a, shifts); return <div>{c.plans.map(s => `${s.start}–${s.end}`).join(' / ') || 'Plan yok'}<p className="text-xs text-slate-400">{formatMinutes(c.planned)}</p></div>; } },
      { key: 'actual', header: 'Gerçekleşen', render: a => <div>{a.checkIn || '—'} → {a.checkOut || '—'}<p className="text-xs text-slate-400">{a.checkOut ? formatMinutes(workedMinutes(a)) : a.checkIn ? 'Açık kayıt' : 'Giriş yok'}</p></div> },
      { key: 'late', header: 'Geç kalma / erken çıkış', render: a => { const c = attendanceComparison(a, shifts); return <span className={c.late || c.early ? 'text-amber-600' : 'text-slate-400'}>{c.late} / {c.early} dk</span>; } },
      { key: 'break', header: 'Mola / hakkı', render: a => { const allowed = employees.find(e => e.id === a.employeeId)?.breakMinutes ?? 0; const used = breakUsed(a); return <span className={used > allowed ? 'text-rose-500' : ''}>{used} / {allowed} dk</span>; } },
      { key: 'overtime', header: 'Fazla mesai', render: a => <Badge color={(overtime[a.id] ?? 0) > 0 ? 'violet' : 'slate'}>{formatMinutes(overtime[a.id] ?? 0)}</Badge> },
    ]} /><p className="text-xs text-slate-500">Fazla mesai, pazartesi–pazar haftasında tamamlanmış net çalışma süresinin 45 saati aşan bölümüdür. Açık kayıtlar bordroya dahil edilmez.</p>
  </div>;
}
