import { Button, ButtonLink } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { FieldHint, FieldLabel, Input, Select, Textarea } from '@/components/ui/field'
import { DRESS_CATEGORIES } from '@/lib/domain'

export type DressFormValues = {
  name: string
  designer: string
  category: string
  color: string
  colorHex: string
  sizes: string
  occasion: string
  fabric: string
  length: string
  neckline: string
  sleeve: string
  retailValue: string
  careNotes: string
  fitNotes: string
}

const EMPTY: DressFormValues = {
  name: '',
  designer: '',
  category: 'Gown',
  color: '',
  colorHex: '#7a3e4d',
  sizes: '',
  occasion: '',
  fabric: '',
  length: '',
  neckline: '',
  sleeve: '',
  retailValue: '',
  careNotes: '',
  fitNotes: '',
}

/** One form for both add and edit, so the fields can never drift apart. */
export function DressForm({
  action,
  dressId,
  values,
  submitLabel,
  cancelHref,
}: {
  action: (formData: FormData) => Promise<void>
  dressId?: string
  values?: Partial<DressFormValues>
  submitLabel: string
  cancelHref: string
}) {
  const v = { ...EMPTY, ...values }
  const categories: string[] = [...DRESS_CATEGORIES]
  if (v.category && !categories.includes(v.category)) categories.push(v.category)

  return (
    <form action={action} className="space-y-6">
      {dressId ? <input type="hidden" name="dressId" value={dressId} /> : null}

      <Card>
        <CardHeader
          title="The piece"
          description="Identity and rack details — they follow the dress through bookings, the schedule and the storefront."
        />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <div>
            <FieldLabel htmlFor="dress-name">Name *</FieldLabel>
            <Input id="dress-name" name="name" required maxLength={80} defaultValue={v.name} placeholder="Amélie Silk Gown" />
          </div>
          <div>
            <FieldLabel htmlFor="dress-designer">Designer</FieldLabel>
            <Input id="dress-designer" name="designer" defaultValue={v.designer} placeholder="As on the inner label" />
          </div>
          <div>
            <FieldLabel htmlFor="dress-category">Category *</FieldLabel>
            <Select id="dress-category" name="category" required defaultValue={v.category}>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <FieldLabel htmlFor="dress-sizes">Sizes *</FieldLabel>
            <Input id="dress-sizes" name="sizes" required defaultValue={v.sizes} placeholder="XS, S, M, L" />
            <FieldHint>Comma-separated. Each size keeps its own rental calendar.</FieldHint>
          </div>
          <div>
            <FieldLabel htmlFor="dress-color">Colour name</FieldLabel>
            <Input id="dress-color" name="color" defaultValue={v.color} placeholder="Mulberry velvet" />
          </div>
          <div>
            <FieldLabel htmlFor="dress-color-hex">Colour swatch</FieldLabel>
            <Input
              id="dress-color-hex"
              name="colorHex"
              type="color"
              defaultValue={v.colorHex}
              className="h-11 cursor-pointer px-1.5 py-1.5"
            />
            <FieldHint>Drives the garment art and the colour dot on the rack list.</FieldHint>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Atelier details" description="Cut and cloth — read by the stylists before a fitting or a dispatch." />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <div>
            <FieldLabel htmlFor="dress-occasion">Occasion</FieldLabel>
            <Input id="dress-occasion" name="occasion" defaultValue={v.occasion} placeholder="Black tie, wedding guest…" />
          </div>
          <div>
            <FieldLabel htmlFor="dress-fabric">Fabric</FieldLabel>
            <Input id="dress-fabric" name="fabric" defaultValue={v.fabric} placeholder="Silk georgette" />
          </div>
          <div>
            <FieldLabel htmlFor="dress-length">Length</FieldLabel>
            <Input id="dress-length" name="length" defaultValue={v.length} placeholder="Floor-length" />
          </div>
          <div>
            <FieldLabel htmlFor="dress-neckline">Neckline</FieldLabel>
            <Input id="dress-neckline" name="neckline" defaultValue={v.neckline} placeholder="Halter" />
          </div>
          <div className="sm:col-span-2">
            <FieldLabel htmlFor="dress-sleeve">Sleeve</FieldLabel>
            <Input id="dress-sleeve" name="sleeve" defaultValue={v.sleeve} placeholder="Sleeveless" />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Pricing"
          description="Rental prices and the damage deposit derive from the retail value and the percentages in Settings → Rental rules."
        />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <div>
            <FieldLabel htmlFor="dress-retail">Retail value ($) *</FieldLabel>
            <Input
              id="dress-retail"
              name="retailValue"
              required
              inputMode="decimal"
              defaultValue={v.retailValue}
              placeholder="2400"
            />
            <FieldHint>Both rental rates and the deposit move with the studio-wide percentages.</FieldHint>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Care & fit" description="Handling and fitting notes kept with the piece." />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <div>
            <FieldLabel htmlFor="dress-care">Care notes</FieldLabel>
            <Textarea
              id="dress-care"
              name="careNotes"
              defaultValue={v.careNotes}
              placeholder="Specialist clean only; steam lightly, store flat…"
            />
          </div>
          <div>
            <FieldLabel htmlFor="dress-fit">Fit notes</FieldLabel>
            <Textarea
              id="dress-fit"
              name="fitNotes"
              defaultValue={v.fitNotes}
              placeholder={'Runs small at the waist; best on 5\u20196" frames…'}
            />
          </div>
        </CardBody>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit">{submitLabel}</Button>
        <ButtonLink href={cancelHref} variant="secondary">
          Cancel
        </ButtonLink>
      </div>
    </form>
  )
}
