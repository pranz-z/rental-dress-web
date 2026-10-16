import type { Metadata } from 'next'
import { CheckCircle2, KeyRound, ShieldCheck, ShieldOff, UserPlus } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Chip } from '@/components/ui/chip'
import { FieldHint, FieldLabel, Input, Select } from '@/components/ui/field'
import { requireCapability } from '@/lib/auth/guards'
import { formatDateTime } from '@/lib/dates'
import { prisma } from '@/lib/db'
import { ROLE_META, STAFF_ROLES } from '@/lib/domain'
import {
  changeStaffRoleAction,
  inviteStaffAction,
  resetStaffPasswordAction,
  resetTwoFactorAction,
  setStaffActiveAction,
  setTwoFactorRequiredAction,
} from '../actions'
import { SETTINGS_DONE_MESSAGES } from '../messages'

export const metadata: Metadata = { title: 'Staff accounts · Settings' }
export const dynamic = 'force-dynamic'

export default async function StaffPage({
  searchParams,
}: {
  searchParams: Promise<{ done?: string; error?: string; temp?: string }>
}) {
  const staff = await requireCapability('settings.staff')
  const { done, error, temp } = await searchParams

  const members = await prisma.staffUser.findMany({ orderBy: [{ active: 'desc' }, { role: 'asc' }, { name: 'asc' }] })
  const activeOwners = members.filter((member) => member.active && member.role === 'OWNER').length
  const doneMessage = done ? (SETTINGS_DONE_MESSAGES[done] ?? null) : null

  return (
    <div className="space-y-5">
      {error ? (
        <div role="alert" className="rounded-xl border border-danger-line bg-surface px-4 py-3 text-sm font-bold text-danger-ink">
          {error}
        </div>
      ) : null}
      {doneMessage ? (
        <div className="rounded-xl border border-line bg-surface px-4 py-3 text-sm text-ink">
          <span className="inline-flex items-center gap-2">
            <CheckCircle2 className="size-4 shrink-0 text-ink-muted" strokeWidth={1.75} aria-hidden />
            {doneMessage}
          </span>
        </div>
      ) : null}
      {temp ? (
        <div className="rounded-xl border border-gold/70 bg-gold/10 px-4 py-3 text-sm leading-relaxed text-ink">
          Temporary password: <code className="rounded-md border border-line bg-surface px-2 py-0.5 font-mono font-bold">{temp}</code>
          <span className="text-ink-muted">
            {' '}
            — it was emailed to them as well. They choose their own password the moment they sign in.
          </span>
        </div>
      ) : null}

      <Card>
        <CardHeader
          title="Invite a teammate"
          description="They receive a temporary password, set their own on first sign-in, and every change here lands in the audit trail."
        />
        <CardBody>
          <form action={inviteStaffAction} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <FieldLabel htmlFor="invite-name">Full name</FieldLabel>
              <Input id="invite-name" name="name" placeholder="Claire Fontaine" required />
            </div>
            <div>
              <FieldLabel htmlFor="invite-email">Studio email</FieldLabel>
              <Input id="invite-email" name="email" type="email" placeholder="claire@maisonreve.com" required />
            </div>
            <div>
              <FieldLabel htmlFor="invite-title">Title</FieldLabel>
              <Input id="invite-title" name="title" placeholder="Stylist" required />
            </div>
            <div>
              <FieldLabel htmlFor="invite-role">Role</FieldLabel>
              <Select id="invite-role" name="role" defaultValue="STYLIST" required>
                {STAFF_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_META[role].label}
                  </option>
                ))}
              </Select>
              <FieldHint>{ROLE_META.STYLIST.blurb}</FieldHint>
            </div>
            <div>
              <FieldLabel htmlFor="invite-phone">Phone (optional)</FieldLabel>
              <Input id="invite-phone" name="phone" placeholder="(617) 555-0177" />
            </div>
            <div className="flex items-end">
              <Button type="submit" className="w-full sm:w-auto">
                <UserPlus className="size-4" strokeWidth={1.75} aria-hidden />
                Send the invitation
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>

      <div className="space-y-4">
        {members.map((member) => {
          const isSelf = member.id === staff.id
          const roleMeta = ROLE_META[member.role]
          return (
            <Card key={member.id} className={member.active ? undefined : 'opacity-70'}>
              <CardBody className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_minmax(0,1.3fr)]">
                <div className="flex items-start gap-3">
                  <Avatar name={member.name} />
                  <div className="min-w-0">
                    <p className="font-bold text-ink">
                      {member.name}
                      {isSelf ? <span className="ml-2 text-xs font-normal text-ink-muted">You</span> : null}
                    </p>
                    <p className="text-[13px] text-ink-muted">{member.email}</p>
                    <p className="mt-0.5 text-[13px] text-ink-muted">
                      {member.title}
                      {member.phone ? ` · ${member.phone}` : ''}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Chip tone={roleMeta.tone}>{roleMeta.label}</Chip>
                    {member.active ? <Chip tone="sage">Active</Chip> : <Chip tone="clay">Deactivated</Chip>}
                    {member.twoFactorEnabled ? (
                      <Chip tone="sage">2FA on</Chip>
                    ) : member.twoFactorRequired ? (
                      <Chip tone="clay">Must enroll 2FA</Chip>
                    ) : (
                      <Chip tone="neutral">2FA off</Chip>
                    )}
                    {member.mustChangePassword ? <Chip tone="gold">Password reset pending</Chip> : null}
                  </div>
                  <p className="text-xs text-ink-muted">
                    Last active {member.lastActiveAt ? formatDateTime(member.lastActiveAt) : 'never'} · invited{' '}
                    {formatDateTime(member.createdAt)}
                  </p>
                  {!isSelf && member.role === 'OWNER' && activeOwners <= 1 ? (
                    <p className="text-xs text-ink-muted">The last active Owner cannot be demoted or deactivated.</p>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-start gap-2">
                  {isSelf ? (
                    <p className="text-[13px] text-ink-muted">
                      Your own account — an Owner’s role and access cannot be changed from here.
                    </p>
                  ) : (
                    <>
                      <form action={changeStaffRoleAction} className="flex items-center gap-2">
                        <input type="hidden" name="staffId" value={member.id} />
                        <Select name="role" defaultValue={member.role} className="w-40" aria-label={`Role for ${member.name}`}>
                          {STAFF_ROLES.map((role) => (
                            <option key={role} value={role}>
                              {ROLE_META[role].label}
                            </option>
                          ))}
                        </Select>
                        <Button type="submit" size="sm" variant="secondary">
                          Save role
                        </Button>
                      </form>

                      <form action={setStaffActiveAction}>
                        <input type="hidden" name="staffId" value={member.id} />
                        <input type="hidden" name="active" value={member.active ? 'false' : 'true'} />
                        <Button type="submit" size="sm" variant={member.active ? 'danger' : 'secondary'}>
                          {member.active ? 'Deactivate' : 'Reactivate'}
                        </Button>
                      </form>
                    </>
                  )}

                  <form action={resetStaffPasswordAction}>
                    <input type="hidden" name="staffId" value={member.id} />
                    <Button type="submit" size="sm" variant="ghost">
                      <KeyRound className="size-3.5" strokeWidth={1.75} aria-hidden />
                      Reset password
                    </Button>
                  </form>

                  <form action={setTwoFactorRequiredAction}>
                    <input type="hidden" name="staffId" value={member.id} />
                    <input type="hidden" name="required" value={member.twoFactorRequired ? 'false' : 'true'} />
                    <Button type="submit" size="sm" variant="ghost">
                      <ShieldCheck className="size-3.5" strokeWidth={1.75} aria-hidden />
                      {member.twoFactorRequired ? 'Make 2FA optional' : 'Require 2FA'}
                    </Button>
                  </form>

                  {member.twoFactorEnabled ? (
                    <form action={resetTwoFactorAction}>
                      <input type="hidden" name="staffId" value={member.id} />
                      <Button type="submit" size="sm" variant="ghost">
                        <ShieldOff className="size-3.5" strokeWidth={1.75} aria-hidden />
                        Reset authenticator
                      </Button>
                    </form>
                  ) : null}
                </div>
              </CardBody>
            </Card>
          )
        })}
      </div>

      <p className="text-[13px] leading-relaxed text-ink-muted">
        Stylists and Fulfillment accounts only see the screens their role allows. A deactivated account ends its sessions on
        the next request.
      </p>
    </div>
  )
}
