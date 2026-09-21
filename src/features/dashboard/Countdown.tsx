import { useEffect, useState } from 'react'
import { getCountdown } from '../../lib/countdown'

export function Countdown({ target }: { target: string }) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const c = getCountdown(new Date(target), now)
  if (c.isPast) {
    return <p className="font-display text-3xl text-brand-800 italic">¡Felices para siempre!</p>
  }

  const parts = [
    { value: c.days, label: c.days === 1 ? 'día' : 'días' },
    { value: c.hours, label: 'horas' },
    { value: c.minutes, label: 'min' },
    { value: c.seconds, label: 'seg' },
  ]

  return (
    <div className="flex gap-2 sm:gap-3" role="timer" aria-label={`Faltan ${c.days} días y ${c.hours} horas`}>
      {parts.map((p, i) => (
        <div
          key={p.label}
          className={`flex min-w-16 flex-col items-center rounded-xl bg-white/80 px-3 py-2 shadow-xs ring-1 ring-brand-100 sm:min-w-20 ${i === 0 ? 'min-w-20 sm:min-w-24' : ''}`}
        >
          <span className="font-display text-3xl font-semibold text-brand-800 tabular-nums sm:text-4xl" aria-hidden>
            {String(p.value).padStart(i === 0 ? 1 : 2, '0')}
          </span>
          <span className="text-[11px] tracking-wide text-muted uppercase" aria-hidden>
            {p.label}
          </span>
        </div>
      ))}
    </div>
  )
}
