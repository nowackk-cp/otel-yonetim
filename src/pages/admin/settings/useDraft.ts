import { useState } from 'react';

/**
 * Sekme bazlı düzenleme taslağı. `initial` her render'da store'daki güncel değerdir;
 * taslak kaydedilene kadar yerelde tutulur, `dirty` ise taslak ile store farklıysa true olur.
 */
export function useDraft<T extends object>(initial: T) {
  const [draft, setDraft] = useState<T>(initial);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);

  const patch = <K extends keyof T>(key: K, value: T[K]) => setDraft((d) => ({ ...d, [key]: value }));

  return { draft, setDraft, patch, dirty };
}
