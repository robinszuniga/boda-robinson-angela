import { useState } from 'react'
import { AlertTriangle, Link2, Trash2 } from 'lucide-react'
import { guestLinksApi } from '../../lib/api'
import { attempt } from '../../lib/attempt'
import { linkKind, options } from '../../lib/labels'
import type { LinkConflict } from '../../lib/seating'
import { Button, IconButton } from '../../components/ui/Button'
import { Card, CardHeader } from '../../components/ui/Display'
import { Select } from '../../components/ui/Field'
import type { Guest, GuestLink, LinkKind } from '../../types/database'

export function LinksPanel({
  guests,
  links,
  conflicts,
}: {
  guests: Guest[]
  links: GuestLink[]
  conflicts: LinkConflict[]
}) {
  const create = guestLinksApi.useCreate()
  const remove = guestLinksApi.useRemove()
  const [a, setA] = useState('')
  const [b, setB] = useState('')
  const [kind, setKind] = useState<LinkKind>('juntos')

  const byId = new Map(guests.map((g) => [g.id, g]))
  const conflictIds = new Set(conflicts.map((c) => c.link.id))
  const sorted = [...guests].sort((x, y) => x.name.localeCompare(y.name, 'es'))

  const add = async () => {
    if (!a || !b || a === b) return
    if (await attempt(create.mutateAsync({ guest_a: a, guest_b: b, kind }))) {
      setA('')
      setB('')
    }
  }

  return (
    <Card>
      <CardHeader title="Vínculos" subtitle="Quiénes deben sentarse juntos o separados" />
      <div className="flex flex-col gap-3 px-4 pb-4">
        {conflicts.length > 0 && (
          <ul className="flex flex-col gap-1 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-800" role="alert">
            {conflicts.map((c) => (
              <li key={c.link.id} className="flex gap-1.5">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                {c.message}
              </li>
            ))}
          </ul>
        )}

        {links.length > 0 && (
          <ul className="flex flex-col divide-y divide-line text-sm">
            {links.map((l) => {
              const ga = byId.get(l.guest_a)
              const gb = byId.get(l.guest_b)
              if (!ga || !gb) return null
              return (
                <li key={l.id} className="flex items-center gap-2 py-1.5">
                  <Link2 className={`size-3.5 shrink-0 ${conflictIds.has(l.id) ? 'text-red-600' : 'text-brand-500'}`} />
                  <span className="min-w-0 flex-1 truncate">
                    {ga.name} <span className="text-muted">{l.kind === 'juntos' ? '+' : '≠'}</span> {gb.name}
                  </span>
                  <IconButton label="Quitar vínculo" onClick={() => remove.mutate(l.id)}>
                    <Trash2 className="size-3.5" />
                  </IconButton>
                </li>
              )
            })}
          </ul>
        )}

        <div className="flex flex-col gap-2 border-t border-line pt-3">
          <Select aria-label="Primer invitado" value={a} onChange={(e) => setA(e.target.value)}>
            <option value="">Invitado…</option>
            {sorted.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </Select>
          <Select aria-label="Tipo de vínculo" value={kind} onChange={(e) => setKind(e.target.value as LinkKind)}>
            {options(linkKind).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          <Select aria-label="Segundo invitado" value={b} onChange={(e) => setB(e.target.value)}>
            <option value="">con…</option>
            {sorted
              .filter((g) => g.id !== a)
              .map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
          </Select>
          <Button size="sm" variant="secondary" disabled={!a || !b || create.isPending} onClick={add}>
            Agregar vínculo
          </Button>
        </div>
      </div>
    </Card>
  )
}
