import { useState } from 'react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Search } from 'lucide-react'
import { tableKey } from '../../lib/crud'
import { attemptLoud } from '../../lib/attempt'
import { updateGuestsEach } from '../../lib/guestBulk'
import { seatsFor, type TableOccupancy } from '../../lib/seating'
import { guestGroup } from '../../lib/labels'
import { plural } from '../../lib/format'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { cn } from '../../components/ui/cn'
import type { Guest, GuestGroup, GuestMember, SeatingTable } from '../../types/database'

const GROUP_ORDER: GuestGroup[] = ['familia_novio', 'familia_novia', 'amigos', 'trabajo', 'otros']

const byGroupCircleName = (a: Guest, b: Guest) =>
  GROUP_ORDER.indexOf(a.guest_group) - GROUP_ORDER.indexOf(b.guest_group) ||
  (a.circle ?? '').localeCompare(b.circle ?? '', 'es') ||
  a.name.localeCompare(b.name, 'es')

/**
 * Sentar a varios invitados en una mesa de una vez. Muestra a los que no tienen
 * mesa; al buscar un nombre aparecen también los que ya están en otra (y se cambian).
 */
export function SeatGuestsModal({
  occ,
  guests,
  members,
  tables,
  onClose,
}: {
  occ: TableOccupancy
  /** Invitados que asisten o no han respondido */
  guests: Guest[]
  members: GuestMember[]
  tables: SeatingTable[]
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [term, setTerm] = useState('')
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  const tableNumber = new Map(tables.map((t) => [t.id, t.number]))
  const q = term.trim().toLowerCase()
  const matches = (g: Guest) => !q || g.name.toLowerCase().includes(q) || (g.circle ?? '').toLowerCase().includes(q)
  const candidates = guests.filter((g) => g.table_id !== occ.table.id && matches(g)).sort(byGroupCircleName)
  const withoutTable = candidates.filter((g) => !g.table_id || !tableNumber.has(g.table_id))
  const elsewhere = q ? candidates.filter((g) => g.table_id && tableNumber.has(g.table_id)) : []

  const chosen = guests.filter((g) => picked.has(g.id))
  const seats = chosen.reduce((sum, g) => sum + seatsFor(g, members), 0)
  const free = Math.max(0, occ.free)
  const over = seats - free

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const save = async () => {
    const before = chosen.map((g) => ({ id: g.id, values: { table_id: g.table_id } }))
    const after = chosen.map((g) => ({ id: g.id, values: { table_id: occ.table.id } }))
    setSaving(true)
    const ok = await attemptLoud(updateGuestsEach(after))
    setSaving(false)
    await qc.invalidateQueries({ queryKey: tableKey('guests') })
    if (!ok) return
    toast.success(`${plural(chosen.length, 'invitado sentado', 'invitados sentados')} en la mesa ${occ.table.number}`, {
      action: {
        label: 'Deshacer',
        onClick: async () => {
          if (await attemptLoud(updateGuestsEach(before))) toast.success('Volvieron a donde estaban')
          await qc.invalidateQueries({ queryKey: tableKey('guests') })
        },
      },
      duration: 10000,
    })
    onClose()
  }

  const row = (g: Guest) => {
    const extra = seatsFor(g, members) - 1
    const current = g.table_id ? tableNumber.get(g.table_id) : undefined
    return (
      <li key={g.id}>
        <label className="flex cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-brand-50/60">
          <input
            type="checkbox"
            className="size-5 shrink-0 rounded accent-brand-600"
            checked={picked.has(g.id)}
            onChange={() => toggle(g.id)}
          />
          <span
            className={cn(
              'size-2.5 shrink-0 rounded-full',
              g.rsvp_status === 'confirmado' ? 'bg-emerald-500' : 'bg-amber-400',
            )}
            title={g.rsvp_status === 'confirmado' ? 'Confirmado' : 'Sin confirmar'}
          />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">
              {g.name}
              {extra > 0 && <span className="font-normal text-muted"> +{extra}</span>}
            </span>
            <span className="block truncate text-xs text-muted">
              {g.circle ?? guestGroup[g.guest_group]}
              {current !== undefined && ` · ahora en la mesa ${current}`}
            </span>
          </span>
        </label>
      </li>
    )
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Sentar en la mesa ${occ.table.number}`}
      description={
        occ.free > 0
          ? `Quedan ${plural(occ.free, 'puesto libre', 'puestos libres')}.`
          : occ.free === 0
            ? 'La mesa está completa.'
            : `La mesa ya tiene ${plural(-occ.free, 'persona', 'personas')} de más.`
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={chosen.length === 0 || saving}>
            {saving ? 'Sentando…' : chosen.length === 0 ? 'Sentar' : `Sentar ${plural(seats, 'persona', 'personas')}`}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          <Input
            aria-label="Buscar invitado"
            placeholder="Buscar por nombre o círculo…"
            className="pl-9"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
          />
        </div>

        {over > 0 && (
          <p className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <AlertTriangle className="size-4 shrink-0 translate-y-0.5" />
            La mesa quedaría con {plural(over, 'persona', 'personas')} de más.
          </p>
        )}

        <div className="max-h-[50dvh] overflow-y-auto rounded-xl border border-line text-sm">
          {withoutTable.length === 0 && elsewhere.length === 0 ? (
            <p className="px-4 py-6 text-center text-muted">
              {q ? 'Nadie coincide con esa búsqueda.' : 'Todos tienen mesa. Busca un nombre para cambiarlo de mesa.'}
            </p>
          ) : (
            <>
              {withoutTable.length > 0 && (
                <>
                  <h3 className="sticky top-0 z-10 border-b border-line bg-stone-50 px-4 py-1.5 font-sans text-xs font-medium text-muted">
                    Sin mesa
                  </h3>
                  <ul className="divide-y divide-line">{withoutTable.map(row)}</ul>
                </>
              )}
              {elsewhere.length > 0 && (
                <>
                  <h3 className="sticky top-0 z-10 border-y border-line bg-stone-50 px-4 py-1.5 font-sans text-xs font-medium text-muted">
                    Ya tienen otra mesa (se cambian a esta)
                  </h3>
                  <ul className="divide-y divide-line">{elsewhere.map(row)}</ul>
                </>
              )}
            </>
          )}
        </div>
        {!q && withoutTable.length > 0 && (
          <p className="text-xs text-muted">Para cambiar de mesa a alguien que ya tiene una, búscalo por su nombre.</p>
        )}
      </div>
    </Modal>
  )
}
