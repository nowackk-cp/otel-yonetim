import { Card, Input, useToast } from '../../../components/ui';
import { formatCurrency, formatPercent } from '../../../lib/format';
import { splitVat } from '../../../lib/calc';
import { useStore } from '../../../store/useStore';
import type { Settings } from '../../../types';
import { num } from '../helpers';
import { SaveBar } from './SaveBar';
import { useDraft } from './useDraft';

type TaxSettings = Pick<
  Settings,
  'vatAccommodation' | 'vatFood' | 'vatAlcohol' | 'vatGeneral' | 'accommodationTax' | 'stampTax'
  | 'corporateTaxRate' | 'taxDeadlineDay' | 'withholdingDeadlineDay' | 'accommodationDeadlineDay'
>;

const PREVIEW_GROSS = 1000;

/** Binde → oran dönüşümleri: depoda oran (0.00759), ekranda binde (7.59) */
const toPermille = (rate: number) => Number((rate * 1000).toFixed(4));
const fromPermille = (permille: number) => permille / 1000;

export function TaxTab() {
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const log = useStore((s) => s.log);
  const toast = useToast();

  const initial: TaxSettings = {
    vatAccommodation: settings.vatAccommodation,
    vatFood: settings.vatFood,
    vatAlcohol: settings.vatAlcohol,
    vatGeneral: settings.vatGeneral,
    accommodationTax: settings.accommodationTax,
    stampTax: settings.stampTax,
    corporateTaxRate: settings.corporateTaxRate,
    taxDeadlineDay: settings.taxDeadlineDay,
    withholdingDeadlineDay: settings.withholdingDeadlineDay,
    accommodationDeadlineDay: settings.accommodationDeadlineDay,
  };
  const { draft, setDraft, patch, dirty } = useDraft(initial);

  const save = () => {
    updateSettings(draft);
    log('Vergi oranları güncellendi', 'muhasebe');
    toast.success('Vergi oranları kaydedildi');
  };

  const vatRows: { key: keyof TaxSettings; label: string; hint: string }[] = [
    { key: 'vatAccommodation', label: 'KDV – Konaklama', hint: 'Oda gelirleri' },
    { key: 'vatFood', label: 'KDV – Yiyecek / İçecek', hint: 'Restoran, bar, oda servisi' },
    { key: 'vatAlcohol', label: 'KDV – Alkollü içecek', hint: 'Bira, şarap, rakı vb.' },
    { key: 'vatGeneral', label: 'KDV – Genel', hint: 'Diğer hizmet ve ürünler' },
  ];

  return (
    <>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="KDV Oranları" subtitle="Yüzde olarak girin (10 = %10)">
          <div className="grid gap-4 sm:grid-cols-2">
            {vatRows.map((row) => (
              <Input
                key={row.key}
                label={row.label}
                type="number"
                min={0}
                step="0.01"
                hint={row.hint}
                value={draft[row.key]}
                onChange={(e) => patch(row.key, num(e.target.value))}
                icon={<span className="text-xs font-semibold">%</span>}
              />
            ))}
          </div>
        </Card>

        <Card title="Diğer Vergiler" subtitle="Konaklama ve damga vergisi">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Konaklama vergisi"
              type="number"
              min={0}
              step="0.01"
              hint="Gecelik oda bedeli üzerinden"
              value={draft.accommodationTax}
              onChange={(e) => patch('accommodationTax', num(e.target.value))}
              icon={<span className="text-xs font-semibold">%</span>}
            />
            <Input
              label="Damga vergisi"
              type="number"
              min={0}
              step="0.001"
              hint="Binde olarak (7.59 = ‰7,59)"
              value={toPermille(draft.stampTax)}
              onChange={(e) => patch('stampTax', fromPermille(num(e.target.value)))}
              icon={<span className="text-xs font-semibold">‰</span>}
            />
            <Input
              label="Kurumlar vergisi"
              type="number"
              min={0}
              max={100}
              step="0.01"
              hint="Yüzde olarak girin; oran olarak saklanır."
              value={draft.corporateTaxRate * 100}
              onChange={(e) => patch('corporateTaxRate', num(e.target.value) / 100)}
              icon={<span className="text-xs font-semibold">%</span>}
              wrapperClassName="sm:col-span-2"
            />
          </div>
        </Card>

        <Card title="Beyan ve ödeme günleri" subtitle="Her ayın son beyan/ödeme günü (1–28)">
          <div className="grid gap-4 sm:grid-cols-3">
            <Input label="KDV beyan / ödeme" type="number" min={1} max={28} value={draft.taxDeadlineDay} onChange={(e) => patch('taxDeadlineDay', num(e.target.value))} />
            <Input label="Muhtasar ve prim hizmet" type="number" min={1} max={28} value={draft.withholdingDeadlineDay} onChange={(e) => patch('withholdingDeadlineDay', num(e.target.value))} />
            <Input label="Konaklama vergisi" type="number" min={1} max={28} value={draft.accommodationDeadlineDay} onChange={(e) => patch('accommodationDeadlineDay', num(e.target.value))} />
          </div>
        </Card>

        <Card title="KDV Önizleme" subtitle={`${formatCurrency(PREVIEW_GROSS)} KDV dahil tutarın ayrıştırılması`} className="lg:col-span-2">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {vatRows.map((row) => {
              const rate = draft[row.key] as number;
              const { net, vat } = splitVat(PREVIEW_GROSS, rate);
              return (
                <div key={row.key} className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/60">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{row.label}</p>
                  <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">
                    Oran <span className="font-semibold">{formatPercent(rate, 2)}</span>
                  </p>
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    Net {formatCurrency(net)} · KDV {formatCurrency(vat)}
                  </p>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <SaveBar dirty={dirty} onSave={save} onReset={() => setDraft(initial)} />
    </>
  );
}
