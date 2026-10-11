import { UserMinus } from 'lucide-react'
import type { TableOccupancy } from '../../lib/seating'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { cn } from '../../components/ui/cn'
import type { Guest } from '../../types/database'

/** Elegir la mesa de un invitado (o sacarlo de la que tiene) */
export function AssignModal({
  guest,
  tables,
  seats,
  onPick,
  onClose,
}: {
  guest: Guest
  tables: TableOccupancy[]
  seats: number
  onPick: (tableId: string | null) => void
  onClose: () => void
}) {
  const needed = seats
  return (
    <Modal open onClose={onClose} title={guest.name} description={`Ocupa ${needed} ${needed === 1 ? 'puesto' : 'puestos'}. Elige su mesa.`}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {tables.map((t) => {
          const current = guest.table_id === t.table.id
          const fits = current || t.free >= needed
          return (
            <button
              key={t.table.id}
              type="button"
              onClick={() => onPick(t.table.id)}
              className={cn(
                'rounded-xl border px-3 py-2 text-left text-sm transition-colors',
                current ? 'border-brand-600 bg-brand-50' : 'border-line hover:border-brand-300',
              )}
            >
              <div className="font-medium">Mesa {t.table.number}</div>
              <div className={cn('text-xs', fits ? 'text-muted' : 'text-red-700')}>
                {current ? 'Mesa actual' : `${Math.max(t.free, 0)} libres`}
              </div>
            </button>
          )
        })}
      </div>
      {guest.table_id && (
        <Button className="mt-4 w-full" variant="secondary" icon={<UserMinus className="size-4" />} onClick={() => onPick(null)}>
          Quitar de la mesa
        </Button>
      )}
    </Modal>
  )
}
