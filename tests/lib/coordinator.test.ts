import { describe, expect, it } from 'vitest'
import { coordinatorGuests } from '../../src/lib/coordinator'
import { guest, member, table } from './factories'

describe('coordinatorGuests', () => {
  it('resume a los confirmados: dietas, adultos mayores y transporte, por mesa', () => {
    const t1 = table({ number: 1 })
    const t5 = table({ number: 5 })
    const familia = guest({
      name: 'Familia Pérez',
      rsvp_status: 'confirmado',
      plus_ones_allowed: 2,
      plus_ones_confirmed: 1,
      table_id: t5.id,
      dietary: 'Sin gluten',
      needs_transport: true,
    })
    const abuela = guest({ name: 'Abuela Rosa', rsvp_status: 'confirmado', age_group: 'mayor', table_id: t1.id })
    const pendiente = guest({ name: 'Primo Juan', dietary: 'Vegano' })
    const members = [
      member({ guest_id: familia.id, name: 'Tomás', age_group: 'nino', attending: true, dietary: 'Menú infantil' }),
      member({ guest_id: familia.id, name: 'Abuelo Luis', age_group: 'mayor', attending: false, dietary: 'Sin sal' }),
    ]

    const info = coordinatorGuests([familia, abuela, pendiente], members, [t1, t5])

    expect(info.confirmedPeople).toBe(3)
    expect(info.ages).toEqual({ adulto: 1, nino: 1, mayor: 1 })
    expect(info.pendingInvitations).toBe(1)
    expect(info.dietary).toEqual([
      { name: 'Familia Pérez', table: 5, dietary: 'Sin gluten' },
      { name: 'Tomás', table: 5, dietary: 'Menú infantil' },
    ])
    expect(info.seniors).toEqual([{ name: 'Abuela Rosa', table: 1 }])
    expect(info.transport).toEqual([{ name: 'Familia Pérez', people: 2 }])
  })

  it('los que no tienen mesa van al final', () => {
    const t2 = table({ number: 2 })
    const info = coordinatorGuests(
      [
        guest({ name: 'Ana', rsvp_status: 'confirmado', age_group: 'mayor' }),
        guest({ name: 'Beto', rsvp_status: 'confirmado', age_group: 'mayor', table_id: t2.id }),
      ],
      [],
      [t2],
    )
    expect(info.seniors).toEqual([
      { name: 'Beto', table: 2 },
      { name: 'Ana', table: null },
    ])
  })
})
