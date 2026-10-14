import { useState } from 'react';
import { Tabs, PageHeader } from '../../components/ui';
import { useStore } from '../../store/useStore';
import { DataTab } from './settings/DataTab';
import { HotelTab } from './settings/HotelTab';
import { PayrollTab } from './settings/PayrollTab';
import { ShiftTemplatesTab } from './settings/ShiftTemplatesTab';
import { TaxTab } from './settings/TaxTab';

type SettingsTab = 'otel' | 'vergi' | 'bordro' | 'vardiya' | 'veri';

export default function SettingsPage() {
  const [tab, setTab] = useState<SettingsTab>('otel');
  const shiftTemplateCount = useStore((s) => s.shiftTemplates.length);

  return (
    <div>
      <PageHeader title="Ayarlar" description="Otel, vergi ve sistem ayarları" />

      <Tabs
        className="mb-6"
        active={tab}
        onChange={(key) => setTab(key as SettingsTab)}
        tabs={[
          { key: 'otel', label: 'Otel Bilgileri' },
          { key: 'vergi', label: 'Vergi Oranları' },
          { key: 'bordro', label: 'Bordro Parametreleri' },
          { key: 'vardiya', label: 'Vardiya Şablonları', count: shiftTemplateCount },
          { key: 'veri', label: 'Veri' },
        ]}
      />

      {/* Sekme değişiminde içerik yeniden mount olur; düzenleme taslakları sıfırlanır */}
      {tab === 'otel' && <HotelTab />}
      {tab === 'vergi' && <TaxTab />}
      {tab === 'bordro' && <PayrollTab />}
      {tab === 'vardiya' && <ShiftTemplatesTab />}
      {tab === 'veri' && <DataTab />}
    </div>
  );
}
