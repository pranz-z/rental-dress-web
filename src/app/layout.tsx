import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'Maison Rêve — Designer dress rental, Boston',
    template: '%s · Maison Rêve',
  },
  description:
    'Maison Rêve rents designer gowns for weddings, galas and evenings out. Reserve online, we deliver to your door, cleaned and pressed.',
  metadataBase: new URL('https://maisonreve.com'),
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=Lato:ital,wght@0,400;0,700;1,400&display=swap"
        />
      </head>
      <body className="min-h-dvh bg-page font-sans text-ink antialiased">{children}</body>
    </html>
  )
}
