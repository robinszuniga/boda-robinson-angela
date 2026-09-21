import type { ReactNode } from 'react'
import { cn } from './cn'

export type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type Size = 'sm' | 'md'

const base =
  'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap'

const variants: Record<Variant, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 shadow-sm',
  secondary: 'bg-white text-ink border border-line hover:bg-brand-50',
  ghost: 'text-muted hover:bg-black/5 hover:text-ink',
  danger: 'bg-red-700 text-white hover:bg-red-800 shadow-sm',
}

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
}

export interface StyleProps {
  variant?: Variant
  size?: Size
  icon?: ReactNode
}

export function buttonClass({ variant = 'primary', size = 'md' }: StyleProps = {}, extra?: string) {
  return cn(base, variants[variant], sizes[size], extra)
}
