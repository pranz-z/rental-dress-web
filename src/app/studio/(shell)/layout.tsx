import { cookies } from 'next/headers'
import { StudioShell } from '@/components/studio/shell'
import { requireStaff } from '@/lib/auth/guards'
import { formatWeekdayLong, todayUtc } from '@/lib/dates'
import { prisma } from '@/lib/db'
import { can } from '@/lib/domain'

export const dynamic = 'force-dynamic'

export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaff()

  const [openInquiries, lateReturns, jar] = await Promise.all([
    can(staff.role, 'inquiries.view') ? prisma.inquiry.count({ where: { status: 'OPEN' } }) : Promise.resolve(0),
    can(staff.role, 'schedule.view') ? prisma.booking.count({ where: { status: 'LATE' } }) : Promise.resolve(0),
    cookies(),
  ])

  const theme = jar.get('mr_studio_theme')?.value === 'dark' ? 'dark' : 'light'

  return (
    <StudioShell
      staff={{ id: staff.id, name: staff.name, role: staff.role, title: staff.title }}
      badges={{ openInquiries, lateReturns }}
      theme={theme}
      today={formatWeekdayLong(todayUtc())}
    >
      {children}
    </StudioShell>
  )
}
