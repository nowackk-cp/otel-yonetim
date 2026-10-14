import { useRef, useState, type ChangeEvent } from 'react';
import { Download, RotateCcw, Upload } from 'lucide-react';
import { Button, Card, ConfirmDialog, useToast } from '../../../components/ui';
import { formatNumber } from '../../../lib/format';
import { useStore, type StoreState } from '../../../store/useStore';
import { COLLECTION_KEYS, exportBackup, parseBackup } from './backup';

export function DataTab() {
  const log = useStore((s) => s.log);
  const resetDemoData = useStore((s) => s.resetDemoData);
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [pendingImport, setPendingImport] = useState<{ data: Partial<StoreState>; recordCount: number } | null>(null);
  const [resetOpen, setResetOpen] = useState(false);

  const totalRecords = useStore((s) => COLLECTION_KEYS.reduce((sum, k) => sum + s[k].length, 0));

  const handleExport = () => {
    exportBackup();
    log('Veriler JSON olarak dışa aktarıldı', 'yonetim');
    toast.success('Yedek dosyası indirildi');
  };

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // aynı dosya tekrar seçilebilsin
    if (!file) return;
    const result = parseBackup(await file.text());
    if (typeof result === 'string') {
      toast.error(result);
      return;
    }
    setPendingImport(result);
  };

  const confirmImport = () => {
    if (!pendingImport) return;
    useStore.setState(pendingImport.data);
    log('Veriler JSON dosyasından içe aktarıldı', 'yonetim');
    toast.success('Veriler içe aktarıldı');
    setPendingImport(null);
  };

  const confirmReset = () => {
    resetDemoData();
    log('Demo verisine sıfırlandı', 'yonetim');
    toast.success('Demo verisi yüklendi');
  };

  return (
    <>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Dışa Aktar" subtitle={`Tüm ayarlar ve kayıtlar (${formatNumber(totalRecords)} kayıt) tek bir JSON dosyasında`}>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Yedek almak veya başka bir cihaza taşımak için kullanın. Dosya, içe aktarma ile geri yüklenebilir.
          </p>
          <div className="mt-5">
            <Button icon={<Download className="h-4 w-4" />} onClick={handleExport}>
              JSON olarak indir
            </Button>
          </div>
        </Card>

        <Card title="İçe Aktar" subtitle="Daha önce dışa aktarılmış bir yedeği yükleyin">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Dikkat: İçe aktarma mevcut tüm verinin üzerine yazar. Onaydan önce kayıt sayısı gösterilir.
          </p>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={handleFile} />
          <div className="mt-5">
            <Button variant="secondary" icon={<Upload className="h-4 w-4" />} onClick={() => fileRef.current?.click()}>
              JSON dosyası seç
            </Button>
          </div>
        </Card>

        <Card title="Tehlikeli Bölge" subtitle="Geri alınamaz işlemler" className="border-rose-200 dark:border-rose-900/60 lg:col-span-2">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Tüm veriler silinir ve örnek (demo) otel verisi yüklenir. Önce yedek almanız önerilir.
            </p>
            <Button variant="danger" icon={<RotateCcw className="h-4 w-4" />} onClick={() => setResetOpen(true)}>
              Demo verisini sıfırla
            </Button>
          </div>
        </Card>
      </div>

      <ConfirmDialog
        open={!!pendingImport}
        onClose={() => setPendingImport(null)}
        onConfirm={confirmImport}
        title="Veriler içe aktarılsın mı?"
        message={
          pendingImport ? (
            <>
              Dosyada <strong>{formatNumber(pendingImport.recordCount)}</strong> kayıt bulundu. Mevcut tüm veriler bu dosyadaki verilerle değiştirilecek.
            </>
          ) : null
        }
        confirmText="Verileri değiştir"
      />

      <ConfirmDialog
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        onConfirm={confirmReset}
        title="Demo verisine sıfırlansın mı?"
        message="Tüm rezervasyon, personel, muhasebe ve diğer kayıtlar silinip örnek veri yüklenecek. Bu işlem geri alınamaz."
        confirmText="Sıfırla"
      />
    </>
  );
}
