import type { Attendance, Employee, InvoiceLine, PayrollRecord, Settings, Transaction } from '../../types';
import { round2 } from '../../lib/calc';
import { calculateEmployeePayroll, calculatePayroll } from '../hr/payrollCalc';

/** Kurumlar vergisi arayüzde yüzde, Settings içinde oran olarak saklanır. */
export const DEFAULT_CORPORATE_TAX_RATE = 25;

function finite(value: number, name: string): number {
  if (!Number.isFinite(value)) throw new RangeError(`${name} sonlu bir sayı olmalı.`);
  return value;
}
function percentage(rate: number): number {
  finite(rate, 'Oran');
  if (rate < 0 || rate > 100) throw new RangeError('Oran 0–100 arasında olmalı.');
  return rate;
}
const money = (value: number) => Math.sign(value) * round2(Math.abs(finite(value, 'Tutar')));

export function calculateEmployerCost(gross: number, settings: Settings): number {
  return calculatePayroll({ gross }, settings).employerCost;
}

export function calculateVat(amount: number, rate: number, included = true) {
  percentage(rate);
  const rounded = money(amount);
  if (included) {
    const vat = money(rounded * rate / (100 + rate));
    return { net: money(rounded - vat), vat, gross: rounded };
  }
  const vat = money(rounded * rate / 100);
  return { net: rounded, vat, gross: money(rounded + vat) };
}

/** GİB uyumlu: konaklama vergisi KDV hariç hizmet bedelinden hesaplanır ve KDV matrahına girmez.
 * included=true: giriş KDV dahil hizmet bedelidir (konaklama vergisi hariç).
 * included=false: giriş vergisiz hizmet bedelidir. gross iki verginin dahil olduğu toplamdır. */
export function calculateAccommodationCharge(amount: number, vatRate: number, accommodationRate: number, included = true) {
  percentage(accommodationRate);
  const vatResult = calculateVat(amount, vatRate, included);
  const net = vatResult.net;
  const accommodationTax = money(net * accommodationRate / 100);
  return { net, accommodationTax, vatBase: net, vat: vatResult.vat, gross: money(vatResult.gross + accommodationTax) };
}

export type TaxableInvoiceLine = InvoiceLine & { accommodation?: boolean; alcohol?: boolean };
export function calculateInvoice(lines: TaxableInvoiceLine[], accommodationRate: number) {
  percentage(accommodationRate);
  const groups = new Map<number, { rate: number; base: number }>();
  let subtotal = 0;
  let accommodationBase = 0;
  for (const line of lines) {
    finite(line.quantity, 'Miktar'); finite(line.unitPrice, 'Birim fiyat'); percentage(line.vatRate);
    if (line.quantity < 0 || line.unitPrice < 0) throw new RangeError('Fatura miktarı ve birim fiyatı negatif olamaz.');
    const base = money(line.quantity * line.unitPrice);
    const group = groups.get(line.vatRate) ?? { rate: line.vatRate, base: 0 };
    group.base = money(group.base + base);
    groups.set(line.vatRate, group);
    subtotal += base;
    if (line.accommodation) accommodationBase += base;
  }
  // Vergiyi oran grubunun toplam matrahında yuvarla; kalem bölmek vergiyi değiştirmesin.
  const vatBreakdown = [...groups.values()].sort((a, b) => a.rate - b.rate).map(group => {
    const base = group.base;
    return { rate: group.rate, base, vat: money(base * group.rate / 100) };
  });
  const vatTotal = round2(vatBreakdown.reduce((s, row) => s + row.vat, 0));
  const accommodationTax = money(money(accommodationBase) * accommodationRate / 100);
  return { subtotal: round2(subtotal), vatTotal, accommodationBase: round2(accommodationBase), accommodationTax,
    total: round2(subtotal + vatTotal + accommodationTax), vatBreakdown };
}

