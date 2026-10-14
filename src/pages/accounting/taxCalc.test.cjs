// Çalıştırma: node --test src/pages/accounting/taxCalc.test.cjs
const ts = require('typescript');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { test } = require('node:test');

// Ek test bağımlılığı olmadan mevcut TS kaynaklarını yükle.
require.extensions['.ts'] = (module, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  module._compile(outputText, filename);
};
const calc = require('./taxCalc.ts');
const { defaultSettings } = require('../../store/seed.ts');
const settings = { ...defaultSettings(), sgkEmployer: 20, unemploymentEmployer: 2, incomeTaxBrackets: [{ upTo: null, rate: 15 }] };
const hr = require('../hr/payrollCalc.ts');
const tx = (type, amount, vatRate, date = '2026-10-01') => ({ id: `${type}-${date}`, type, category: 'Diğer Gelir', description: 'Kontrol', amount, vatRate, vatAmount: 0, date, account: 'banka' });

test('KDV dahil, hariç ve sıfır oran', () => {
  assert.deepEqual(calc.calculateVat(110, 10, true), { net: 100, vat: 10, gross: 110 });
  assert.deepEqual(calc.calculateVat(100, 20, false), { net: 100, vat: 20, gross: 120 });
  assert.deepEqual(calc.calculateVat(100, 0), { net: 100, vat: 0, gross: 100 });
});
test('Karma faturada yalnızca konaklama kalemine ek vergi uygulanır', () => {
  const lines = [{ description: 'Oda', quantity: 2, unitPrice: 100, vatRate: 10, accommodation: true }, { description: 'Spa', quantity: 1, unitPrice: 100, vatRate: 20 }];
  const result = calc.calculateInvoice(lines, 2);
  assert.equal(result.subtotal, 300); assert.equal(result.vatTotal, 40);
  assert.equal(result.accommodationTax, 4); assert.equal(result.total, 344);
  assert.deepEqual(result.vatBreakdown.map((r) => r.vat), [20, 20]);
  assert.deepEqual(lines[0], { description: 'Oda', quantity: 2, unitPrice: 100, vatRate: 10, accommodation: true });
});
test('Boş faturanın ve boş vergi döneminin toplamları sıfırdır', () => {
  assert.equal(calc.calculateInvoice([], 2).total, 0);
  const result = calc.calculateVatReturn([]);
  assert.equal(result.payable, 0); assert.equal(result.carry, 0);
});
test('İndirilecek KDV ve açılış devri ödenecek KDV’den düşülür', () => {
  const result = calc.calculateVatReturn([tx('gelir', 110, 10), tx('gider', 120, 20)], 5);
  assert.equal(result.outputVat, 10); assert.equal(result.inputVat, 20);
  assert.equal(result.payable, 0); assert.equal(result.carry, 15);
  assert.equal(result.accommodationBase, 0);
});
test('Devir ay ay kapanır, ödenecek bakiye sonraki aya taşınmaz', () => {
  assert.equal(calc.calculateCarryBefore([tx('gider', 120, 20, '2026-08-01'), tx('gelir', 110, 10, '2026-09-01')], '2026-10'), 10);
  assert.equal(calc.calculateCarryBefore([tx('gelir', 1100, 10, '2026-08-01'), tx('gider', 120, 20, '2026-09-01')], '2026-10'), 20);
});
test('Geçici vergi net matrahta hesaplanır, zarar ve özel oran desteklenir', () => {
  assert.deepEqual(calc.calculateProvisionalTax([tx('gelir', 110, 10), tx('gider', 60, 20)]), { profit: 50, assessedTax: 12.5, previousPaid: 0, tax: 12.5, carryCredit: 0 });
  assert.equal(calc.calculateProvisionalTax([tx('gider', 120, 20)]).tax, 0);
  assert.equal(calc.calculateProvisionalTax([tx('gelir', 110, 10)], 30).tax, 30);
});
test('Bordro varsa kesintiler korunur, olmayan personel tahmin edilir', () => {
  const employees = [{ id: 'e1', active: true, startDate: '2020-01-01', grossSalary: 100, salaryType: 'aylik' }, { id: 'e2', active: true, startDate: '2020-01-01', grossSalary: 100, salaryType: 'aylik' }];
  const payrolls = [{ id: 'p1', employeeId: 'e1', period: '2026-10', gross: 100, overtime: 10, deductions: { incomeTax: 3, stampTax: 2, sgk: 14, unemployment: 1 } }];
  const result = calc.calculatePayrollTaxes(employees, payrolls, '2026-10', settings);
  assert.equal(result.recordedCount, 1); assert.equal(result.estimatedCount, 1);
  assert.equal(result.incomeTax, 3); assert.equal(result.stampTax, 2);
  assert.equal(result.employeePremium, 30); assert.equal(result.employerPremium, 46.2);
  assert.equal(result.premiums, 76.2);
});
test('Gelecekte başlayacak ve pasif personel tahmine alınmaz', () => {
  const employees = [{ id: 'inactive', active: false, startDate: '2020-01-01', grossSalary: 100 }, { id: 'future', active: true, startDate: '2026-11-01', grossSalary: 100 }];
  assert.equal(calc.calculatePayrollTaxes(employees, [], '2026-10', settings).estimatedCount, 0);
});
test('Takvim yıl devrini ve hafta sonunu işler', () => {
  assert.equal(calc.calculateTaxCalendar('2026-12', settings).find((r) => r.name.startsWith('KDV')).date, '2027-01-28');
  assert.equal(calc.calculateTaxCalendar('2026-10', settings).find((r) => r.name.startsWith('KDV')).date, '2026-11-30');
});
test('Eski demo faturası yuvarlama farkı kayıtlı toplamlarla uzlaşır', () => {
  const result = calc.invoiceVatBreakdown([{ description: 'Oda', quantity: 7, unitPrice: 2954.55, vatRate: 10 }], 20681.82, 2068.18);
  assert.equal(result.roundingAdjustment, -0.03);
  assert.equal(result.groups[0].base, 20681.82); assert.equal(result.groups[0].vat, 2068.18);
});

