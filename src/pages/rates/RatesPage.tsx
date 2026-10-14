import { useState } from 'react';
import { PageHeader, Tabs } from '../../components/ui';
import { RatePlansTab } from './RatePlansTab';
import { SeasonsTab } from './SeasonsTab';
import { RateCalendarTab } from './RateCalendarTab';
import { ChannelsTab } from './ChannelsTab';

export default function RatesPage() {
  const [activeTab, setActiveTab] = useState<'plans' | 'seasons' | 'calendar' | 'channels'>('plans');

  return (
    <div className="space-y-6 pb-12">
      {/* Sayfa Başlığı */}
      <PageHeader
        title="Fiyat & Satış Kanalları"
        description="Fiyat planları, sezonluk çarpanlar, dinamik fiyat takvimi ve satış kanalı komisyon analizleri."
      />

      {/* Ana Sekmeler */}
      <Tabs
        tabs={[
          { key: 'plans', label: 'Fiyat Planları' },
          { key: 'seasons', label: 'Sezonlar' },
          { key: 'calendar', label: 'Fiyat Takvimi' },
          { key: 'channels', label: 'Satış Kanalları' },
        ]}
        active={activeTab}
        onChange={(k) => setActiveTab(k as typeof activeTab)}
      />

      {/* Aktif Sekme İçeriği */}
      {activeTab === 'plans' && <RatePlansTab />}
      {activeTab === 'seasons' && <SeasonsTab />}
      {activeTab === 'calendar' && <RateCalendarTab />}
      {activeTab === 'channels' && <ChannelsTab />}
    </div>
  );
}
