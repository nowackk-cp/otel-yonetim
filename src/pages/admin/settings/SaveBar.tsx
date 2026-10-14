import { Save, Undo2 } from 'lucide-react';
import { Button } from '../../../components/ui';

interface SaveBarProps {
  dirty: boolean;
  onSave: () => void;
  onReset: () => void;
}

/** Sekmenin altındaki kaydet/vazgeç çubuğu. Değişiklik yoksa butonlar pasif kalır. */
export function SaveBar({ dirty, onSave, onReset }: SaveBarProps) {
  return (
    <div className="sticky bottom-4 mt-6 flex items-center justify-between gap-3 rounded-2xl border border-slate-200/70 bg-white/90 p-3 pl-5 shadow-pop backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        {dirty ? <span className="font-medium text-amber-600 dark:text-amber-300">Kaydedilmemiş değişiklikler var</span> : 'Tüm değişiklikler kayıtlı'}
      </p>
      <div className="flex gap-2">
        <Button variant="secondary" icon={<Undo2 className="h-4 w-4" />} onClick={onReset} disabled={!dirty}>
          Vazgeç
        </Button>
        <Button icon={<Save className="h-4 w-4" />} onClick={onSave} disabled={!dirty}>
          Kaydet
        </Button>
      </div>
    </div>
  );
}
