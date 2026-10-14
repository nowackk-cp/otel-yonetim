export function cn(...parts: (string | false | 0 | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}
