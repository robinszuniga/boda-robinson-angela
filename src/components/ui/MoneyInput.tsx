import { useState, type ComponentProps } from 'react'
import { formatNumber, parseMoney } from '../../lib/format'
import { cn } from './cn'
import { Input } from './Field'

type Props = Omit<ComponentProps<'input'>, 'value' | 'onChange' | 'type'> & {
  value: number | null | undefined
  onChange: (value: number | null) => void
}

/** Campo de pesos: muestra puntos de miles mientras se escribe y entrega un número */
export function MoneyInput({ value, onChange, className, onBlur, ...props }: Props) {
  const [focused, setFocused] = useState(false)
  const [draft, setDraft] = useState('')
  const shown = focused ? draft : value == null ? '' : formatNumber(value)

  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted">$</span>
      <Input
        {...props}
        inputMode="numeric"
        autoComplete="off"
        className={cn('pl-7 tabular-nums', className)}
        value={shown}
        onFocus={() => {
          setDraft(value == null ? '' : formatNumber(value))
          setFocused(true)
        }}
        onChange={(e) => {
          const parsed = parseMoney(e.target.value)
          setDraft(parsed == null ? '' : formatNumber(parsed))
          onChange(parsed)
        }}
        onBlur={(e) => {
          setFocused(false)
          onBlur?.(e)
        }}
      />
    </div>
  )
}
