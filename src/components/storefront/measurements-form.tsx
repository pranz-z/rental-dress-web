'use client'

/**
 * Saved measurements — the numbers the studio checks before it sends a dress.
 * Numbers are centimetres; sizes are the studio's letter labels.
 */
import { useActionState } from 'react'
import { Check, Loader2, Ruler } from 'lucide-react'
import { saveMeasurementsAction } from '@/app/(storefront)/account/actions'
import { IDLE_FORM } from '@/app/(storefront)/form-state'
import { FieldHint, FieldLabel, Input, Select, Textarea } from '@/components/ui/field'

const LETTER_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL']

export type MeasurementDefaults = {
  heightCm: number | null
  bustCm: number | null
  waistCm: number | null
  hipsCm: number | null
  dressSizeLabel: string | null
  backupSize: string | null
  shoeSize: string | null
  notes: string | null
}

export function MeasurementsForm({ saved }: { saved: MeasurementDefaults | null }) {
  const [state, formAction, pending] = useActionState(saveMeasurementsAction, IDLE_FORM)

  return (
    <form action={formAction} className="space-y-5">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div>
          <FieldLabel htmlFor="m-height">Height (cm)</FieldLabel>
          <Input id="m-height" name="heightCm" inputMode="numeric" defaultValue={saved?.heightCm ?? ''} placeholder="168" />
        </div>
        <div>
          <FieldLabel htmlFor="m-bust">Bust (cm)</FieldLabel>
          <Input id="m-bust" name="bustCm" inputMode="numeric" defaultValue={saved?.bustCm ?? ''} placeholder="88" />
        </div>
        <div>
          <FieldLabel htmlFor="m-waist">Waist (cm)</FieldLabel>
          <Input id="m-waist" name="waistCm" inputMode="numeric" defaultValue={saved?.waistCm ?? ''} placeholder="68" />
        </div>
        <div>
          <FieldLabel htmlFor="m-hips">Hips (cm)</FieldLabel>
          <Input id="m-hips" name="hipsCm" inputMode="numeric" defaultValue={saved?.hipsCm ?? ''} placeholder="96" />
        </div>
        <div>
          <FieldLabel htmlFor="m-size">Usual size</FieldLabel>
          <Select id="m-size" name="dressSizeLabel" defaultValue={saved?.dressSizeLabel ?? ''}>
            <option value="">Choose…</option>
            {LETTER_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <FieldLabel htmlFor="m-backup">Backup size</FieldLabel>
          <Select id="m-backup" name="backupSize" defaultValue={saved?.backupSize ?? ''}>
            <option value="">Choose…</option>
            {LETTER_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <FieldLabel htmlFor="m-shoe">Shoe size (EU)</FieldLabel>
          <Input id="m-shoe" name="shoeSize" inputMode="numeric" defaultValue={saved?.shoeSize ?? ''} placeholder="38" />
        </div>
      </div>

      <div>
        <FieldLabel htmlFor="m-notes">Fit notes for the studio (optional)</FieldLabel>
        <Textarea
          id="m-notes"
          name="notes"
          rows={3}
          defaultValue={saved?.notes ?? ''}
          placeholder="Torso runs long, straps usually need shortening, prefer a relaxed fit at the waist…"
        />
        <FieldHint>Everything here stays between you and the styling team.</FieldHint>
      </div>

      {state.status === 'ok' ? (
        <p role="status" className="flex items-center gap-2 text-sm font-bold text-ink">
          <Check className="size-4 text-mulberry" strokeWidth={2} aria-hidden />
          {state.message}
        </p>
      ) : null}
      {state.status === 'error' ? (
        <p role="alert" className="text-sm font-bold text-danger-ink">
          {state.message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-11 items-center gap-2 rounded-full border border-line-strong bg-surface px-6 text-sm font-bold text-ink transition-colors hover:border-rose hover:text-mulberry disabled:opacity-60"
      >
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Ruler className="size-4" strokeWidth={1.75} aria-hidden />}
        Save measurements
      </button>
    </form>
  )
}
