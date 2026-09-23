import { useState } from 'react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { tableKey } from '../../lib/crud'
import { attemptLoud } from '../../lib/attempt'
import { plural } from '../../lib/format'
import { Button } from '../../components/ui/Button'
import { Checkbox } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { useConfirm } from '../../components/ui/Confirm'
import type { TableOccupancy } from '../../lib/seating'

/** Elegir varias mesas y borrarlas de una vez */
export function DeleteTablesModal({ tables, onClose }: { tables: TableOccupancy[]; onClose: () => void }) {
  const qc = useQueryClient()
  const confirm = useConfirm()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)

  const all = selected.size === tables.length && tables.length > 0
  const seated = tables
    .filter((t) => selected.has(t.table.id))
    .reduce((sum, t) => sum + t.guests.length, 0)

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const remove = async () => {
    const ids = [...selected]
    const ok = await confirm({
      title: `¿Borrar ${plural(ids.length, 'mesa', 'mesas')}?`,
      message:
        seated > 0
          ? `${plural(seated, 'invitación queda', 'invitaciones quedan')} sin mesa. No se borra ningún invitado.`
          : 'Están vacías, así que no se pierde nada más.',
      confirmLabel: 'Borrar',
      danger: true,
    })
    if (!ok) return
    setDeleting(true)
    const done = await attemptLoud(
      (async () => {
        const { error } = await supabase.from('seating_tables').delete().in('id', ids)
        if (error) throw error
      })(),
    )
    setDeleting(false)
    await Promise.all([
      qc.invalidateQueries({ queryKey: tableKey('seating_tables') }),
      qc.invalidateQueries({ queryKey: tableKey('guests') }),
    ])
    if (!done) return
    toast.success(`${plural(ids.length, 'mesa borrada', 'mesas borradas')}`)
    onClose()
  }

  return (
    <Modal
      open
      size="lg"
      onClose={onClose}
      title="Borrar mesas"
      description="Los invitados de esas mesas quedan sin mesa. No se borra ningún invitado."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            className="bg-red-700 hover:bg-red-800"
            icon={<Trash2 className="size-4" />}
            disabled={selected.size === 0 || deleting}
            onClick={remove}
          >
            {deleting ? 'Borrando…' : `Borrar ${selected.size || ''}`}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Checkbox
          label={all ? 'Quitar la selección' : `Elegir todas las mesas (${tables.length})`}
          checked={all}
          onChange={() => setSelected(all ? new Set() : new Set(tables.map((t) => t.table.id)))}
        />
        <ul className="max-h-72 divide-y divide-line overflow-y-auto rounded-xl border border-line">
          {tables.map((t) => (
            <li key={t.table.id}>
              <label className="flex cursor-pointer items-center gap-3 px-4 py-2.5 text-sm hover:bg-ivory">
                <input
                  type="checkbox"
                  className="size-4 accent-brand-600"
                  checked={selected.has(t.table.id)}
                  onChange={() => toggle(t.table.id)}
                />
                <span className="min-w-0 flex-1">
                  Mesa {t.table.number}
                  {t.table.name && <span className="text-muted"> · {t.table.name}</span>}
                </span>
                <span className="shrink-0 text-xs text-muted tabular-nums">
                  {t.guests.length === 0
                    ? 'vacía'
                    : `${plural(t.guests.length, 'invitación', 'invitaciones')} · ${t.used} ${t.used === 1 ? 'puesto' : 'puestos'}`}
                </span>
              </label>
            </li>
          ))}
        </ul>
        {seated > 0 && (
          <p className="text-xs text-amber-700">
            {plural(seated, 'invitación va a quedar', 'invitaciones van a quedar')} sin mesa.
          </p>
        )}
      </div>
    </Modal>
  )
}
