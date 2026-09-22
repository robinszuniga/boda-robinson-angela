import type { Guest, GuestGroup } from '../types/database'

export interface CircleSuggestion {
  key: string
  guests: Guest[]
  group: GuestGroup
  /** Cuándo se agregó el primero del lote */
  addedAt: string
  /** Nombre propuesto: "Familia Ruiz" si varios comparten apellido */
  suggestion: string
}

const surname = (name: string) => {
  const parts = name.trim().split(/\s+/)
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : null
}

/** "Familia Ruiz" si al menos dos del lote comparten apellido */
function proposeName(guests: Guest[]): string {
  const counts = new Map<string, { label: string; n: number }>()
  for (const g of guests) {
    const key = surname(g.name)
    if (!key) continue
    const label = g.name.trim().split(/\s+/).at(-1)!
    counts.set(key, { label, n: (counts.get(key)?.n ?? 0) + 1 })
  }
  const best = [...counts.values()].sort((a, b) => b.n - a.n)[0]
  return best && best.n >= 2 ? `Familia ${best.label}` : ''
}

/**
 * Propone círculos a partir de cómo se cargó la lista: los invitados del mismo
 * grupo que se agregaron seguidos (una tanda pegada) suelen conocerse entre sí.
 */
export function suggestCircles(guests: Guest[], windowMinutes = 10): CircleSuggestion[] {
  const pending = guests
    .filter((g) => !g.circle?.trim())
    // Al agregar varios de una vez todos quedan con la misma hora, así que
    // dentro del mismo momento se agrupan por grupo
    .sort(
      (a, b) =>
        a.created_at.localeCompare(b.created_at) ||
        a.guest_group.localeCompare(b.guest_group) ||
        a.name.localeCompare(b.name, 'es'),
    )

  const batches: Guest[][] = []
  for (const guest of pending) {
    const current = batches.at(-1)
    const last = current?.at(-1)
    const gap = last ? new Date(guest.created_at).getTime() - new Date(last.created_at).getTime() : Infinity
    if (current && last && last.guest_group === guest.guest_group && gap <= windowMinutes * 60_000) current.push(guest)
    else batches.push([guest])
  }

  return batches
    .filter((batch) => batch.length >= 2)
    .map((batch) => ({
      key: batch[0].id,
      guests: batch,
      group: batch[0].guest_group,
      addedAt: batch[0].created_at,
      suggestion: proposeName(batch),
    }))
    .sort((a, b) => b.guests.length - a.guests.length || a.addedAt.localeCompare(b.addedAt))
}