test('Varsayılan oranlar yüzde / ondalık birimlerini korur', () => {
  const s = defaultSettings();
  assert.equal(s.vatAccommodation, 10); assert.equal(s.vatFood, 10);
  assert.equal(s.vatAlcohol, 20); assert.equal(s.accommodationTax, 2);
  assert.equal(s.corporateTaxRate, 0.25); assert.equal(s.stampTax, 0.00759);
});

test('Elle hesap: 10.000 TL net + 1.000 TL KDV + 200 TL konaklama vergisi = 11.200 TL', () => {
  const expected = { net: 10000, accommodationTax: 200, vatBase: 10000, vat: 1000, gross: 11200 };
  assert.deepEqual(calc.calculateAccommodationCharge(10000, 10, 2, false), expected);
  // KDV dahil hizmet bedeli 11.000 TL; ayrıca 200 TL konaklama vergisi alınır.
  assert.deepEqual(calc.calculateAccommodationCharge(11000, 10, 2, true), expected);
  const bill = calc.calculateInvoice([{ description: 'Oda', quantity: 1, unitPrice: 10000, vatRate: 10, accommodation: true }], 2);
  const declaration = calc.calculateVatReturn([{ ...tx('gelir', 11000, 10), category: 'Konaklama' }], 0, 2);
  assert.equal(bill.total, 11200); assert.equal(bill.vatTotal, 1000);
  assert.equal(declaration.outputVat, bill.vatTotal); assert.equal(declaration.accommodationBase, bill.accommodationBase);
  assert.equal(declaration.accommodationTax, 200); assert.equal(declaration.breakdown[0].salesBase, 10000);
  assert.equal(calc.calculateProvisionalTax([{ ...tx('gelir', 11000, 10), category: 'Konaklama' }], 25).tax, 2500);
});

