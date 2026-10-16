import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/cn'

export function Card({ className, children, ...rest }: ComponentProps<'div'>) {
  return (
    <div className={cn('rounded-xl border border-line bg-surface shadow-soft', className)} {...rest}>
      {children}
    </div>
  )
}

export function CardHeader({
  title,
  description,
  action,
  className,
  children,
}: {
  title?: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
  children?: ReactNode
}) {
  return (
    <div className={cn('flex items-start justify-between gap-4 border-b border-line px-5 py-4', className)}>
      {children ?? (
        <>
          <div className="min-w-0">
            {title ? <h2 className="font-serif text-lg leading-snug text-ink">{title}</h2> : null}
            {description ? <p className="mt-0.5 text-[13px] text-ink-muted">{description}</p> : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </>
      )}
    </div>
  )
}

export function CardBody({ className, children, ...rest }: ComponentProps<'div'>) {
  return (
    <div className={cn('px-5 py-4', className)} {...rest}>
      {children}
    </div>
  )
}

export function CardFooter({ className, children, ...rest }: ComponentProps<'div'>) {
  return (
    <div className={cn('flex items-center justify-between gap-3 border-t border-line px-5 py-3.5', className)} {...rest}>
      {children}
    </div>
  )
}
