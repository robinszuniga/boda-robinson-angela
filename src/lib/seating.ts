import type { Guest, GuestLink, SeatingTable } from '../types/database'

export type TableStatus = 'vacia' | 'incompleta' | 'completa' | 'sobrecupo'

/**
 * Puestos que ocupa un invitado. Si ya confirmó se usan sus acompañantes confirmados;
 * si está pendiente se reserva el máximo permitido. Los que rechazaron no ocupan.
 */
export function seatsFor(guest: Guest): number {
  if (guest.rsvp_status === 'rechazado') return 0
  const companions =
    guest.rsvp_status === 'confirmado' ? guest.plus_ones_confirmed : guest.plus_ones_allowed
  return 1 + companions
}

export interface TableOccupancy {
  table: SeatingTable
  guests: Guest[]
  used: number
  free: number
  status: TableStatus
}

export function tableStatus(used: number, capacity: number): TableStatus {
  if (used === 0) return 'vacia'
  if (used > capacity) return 'sobrecupo'
  if (used === capacity) return 'completa'
  return 'incompleta'
}

export function occupancy(tables: SeatingTable[], guests: Guest[]): TableOccupancy[] {
  return [...tables]
    .sort((a, b) => a.number - b.number)
    .map((table) => {
      const seated = guests.filter((g) => g.table_id === table.id && g.rsvp_status !== 'rechazado')
      const used = seated.reduce((s, g) => s + seatsFor(g), 0)
      return {
        table,
        guests: seated,
        used,
        free: table.capacity - used,
        status: tableStatus(used, table.capacity),
      }
    })
}

export interface LinkConflict {
  link: GuestLink
  a: Guest
  b: Guest
  message: string
}

/** Vínculos que no se cumplen con la distribución actual */
export function linkConflicts(links: GuestLink[], guests: Guest[]): LinkConflict[] {
  const byId = new Map(guests.map((g) => [g.id, g]))
  const conflicts: LinkConflict[] = []
  for (const link of links) {
    const a = byId.get(link.guest_a)
    const b = byId.get(link.guest_b)
    if (!a || !b) continue
    if (a.rsvp_status === 'rechazado' || b.rsvp_status === 'rechazado') continue
    if (link.kind === 'juntos' && a.table_id && b.table_id && a.table_id !== b.table_id) {
      conflicts.push({ link, a, b, message: `${a.name} y ${b.name} deberían sentarse juntos` })
    }
    if (link.kind === 'separados' && a.table_id && a.table_id === b.table_id) {
      conflicts.push({ link, a, b, message: `${a.name} y ${b.name} deberían estar en mesas distintas` })
    }
  }
  return conflicts
}

export interface Headcount {
  invitations: number
  confirmedGuests: number
  pendingGuests: number
  declinedGuests: number
  /** Personas confirmadas (invitado + acompañantes confirmados) */
  confirmedPeople: number
  /** Personas que aún podrían venir (pendientes con su máximo de acompañantes) */
  pendingPeople: number
  /** Máximo posible: confirmados + pendientes */
  expectedPeople: number
}

export function headcount(guests: Guest[]): Headcount {
  const confirmed = guests.filter((g) => g.rsvp_status === 'confirmado')
  const pending = guests.filter((g) => g.rsvp_status === 'pendiente')
  const confirmedPeople = confirmed.reduce((s, g) => s + seatsFor(g), 0)
  const pendingPeople = pending.reduce((s, g) => s + seatsFor(g), 0)
  return {
    invitations: guests.length,
    confirmedGuests: confirmed.length,
    pendingGuests: pending.length,
    declinedGuests: guests.length - confirmed.length - pending.length,
    confirmedPeople,
    pendingPeople,
    expectedPeople: confirmedPeople + pendingPeople,
  }
}
