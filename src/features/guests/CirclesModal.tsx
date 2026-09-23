import { useState } from 'react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { Sparkles } from 'lucide-react'
import { tableKey } from '../../lib/crud'
import { attemptLoud } from '../../lib/attempt'
import { updateGuests } from '../../lib/guestBulk'
import { suggestCircles } from '../../lib/circles'
import { guestGroup } from '../../lib/labels'
import { formatDate, plural } from '../../lib/format'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import type { Guest } from '../../types/database'

/** Propone círculos según cómo se cargó la lista: solo hay que ponerles nombre */
export function CirclesModal({ guests, onClose }: { guests: Guest[]; onClose: () => void }) {
  const qc = useQueryClient()
  const suggestions = suggestCircles(guests)
  const [names, setNames] = useState<Record<string, string>>(() =>
    Object.fromEntries(suggestions.map((s) => [s.key, s.suggestion])),
  )
  const [saving, setSaving] = useState<string | null>(null)
  const [done, setDone] = useState<string[]>([])

  const apply = async (key: string, ids: string[]) => {
    const circle = (names[key] ?? '').trim()
    if (!circle) return
    setSaving(key)
    const ok = await attemptLoud(updateGuests(ids, { circle }))
    setSaving(null)
    await qc.invalidateQueries({ queryKey: tableKey('guests') })
    if (!ok) return
    setDone((prev) => [...prev, key])
    toast.success(`${plural(ids.length, 'invitado quedó', 'invitados quedaron')} en "${circle}"`)
  }

  const pending = suggestions.filter((s) => !done.includes(s.key))

  return (
    <Modal
      open
      size="lg"
      onClose={onClose}
      title="Círculos sugeridos"
      description="Los que agregaste seguidos y del mismo grupo suelen conocerse. Ponles nombre y quedan listos."
      footer={
        <Button variant="secondary" onClick={onClose}>
          Listo
        </Button>
      }
    >
      {pending.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">
          {suggestions.length === 0
            ? 'No hay tandas para sugerir. Puedes marcar invitados en la lista y asignarles el círculo a mano.'
            : 'Ya les pusiste nombre a todas las tandas.'}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {pending.map((s) => (
            <li key={s.key} className="rounded-xl border border-line p-3">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium">
                  <Sparkles className="-mt-0.5 mr-1 inline size-3.5 text-accent-400" />
                  {plural(s.guests.length, 'invitado', 'invitados')} · {guestGroup[s.group]}
                </span>
                <span className="shrink-0 text-xs text-muted">agregados el {formatDate(s.addedAt)}</span>
              </div>
              <p className="mt-1 line-clamp-2 text-xs text-muted">{s.guests.map((g) => g.name).join(', ')}</p>
              <div className="mt-2 flex gap-2">
                <Input
                  aria-label={`Nombre del círculo de ${s.guests.length} invitados`}
                  className="h-9"
                  placeholder="Primos de Ángela, Universidad, Trabajo…"
                  maxLength={60}
                  value={names[s.key] ?? ''}
                  onChange={(e) => setNames((prev) => ({ ...prev, [s.key]: e.target.value }))}
                />
                <Button
                  size="sm"
                  disabled={!(names[s.key] ?? '').trim() || saving === s.key}
                  onClick={() => apply(s.key, s.guests.map((g) => g.id))}
                >
                  {saving === s.key ? 'Guardando…' : 'Aplicar'}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}
