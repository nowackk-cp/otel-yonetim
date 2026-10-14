import type { Attendance, Employee, LeaveRequest, Shift } from '../../types';
import { addDaysStr, daysBetween, timeToMinutes, todayStr } from '../../lib/format';

export const departments = { on_buro: 'Ön büro', kat_hizmetleri: 'Kat hizmetleri', mutfak: 'Mutfak', servis: 'Servis', teknik: 'Teknik', guvenlik: 'Güvenlik', muhasebe: 'Muhasebe', yonetim: 'Yönetim' };
export const departmentOptions = Object.entries(departments).map(([value, label]) => ({ value, label }));
export const leaveTypes = { yillik: 'Yıllık izin', hastalik: 'Hastalık', ucretsiz: 'Ücretsiz izin', mazeret: 'Mazeret' };
export const shiftNames = { sabah: 'Sabah', aksam: 'Akşam', gece: 'Gece', ozel: 'Özel' };
export const shiftColors = { sabah: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800', aksam: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-200 dark:border-indigo-800', gece: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600', ozel: 'bg-teal-50 text-teal-800 border-teal-200 dark:bg-teal-950 dark:text-teal-200 dark:border-teal-800' };
export function weekStart(date: string): string { return addDaysStr(date, -((new Date(`${date}T12:00:00`).getDay() + 6) % 7)); }
export function duration(start: string, end: string): number { const d = timeToMinutes(end) - timeToMinutes(start); return d < 0 ? d + 1440 : d; }
export function shiftNet(s: Pick<Shift, 'start' | 'end' | 'breakMinutes'>): number { return Math.max(0, duration(s.start, s.end) - s.breakMinutes); }
export function breakUsed(a: Attendance, now?: string): number { return a.breaks.reduce((sum, b) => sum + (b.end || now ? duration(b.start, b.end || now!) : 0), 0); }
export function workedMinutes(a: Attendance, now?: string): number { return a.checkIn && (a.checkOut || now) ? Math.max(0, duration(a.checkIn, a.checkOut || now!) - breakUsed(a, a.checkOut || now)) : 0; }
export function serviceYears(e: Employee, at = todayStr()): number { const start = new Date(`${e.startDate}T12:00:00`); const end = new Date(`${at}T12:00:00`); let years = end.getFullYear() - start.getFullYear(); if (at.slice(5) < e.startDate.slice(5)) years--; return Math.max(0, years); }
/** 4857/53: 1–5 (5 dahil) 14; 5 üzeri–15 altı 20; 15 ve üzeri 26. */
export function recommendedLeave(e: Employee, at = todayStr()): number { const years = serviceYears(e, at); return years < 1 ? 0 : years <= 5 ? 14 : years < 15 ? 20 : 26; }
/** Planlama bakiyesi: seçilen takvim yılında onaylı yıllık izinlerin benzersiz takvim günleri. */
export function leaveBalance(e: Employee, requests: LeaveRequest[], at = todayStr()) {
  const year = at.slice(0, 4); const usedDays = new Set<string>();
  requests.filter(l => l.employeeId === e.id && l.type === 'yillik' && l.status === 'onaylandi').forEach(l => {
    const from = l.startDate > `${year}-01-01` ? l.startDate : `${year}-01-01`;
    const to = l.endDate < `${year}-12-31` ? l.endDate : `${year}-12-31`;
    for (let d = from; d <= to; d = addDaysStr(d, 1)) usedDays.add(d);
  });
  const entitlement = e.annualLeaveDays; return { entitlement, used: usedDays.size, remaining: entitlement - usedDays.size, recommended: recommendedLeave(e, at) };
}
export function shiftBounds(s: Shift): [number, number] { const start = daysBetween('2000-01-01', s.date) * 1440 + timeToMinutes(s.start); return [start, start + duration(s.start, s.end)]; }
export function shiftWarnings(employee: Employee, shifts: Shift[], leaves: LeaveRequest[], week: string): string[] {
  const all = shifts.filter(s => s.employeeId === employee.id).sort((a, b) => shiftBounds(a)[0] - shiftBounds(b)[0]);
  const current = all.filter(s => s.date >= week && s.date <= addDaysStr(week, 6)); const warnings = new Set<string>();
  if (current.reduce((n, s) => n + shiftNet(s), 0) > 2700) warnings.add('Haftalık 45 saat aşılıyor');
  for (const s of current) {
    if (s.breakMinutes < employee.breakMinutes) warnings.add(`${s.date.slice(5)}: mola hakkı eksik`);
    const [start, end] = shiftBounds(s);
    if (leaves.some(l => l.employeeId === employee.id && l.status === 'onaylandi' && start < (daysBetween('2000-01-01', l.endDate) + 1) * 1440 && end > daysBetween('2000-01-01', l.startDate) * 1440)) warnings.add(`${s.date.slice(5)}: onaylı izinle çakışıyor`);
    for (const other of all) {
      if (other.id === s.id) continue;
      const [os, oe] = shiftBounds(other);
      if (start < oe && os < end) warnings.add(`${s.date.slice(5)}: vardiya çakışması`);
      else if ((os >= end && os - end < 660) || (start >= oe && start - oe < 660)) warnings.add(`${s.date.slice(5)}: dinlenme 11 saatten az`);
    }
  }
  return [...warnings];
}
export function attendanceComparison(a: Attendance, shifts: Shift[]) {
  const plans = shifts.filter(s => s.employeeId === a.employeeId && s.date === a.date).sort((x, y) => x.start.localeCompare(y.start));
  const planned = plans.reduce((sum, s) => sum + shiftNet(s), 0); const first = plans[0]; const last = plans[plans.length - 1];
  const offset = (time: string, reference: string) => { let v = timeToMinutes(time) - timeToMinutes(reference); if (v < -720) v += 1440; if (v > 720) v -= 1440; return v; };
  return { plans, planned, actual: workedMinutes(a), late: a.checkIn && first ? Math.max(0, offset(a.checkIn, first.start)) : 0, early: a.checkOut && last ? Math.max(0, -offset(a.checkOut, last.end)) : 0 };
}
export const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
export function printTable(title: string, headers: string[], rows: unknown[][], note = '') {
  const frame = document.createElement('iframe'); frame.style.cssText = 'position:fixed;width:1px;height:1px;left:-10000px;'; frame.title = title;
  frame.onload = () => { frame.contentWindow?.focus(); frame.contentWindow?.print(); window.setTimeout(() => frame.remove(), 60000); };
  frame.srcdoc = `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>@page{size:landscape;margin:14mm}body{font:12px Arial;color:#172033}h1{font-size:23px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #dce1ec;padding:9px;text-align:left}th{background:#eef2ff}p{color:#64748b}tr{break-inside:avoid}</style></head><body><h1>${escapeHtml(title)}</h1><p>${escapeHtml(note)}</p><table><thead><tr>${headers.map(h => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></body></html>`;
  document.body.appendChild(frame);
}
