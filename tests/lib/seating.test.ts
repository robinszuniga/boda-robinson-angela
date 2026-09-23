import { describe, expect, it } from 'vitest'
import { headcount, linkConflicts, membersApart, occupancy, seatsFor, tableStatus } from '../../src/lib/seating'
import { guest, link, member, table } from './factories'

describe('seatsFor', () => {
  it('pendiente reserva el máximo, confirmado usa lo confirmado, rechazado no ocupa', () => {
    expect(seatsFor(guest({ plus_ones_allowed: 2 }))).toBe(3)
    expect(seatsFor(guest({ rsvp_status: 'confirmado', plus_ones_allowed: 2, plus_ones_confirmed: 1 }))).toBe(2)
    expect(seatsFor(guest({ rsvp_status: 'rechazado', plus_ones_allowed: 2 }))).toBe(0)
  })
})

describe('tableStatus', () => {
  it('clasifica la ocupación', () => {
    expect(tableStatus(0, 10)).toBe('vacia')
    expect(tableStatus(4, 10)).toBe('incompleta')
    expect(tableStatus(10, 10)).toBe('completa')
    expect(tableStatus(11, 10)).toBe('sobrecupo')
  })
})

describe('occupancy', () => {
  it('suma puestos por mesa, ignora rechazados y ordena por número', () => {
    const t2 = table({ number: 2, capacity: 4 })
    const t1 = table({ number: 1, capacity: 2 })
    const result = occupancy(
      [t2, t1],
      [
        guest({ table_id: t2.id, plus_ones_allowed: 1 }),
        guest({ table_id: t2.id, rsvp_status: 'confirmado' }),
        guest({ table_id: t2.id, rsvp_status: 'rechazado' }),
        guest({ table_id: t1.id, rsvp_status: 'confirmado', plus_ones_allowed: 2, plus_ones_confirmed: 2 }),
      ],
    )
    expect(result.map((r) => r.table.number)).toEqual([1, 2])
    expect(result[0]).toMatchObject({ used: 3, free: -1, status: 'sobrecupo' })
    expect(result[1]).toMatchObject({ used: 3, free: 1, status: 'incompleta' })
    expect(result[1].guests).toHaveLength(2)
  })
})

describe('linkConflicts', () => {
  it('detecta "juntos" en mesas distintas y "separados" en la misma mesa', () => {
    const [t1, t2] = [table(), table()]
    const a = guest({ name: 'Ana', table_id: t1.id })
    const b = guest({ name: 'Beto', table_id: t2.id })
    const c = guest({ name: 'Caro', table_id: t1.id })
    const d = guest({ name: 'Dani' })
    const conflicts = linkConflicts(
      [
        link({ guest_a: a.id, guest_b: b.id, kind: 'juntos' }),
        link({ guest_a: a.id, guest_b: c.id, kind: 'separados' }),
        link({ guest_a: a.id, guest_b: d.id, kind: 'juntos' }), // Dani sin mesa: aún no es conflicto
      ],
      [a, b, c, d],
    )
    expect(conflicts.map((x) => x.message)).toEqual([
      'Ana y Beto deberían sentarse juntos',
      'Ana y Caro deberían estar en mesas distintas',
    ])
  })

  it('ignora vínculos con invitados que no asisten', () => {
    const [t1, t2] = [table(), table()]
    const a = guest({ table_id: t1.id })
    const b = guest({ table_id: t2.id, rsvp_status: 'rechazado' })
    expect(linkConflicts([link({ guest_a: a.id, guest_b: b.id })], [a, b])).toEqual([])
  })
})

describe('headcount', () => {
  it('cuenta invitaciones y personas', () => {
    const h = headcount([
      guest({ rsvp_status: 'confirmado', plus_ones_allowed: 1, plus_ones_confirmed: 1 }),
      guest({ rsvp_status: 'pendiente', plus_ones_allowed: 2 }),
      guest({ rsvp_status: 'rechazado', plus_ones_allowed: 1 }),
    ])
    expect(h).toEqual({
      invitations: 3,
      invitedPeople: 7,
      invitedCompanions: 4,
      confirmedGuests: 1,
      pendingGuests: 1,
      declinedGuests: 1,
      confirmedPeople: 2,
      pendingPeople: 3,
      expectedPeople: 5,
    })
  })
})

describe('acompañantes sentados en otra mesa', () => {
  it('el invitado ocupa un puesto menos y el acompañante ocupa el suyo', () => {
    const t1 = table({ number: 1, capacity: 10 })
    const t2 = table({ number: 2, capacity: 10 })
    const abuela = guest({ name: 'Remedios', table_id: t1.id, plus_ones_allowed: 2 })
    const primos = [
      member({ guest_id: abuela.id, name: 'Vanessa', table_id: t2.id }),
      member({ guest_id: abuela.id, name: 'Martin', table_id: t2.id, sort_order: 1 }),
    ]
    expect(seatsFor(abuela, primos)).toBe(1)
    expect(membersApart(abuela, primos).map((m) => m.name)).toEqual(['Vanessa', 'Martin'])

    const [mesa1, mesa2] = occupancy([t1, t2], [abuela], primos)
    expect(mesa1.used).toBe(1)
    expect(mesa2.used).toBe(2)
    expect(mesa2.apart.map((m) => m.name)).toEqual(['Vanessa', 'Martin'])
    expect(mesa1.used + mesa2.used).toBe(3)
  })

  it('un acompañante en la misma mesa de su invitación no se cuenta dos veces', () => {
    const t1 = table({ number: 1, capacity: 10 })
    const g = guest({ table_id: t1.id, plus_ones_allowed: 1 })
    const m = member({ guest_id: g.id, name: 'Va junto', table_id: t1.id })
    const [mesa] = occupancy([t1], [g], [m])
    expect(mesa.used).toBe(2)
    expect(mesa.apart).toEqual([])
  })

  it('el que dijo que no va no ocupa puesto aunque tenga mesa propia', () => {
    const t1 = table({ number: 1, capacity: 10 })
    const t2 = table({ number: 2, capacity: 10 })
    const g = guest({ table_id: t1.id, rsvp_status: 'confirmado', plus_ones_allowed: 2, plus_ones_confirmed: 1 })
    const m = member({ guest_id: g.id, name: 'No va', table_id: t2.id, attending: false })
    const [mesa1, mesa2] = occupancy([t1, t2], [g], [m])
    expect(mesa1.used).toBe(2)
    expect(mesa2.used).toBe(0)
  })
})