/** Eski kayıtlardaki yuvarlanmış birim fiyatları, kaydedilmiş fatura toplamlarıyla uzlaştırır. */
export function invoiceVatBreakdown(lines: InvoiceLine[], subtotal: number, vatTotal: number, _accommodationTax = 0) {
  const result = calculateInvoice(lines, 0);
  const groups = result.vatBreakdown.map((group) => ({ ...group }));
  // İmza uyumluluğu için son parametre korunur; konaklama vergisi KDV kırılımına eklenmez.
  if (groups.length) {
    const last = groups[groups.length - 1];
    last.base = round2(last.base + subtotal - result.subtotal);
    last.vat = money(last.vat + vatTotal - groups.reduce((sum, g) => sum + g.vat, 0));
  }
  return { groups, roundingAdjustment: round2(subtotal - result.subtotal) };
}

export function calculateVatReturn(transactions: Transaction[], openingCarry = 0, accommodationRate = 2) {
  percentage(accommodationRate);
  const normalizedCarry = money(Math.max(0, finite(openingCarry, 'Devreden KDV')));
  const groups = new Map<number, { rate: number; salesBase: number; salesVat: number; purchaseVat: number }>();
  let outputVat = 0;
  let inputVat = 0;
  let accommodationBase = 0;
  let accommodationTax = 0;
  for (const tx of transactions) {
    const { net, vat } = calculateVat(tx.amount, tx.vatRate);
    const group = groups.get(tx.vatRate) ?? { rate: tx.vatRate, salesBase: 0, salesVat: 0, purchaseVat: 0 };
    if (tx.type === 'gelir') {
      group.salesBase += net; group.salesVat += vat; outputVat += vat;
      if (isAccommodation(tx.category)) {
        // Transaction.amount yalnızca KDV dahil hizmet bedelidir; ek konaklama vergisini içermez.
        accommodationBase += net; accommodationTax += money(net * accommodationRate / 100);
      }
    } else { group.purchaseVat += vat; inputVat += vat; }
    groups.set(tx.vatRate, group);
  }
  const difference = money(money(outputVat) - money(inputVat) - normalizedCarry);
  return { outputVat: round2(outputVat), inputVat: round2(inputVat), payable: Math.max(0, difference),
    carry: Math.max(0, -difference), openingCarry: normalizedCarry, accommodationBase: round2(accommodationBase), accommodationTax: money(accommodationTax),
    breakdown: [...groups.values()].sort((a, b) => a.rate - b.rate).map((g) => ({ ...g, salesBase: round2(g.salesBase), salesVat: round2(g.salesVat), purchaseVat: round2(g.purchaseVat) })) };
}

export function isAccommodation(category: string): boolean {
  return /^konaklama(?:$|\s+(?:geliri|hizmeti|bedeli)$)/u.test(category.trim().toLocaleLowerCase('tr-TR'));
}

/** Kayıtlardaki önceki ayları sırayla kapatır; ödenecek KDV sonraki aya taşınmaz. */
export function calculateCarryBefore(transactions: Transaction[], period: string): number {
  const months = [...new Set(transactions.filter((t) => t.date.slice(0, 7) < period).map((t) => t.date.slice(0, 7)))].sort();
  return months.reduce((carry, month) => calculateVatReturn(transactions.filter((t) => t.date.startsWith(month)), carry).carry, 0);
}

export function calculateAccommodationTax(netBase: number, rate: number): number {
  return money(Math.max(0, finite(netBase, 'Matrah')) * percentage(rate) / 100);
}

/** Kayıtlı bordro önceliklidir; önizleme İK ile aynı kümülatif matrah ve puantajı kullanır. */
export function calculatePayrollTaxes(employees: Employee[], payrolls: PayrollRecord[], period: string, settings: Settings, attendance: Attendance[] = []) {
  const records = payrolls.filter((p) => p.period === period);
  const employeeIds = new Set(records.map((p) => p.employeeId));
  const fallback = employees.filter((e) => e.active && e.startDate <= `${period}-31` && !employeeIds.has(e.id));
  const rows = [
    ...records.map((p) => ({ employeeId: p.employeeId, incomeTax: p.deductions.incomeTax, stampTax: p.deductions.stampTax,
      employeePremium: p.deductions.sgk + p.deductions.unemployment,
      employerPremium: money(money((p.gross + p.overtime) * settings.sgkEmployer / 100) + money((p.gross + p.overtime) * settings.unemploymentEmployer / 100)) })),
    ...fallback.map((e) => { const c = calculateEmployeePayroll(e, period, attendance, payrolls, settings);
      return { employeeId: e.id, incomeTax: c.incomeTax, stampTax: c.stampTax, employeePremium: c.sgk + c.unemployment, employerPremium: c.employerSgk + c.employerUnemployment }; }),
  ];
  const sum = (key: 'incomeTax' | 'stampTax' | 'employeePremium' | 'employerPremium') => round2(rows.reduce((s, r) => s + r[key], 0));
  return { incomeTax: sum('incomeTax'), stampTax: sum('stampTax'), employeePremium: sum('employeePremium'), employerPremium: sum('employerPremium'),
    withholding: round2(sum('incomeTax') + sum('stampTax')), premiums: round2(sum('employeePremium') + sum('employerPremium')), recordedCount: records.length, estimatedCount: fallback.length };
}

