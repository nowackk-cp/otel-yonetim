import type { Attendance, Employee, PayrollRecord, Settings } from '../../types';
import { round2 } from '../../lib/calc';
import { calculatePayroll, minimumWageBaseBeforePeriod, type PayrollSettings } from '../../lib/payroll';
export { calculatePayroll, calcPayroll, calculateGrossFromNet, minimumWageBaseBeforePeriod } from '../../lib/payroll';
export type { PayrollInput, PayrollCalc, PayrollSettings } from '../../lib/payroll';
import { weekStart, workedMinutes } from './hrUtils';

/** 45 saat üzeri tamamlanmış puantaj; ay sınırındaki hafta önceki ayla birlikte hesaplanır.
 * Fazla mesai eşiğini aşan kayıt, vardiyanın başladığı aya yazılır. */
export function overtimeByAttendance(attendance: Attendance[], employeeId: string): Record<string, number> {
  const weeks = new Map<string, number>(); const result: Record<string, number> = {};
  const records = attendance.filter(a => a.employeeId === employeeId && a.checkIn && a.checkOut).sort((a, b) => `${a.date} ${a.checkIn}`.localeCompare(`${b.date} ${b.checkIn}`));
  for (const a of records) { const week = weekStart(a.date); const before = weeks.get(week) ?? 0; const after = before + workedMinutes(a); result[a.id] = Math.max(0, after - 2700) - Math.max(0, before - 2700); weeks.set(week, after); }
  return result;
}
export function calculateEmployeePayroll(employee: Employee, period: string, attendance: Attendance[], payrolls: PayrollRecord[], settings: PayrollSettings) {
  const month = attendance.filter(a => a.employeeId === employee.id && a.date.startsWith(period));
  const workedHours = month.reduce((n, a) => n + workedMinutes(a), 0) / 60;
  const overtimeMap = overtimeByAttendance(attendance, employee.id);
  const overtimeHours = month.reduce((n, a) => n + (overtimeMap[a.id] ?? 0), 0) / 60;
  // Aynı ayın mükerrer kaydı kümülatif matrahı iki kez artırmamalı.
  const previous = [...new Map(payrolls.filter(p => p.employeeId === employee.id && p.period.slice(0, 4) === period.slice(0, 4) && p.period < period).map(p => [p.period, p])).values()];
  const cumulativeTaxBase = round2(previous.reduce((sum, p) => sum + round2(Math.max(0, p.gross + p.overtime - p.deductions.sgk - p.deductions.unemployment)), 0));
  const hourlyRate = employee.salaryType === 'saatlik' ? employee.grossSalary : employee.grossSalary / 225;
  // Saatlik çalışanda fazla mesai saati normal brütte tekrar sayılmaz.
  const gross = employee.salaryType === 'saatlik' ? Math.max(0, workedHours - overtimeHours) * hourlyRate : employee.grossSalary;
  const monthIndex = Number(period.slice(5, 7)) - 1;
  const firstMonth = employee.startDate.slice(0, 4) === period.slice(0, 4) ? Number(employee.startDate.slice(5, 7)) - 1 : 0;
  const missingPeriods = Array.from({ length: Math.max(0, monthIndex - firstMonth) }, (_, i) => `${period.slice(0, 4)}-${String(firstMonth + i + 1).padStart(2, '0')}`).filter(p => !previous.some(record => record.period === p));
  return { ...calculatePayroll({ gross, hourlyRate, overtimeHours, cumulativeTaxBase, cumulativeMinimumWageBase: minimumWageBaseBeforePeriod(period, settings) }, settings), workedHours, overtimeHours, previousPeriods: previous.length, missingPeriods };
}