test('Restoran/minibar konaklama vergisine girmez; alkollü kalem %20 KDV taşır', () => {
  const bill = calc.calculateInvoice([
    { description: 'Oda', quantity: 1, unitPrice: 100, vatRate: 10, accommodation: true },
    { description: 'Restoran', quantity: 1, unitPrice: 100, vatRate: 10 },
    { description: 'Minibar', quantity: 1, unitPrice: 50, vatRate: 20, alcohol: true },
  ], 2);
  assert.equal(bill.accommodationTax, 2); assert.equal(bill.vatTotal, 30); assert.equal(bill.total, 282);
  assert.deepEqual(bill.vatBreakdown, [{ rate: 10, base: 200, vat: 20 }, { rate: 20, base: 50, vat: 10 }]);
  const preview = calc.invoiceVatBreakdown([
    { description: 'Oda', quantity: 1, unitPrice: 100, vatRate: 10, accommodation: true },
    { description: 'Restoran', quantity: 1, unitPrice: 100, vatRate: 10 },
    { description: 'Minibar', quantity: 1, unitPrice: 50, vatRate: 20 },
  ], bill.subtotal, bill.vatTotal, bill.accommodationTax);
  assert.deepEqual(preview.groups, bill.vatBreakdown);
});

test('KDV kırılımı satış ve gider oranlarını karıştırmaz; eski vatAmount alanına güvenmez', () => {
  const result = calc.calculateVatReturn([tx('gelir', 110, 10), tx('gelir', 120, 20), tx('gider', 60, 20)], 5);
  assert.equal(result.outputVat, 30); assert.equal(result.inputVat, 10); assert.equal(result.payable, 15); assert.equal(result.carry, 0);
  assert.deepEqual(result.breakdown, [{ rate: 10, salesBase: 100, salesVat: 10, purchaseVat: 0 }, { rate: 20, salesBase: 100, salesVat: 20, purchaseVat: 10 }]);
});

test('Negatif açılış devri sıfıra normalize edilir; boş dönemde bakiye korunur', () => {
  assert.equal(calc.calculateVatReturn([], -5).openingCarry, 0);
  assert.equal(calc.calculateVatReturn([], 12.34).carry, 12.34);
  assert.equal(calc.calculateCarryBefore([tx('gider', 120, 20, '2025-12-01'), tx('gelir', 55, 10, '2026-02-01')], '2026-03'), 15);
});

test('Konaklama sınıflandırması restoran ve vergi kategorilerini dışlar', () => {
  assert.equal(calc.isAccommodation(' Konaklama '), true);
  assert.equal(calc.isAccommodation('Konaklama geliri'), true);
  for (const category of ['Konaklama vergisi', 'Konaklama dışı hizmetler', 'Restoran', 'Minibar']) assert.equal(calc.isAccommodation(category), false);
});

test('Kuruş yuvarlaması net + KDV = brüt eşitliğini ve iadelerin işaretini korur', () => {
  for (const amount of [0, 0.01, 0.05, 0.11, 1.005, 1234.56, -0.05, -110]) {
    for (const rate of [0, 1, 10, 20]) {
      const result = calc.calculateVat(amount, rate);
      assert.equal(Math.round((result.net + result.vat) * 100), Math.round(result.gross * 100));
    }
  }
  assert.deepEqual(calc.calculateVat(-110, 10), { net: -100, vat: -10, gross: -110 });
});

test('Geçersiz oranlar ve sonlu olmayan tutarlar sessizce NaN/Infinity üretmez', () => {
  for (const rate of [-100, -1, Infinity, NaN, 101]) assert.throws(() => calc.calculateVat(100, rate), RangeError);
  for (const amount of [Infinity, NaN]) assert.throws(() => calc.calculateVat(amount, 10), RangeError);
  assert.throws(() => calc.calculateInvoice([{ quantity: -1, unitPrice: 100, vatRate: 10 }], 2), RangeError);
  assert.deepEqual(calc.calculateAccommodationCharge(0, 0, 0), { net: 0, accommodationTax: 0, vatBase: 0, vat: 0, gross: 0 });
});

