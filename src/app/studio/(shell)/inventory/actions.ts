'use server'

/**
 * Inventory actions. Every write funnels through the domain operations in
 * lib/inventory.ts and lib/cleaning.ts, so the audit trail, the availability
 * rules and the cleaning hand-off are enforced exactly once. Success and
 * failure travel back through the URL, keeping every page a plain refresh.
 */
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireCapability } from '@/lib/auth/guards'
import { CleaningError, completeCleaning } from '@/lib/cleaning'
import {
  InventoryError,
  blockDressDates,
  createDress,
  parseDateInput,
  parseDressForm,
  removeDressBlock,
  restoreDress,
  retireDress,
  updateDress,
} from '@/lib/inventory'

function pathWith(base: string, params: { done?: string; error?: string }): string {
  const search = new URLSearchParams()
  if (params.done) search.set('done', params.done)
  if (params.error) search.set('error', params.error)
  const query = search.toString()
  return query ? `${base}?${query}` : base
}

function revalidateInventory(dressId?: string): void {
  revalidatePath('/studio/inventory')
  if (dressId) revalidatePath(`/studio/inventory/${dressId}`)
  revalidatePath('/studio')
  revalidatePath('/studio/schedule')
}

/** Runs an operation, bouncing back to `target` with a plain-language message. */
async function attempt<T>(target: string, operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    if (error instanceof InventoryError || error instanceof CleaningError) {
      redirect(pathWith(target, { error: error.message }))
    }
    console.error('Inventory action failed:', error)
    redirect(pathWith(target, { error: 'Something went wrong — the change was not saved.' }))
  }
}

export async function createDressAction(formData: FormData): Promise<void> {
  const staff = await requireCapability('inventory.manage')
  const dressId = await attempt('/studio/inventory/new', () => createDress(staff, parseDressForm(formData)))
  revalidateInventory(dressId)
  redirect(pathWith(`/studio/inventory/${dressId}`, { done: 'created' }))
}

export async function updateDressAction(formData: FormData): Promise<void> {
  const staff = await requireCapability('inventory.manage')
  const dressId = String(formData.get('dressId') ?? '')
  await attempt(`/studio/inventory/${dressId}/edit`, () => updateDress(staff, dressId, parseDressForm(formData)))
  revalidateInventory(dressId)
  redirect(pathWith(`/studio/inventory/${dressId}`, { done: 'updated' }))
}

export async function blockDatesAction(formData: FormData): Promise<void> {
  const staff = await requireCapability('inventory.manage')
  const dressId = String(formData.get('dressId') ?? '')
  const size = String(formData.get('size') ?? '').trim() || null
  const startRaw = String(formData.get('startDate') ?? '')
  const endRaw = String(formData.get('endDate') ?? '')
  const reason = String(formData.get('reason') ?? '')

  await attempt(`/studio/inventory/${dressId}`, () =>
    blockDressDates(staff, {
      dressId,
      size,
      startDate: parseDateInput(startRaw, 'start date'),
      endDate: parseDateInput(endRaw, 'end date'),
      reason,
    }),
  )
  revalidateInventory(dressId)
  redirect(pathWith(`/studio/inventory/${dressId}`, { done: 'blocked' }))
}

export async function removeBlockAction(formData: FormData): Promise<void> {
  const staff = await requireCapability('inventory.manage')
  const dressId = String(formData.get('dressId') ?? '')
  const blockId = String(formData.get('blockId') ?? '')
  await attempt(`/studio/inventory/${dressId}`, () => removeDressBlock(staff, blockId))
  revalidateInventory(dressId)
  redirect(pathWith(`/studio/inventory/${dressId}`, { done: 'unblocked' }))
}

export async function retireDressAction(formData: FormData): Promise<void> {
  const staff = await requireCapability('inventory.manage')
  const dressId = String(formData.get('dressId') ?? '')
  await attempt(`/studio/inventory/${dressId}`, () => retireDress(staff, dressId))
  revalidateInventory(dressId)
  redirect(pathWith(`/studio/inventory/${dressId}`, { done: 'retired' }))
}

export async function restoreDressAction(formData: FormData): Promise<void> {
  const staff = await requireCapability('inventory.manage')
  const dressId = String(formData.get('dressId') ?? '')
  await attempt(`/studio/inventory/${dressId}`, () => restoreDress(staff, dressId))
  revalidateInventory(dressId)
  redirect(pathWith(`/studio/inventory/${dressId}`, { done: 'restored' }))
}

export async function completeCleaningFromInventoryAction(formData: FormData): Promise<void> {
  const staff = await requireCapability('inventory.cleaning')
  const dressId = String(formData.get('dressId') ?? '')
  const recordId = String(formData.get('recordId') ?? '')
  await attempt(`/studio/inventory/${dressId}`, () => completeCleaning(recordId, staff))
  revalidateInventory(dressId)
  redirect(pathWith(`/studio/inventory/${dressId}`, { done: 'cleaned' }))
}
