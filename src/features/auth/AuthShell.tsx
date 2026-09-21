import type { ReactNode } from 'react'

export function AuthShell({ subtitle, children }: { subtitle: string; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[radial-gradient(ellipse_at_top,var(--color-brand-100),transparent_60%)] p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Monogram className="mx-auto size-16 text-2xl" />
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">Nuestra boda</h1>
          <p className="mt-1 text-sm text-muted">{subtitle}</p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-6 shadow-sm">{children}</div>
      </div>
    </div>
  )
}

export function Monogram({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`flex items-center justify-center rounded-full border border-brand-200 bg-white font-display text-brand-700 italic shadow-sm ${className}`}
    >
      R<span className="px-0.5 text-accent-400">&amp;</span>Á
    </div>
  )
}
