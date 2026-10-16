import type { ComponentProps, ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/cn'

export const fieldBase =
  'w-full rounded-lg border border-line bg-surface text-sm text-ink placeholder:text-ink-muted transition-colors focus:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/25 disabled:opacity-60'

export function FieldLabel({ className, children, ...rest }: ComponentProps<'label'>) {
  return (
    <label className={cn('mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-ink-muted', className)} {...rest}>
      {children}
    </label>
  )
}

export function FieldHint({ className, children }: { className?: string; children: ReactNode }) {
  return <p className={cn('mt-1.5 text-xs leading-relaxed text-ink-muted', className)}>{children}</p>
}

export function FieldError({ className, children }: { className?: string; children?: ReactNode }) {
  if (!children) return null
  return (
    <p role="alert" className={cn('mt-1.5 text-xs font-bold text-danger-ink', className)}>
      {children}
    </p>
  )
}

export function Input({ className, ...rest }: ComponentProps<'input'>) {
  return <input className={cn(fieldBase, 'h-11 px-3.5', className)} {...rest} />
}

export function Textarea({ className, ...rest }: ComponentProps<'textarea'>) {
  return <textarea className={cn(fieldBase, 'min-h-28 px-3.5 py-3 leading-relaxed', className)} {...rest} />
}

export function Select({ className, children, ...rest }: ComponentProps<'select'>) {
  return (
    <span className="relative block">
      <select className={cn(fieldBase, 'h-11 appearance-none pr-10 pl-3.5', className)} {...rest}>
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-ink-muted"
        strokeWidth={1.75}
        aria-hidden
      />
    </span>
  )
}

export function Checkbox({ className, ...rest }: ComponentProps<'input'>) {
  return (
    <input
      type="checkbox"
      className={cn('size-4 shrink-0 rounded-[5px] border-line-strong accent-[var(--accent)]', className)}
      {...rest}
    />
  )
}
