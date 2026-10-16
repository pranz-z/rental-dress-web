'use client'

import { useState, useTransition } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Heart, Loader2 } from 'lucide-react'
import { cn } from '@/lib/cn'
import { toggleFavoriteAction } from '@/app/(storefront)/actions'

/** The heart that blooms when saved. Guests are sent to sign in first. */
export function WishlistHeart({
  dressId,
  dressName,
  saved,
  signedIn,
  className,
}: {
  dressId: string
  dressName: string
  saved: boolean
  signedIn: boolean
  className?: string
}) {
  const [isSaved, setIsSaved] = useState(saved)
  const [justSaved, setJustSaved] = useState(false)
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  const pathname = usePathname()

  function onToggle() {
    if (!signedIn) {
      router.push(`/account/sign-in?next=${encodeURIComponent(pathname)}`)
      return
    }
    startTransition(async () => {
      const result = await toggleFavoriteAction(dressId)
      if (result.requiresSignIn) {
        router.push(`/account/sign-in?next=${encodeURIComponent(pathname)}`)
        return
      }
      setIsSaved(result.saved)
      if (result.saved) {
        setJustSaved(true)
        window.setTimeout(() => setJustSaved(false), 700)
      }
    })
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={pending}
      aria-pressed={isSaved}
      aria-label={isSaved ? `Remove ${dressName} from favorites` : `Save ${dressName} to favorites`}
      className={cn(
        'relative grid size-10 place-items-center rounded-full border border-line bg-surface/90 text-ink-muted shadow-soft backdrop-blur-sm transition-all hover:border-rose hover:text-mulberry disabled:opacity-70',
        isSaved && 'border-rose/70 text-mulberry',
        className,
      )}
    >
      {pending ? (
        <Loader2 className="size-4.5 animate-spin" strokeWidth={1.75} aria-hidden />
      ) : (
        <Heart className={cn('size-4.5 transition-transform', isSaved ? 'scale-110 fill-current' : 'scale-100')} strokeWidth={1.75} aria-hidden />
      )}
      {justSaved ? <span aria-hidden className="absolute inset-0 animate-ping rounded-full border border-mulberry/40" /> : null}
    </button>
  )
}
