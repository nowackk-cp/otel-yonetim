// Çalıştırma: node --test src/pages/hr/payrollCalc.test.mjs
// Esbuild bellekte derler; kaynak veya çıktı klasörlerinde dosya oluşturmaz.
import { build } from 'esbuild';
import assert from 'node:assert/strict';
import test from 'node:test';

const compiled = await build({
  stdin: { contents: `export * from './src/pages/hr/payrollCalc'; export * from './src/pages/hr/hrUtils'; export { calcPayroll as legacyCalcPayroll } from './src/lib/calc'; export { calculatePayroll as sharedCalculatePayroll, incomeTaxOnAnnual } from './src/lib/payroll'; export { defaultSettings, createSeed } from './src/store/seed';`, resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, write: false, platform: 'node', format: 'esm',
});
const { calculatePayroll, calculateEmployeePayroll, calculateGrossFromNet, minimumWageBaseBeforePeriod, legacyCalcPayroll, sharedCalculatePayroll, incomeTaxOnAnnual, defaultSettings, createSeed, overtimeByAttendance, workedMinutes, recommendedLeave, leaveBalance, shiftWarnings } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);
const settings = { minWageGross: 30000, sgkEmployee: 14, unemploymentEmployee: 1, sgkEmployer: 15.75, unemploymentEmployer: 2, stampTax: 0.00759, incomeTaxBrackets: [{ upTo: 100000, rate: 15 }, { upTo: 200000, rate: 20 }, { upTo: null, rate: 30 }] };
const employee = { id: 'e1', fullName: 'Test Personeli', department: 'on_buro', salaryType: 'aylik', grossSalary: 45000, startDate: '2020-01-01', annualLeaveDays: 20, breakMinutes: 60, active: true };
const attendance = (id, date, checkIn = '08:00', checkOut = '18:00', breaks = []) => ({ id, employeeId: 'e1', date, checkIn, checkOut, breaks });

