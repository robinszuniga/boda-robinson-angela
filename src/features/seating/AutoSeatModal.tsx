import { useState } from 'react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { AlertTriangle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { tableKey } from '../../lib/crud'
import { attempt } from '../../lib/attempt'
import { planSeatingByGroup } from '../../lib/autoSeating'
import { seatsFor } from '../../lib/seating'
import { guestGroup } from '../../lib/labels'
import { plural } from '../../lib/format'
import { Button } from '../../components/ui/Button'
import { Checkbox } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import type { Guest, GuestLink, SeatingTable } from '../../types/database'

/** Guarda las mesas de a 10 para no disparar cientos de peticiones a la vez */
async function saveTables(moves: { id: string; tableId: string | null }[]) {
  for (let i = 0; i < moves.length; i += 10) {
    const results = await Promise.all(
      moves.slice(i, i + 10).map((m) => supabase.from('guests').update({ table_id: m.tableId }).eq('id', m.id)),
    )
    const failed = results.find((r) => r.error)
    if (failed?.error) throw failed.error
  }
}

/** Reparte a los invitados por grupo, con vista previa antes de aplicar */
export function AutoSeatModal({
  tables,
  guests,
  links,
  onClose,
}: {
  tables: SeatingTable[]
  guests: Guest[]
  links: GuestLink[]
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [reassignAll, setReassignAll] = useState(false)
  const [saving, setSaving] = useState(false)
  const plan = planSeatingByGroup(tables, guests, links, { reassignAll })
  const used = plan.tables.filter((t) => t.guests.length > 0)

  const apply = async () => {
    const before = plan.moves.map((m) => ({ id: m.guest.id, tableId: m.guest.table_id }))
    const after = plan.moves.map((m) => ({ id: m.guest.id, tableId: m.tableId }))
    setSaving(true)
    const ok = await attempt(saveTables(after))
    setSaving(false)
    await qc.invalidateQueries({ queryKey: tableKey('guests') })
    if (!ok) return
    toast.success(`${plural(after.length, 'invitado acomodado', 'invitados acomodados')}`, {
      action: {
        label: 'Deshacer',
        onClick: async () => {
          if (await attempt(saveTables(before))) toast.success('Se devolvieron las mesas como estaban')
          await qc.invalidateQueries({ queryKey: tableKey('guests') })
        },
      },
      duration: 10000,
    })
    onClose()
  }

  return (
    <Modal
      open
      size="lg"
      onClose={onClose}
      title="Armar mesas por grupo"
      description="Cada mesa queda con un solo grupo y ninguna invitación se separa."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={apply} disabled={plan.moves.length === 0 || saving}>
            {saving ? 'Acomodando…' : `Acomodar ${plan.moves.length || ''}`}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Checkbox
          label="Rehacer todo, incluso los que ya tienen mesa"
          checked={reassignAll}
          onChange={(e) => setReassignAll(e.target.checked)}
        />

        <p className="text-sm">
          {plan.moves.length === 0
            ? 'No hay nada que mover: todos están en una mesa de su grupo.'
            : `${plural(plan.moves.length, 'invitado cambia', 'invitados cambian')} de mesa · ${plural(used.length, 'mesa usada', 'mesas usadas')} de ${tables.length}`}
        </p>

        {plan.unseated.length > 0 && (
          <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <AlertTriangle className="size-4 shrink-0 translate-y-0.5" />
            <span>
              {plural(plan.unseated.length, 'invitación queda', 'invitaciones quedan')} sin mesa porque no cabe con su
              grupo: {plan.unseated.map((g) => g.name).join(', ')}. Crea más mesas o súbeles la capacidad.
            </span>
          </div>
        )}

        <ul className="max-h-72 divide-y divide-line overflow-y-auto rounded-xl border border-line text-sm">
          {used.map((t) => (
            <li key={t.table.id} className="px-4 py-2.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-medium">
                  Mesa {t.table.number}
                  {t.table.name && <span className="font-normal text-muted"> · {t.table.name}</span>}
                </span>
                <span className="shrink-0 text-xs text-muted tabular-nums">
                  {t.used}/{t.table.capacity}
                  {t.group && ` · ${guestGroup[t.group]}`}
                </span>
              </div>
              <p className="text-xs text-muted">
                {t.guests
                  .map((g) => {
                    const extra = seatsFor(g) - 1
                    return extra > 0 ? `${g.name} +${extra}` : g.name
                  })
                  .join(', ')}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  )
}
