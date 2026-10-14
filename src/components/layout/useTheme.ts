import { useCallback, useEffect, useState } from 'react';

const KEY = 'otel-theme';

/** Açık/koyu tema; tercih localStorage('otel-theme') içinde tutulur. */
export function useTheme() {
  const [dark, setDark] = useState<boolean>(() => document.documentElement.classList.contains('dark'));

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    try {
      localStorage.setItem(KEY, dark ? 'dark' : 'light');
    } catch {
      /* yoksay */
    }
  }, [dark]);

  const toggle = useCallback(() => setDark((d) => !d), []);
  return { dark, toggle };
}
