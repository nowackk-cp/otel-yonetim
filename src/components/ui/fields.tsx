import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from './cn';

const base =
  'w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-800 placeholder:text-slate-400 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:bg-slate-50 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-indigo-400 dark:disabled:bg-slate-800/50';

interface FieldWrapProps {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function Field({ label, hint, error, className, children }: FieldWrapProps) {
  return (
    <label className={cn('block', className)}>
      {label && <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">{label}</span>}
      {children}
      {error ? <span className="mt-1 block text-xs text-rose-600">{error}</span> : hint ? <span className="mt-1 block text-xs text-slate-400">{hint}</span> : null}
    </label>
  );
}

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  icon?: ReactNode;
  wrapperClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, icon, className, wrapperClassName, ...rest },
  ref,
) {
  return (
    <Field label={label} hint={hint} error={error} className={wrapperClassName}>
      <div className="relative">
        {icon && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 [&>svg]:h-4 [&>svg]:w-4">{icon}</span>}
        <input ref={ref} className={cn(base, 'h-10', icon && 'pl-9', error && 'border-rose-400', className)} {...rest} />
      </div>
    </Field>
  );
});

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  options: SelectOption[];
  placeholder?: string;
  wrapperClassName?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hint, error, options, placeholder, className, wrapperClassName, ...rest },
  ref,
) {
  return (
    <Field label={label} hint={hint} error={error} className={wrapperClassName}>
      <select ref={ref} className={cn(base, 'h-10 pr-8', error && 'border-rose-400', className)} {...rest}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
});

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  wrapperClassName?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, className, wrapperClassName, rows = 3, ...rest },
  ref,
) {
  return (
    <Field label={label} hint={hint} error={error} className={wrapperClassName}>
      <textarea ref={ref} rows={rows} className={cn(base, 'py-2.5', error && 'border-rose-400', className)} {...rest} />
    </Field>
  );
});

export interface DatePickerProps extends Omit<InputProps, 'type' | 'onChange' | 'value'> {
  /** 'YYYY-MM-DD' (time için 'HH:mm', month için 'YYYY-MM') */
  value: string;
  onChange: (value: string) => void;
  mode?: 'date' | 'time' | 'month';
}

/** Native input tabanlı tarih/saat seçici. */
export function DatePicker({ value, onChange, mode = 'date', ...rest }: DatePickerProps) {
  return <Input type={mode} value={value} onChange={(e) => onChange(e.target.value)} {...rest} />;
}
