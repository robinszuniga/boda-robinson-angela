import type { AgeGroup, Guest, GuestMember } from '../types/database'
import { plural } from './format'

export type AgeCount = Record<AgeGroup, number>

const empty = (): AgeCount => ({ adulto: 0, nino: 0, mayor: 0 })

function membersByGuest(members: GuestMember[]): Map<string, GuestMember[]> {
  const map = new Map<string, GuestMember[]>()
  for (const m of members) map.set(m.guest_id, [...(map.get(m.guest_id) ?? []), m])
  return map
}

/** Edades de una invitación: el invitado y sus acompañantes con nombre que no dijeron que no van */
export function partyAges(guest: Guest, members: GuestMember[]): AgeCount {
  const count = empty()
  count[guest.age_group]++
  for (const m of members) {
    if (m.guest_id === guest.id && m.attending !== false) count[m.age_group]++
  }
  return count
}

/**
 * Personas confirmadas por edad. Los acompañantes sin nombre cuentan como adultos
 * porque no se sabe su edad; el total coincide con las personas confirmadas.
 */
export function confirmedByAge(guests: Guest[], members: GuestMember[]): AgeCount {
  const count = empty()
  const byGuest = membersByGuest(members)
  for (const g of guests) {
    if (g.rsvp_status !== 'confirmado') continue
    count[g.age_group]++
    const going = (byGuest.get(g.id) ?? []).filter((m) => m.attending !== false).slice(0, g.plus_ones_confirmed)
    for (const m of going) count[m.age_group]++
    count.adulto += g.plus_ones_confirmed - going.length
  }
  return count
}

/** "2 niños · 1 adulto mayor" (los adultos no se mencionan) */
export function ageSummary(count: AgeCount): string {
  return [
    count.nino > 0 && plural(count.nino, 'niño(a)', 'niños'),
    count.mayor > 0 && plural(count.mayor, 'adulto mayor', 'adultos mayores'),
  ]
    .filter(Boolean)
    .join(' · ')
}
