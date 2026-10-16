/**
 * Route guards. Every studio page funnels through these, so a role can never
 * see a section its capabilities don't include — even by typing the URL.
 */
import { redirect } from 'next/navigation'
import type { StaffUser } from '@prisma/client'
import { can, landingSection, type Capability } from '../domain'
import { currentStaff } from './session'

export async function requireStaff(): Promise<StaffUser> {
  const staff = await currentStaff()
  if (!staff) redirect('/studio/login')
  return staff
}

export async function requireCapability(capability: Capability): Promise<StaffUser> {
  const staff = await requireStaff()
  if (!can(staff.role, capability)) redirect(`/studio?denied=${capability}`)
  return staff
}

/** Where a role should land after signing in. */
export function landingPathFor(staff: StaffUser): string {
  const section = landingSection(staff.role)
  return section === 'overview' ? '/studio' : `/studio/${section}`
}
