import type { Guest, GuestMember, SeatingTable } from '../types/database'
import { confirmedByAge, type AgeCount } from './ages'
import { headcount, seatsFor } from './seating'

export interface PersonAtTable {
  name: string
  table: number | null
}

export interface CoordinatorGuests {
  confirmedPeople: number
  ages: AgeCount
  pendingInvitations: number
  /** Restricciones alimentarias de los que van (invitados y acompañantes con nombre) */
  dietary: (PersonAtTable & { dietary: string })[]
  /** Adultos mayores que van, para ayudarlos y ubicarlos */
  seniors: PersonAtTable[]
  /** Invitaciones confirmadas que pidieron transporte, con cuántas personas son */
  transport: { name: string; people: number }[]
}

const byTableThenName = (a: PersonAtTable, b: PersonAtTable) =>
  (a.table ?? Infinity) - (b.table ?? Infinity) || a.name.localeCompare(b.name, 'es')

/** Resumen de invitados confirmados para la hoja del coordinador del día */
export function coordinatorGuests(guests: Guest[], members: GuestMember[], tables: SeatingTable[]): CoordinatorGuests {
  const tableNumber = new Map(tables.map((t) => [t.id, t.number]))
  const confirmed = guests.filter((g) => g.rsvp_status === 'confirmado')
  const dietary: CoordinatorGuests['dietary'] = []
  const seniors: PersonAtTable[] = []

  for (const g of confirmed) {
    const table = (g.table_id && tableNumber.get(g.table_id)) || null
    if (g.dietary) dietary.push({ name: g.name, table, dietary: g.dietary })
    if (g.age_group === 'mayor') seniors.push({ name: g.name, table })
    for (const m of members) {
      if (m.guest_id !== g.id || m.attending === false) continue
      // Un acompañante puede estar sentado en otra mesa
      const suya = m.table_id ? (tableNumber.get(m.table_id) ?? null) : table
      if (m.dietary) dietary.push({ name: m.name, table: suya, dietary: m.dietary })
      if (m.age_group === 'mayor') seniors.push({ name: m.name, table: suya })
    }
  }

  return {
    confirmedPeople: headcount(guests).confirmedPeople,
    ages: confirmedByAge(guests, members),
    pendingInvitations: guests.filter((g) => g.rsvp_status === 'pendiente').length,
    dietary: dietary.sort(byTableThenName),
    seniors: seniors.sort(byTableThenName),
    transport: confirmed
      .filter((g) => g.needs_transport)
      .map((g) => ({ name: g.name, people: seatsFor(g) }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es')),
  }
}
