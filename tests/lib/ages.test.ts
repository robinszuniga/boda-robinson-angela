import { describe, expect, it } from 'vitest'
import { ageSummary, confirmedByAge, partyAges } from '../../src/lib/ages'
import { headcount } from '../../src/lib/seating'
import { guest, member } from './factories'

describe('partyAges', () => {
  it('cuenta al invitado y a los acompañantes con nombre que no dijeron que no van', () => {
    const g = guest({ age_group: 'mayor' })
    const members = [
      member({ guest_id: g.id, name: 'Tomás', age_group: 'nino' }),
      member({ guest_id: g.id, name: 'Sara', age_group: 'nino', attending: false }),
      member({ guest_id: 'otro', name: 'Ajeno', age_group: 'nino' }),
    ]
    expect(partyAges(g, members)).toEqual({ adulto: 0, nino: 1, mayor: 1 })
  })
})

describe('confirmedByAge', () => {
  it('solo cuenta confirmados; los acompañantes sin nombre son adultos y el total cuadra', () => {
    const familia = guest({ rsvp_status: 'confirmado', plus_ones_allowed: 3, plus_ones_confirmed: 2 })
    const abuela = guest({ rsvp_status: 'confirmado', age_group: 'mayor', plus_ones_allowed: 1, plus_ones_confirmed: 1 })
    const pendiente = guest({ age_group: 'nino', plus_ones_allowed: 2 })
    const rechazo = guest({ rsvp_status: 'rechazado', age_group: 'mayor' })
    const members = [
      member({ guest_id: familia.id, name: 'Tomás', age_group: 'nino', attending: true }),
      member({ guest_id: familia.id, name: 'Sara', age_group: 'nino', attending: true }),
      member({ guest_id: familia.id, name: 'Luis', attending: false }),
    ]
    const guests = [familia, abuela, pendiente, rechazo]
    const count = confirmedByAge(guests, members)
    expect(count).toEqual({ adulto: 2, nino: 2, mayor: 1 })
    expect(count.adulto + count.nino + count.mayor).toBe(headcount(guests).confirmedPeople)
  })

  it('no cuenta más acompañantes con nombre que los confirmados', () => {
    const g = guest({ rsvp_status: 'confirmado', plus_ones_allowed: 2, plus_ones_confirmed: 1 })
    const members = [
      member({ guest_id: g.id, name: 'Tomás', age_group: 'nino' }),
      member({ guest_id: g.id, name: 'Sara', age_group: 'nino' }),
    ]
    expect(confirmedByAge([g], members)).toEqual({ adulto: 1, nino: 1, mayor: 0 })
  })
})

describe('ageSummary', () => {
  it('menciona solo niños y adultos mayores, en singular o plural', () => {
    expect(ageSummary({ adulto: 5, nino: 0, mayor: 0 })).toBe('')
    expect(ageSummary({ adulto: 5, nino: 1, mayor: 0 })).toBe('1 niño(a)')
    expect(ageSummary({ adulto: 0, nino: 2, mayor: 1 })).toBe('2 niños · 1 adulto mayor')
    expect(ageSummary({ adulto: 0, nino: 0, mayor: 3 })).toBe('3 adultos mayores')
  })
})