/** Nakit vergi ödemeleri ticari gider değildir; matrahtan ikinci kez düşülmez. */
export function isTaxPayment(tx: Transaction): boolean {
  return tx.type === 'gider' && (/^(?:vergi|geçici vergi|kurumlar vergisi|kdv|konaklama vergisi|muhtasar)(?:$|\s)/u.test(tx.category.trim().toLocaleLowerCase('tr-TR')) || /^GECICI:\d{4}:Q[1-4]$/.test(tx.documentNo ?? ''));
}

/** Çağıran yıl başından çeyrek sonuna kadar olan kayıtları verir. Mahsup, ödenmiş tutardır. */
export function calculateProvisionalTax(transactions: Transaction[], rate = DEFAULT_CORPORATE_TAX_RATE, previousPaid = 0, accommodationRate = 2) {
  percentage(rate);
  percentage(accommodationRate);
  const paid = money(Math.max(0, finite(previousPaid, 'Önceki geçici vergi ödemesi')));
  const profit = money(transactions.filter(t => !isTaxPayment(t)).reduce((sum, t) => {
    // Defter tutarı KDV dahil hizmet bedelidir; konaklama vergisi buradan ikinci kez düşülmez.
    const net = calculateVat(t.amount, t.vatRate).net;
    return sum + (t.type === 'gelir' ? 1 : -1) * net;
  }, 0));
  const assessedTax = money(Math.max(0, profit) * rate / 100);
  return { profit, assessedTax, previousPaid: paid, tax: money(Math.max(0, assessedTax - paid)), carryCredit: money(Math.max(0, paid - assessedTax)) };
}

/** Belge no, ödemenin hangi yıl/çeyrek borcuna ait olduğunu açıkça belirtir. */
export function previousProvisionalPayments(transactions: Transaction[], period: string): number {
  const year = Number(period.slice(0, 4)); const quarter = Math.ceil(Number(period.slice(5, 7)) / 3);
  const end = `${year}-${String(quarter * 3).padStart(2, '0')}-31`;
  return money(transactions.reduce((sum, t) => {
    const match = /^GECICI:(\d{4}):Q([1-4])$/.exec(t.documentNo ?? '');
    return match && t.type === 'gider' && Number(match[1]) === year && Number(match[2]) < quarter && t.date <= end ? sum + t.amount : sum;
  }, 0));
}

/** Planlama takvimi: takip eden ay, hafta sonu ise ilk iş günü. Resmî uzatmalar ayrıca kontrol edilir. */
export function calculateTaxCalendar(period: string, settings: Settings) {
  const [year, month] = period.split('-').map(Number);
  const deadline = (day: number) => {
    const date = new Date(year, month, Math.max(1, Math.min(28, day)));
    while (date.getDay() === 0 || date.getDay() === 6) date.setDate(date.getDate() + 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };
  return [
    { name: 'KDV beyan ve ödeme', date: deadline(settings.taxDeadlineDay) },
    { name: 'Muhtasar ve prim hizmet beyanı / vergi ödemesi', date: deadline(settings.withholdingDeadlineDay) },
    { name: 'Konaklama vergisi beyan ve ödeme', date: deadline(settings.accommodationDeadlineDay) },
  ].sort((a, b) => a.date.localeCompare(b.date));
}
