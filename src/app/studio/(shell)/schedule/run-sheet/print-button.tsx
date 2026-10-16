'use client'

import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'

/** Opens the browser's print dialog on the daily run sheet. */
export function PrintButton() {
  return (
    <Button type="button" size="sm" onClick={() => window.print()}>
      <Printer className="size-4" strokeWidth={1.75} aria-hidden />
      Print run sheet
    </Button>
  )
}
