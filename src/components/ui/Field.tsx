import { useId, type ComponentProps, type ReactNode } from 'react'
import { cn } from './cn'

const control =
  'w-full rounded-lg border border-line bg-white px-3 text-sm text-ink placeholder:text-muted/70 transition-colors focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 disabled:bg-stone-50 aria-invalid:border-red-400'

interface FieldProps {
  label: string
  hint?: ReactNode
  error?: string
  className?: string
  children: (id: string) => ReactNode
}

/** Etiqueta + control + ayuda/error, con ids enlazados para accesibilidad */
export function Field({ label, hint, error, className, children }: FieldProps) {
  const id = useId()
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      {children(id)}
      {error ? (
        <p className="text-xs text-red-700" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  )
}

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input className={cn(control, 'h-10', className)} {...props} />
}

export function Textarea({ className, rows = 3, ...props }: ComponentProps<'textarea'>) {
  return <textarea rows={rows} className={cn(control, 'py-2 leading-relaxed', className)} {...props} />
}

export function Select({ className, children, ...props }: ComponentProps<'select'>) {
  return (
    <select className={cn(control, 'h-10 pr-8', className)} {...props}>
      {children}
    </select>
  )
}

export function Checkbox({ label, className, ...props }: ComponentProps<'input'> & { label: ReactNode }) {
  return (
    <label className={cn('inline-flex cursor-pointer items-center gap-2 text-sm', className)}>
      <input type="checkbox" className="size-4 rounded accent-brand-600" {...props} />
      {label}
    </label>
  )
}

export function FormGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('grid grid-cols-1 gap-4 sm:grid-cols-2', className)}>{children}</div>
}
