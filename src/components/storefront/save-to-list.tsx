'use client'

/**
 * “Save to an event list” — the quiet sibling of the heart. Signed-in only;
 * the dress page renders it when the customer has lists, or a gentle prompt
 * to start one when they don't.
 */
import { useActionState } from 'react'
import Link from 'next/link'
import { BookmarkPlus, Check, Loader2 } from 'lucide-react'
import { addToEventListAction } from '@/app/(storefront)/account/actions'
import { IDLE_FORM } from '@/app/(storefront)/form-state'
import { Select } from '@/components/ui/field'

export function SaveToList({
  dressId,
  dressName,
  sizes,
  lists,
  defaultSize,
}: {
  dressId: string
  dressName: string
  sizes: string[]
  lists: Array<{ id: string; name: string }>
  defaultSize?: string | null
}) {
  const [state, formAction, pending] = useActionState(addToEventListAction, IDLE_FORM)

  if (state.status === 'ok') {
    return (
      <p role="status" className="flex items-center gap-2 text-sm font-bold text-ink">
        <Check className="size-4 text-mulberry" strokeWidth={2} aria-hidden />
        {state.message}
      </p>
    )
  }

  if (lists.length === 0) {
    return (
      <p className="text-sm text-ink-muted">
        Planning an event?{' '}
        <Link href="/account#lists" className="font-bold text-mulberry hover:underline">
          Start an event list
        </Link>{' '}
        and keep the dresses you are deciding between in one place.
      </p>
    )
  }

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2.5">
      <input type="hidden" name="dressId" value={dressId} />
      <div className="min-w-[190px]">
        <label htmlFor="save-to-list" className="mb-1.5 block text-[11px] font-bold tracking-[0.1em] text-ink-muted uppercase">
          Save {dressName} to
        </label>
        <Select id="save-to-list" name="listId" defaultValue={lists[0]!.id}>
          {lists.map((list) => (
            <option key={list.id} value={list.id}>
              {list.name}
            </option>
          ))}
        </Select>
      </div>
      {sizes.length > 0 ? (
        <div className="w-[92px]">
          <label htmlFor="save-to-list-size" className="mb-1.5 block text-[11px] font-bold tracking-[0.1em] text-ink-muted uppercase">
            Size
          </label>
          <Select id="save-to-list-size" name="size" defaultValue={defaultSize && sizes.includes(defaultSize) ? defaultSize : sizes[0]!}>
            {sizes.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </Select>
        </div>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-11 items-center gap-2 rounded-full border border-line-strong bg-surface px-5 text-sm font-bold text-ink transition-colors hover:border-rose hover:text-mulberry disabled:opacity-60"
      >
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <BookmarkPlus className="size-4" strokeWidth={1.75} aria-hidden />}
        Save
      </button>
      {state.status === 'error' ? (
        <p role="alert" className="w-full text-xs font-bold text-danger-ink">
          {state.message}
        </p>
      ) : null}
    </form>
  )
}
