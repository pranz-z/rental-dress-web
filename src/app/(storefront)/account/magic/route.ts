import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { readMagicLinkToken, startCustomerSession } from '@/lib/storefront/session'

export const dynamic = 'force-dynamic'

/**
 * Magic-link landing. The token is a short-lived signed JWT carrying the
 * customer id; once verified the ordinary session cookie is issued and the
 * customer lands wherever they were headed.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token') ?? ''
  const rawNext = request.nextUrl.searchParams.get('next') ?? ''
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/account'

  const customerId = await readMagicLinkToken(token)
  if (!customerId) {
    return NextResponse.redirect(new URL('/account/sign-in?error=expired', request.url))
  }

  const customer = await prisma.customer.findUnique({ where: { id: customerId }, select: { id: true } })
  if (!customer) {
    return NextResponse.redirect(new URL('/account/sign-in?error=expired', request.url))
  }

  await startCustomerSession(customer.id)
  return NextResponse.redirect(new URL(next, request.url))
}