test('Asgari ücrette gelir ve damga vergisi sıfır; net ve işveren maliyeti doğru', () => {
  const c = calculatePayroll({ gross: 30000 }, settings);
  assert.equal(c.sgk, 4200); assert.equal(c.unemployment, 300);
  assert.equal(c.incomeTaxExemption, 3825); assert.equal(c.incomeTax, 0); assert.equal(c.stampTax, 0);
  assert.equal(c.net, 25500); assert.equal(c.employerCost, 35325);
});
test('Kümülatif matrah dilim geçişinde iki oranı kullanır', () => {
  const c = calculatePayroll({ gross: 20000, cumulativeTaxBase: 95000 }, { ...settings, minWageGross: 0 });
  // 17.000 matrahın ilk 5.000'i %15, kalan 12.000'i %20.
  assert.equal(c.incomeTaxBeforeExemption, 3150); assert.equal(c.incomeTax, 3150); assert.equal(c.cumulativeTaxBaseAfter, 112000);
});
test('Asgari ücret istisnasının kümülatif matrahı bağımsız ilerler', () => {
  const c = calculatePayroll({ gross: 60000, cumulativeTaxBase: 250000, cumulativeMinimumWageBase: 90000 }, settings);
  assert.equal(c.incomeTaxBeforeExemption, 15300); assert.equal(c.incomeTaxExemption, 4600); assert.equal(c.incomeTax, 10700);
});
test('Sıfır ve düşük brütte istisnalar negatif vergi oluşturmaz', () => {
  for (const gross of [0, 100, -100]) { const c = calculatePayroll({ gross }, settings); assert.ok(c.incomeTax >= 0); assert.ok(c.stampTax >= 0); assert.ok(c.net >= 0); }
});
test('Fazla mesai brüte eklenir ve tüm kesintiler toplam kazançtan hesaplanır', () => {
  const c = calculatePayroll({ gross: 45000, overtimeHours: 10, hourlyRate: 200 }, settings);
  assert.equal(c.overtime, 3000); assert.equal(c.totalGross, 48000); assert.equal(c.sgk, 6720);
  assert.equal(c.net, Math.round((c.totalGross - Object.values(c.deductions).reduce((a, b) => a + b, 0)) * 100) / 100);
});
test('Gece vardiyası ve gece yarısından sonraki mola doğru hesaplanır', () => {
  assert.equal(workedMinutes(attendance('n', '2026-10-01', '22:00', '06:00', [{ start: '23:45', end: '00:15' }, { start: '03:00', end: '03:30' }])), 420);
  assert.equal(workedMinutes(attendance('z', '2026-10-01', '08:00', '08:00')), 0);
  assert.equal(workedMinutes(attendance('b', '2026-10-01', '08:00', '09:00', [{ start: '08:30', end: '08:30' }])), 60);
});
test('Ay sınırını aşan haftada fazla mesai sıfırlanmaz; açık kayıt dahil edilmez', () => {
  const records = ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02'].map((date, i) => attendance(`a${i}`, date));
  records.push(attendance('open', '2026-10-03', '08:00', undefined)); records[5].checkOut = undefined;
  const map = overtimeByAttendance(records, 'e1'); assert.equal(map.a4, 300); assert.equal(map.a3, 0); assert.equal(map.open, undefined);
  const calc = calculateEmployeePayroll({ ...employee, salaryType: 'saatlik', grossSalary: 100 }, '2026-10', records, [], settings);
  assert.equal(calc.workedHours, 20); assert.equal(calc.overtimeHours, 5); assert.equal(calc.gross, 1500); assert.equal(calc.overtime, 750); assert.equal(calc.totalGross, 2250);
});
test('Önceki bordronun fazla mesaisi matraha dahil; önceki yıl hariç', () => {
  const record = { employeeId: 'e1', period: '2026-09', gross: 40000, overtime: 2000, deductions: { sgk: 5880, unemployment: 420 }, net: 0 };
  const calc = calculateEmployeePayroll(employee, '2026-10', [], [record, { ...record, period: '2025-12' }, { ...record, employeeId: 'other' }], settings);
  assert.equal(calc.cumulativeTaxBase, 35700);
});
test('İzin önerisi beş yıl dahil ve on beş yıl sınırlarını korur', () => {
  assert.equal(recommendedLeave({ ...employee, startDate: '2026-01-01' }, '2026-10-14'), 0);
  assert.equal(recommendedLeave({ ...employee, startDate: '2021-10-14' }, '2026-10-14'), 14);
  assert.equal(recommendedLeave({ ...employee, startDate: '2020-10-14' }, '2026-10-14'), 20);
  assert.equal(recommendedLeave({ ...employee, startDate: '2011-10-14' }, '2026-10-14'), 26);
});
test('Bakiyeden sadece ilgili yılın onaylı yıllık izin günleri düşer', () => {
  const request = { employeeId: 'e1', startDate: '2025-12-30', endDate: '2026-01-02', status: 'onaylandi', type: 'yillik' };
  const balance = leaveBalance(employee, [request, { ...request, type: 'hastalik' }, { ...request, status: 'beklemede' }], '2026-10-14');
  assert.equal(balance.used, 2); assert.equal(balance.remaining, 18);
});
test('Hafta sınırındaki dinlenme ve gece vardiyası izin çakışması algılanır', () => {
  const shifts = [{ id: 's1', employeeId: 'e1', date: '2026-10-11', start: '20:00', end: '04:00', breakMinutes: 60, type: 'ozel' }, { id: 's2', employeeId: 'e1', date: '2026-10-12', start: '08:00', end: '16:00', breakMinutes: 30, type: 'sabah' }];
  const warnings = shiftWarnings(employee, shifts, [], '2026-10-12');
  assert.ok(warnings.some(w => w.includes('11 saat'))); assert.ok(warnings.some(w => w.includes('mola hakkı')));
  assert.ok(shiftWarnings(employee, shifts, [{ employeeId: 'e1', startDate: '2026-10-12', endDate: '2026-10-12', status: 'onaylandi' }], '2026-10-05').some(w => w.includes('izinle çakışıyor')));
});

const official2026 = defaultSettings();
const recordFrom = (c, period, employeeId = 'e1') => ({ id: `p-${employeeId}-${period}`, employeeId, period, gross: c.gross, overtime: c.overtime, deductions: c.deductions, net: c.net, paid: false });
const cents = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

test('2026 varsayılanları: resmî ücret tarifesi, asgari ücret, tavan ve sektör oranı', () => {
  assert.equal(official2026.minWageGross, 33030);
  assert.deepEqual(official2026.incomeTaxBrackets, [{ upTo: 190000, rate: 15 }, { upTo: 400000, rate: 20 }, { upTo: 1500000, rate: 27 }, { upTo: 5300000, rate: 35 }, { upTo: null, rate: 40 }]);
  assert.equal(official2026.sgkCeilingMultiplier, 9); assert.equal(official2026.sgkEmployer, 19.75);
  assert.equal(official2026.stampTax, 0.00759);
});

