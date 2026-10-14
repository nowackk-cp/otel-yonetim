import type { Settings } from '../types';

/** 2026: 5510/82 üst sınır 9 kat. Geçmiş/özel senaryolar için 7,5 seçilebilir. */
export type PayrollSettings = Settings & { sgkCeilingMultiplier?: number };
export const DEFAULT_SGK_CEILING_MULTIPLIER = 9;
const nonnegative = (n: number) => Number.isFinite(n) ? Math.max(0, n) : 0;
const money = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export interface PayrollInput {
  /** Fazla mesai hariç brüt ücret. */
  gross: number;
  overtimeHours?: number;
  hourlyRate?: number;
  /** Kayıtlı bordro okunurken saatten yeniden türetmeden kesin mesai tutarı. */
  overtimeGross?: number;
  cumulativeTaxBase?: number;
  /** Çalışanın matrahından bağımsız, önceki ayların asgari ücret matrahları. */
  cumulativeMinimumWageBase?: number;
  otherDeductions?: number;
}

export function incomeTaxOnAnnual(annualBase: number, brackets: Settings['incomeTaxBrackets']): number {
  let tax = 0; let previous = 0;
  for (const bracket of brackets) {
    const upper = bracket.upTo ?? Infinity;
    if (annualBase > previous) tax += (Math.min(annualBase, upper) - previous) * bracket.rate / 100;
    previous = upper;
    if (annualBase <= upper) break;
  }
  return tax;
}

export function minimumWageTaxBase(settings: Settings): number {
  const gross = money(nonnegative(settings.minWageGross));
  return money(Math.max(0, gross - money(gross * settings.sgkEmployee / 100) - money(gross * settings.unemploymentEmployee / 100)));
}

export function minimumWageBaseBeforePeriod(period: string, settings: Settings): number {
  return money(Math.max(0, Number(period.slice(5, 7)) - 1) * minimumWageTaxBase(settings));
}

/** Saf hesap: aynı ay maaş ve mesai birleştirilir, istisnalar bir kez uygulanır.
 * Tam ay ve yıl içinde sabit asgari ücret/prim oranları varsayılır. */
export function calculatePayroll(input: PayrollInput, settings: PayrollSettings) {
  const gross = money(nonnegative(input.gross));
  const overtime = input.overtimeGross === undefined
    ? money(nonnegative(input.overtimeHours ?? 0) * nonnegative(input.hourlyRate ?? gross / 225) * 1.5)
    : money(nonnegative(input.overtimeGross));
  const totalGross = money(gross + overtime);
  const multiplier = settings.sgkCeilingMultiplier && settings.sgkCeilingMultiplier > 0 ? settings.sgkCeilingMultiplier : DEFAULT_SGK_CEILING_MULTIPLIER;
  // Asgari ücret 0 olan özel vergi testinde/ayarda tavan tanımlı değildir.
  const sgkCeiling = settings.minWageGross > 0 ? money(settings.minWageGross * multiplier) : Infinity;
  const sgkBase = money(Math.min(totalGross, sgkCeiling));
  const sgk = money(sgkBase * settings.sgkEmployee / 100);
  const unemployment = money(sgkBase * settings.unemploymentEmployee / 100);
  const incomeTaxBase = money(Math.max(0, totalGross - sgk - unemployment));
  const cumulativeTaxBase = money(nonnegative(input.cumulativeTaxBase ?? 0));
  const tax = (base: number) => incomeTaxOnAnnual(base, settings.incomeTaxBrackets);
  const cumulativeTaxBaseAfter = money(cumulativeTaxBase + incomeTaxBase);
  const incomeTaxBeforeExemption = money(tax(cumulativeTaxBaseAfter) - tax(cumulativeTaxBase));
  const minimumBase = minimumWageTaxBase(settings);
  const cumulativeMinimumWageBase = money(nonnegative(input.cumulativeMinimumWageBase ?? 0));
  const incomeTaxExemption = money(Math.min(incomeTaxBeforeExemption, Math.max(0, tax(money(cumulativeMinimumWageBase + minimumBase)) - tax(cumulativeMinimumWageBase))));
  const incomeTax = money(Math.max(0, incomeTaxBeforeExemption - incomeTaxExemption));
  const stampTaxBeforeExemption = money(totalGross * settings.stampTax);
  const stampTaxExemption = Math.min(stampTaxBeforeExemption, money(nonnegative(settings.minWageGross) * settings.stampTax));
  const stampTax = money(Math.max(0, stampTaxBeforeExemption - stampTaxExemption));
  const other = money(nonnegative(input.otherDeductions ?? 0));
  const employerSgk = money(sgkBase * settings.sgkEmployer / 100);
  const employerUnemployment = money(sgkBase * settings.unemploymentEmployer / 100);
  return { gross, overtime, totalGross, sgkBase, sgkCeiling, sgk, unemployment, incomeTaxBase, cumulativeTaxBase,
    cumulativeTaxBaseAfter, cumulativeMinimumWageBase, incomeTaxBeforeExemption, incomeTaxExemption, incomeTax,
    stampTaxBeforeExemption, stampTaxExemption, stampTax, other,
    net: money(totalGross - sgk - unemployment - incomeTax - stampTax - other), employerSgk, employerUnemployment,
    employerCost: money(totalGross + employerSgk + employerUnemployment), deductions: { sgk, unemployment, incomeTax, stampTax, other } };
}

export type PayrollCalc = ReturnType<typeof calculatePayroll>;
/** Eski sayısal API korunur; matrah verilmezse yılın ilk bordrosu varsayılır. */
export function calcPayroll(input: number | PayrollInput, settings: PayrollSettings): PayrollCalc {
  return calculatePayroll(typeof input === 'number' ? { gross: input } : input, settings);
}

/** Kuruş adımlarıyla arama: sonucu tekrar yuvarlamak hedef neti aşağı düşürmez. */
export function calculateGrossFromNet(net: number, settings: PayrollSettings, context: Omit<PayrollInput, 'gross'> = {}): PayrollCalc {
  const target = money(nonnegative(net));
  const calculate = (cents: number) => calculatePayroll({ ...context, gross: cents / 100 }, settings);
  let low = 0; let high = Math.max(100, Math.ceil(target * 200));
  for (let i = 0; i < 32 && calculate(high).net < target; i++) high *= 2;
  while (low < high) { const middle = Math.floor((low + high) / 2); if (calculate(middle).net < target) low = middle + 1; else high = middle; }
  return calculate(low);
}
