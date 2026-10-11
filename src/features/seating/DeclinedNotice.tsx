import { AlertTriangle } from 'lucide-react'
import type { DeclinedAtTable } from '../../lib/floorPlan'
import { Button } from '../../components/ui/Button'
import { cn } from '../../components/ui/cn'

export type DeclinedItem = DeclinedAtTable & { tableNumber: number }

/**
 * Aviso rojo con los que dijeron que no van y siguen anotados en una mesa. Su puesto
 * ya está libre (no cuentan en la ocupación); "Quitar" los saca para llenar el hueco.
 */
export function DeclinedNotice({
  items,
  showTable,
  onRemove,
  className,
}: {
  items: DeclinedItem[]
  /** Con el número de mesa al lado de cada nombre (cuando la lista es de todo el salón) */
  showTable: boolean
  onRemove: (item: DeclinedItem) => void
  className?: string
}) {
  if (items.length === 0) return null
  return (
    <div className={cn('rounded-xl border border-red-200 bg-red-50 p-3', className)} role="status">
      <p className="flex items-center gap-1.5 text-sm font-medium text-red-800">
        <AlertTriangle className="size-4 shrink-0" />
        {items.length === 1 ? 'Dijo que no va' : 'Dijeron que no van'}
      </p>
      <p className="mt-0.5 text-xs text-red-800/80">Su puesto ya quedó libre. Quítenlos para llenar el hueco.</p>
      <ul className="mt-2 flex flex-col gap-1.5">
        {items.map((d) => (
          <li key={d.key} className="flex items-center justify-between gap-2 text-sm">
            <span className="min-w-0 truncate">
              {d.name}
              {showTable && <span className="text-red-800/70"> · mesa {d.tableNumber}</span>}
            </span>
            <Button
              size="sm"
              variant="secondary"
              className="h-7 shrink-0 px-2 text-xs"
              aria-label={`Quitar a ${d.name} de la mesa ${d.tableNumber}`}
              onClick={() => onRemove(d)}
            >
              Quitar
            </Button>
          </li>
        ))}
      </ul>
    </div>
  )
}
