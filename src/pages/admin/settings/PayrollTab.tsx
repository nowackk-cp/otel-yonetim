import { Plus, Trash2 } from 'lucide-react';
import { Button, Card, Input, useToast } from '../../../components/ui';
import { calcPayroll } from '../../../lib/calc';
import { formatCurrency } from '../../../lib/format';
import { useStore } from '../../../store/useStore';
import type { IncomeTaxBracket, Settings } from '../../../types';
import { num } from '../helpers';
import { SaveBar } from './SaveBar';
import { useDraft } from './useDraft';

type PayrollSettings = Pick<
  Settings,
  'minWageGross' | 'sgkEmployee' | 'unemploymentEmployee' | 'sgkEmployer' | 'unemploymentEmployer' | 'incomeTaxBrackets'
>;

const PERCENT_ADORNMENT = <span className="text-xs font-semibold">%</span>;

/** Dilimler artan sırada olmalı; son dilim her zaman sınırsızdır (upTo = null). */
function validateBrackets(brackets: IncomeTaxBracket[]): string | null {
  if (!brackets.length) return 'En az bir gelir vergisi dilimi olmalı';
  let prev = 0;
  for (let i = 0; i < brackets.length - 1; i++) {
    const upTo = brackets[i].upTo;
    if (upTo === null || upTo <= prev) return `Dilim ${i + 1}: üst sınır bir önceki sınırdan büyük olmalı`;
    prev = upTo;
  }
  if (brackets.some((b) => b.rate < 0)) return 'Vergi oranları negatif olamaz';
  return null;
}

