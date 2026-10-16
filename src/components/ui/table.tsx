import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/cn'

export function TableWrap({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('overflow-x-auto', className)}>{children}</div>
}

export function Table({ className, children }: { className?: string; children: ReactNode }) {
  return <table className={cn('w-full border-collapse text-sm', className)}>{children}</table>
}

export function Th({ className, children, ...rest }: ComponentProps<'th'>) {
  return (
    <th
      scope="col"
      className={cn(
        'border-b border-line px-4 py-3 text-left text-[11px] font-bold whitespace-nowrap uppercase tracking-[0.1em] text-ink-muted',
        className,
      )}
      {...rest}
    >
      {children}
    </th>
  )
}

export function Td({ className, children, ...rest }: ComponentProps<'td'>) {
  return (
    <td className={cn('border-b border-line px-4 py-3.5 align-middle text-ink', className)} {...rest}>
      {children}
    </td>
  )
}

export function Tr({ className, children, ...rest }: ComponentProps<'tr'>) {
  return (
    <tr className={cn('transition-colors hover:bg-surface-muted/70', className)} {...rest}>
      {children}
    </tr>
  )
}