test('2026 asgari ücretli on iki ay boyunca GV/DV ödemez, net 28.075,50 TL kalır', () => {
  let cumulativeTaxBase = 0;
  const exemptions = [];
  for (let month = 1; month <= 12; month++) {
    const period = `2026-${String(month).padStart(2, '0')}`;
    const c = calculatePayroll({ gross: 33030, cumulativeTaxBase, cumulativeMinimumWageBase: minimumWageBaseBeforePeriod(period, official2026) }, official2026);
    assert.equal(c.sgk, 4624.2); assert.equal(c.unemployment, 330.3);
    assert.equal(c.net, 28075.5, period); assert.equal(c.incomeTax, 0, period); assert.equal(c.stampTax, 0, period);
    assert.equal(c.employerCost, 40214.03); assert.equal(c.stampTaxExemption, 250.7);
    cumulativeTaxBase = c.cumulativeTaxBaseAfter; exemptions.push(c.incomeTaxExemption);
  }
  assert.equal(exemptions[0], 4211.33); assert.equal(exemptions[6], 4537.75); assert.equal(exemptions[7], 5615.1);
});

test('100.000 TL brütte ocak ve şubat matrahı martta %15→%20 dilimine taşınır', () => {
  const highEmployee = { ...employee, grossSalary: 100000 };
  const records = [];
  for (const period of ['2026-01', '2026-02']) records.push(recordFrom(calculateEmployeePayroll(highEmployee, period, [], records, official2026), period));
  const march = calculateEmployeePayroll(highEmployee, '2026-03', [], [...records].reverse(), official2026);
  assert.equal(march.cumulativeTaxBase, 170000); assert.equal(march.incomeTaxBase, 85000);
  assert.equal(march.cumulativeTaxBaseAfter, 255000); assert.equal(march.incomeTaxBeforeExemption, 16000);
  assert.equal(march.incomeTaxExemption, 4211.33); assert.equal(march.incomeTax, 11788.67);
  assert.equal(march.net, 72703.03); assert.deepEqual(march.missingPeriods, []);
});

test('Ücret tarifesinin %27→%35 ve %35→%40 geçişleri tek ayda bölünür', () => {
  assert.equal(calculatePayroll({ gross: 100000, cumulativeTaxBase: 1490000 }, official2026).incomeTaxBeforeExemption, 28950);
  assert.equal(calculatePayroll({ gross: 100000, cumulativeTaxBase: 5290000 }, official2026).incomeTaxBeforeExemption, 33500);
});

test('Tavanı aşan maaşta tüm primler 297.270 TL’den; GV matrahı gerçek brütten', () => {
  const c = calculatePayroll({ gross: 400000 }, official2026);
  assert.equal(c.sgkBase, 297270); assert.equal(c.sgkCeiling, 297270);
  assert.equal(c.sgk, 41617.8); assert.equal(c.unemployment, 2972.7);
  assert.equal(c.incomeTaxBase, 355409.5);
  assert.equal(c.employerSgk, 58710.83); assert.equal(c.employerUnemployment, 5945.4);
  assert.equal(c.employerCost, 464656.23);
  // Tavan damga vergisine uygulanmaz.
  assert.equal(c.stampTaxBeforeExemption, 3036); assert.equal(c.stampTax, 2785.3);
});

test('Görevdeki özel 7,5 kat tavan ve %15,75 / %20,75 oranları da hesaplanır', () => {
  const legacy = { ...official2026, sgkCeilingMultiplier: 7.5, sgkEmployer: 15.75 };
  const c = calculatePayroll({ gross: 400000 }, legacy);
  assert.equal(c.sgkBase, 247725); assert.equal(c.sgk, 34681.5); assert.equal(c.unemployment, 2477.25);
  assert.equal(c.incomeTaxBase, 362841.25); assert.equal(c.employerSgk, 39016.69);
  assert.equal(c.employerCost, 443971.19);
  assert.equal(calculatePayroll({ gross: 400000 }, { ...legacy, sgkEmployer: 20.75 }).employerSgk, 51402.94);
  assert.equal(calculatePayroll({ gross: 33030 }, { ...official2026, sgkEmployer: 21.75 }).employerCost, 40874.63);
});