test('Geçici vergi kümülatif kârdan önceki ödemeyi düşer; ödeme tekrar gider yazılmaz', () => {
  const records = [tx('gelir', 1100, 10, '2026-01-01'), tx('gelir', 2200, 10, '2026-04-01'), tx('gider', 600, 20, '2026-05-01'), { ...tx('gider', 250, 0, '2026-05-17'), category: 'Geçici Vergi', documentNo: 'GECICI:2026:Q1' }];
  const paid = calc.previousProvisionalPayments(records, '2026-06');
  const result = calc.calculateProvisionalTax(records, 25, paid);
  assert.equal(paid, 250); assert.equal(result.profit, 2500); assert.equal(result.assessedTax, 625); assert.equal(result.tax, 375);
  assert.equal(calc.calculateProvisionalTax([tx('gider', 120, 20)], 25, 250).tax, 0);
  assert.equal(calc.calculateProvisionalTax([], 25, 250).carryCredit, 250);
});

test('Mahsup yalnızca aynı yılın önceki çeyrek ödemelerini kapsar', () => {
  const payment = (documentNo, date, amount = 100) => ({ ...tx('gider', amount, 0, date), category: 'Geçici Vergi', documentNo });
  const records = [payment('GECICI:2025:Q4', '2026-02-01'), payment('GECICI:2026:Q1', '2026-05-01'), payment('GECICI:2026:Q2', '2026-06-01'), payment('GECICI:2026:Q1', '2026-07-01')];
  assert.equal(calc.previousProvisionalPayments(records, '2026-06'), 100);
  assert.equal(calc.previousProvisionalPayments(records, '2026-03'), 0);
});

test('Geçici vergide KDV dahil hizmet bedelinden konaklama vergisi ikinci kez düşülmez', () => {
  const result = calc.calculateProvisionalTax([{ ...tx('gelir', 110, 10), category: 'Konaklama' }], 25);
  assert.equal(result.profit, 100); assert.equal(result.tax, 25);
});

test('Muhtasar önizlemesi İK ile kümülatif matrah, asgari ücret istisnası ve mesai bakımından aynıdır', () => {
  const employee = { id: 'same', active: true, startDate: '2020-01-01', grossSalary: 60000, salaryType: 'aylik' };
  const previous = [{ employeeId: 'same', period: '2026-09', gross: 250000, overtime: 10000, deductions: { sgk: 36400, unemployment: 2600, incomeTax: 0, stampTax: 0 } }];
  const attendance = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09'].map((date, i) => ({ id: `a${i}`, employeeId: 'same', date, checkIn: '08:00', checkOut: '18:00', breaks: [] }));
  const s = defaultSettings(); const expected = hr.calculateEmployeePayroll(employee, '2026-10', attendance, previous, s);
  const actual = calc.calculatePayrollTaxes([employee], previous, '2026-10', s, attendance);
  assert.equal(actual.incomeTax, expected.incomeTax); assert.equal(actual.stampTax, expected.stampTax);
  assert.equal(actual.employeePremium, Math.round((expected.sgk + expected.unemployment) * 100) / 100);
  assert.equal(actual.employerPremium, Math.round((expected.employerSgk + expected.employerUnemployment) * 100) / 100);
});

test('Saatlik personelde 225 saat varsayılmaz; puantajsız önizleme sıfırdır', () => {
  const employee = { id: 'hourly', active: true, startDate: '2020-01-01', grossSalary: 1000, salaryType: 'saatlik' };
  const actual = calc.calculatePayrollTaxes([employee], [], '2026-10', settings);
  assert.equal(actual.withholding, 0); assert.equal(actual.premiums, 0);
});

test('İşveren primleri İK gibi ayrı ayrı kuruşa yuvarlanır', () => {
  const s = { ...settings, sgkEmployer: 15.75, unemploymentEmployer: 2 };
  const record = { employeeId: 'e', period: '2026-10', gross: 1.23, overtime: 0, deductions: { incomeTax: 0, stampTax: 0, sgk: 0, unemployment: 0 } };
  const expected = hr.calculatePayroll({ gross: 1.23 }, s);
  assert.equal(calc.calculatePayrollTaxes([], [record], '2026-10', s).employerPremium, Math.round((expected.employerSgk + expected.employerUnemployment) * 100) / 100);
});

