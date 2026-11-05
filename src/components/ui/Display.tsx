import type { ReactNode } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import type { Tone } from '../../lib/labels'
import { describeError } from '../../lib/errors'
import { cn } from './cn'
import { Button } from './Button'
import { PROGRESS_LAYER_COLORS } from './progressStyles'

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn('rounded-2xl border border-line bg-white shadow-xs', className)}>{children}</section>
}

export function CardHeader({
  title,
  action,
  subtitle,
}: {
  title: ReactNode
  action?: ReactNode
  subtitle?: ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
      <div className="min-w-0">
        <h2 className="text-lg font-semibold">{title}</h2>
        {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

const tones: Record<Tone, string> = {
  neutral: 'bg-stone-100 text-stone-700',
  green: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  amber: 'bg-amber-50 text-amber-800 ring-amber-200',
  red: 'bg-red-50 text-red-800 ring-red-200',
  blue: 'bg-sky-50 text-sky-800 ring-sky-200',
  brand: 'bg-brand-50 text-brand-700 ring-brand-200',
  accent: 'bg-accent-50 text-accent-700 ring-accent-200',
}

export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-transparent ring-inset',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

export function ProgressBar({
  value,
  max,
  secondary,
  tone = 'brand',
  className,
  label,
  valueText,
}: {
  value: number
  max: number
  /**
   * Una segunda capa más clara detrás de la principal. En el presupuesto la
   * clara es lo contratado y la fuerte lo pagado: con una sola capa se veía la
   * barra llena aunque solo se hubiera pagado la mitad.
   */
  secondary?: number
  tone?: 'brand' | 'red' | 'amber' | 'accent'
  className?: string
  label?: string
  /** Lo que lee el lector de pantalla cuando el número solo no lo explica */
  valueText?: string
}) {
  const pctOf = (n: number) => (max > 0 ? Math.min(100, (n / max) * 100) : 0)
  const layered = secondary != null
  const color = layered
    ? PROGRESS_LAYER_COLORS.solid[tone]
    : { brand: 'bg-brand-500', red: 'bg-red-600', amber: 'bg-amber-500', accent: 'bg-accent-400' }[tone]
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={valueText}
      className={cn('relative h-2 w-full overflow-hidden rounded-full bg-stone-100', className)}
    >
      {layered && (
        <div
          className={cn('absolute inset-y-0 left-0 rounded-full transition-all', PROGRESS_LAYER_COLORS.light[tone])}
          style={{ width: `${pctOf(secondary)}%` }}
        />
      )}
      <div className={cn('relative h-full rounded-full transition-all', color)} style={{ width: `${pctOf(value)}%` }} />
    </div>
  )
}

export function Stat({
  label,
  value,
  sub,
  icon,
  className,
}: {
  label: string
  value: ReactNode
  sub?: ReactNode
  icon?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('rounded-2xl border border-line bg-white p-4 shadow-xs', className)}>
      <div className="flex items-center gap-2 text-sm text-muted">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {sub && <div className="mt-1 text-xs text-muted">{sub}</div>}
    </div>
  )
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon?: ReactNode
  title: string
  children?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-white/60 px-6 py-12 text-center">
      {icon && <div className="mb-3 text-brand-400">{icon}</div>}
      <h3 className="text-lg font-semibold">{title}</h3>
      {children && <p className="mt-1 max-w-md text-sm text-muted">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function LoadingState({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted" role="status">
      <Loader2 className="size-4 animate-spin" />
      {label}
    </div>
  )
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-6 py-10 text-center" role="alert">
      <AlertTriangle className="size-6 text-red-700" />
      <p className="text-sm text-red-800">{describeError(error)}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Reintentar
        </Button>
      )}
    </div>
  )
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T
  onChange: (value: T) => void
  options: { value: T; label: ReactNode }[]
  label: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex w-fit rounded-lg border border-line bg-white p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm transition-colors',
            value === o.value ? 'bg-brand-600 text-white shadow-sm' : 'text-muted hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