export function PayrollTab() {
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const log = useStore((s) => s.log);
  const toast = useToast();

  const initial: PayrollSettings = {
    minWageGross: settings.minWageGross,
    sgkEmployee: settings.sgkEmployee,
    unemploymentEmployee: settings.unemploymentEmployee,
    sgkEmployer: settings.sgkEmployer,
    unemploymentEmployer: settings.unemploymentEmployer,
    incomeTaxBrackets: settings.incomeTaxBrackets,
  };
  const { draft, setDraft, patch, dirty } = useDraft(initial);

  const brackets = draft.incomeTaxBrackets;
  const lastIdx = brackets.length - 1;
  const bracketError = validateBrackets(brackets);

  const setBracket = (idx: number, change: Partial<IncomeTaxBracket>) =>
    patch(
      'incomeTaxBrackets',
      brackets.map((b, i) => (i === idx ? { ...b, ...change } : b)),
    );

  const addBracket = () => {
    // Yeni dilim, son (sınırsız) dilimin hemen önüne eklenir
    const prevUpTo = lastIdx >= 1 ? brackets[lastIdx - 1].upTo ?? 0 : 0;
    const next = [...brackets];
    next.splice(lastIdx, 0, { upTo: prevUpTo + 10000, rate: brackets[lastIdx].rate });
    patch('incomeTaxBrackets', next);
  };

  const removeBracket = (idx: number) => {
    if (brackets.length <= 1) return;
    patch(
      'incomeTaxBrackets',
      brackets.filter((_, i) => i !== idx),
    );
  };

  const save = () => {
    if (bracketError) {
      toast.error(bracketError);
      return;
    }
    // Son dilim her zaman sınırsız kalsın
    const incomeTaxBrackets = brackets.map((b, i) => (i === lastIdx ? { ...b, upTo: null } : b));
    updateSettings({ ...draft, incomeTaxBrackets });
    log('Bordro parametreleri güncellendi', 'ik');
    toast.success('Bordro parametreleri kaydedildi');
  };

  // Önizleme: asgari ücret üzerinden kesintiler (kaydedilmemiş taslakla)
  const preview = calcPayroll(draft.minWageGross, { ...settings, ...draft });

  return (
    <>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Asgari Ücret ve Prim Oranları" subtitle="Bordro hesabında kullanılan temel oranlar">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Asgari ücret (brüt, aylık)"
              type="number"
              min={0}
              step="0.01"
              value={draft.minWageGross}
              onChange={(e) => patch('minWageGross', num(e.target.value))}
              icon={<span className="text-xs font-semibold">₺</span>}
              wrapperClassName="sm:col-span-2"
            />
            <Input
              label="SGK – işçi payı"
              type="number"
              min={0}
              step="0.01"
              value={draft.sgkEmployee}
              onChange={(e) => patch('sgkEmployee', num(e.target.value))}
              icon={PERCENT_ADORNMENT}
            />
            <Input
              label="İşsizlik – işçi payı"
              type="number"
              min={0}
              step="0.01"
              value={draft.unemploymentEmployee}
              onChange={(e) => patch('unemploymentEmployee', num(e.target.value))}
              icon={PERCENT_ADORNMENT}
            />
            <Input
              label="SGK – işveren payı"
              type="number"
              min={0}
              step="0.01"
              value={draft.sgkEmployer}
              onChange={(e) => patch('sgkEmployer', num(e.target.value))}
              icon={PERCENT_ADORNMENT}
            />
            <Input
              label="İşsizlik – işveren payı"
              type="number"
              min={0}
              step="0.01"
              value={draft.unemploymentEmployer}
              onChange={(e) => patch('unemploymentEmployer', num(e.target.value))}
              icon={PERCENT_ADORNMENT}
            />
          </div>
        </Card>

        <Card
          title="Gelir Vergisi Dilimleri"
          subtitle="Yıllık matrah üzerinden dilimli oran. Son dilim sınırsızdır."
          actions={
            <Button size="sm" variant="secondary" icon={<Plus className="h-3.5 w-3.5" />} onClick={addBracket}>
              Dilim Ekle
            </Button>
          }
        >
          <div className="space-y-2">
            <div className="grid grid-cols-[4.5rem_1fr_1fr_2rem] items-center gap-3 px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <span>Dilim</span>
              <span>Üst sınır (₺)</span>
              <span>Oran (%)</span>
              <span />
            </div>
            {brackets.map((b, i) => (
              <div key={i} className="grid grid-cols-[4.5rem_1fr_1fr_2rem] items-center gap-3">
                <span className="text-sm font-medium text-slate-600 dark:text-slate-300">{i + 1}.</span>
                {i === lastIdx ? (
                  <span className="flex h-10 items-center rounded-xl bg-slate-100 px-3.5 text-sm text-slate-500 dark:bg-slate-800 dark:text-slate-400">Sınırsız</span>
                ) : (
                  <Input
                    type="number"
                    min={0}
                    step="1"
                    aria-label={`Dilim ${i + 1} üst sınırı`}
                    value={b.upTo ?? 0}
                    onChange={(e) => setBracket(i, { upTo: num(e.target.value) })}
                  />
                )}
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  aria-label={`Dilim ${i + 1} oranı`}
                  value={b.rate}
                  onChange={(e) => setBracket(i, { rate: num(e.target.value) })}
                />
                <button
                  onClick={() => removeBracket(i)}
                  disabled={brackets.length <= 1}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30 dark:hover:bg-rose-500/10"
                  aria-label={`Dilim ${i + 1} sil`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          {bracketError && <p className="mt-3 text-xs text-rose-600 dark:text-rose-300">{bracketError}</p>}
        </Card>

        <Card title="Bordro Önizleme" subtitle={`Asgari ücret (${formatCurrency(draft.minWageGross)}) için aylık kesintiler`} className="lg:col-span-2">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <PreviewItem label="Brüt" value={formatCurrency(preview.gross)} />
            <PreviewItem label="SGK + işsizlik (işçi)" value={formatCurrency(preview.sgk + preview.unemployment)} />
            <PreviewItem label="Gelir vergisi + damga" value={formatCurrency(preview.incomeTax + preview.stampTax)} />
            <PreviewItem label="Net ücret" value={formatCurrency(preview.net)} highlight />
            <PreviewItem label="İşveren SGK + işsizlik" value={formatCurrency(preview.employerSgk + preview.employerUnemployment)} />
            <PreviewItem label="Toplam işveren maliyeti" value={formatCurrency(preview.employerCost)} />
          </div>
        </Card>
      </div>

      <SaveBar dirty={dirty} onSave={save} onReset={() => setDraft(initial)} />
    </>
  );
}

function PreviewItem({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={highlight ? 'rounded-xl bg-indigo-50 p-4 dark:bg-indigo-500/15' : 'rounded-xl bg-slate-50 p-4 dark:bg-slate-800/60'}>
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <p className={highlight ? 'mt-1 text-lg font-bold text-indigo-700 dark:text-indigo-200' : 'mt-1 text-lg font-semibold text-slate-900 dark:text-white'}>{value}</p>
    </div>
  );
}
