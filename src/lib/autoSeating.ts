import type { Guest, GuestGroup, GuestLink, SeatingTable } from '../types/database'
import { seatsFor } from './seating'

/** Orden en que se van llenando las mesas */
const GROUP_ORDER: GuestGroup[] = ['familia_novio', 'familia_novia', 'amigos', 'trabajo', 'otros']

export interface PlannedTable {
  table: SeatingTable
  guests: Guest[]
  used: number
  /** Grupo que ocupa la mesa, null si está vacía */
  group: GuestGroup | null
}

export interface SeatingPlan {
  /** Invitados que cambian de mesa */
  moves: { guest: Guest; tableId: string }[]
  tables: PlannedTable[]
  /** No cupieron en ninguna mesa de su grupo */
  unseated: Guest[]
}

/** Invitaciones que deben sentarse juntas, unidas por los vínculos "juntos" */
function clusters(guests: Guest[], links: GuestLink[]): Guest[][] {
  const parent = new Map<string, string>(guests.map((g) => [g.id, g.id]))
  const find = (id: string): string => {
    const up = parent.get(id)
    if (!up || up === id) return id
    const root = find(up)
    parent.set(id, root)
    return root
  }
  for (const link of links) {
    if (link.kind !== 'juntos') continue
    const a = parent.has(link.guest_a) ? find(link.guest_a) : null
    const b = parent.has(link.guest_b) ? find(link.guest_b) : null
    if (a && b && a !== b) parent.set(a, b)
  }
  const groups = new Map<string, Guest[]>()
  for (const g of guests) {
    const root = find(g.id)
    groups.set(root, [...(groups.get(root) ?? []), g])
  }
  return [...groups.values()]
}

function apartMap(links: GuestLink[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>()
  const add = (a: string, b: string) => map.set(a, (map.get(a) ?? new Set()).add(b))
  for (const link of links) {
    if (link.kind !== 'separados') continue
    add(link.guest_a, link.guest_b)
    add(link.guest_b, link.guest_a)
  }
  return map
}

/**
 * Reparte a los invitados por grupo: cada mesa queda con un solo grupo y las
 * invitaciones no se separan. Respeta los vínculos "juntos" y "separados" y,
 * si no se pide rehacer todo, deja donde están a los que ya tienen mesa.
 */
export function planSeatingByGroup(
  tables: SeatingTable[],
  guests: Guest[],
  links: GuestLink[],
  options: { reassignAll?: boolean } = {},
): SeatingPlan {
  const attending = guests.filter((g) => g.rsvp_status !== 'rechazado')
  const tableIds = new Set(tables.map((t) => t.id))
  const sortedTables = [...tables].sort((a, b) => a.number - b.number)

  const planned = new Map<string, PlannedTable>(
    sortedTables.map((table) => [table.id, { table, guests: [], used: 0, group: null }]),
  )
  const seatAt = (tableId: string, group: Guest[]) => {
    const target = planned.get(tableId)!
    target.guests.push(...group)
    target.used += group.reduce((s, g) => s + seatsFor(g), 0)
    target.group = group[0].guest_group
  }

  // Los que ya tienen mesa se quedan donde están (salvo que se rehaga todo)
  const fixed = options.reassignAll ? [] : attending.filter((g) => g.table_id && tableIds.has(g.table_id))
  for (const g of fixed) seatAt(g.table_id!, [g])
  // Una mesa con invitados de varios grupos se deja quieta
  for (const t of planned.values()) {
    if (t.guests.length > 0 && new Set(t.guests.map((g) => g.guest_group)).size > 1) t.group = null
  }

  const fixedIds = new Set(fixed.map((g) => g.id))
  const pending = attending.filter((g) => !fixedIds.has(g.id))
  const apart = apartMap(links)
  const unseated: Guest[] = []

  const groupsOf = (list: Guest[]) => [...new Set(list.map((g) => g.guest_group))]
  const byGroup = GROUP_ORDER.filter((group) => pending.some((g) => g.guest_group === group))

  for (const group of byGroup) {
    const members = pending.filter((g) => g.guest_group === group)
    const parties = clusters(members, links)
      .map((party) => ({ party, seats: party.reduce((s, g) => s + seatsFor(g), 0) }))
      .sort((a, b) => b.seats - a.seats || a.party[0].name.localeCompare(b.party[0].name, 'es'))

    for (const { party, seats } of parties) {
      const forbidden = new Set(party.flatMap((g) => [...(apart.get(g.id) ?? [])]))
      // Primero se terminan de llenar las mesas que ya tienen gente de este grupo
      const started = sortedTables.filter((table) => {
        const t = planned.get(table.id)!
        return t.guests.length > 0 && t.group === group && groupsOf(t.guests).length === 1
      })
      const empty = sortedTables.filter((table) => planned.get(table.id)!.guests.length === 0)
      const target = [...started, ...empty].find((table) => {
        const t = planned.get(table.id)!
        return table.capacity - t.used >= seats && !t.guests.some((g) => forbidden.has(g.id))
      })
      if (target) seatAt(target.id, party)
      else unseated.push(...party)
    }
  }

  const moves = [...planned.values()].flatMap((t) =>
    t.guests.filter((g) => g.table_id !== t.table.id).map((guest) => ({ guest, tableId: t.table.id })),
  )

  return { moves, tables: [...planned.values()], unseated }
}
