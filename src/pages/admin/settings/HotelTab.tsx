import { Card, DatePicker, Input, Textarea, useToast } from '../../../components/ui';
import { useStore } from '../../../store/useStore';
import type { Settings } from '../../../types';
import { SaveBar } from './SaveBar';
import { useDraft } from './useDraft';

type HotelSettings = Pick<
  Settings,
  'hotelName' | 'address' | 'phone' | 'email' | 'taxNo' | 'taxOffice' | 'checkInTime' | 'checkOutTime'
>;

export function HotelTab() {
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const log = useStore((s) => s.log);
  const toast = useToast();

  const initial: HotelSettings = {
    hotelName: settings.hotelName,
    address: settings.address,
    phone: settings.phone,
    email: settings.email,
    taxNo: settings.taxNo,
    taxOffice: settings.taxOffice,
    checkInTime: settings.checkInTime,
    checkOutTime: settings.checkOutTime,
  };
  const { draft, setDraft, patch, dirty } = useDraft(initial);

  const save = () => {
    updateSettings(draft);
    log('Otel bilgileri güncellendi', 'yonetim');
    toast.success('Otel bilgileri kaydedildi');
  };

  return (
    <>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Genel Bilgiler" subtitle="Misafir belgeleri, faturalar ve sözleşmelerde kullanılır">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Otel adı" value={draft.hotelName} onChange={(e) => patch('hotelName', e.target.value)} className="sm:col-span-2" />
            <Textarea
              label="Adres"
              value={draft.address}
              onChange={(e) => patch('address', e.target.value)}
              rows={2}
              wrapperClassName="sm:col-span-2"
            />
            <Input label="Telefon" value={draft.phone} onChange={(e) => patch('phone', e.target.value)} />
            <Input label="E-posta" type="email" value={draft.email} onChange={(e) => patch('email', e.target.value)} />
          </div>
        </Card>

        <Card title="Vergi Bilgileri" subtitle="Fatura ve beyannamelerde görünür">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Vergi dairesi" value={draft.taxOffice} onChange={(e) => patch('taxOffice', e.target.value)} />
            <Input label="Vergi no" value={draft.taxNo} onChange={(e) => patch('taxNo', e.target.value)} inputMode="numeric" />
          </div>
        </Card>

        <Card title="Giriş / Çıkış Saatleri" subtitle="Rezervasyon takviminde ve misafir bilgilendirmesinde kullanılır" className="lg:col-span-2">
          <div className="grid gap-4 sm:grid-cols-2 lg:max-w-xl">
            <DatePicker mode="time" label="Check-in (giriş) saati" value={draft.checkInTime} onChange={(v) => patch('checkInTime', v)} />
            <DatePicker mode="time" label="Check-out (çıkış) saati" value={draft.checkOutTime} onChange={(v) => patch('checkOutTime', v)} />
          </div>
        </Card>
      </div>

      <SaveBar dirty={dirty} onSave={save} onReset={() => setDraft(initial)} />
    </>
  );
}
