import { cn } from './cn';
import { initials } from '../../lib/format';

export interface AvatarProps {
  name: string;
  size?: 'sm' | 'md' | 'lg';
  /** Arka plan rengi (hex). Verilmezse isimden türetilir. */
  color?: string;
  className?: string;
}

const sizes = { sm: 'h-7 w-7 text-[10px]', md: 'h-9 w-9 text-xs', lg: 'h-12 w-12 text-sm' };
const fallback = ['#6366f1', '#8b5cf6', '#ec4899', '#f97316', '#14b8a6', '#3b82f6', '#22c55e', '#eab308'];

export function Avatar({ name, size = 'md', color, className }: AvatarProps) {
  const bg = color ?? fallback[[...name].reduce((s, c) => s + c.charCodeAt(0), 0) % fallback.length];
  return (
    <span
      className={cn('inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white', sizes[size], className)}
      style={{ backgroundColor: bg }}
      title={name}
    >
      {initials(name)}
    </span>
  );
}