test('Tavan sınırı, sınır altı ve mesaiyle tavan aşımı', () => {
  const atCap = calculatePayroll({ gross: 297270 }, official2026);
  const aboveCap = calculatePayroll({ gross: 297270.01 }, official2026);
  assert.equal(atCap.sgk, aboveCap.sgk); assert.equal(atCap.employerSgk, aboveCap.employerSgk);
  const withOvertime = calculatePayroll({ gross: 290000, overtimeHours: 10 }, official2026);
  assert.equal(withOvertime.overtime, 19333.33); assert.equal(withOvertime.sgkBase, 297270);
  assert.equal(calculatePayroll({ gross: 100000 }, official2026).sgkBase, 100000);
});

test('Aylık brüt/225 mesai ve kayıtlı kesin mesai tutarı kuruş kaybetmez', () => {
  assert.equal(calculatePayroll({ gross: 45000, overtimeHours: 10 }, official2026).overtime, 3000);
  const c = calculatePayroll({ gross: 33030.01, overtimeGross: 1234.57, otherDeductions: 87.33 }, official2026);
  assert.equal(c.overtime, 1234.57); assert.equal(c.totalGross, 34264.58);
  assert.equal(c.net, cents(c.totalGross - Object.values(c.deductions).reduce((sum, n) => sum + n, 0)));
  assert.equal(c.employerCost, cents(c.totalGross + c.employerSgk + c.employerUnemployment));
  assert.equal(calculatePayroll({ gross: 45000, overtimeHours: 10, overtimeGross: 0 }, official2026).overtime, 0);
});

test('Ocakta matrah sıfırlanır; diğer personel, gelecek ay ve mükerrer ay dışarıda kalır', () => {
  const january = recordFrom(calculatePayroll({ gross: 45000, overtimeGross: 1000 }, official2026), '2026-01');
  const rows = [january, { ...january, id: 'duplicate' }, { ...january, period: '2025-12' }, { ...january, employeeId: 'e2' }, { ...january, period: '2026-03' }];
  assert.equal(calculateEmployeePayroll(employee, '2026-02', [], rows, official2026).cumulativeTaxBase, 39100);
  assert.equal(calculateEmployeePayroll(employee, '2026-01', [], rows, official2026).cumulativeTaxBase, 0);
});

test('Eksik geçmiş aylar tespit edilir; işe girişten önceki aylar eksik sayılmaz', () => {
  assert.deepEqual(calculateEmployeePayroll(employee, '2026-03', [], [], official2026).missingPeriods, ['2026-01', '2026-02']);
  assert.deepEqual(calculateEmployeePayroll({ ...employee, startDate: '2026-03-01' }, '2026-03', [], [], official2026).missingPeriods, []);
});

test('Netten brüte arama hedef netin kuruş altında kalmaz; tavan ve dilimler desteklenir', () => {
  for (const net of [0, 100, 28075.5, 35000.01, 100000.99, 400000]) {
    const c = calculateGrossFromNet(net, official2026, { cumulativeTaxBase: 185000, cumulativeMinimumWageBase: minimumWageBaseBeforePeriod('2026-07', official2026) });
    assert.ok(c.net >= net, `${net}: ${c.net}`); assert.ok(c.net <= net + 0.02, `${net}: ${c.net}`);
    assert.equal(cents(c.gross), c.gross);
  }
});

test('İK, ortak modül ve eski lib/calc API’si aynı hesap kaynağını kullanır', () => {
  assert.equal(calculatePayroll, sharedCalculatePayroll);
  assert.deepEqual(legacyCalcPayroll(33030, official2026), calculatePayroll({ gross: 33030 }, official2026));
});

test('Demo bordroları ocaktan itibaren aynı motorla ve gerçek kümülatif matrahla oluşur', () => {
  const seed = createSeed();
  const previous = new Map();
  for (const p of seed.payrolls) {
    const key = `${p.employeeId}-${p.period.slice(0, 4)}`;
    const c = calculatePayroll({ gross: p.gross, overtimeGross: p.overtime, cumulativeTaxBase: previous.get(key) ?? 0, cumulativeMinimumWageBase: minimumWageBaseBeforePeriod(p.period, seed.settings) }, seed.settings);
    assert.deepEqual(p.deductions, c.deductions, `${p.employeeId} ${p.period}`); assert.equal(p.net, c.net);
    previous.set(key, c.cumulativeTaxBaseAfter);
  }
  if (new Date().getMonth() > 0) assert.ok(seed.payrolls.some(p => p.period.endsWith('-01')));
  for (const transaction of seed.transactions.filter(t => t.description === 'Personel maaş ödemesi')) {
    const expected = seed.payrolls.filter(p => p.paidDate === transaction.date).reduce((sum, p) => sum + p.net, 0);
    assert.equal(transaction.amount, cents(expected), transaction.date);
  }
});
