'use client'

/**
 * Start an event list — a quiet planning space for a wedding, a gala season,
 * or the person who keeps asking you to a dinner. Dresses join from any dress
 * page.
 */
import { useActionState, useRef } from 'react'
import { Check, Loader2, ListPlus } from 'lucide-react'
import { createEventListAction } from '@/app/(storefront)/account/actions'
import { IDLE_FORM } from '@/app/(storefront)/form-state'
import { FieldLabel, Input } from '@/components/ui/field'

export function NewEventListForm({ occasions }: { occasions: string[] }) {
  const [state, formAction, pending] = useActionState(createEventListAction, IDLE_FORM)
  const formRef = useRef<HTMLFormElement>(null)

  if (state.status === 'ok') {
    return (
      <p role="status" className="flex items-center gap-2 rounded-xl border border-line bg-surface-muted/50 px-4 py-3.5 text-sm font-bold text-ink">
        <Check className="size-4 text-mulberry" strokeWidth={2} aria-hidden />
        {state.message}
        <button
          type="button"
          onClick={() => {
            formRef.current?.reset()
            window.location.reload()
          }}
          className="ml-auto text-[13px] font-bold text-mulberry hover:underline"
        >
          Add another
        </button>
      </p>
    )
  }

  return (
    <form ref={formRef} action={formAction} className="grid gap-4 sm:grid-cols-[1.4fr_1fr_1fr]">
      <div>
        <FieldLabel htmlFor="list-name">List name</FieldLabel>
        <Input id="list-name" name="name" required minLength={2} maxLength={80} placeholder="Priya's wedding, October" />
      </div>
      <div>
        <FieldLabel htmlFor="list-date">Event date (optional)</FieldLabel>
        <Input id="list-date" name="eventDate" type="date" />
      </div>
      <div>
        <FieldLabel htmlFor="list-occasion">Occasion (optional)</FieldLabel>
        <Input id="list-occasion" name="occasion" list="list-occasion-options" placeholder="Wedding guest" />
        <datalist id="list-occasion-options">
          {occasions.map((occasion) => (
            <option key={occasion} value={occasion} />
          ))}
        </datalist>
      </div>
      {state.status === 'error' ? (
        <p role="alert" className="text-sm font-bold text-danger-ink sm:col-span-3">
          {state.message}
        </p>
      ) : null}
      <div className="sm:col-span-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-11 items-center gap-2 rounded-full border border-line-strong bg-surface px-6 text-sm font-bold text-ink transition-colors hover:border-rose hover:text-mulberry disabled:opacity-60"
        >
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ListPlus className="size-4" strokeWidth={1.75} aria-hidden />}
          Start the list
        </button>
      </div>
    </form>
  )
}