test('Küçük kalemleri bölmek aynı KDV grubunun vergi toplamını değiştirmez', () => {
  const line = { description: 'Oda', quantity: 1, unitPrice: 0.25, vatRate: 10, accommodation: true };
  const split = calc.calculateInvoice([line, line], 2);
  const combined = calc.calculateInvoice([{ ...line, quantity: 2 }], 2);
  assert.deepEqual(split, combined);
  assert.equal(split.subtotal, 0.5); assert.equal(split.accommodationTax, 0.01);
  assert.equal(split.vatTotal, 0.05); assert.equal(split.total, 0.56);
  const preview = calc.invoiceVatBreakdown([line, line], split.subtotal, split.vatTotal, split.accommodationTax);
  assert.deepEqual(preview.groups, split.vatBreakdown);
  const tax = calc.calculateVatReturn([{ ...tx('gelir', split.subtotal + split.vatTotal, 10), category: 'Konaklama' }]);
  assert.equal(tax.accommodationTax, split.accommodationTax); assert.equal(tax.outputVat, split.vatTotal);
});

test('Konaklama vergisi oranı KDV matrahını, KDV tutarını ve ticari kârı değiştirmez', () => {
  const lines = [{ description: 'Oda', quantity: 1, unitPrice: 10000, vatRate: 10, accommodation: true }];
  const records = [{ ...tx('gelir', 11000, 10), category: 'Konaklama' }, tx('gider', 1200, 20)];
  for (const rate of [0, 2, 5]) {
    const charge = calc.calculateAccommodationCharge(11000, 10, rate);
    const bill = calc.calculateInvoice(lines, rate);
    const declaration = calc.calculateVatReturn(records, 100, rate);
    assert.equal(charge.net, 10000); assert.equal(charge.vat, 1000);
    assert.equal(charge.accommodationTax, 10000 * rate / 100);
    assert.equal(charge.gross, 11000 + 10000 * rate / 100);
    assert.equal(bill.vatTotal, 1000); assert.equal(bill.total, charge.gross);
    assert.deepEqual(calc.invoiceVatBreakdown(lines, bill.subtotal, bill.vatTotal, bill.accommodationTax).groups, [{ rate: 10, base: 10000, vat: 1000 }]);
    assert.equal(declaration.accommodationBase, 10000); assert.equal(declaration.outputVat, 1000);
    assert.equal(declaration.inputVat, 200); assert.equal(declaration.payable, 700);
    assert.equal(calc.calculateProvisionalTax(records, 25, 500, rate).profit, 9000);
    assert.equal(calc.calculateProvisionalTax(records, 25, 500, rate).tax, 1750);
  }
});

test('Sıfır KDV oranında da konaklama vergisi hizmet bedelinden ayrıca hesaplanır', () => {
  assert.deepEqual(calc.calculateAccommodationCharge(10000, 0, 2), { net: 10000, vatBase: 10000, vat: 0, accommodationTax: 200, gross: 10200 });
  assert.deepEqual(calc.calculateAccommodationCharge(-110, 10, 2), { net: -100, vatBase: -100, vat: -10, accommodationTax: -2, gross: -112 });
});

test('Folio KDV dahil kalemlerinden aktarılan faturada vergiler ayrı hesaplanır', () => {
  const { splitVat } = require('../../lib/calc.ts');
  const folio = [{ description: 'Konaklama', type: 'konaklama', amount: 11000, vatRate: 10 }, { description: 'Restoran', type: 'restoran', amount: 1100, vatRate: 10 }, { description: 'Minibar', type: 'minibar', amount: 600, vatRate: 20 }];
  const lines = folio.map(item => ({ description: item.description, quantity: 1, unitPrice: splitVat(item.amount, item.vatRate).net, vatRate: item.vatRate, accommodation: item.type === 'konaklama' }));
  const bill = calc.calculateInvoice(lines, 2);
  assert.equal(bill.subtotal, 11500); assert.equal(bill.vatTotal, 1200);
  assert.equal(bill.accommodationBase, 10000); assert.equal(bill.accommodationTax, 200);
  assert.equal(bill.total, 12900);
  const declaration = calc.calculateVatReturn(folio.map(item => ({ ...tx('gelir', item.amount, item.vatRate), category: item.description })));
  assert.equal(declaration.outputVat, 1200); assert.equal(declaration.accommodationTax, 200);
});
