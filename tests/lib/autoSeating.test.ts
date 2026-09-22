import { describe, expect, it } from 'vitest'
import { planSeatingByGroup } from '../../src/lib/autoSeating'
import { guest, link, table } from './factories'

const namesAt = (plan: ReturnType<typeof planSeatingByGroup>, number: number) =>
  plan.tables.find((t) => t.table.number === number)!.guests.map((g) => g.name)

describe('planSeatingByGroup', () => {
  it('no mezcla grupos en una misma mesa aunque sobren puestos', () => {
    const t1 = table({ number: 1, capacity: 6 })
    const t2 = table({ number: 2, capacity: 6 })
    const guests = [
      guest({ name: 'Papá del novio', guest_group: 'familia_novio' }),
      guest({ name: 'Mamá del novio', guest_group: 'familia_novio' }),
      guest({ name: 'Amiga Ana', guest_group: 'amigos' }),
    ]
    const plan = planSeatingByGroup([t1, t2], guests, [])
    expect(namesAt(plan, 1)).toEqual(['Mamá del novio', 'Papá del novio'])
    expect(namesAt(plan, 2)).toEqual(['Amiga Ana'])
    expect(plan.unseated).toEqual([])
    expect(plan.moves).toHaveLength(3)
  })

  it('no parte una invitación: si la familia no cabe entera, pasa a la siguiente mesa', () => {
    const t1 = table({ number: 1, capacity: 4 })
    const t2 = table({ number: 2, capacity: 4 })
    const guests = [
      guest({ name: 'Familia Pérez', guest_group: 'familia_novia', plus_ones_allowed: 3 }),
      guest({ name: 'Tía Marta', guest_group: 'familia_novia', plus_ones_allowed: 1 }),
    ]
    const plan = planSeatingByGroup([t1, t2], guests, [])
    expect(namesAt(plan, 1)).toEqual(['Familia Pérez'])
    expect(namesAt(plan, 2)).toEqual(['Tía Marta'])
  })

  it('respeta "sentar juntos" y "sentar separados"', () => {
    const t1 = table({ number: 1, capacity: 3 })
    const t2 = table({ number: 2, capacity: 3 })
    const ana = guest({ name: 'Ana', guest_group: 'amigos' })
    const beto = guest({ name: 'Beto', guest_group: 'amigos' })
    const caro = guest({ name: 'Caro', guest_group: 'amigos' })
    const juntos = planSeatingByGroup(
      [t1, t2],
      [ana, beto, caro],
      [link({ guest_a: ana.id, guest_b: caro.id, kind: 'juntos' })],
    )
    const mesaDeAna = juntos.tables.find((t) => t.guests.some((g) => g.id === ana.id))!
    expect(mesaDeAna.guests.map((g) => g.name)).toContain('Caro')

    const separados = planSeatingByGroup(
      [t1, t2],
      [ana, beto, caro],
      [link({ guest_a: ana.id, guest_b: beto.id, kind: 'separados' })],
    )
    const mesaAna = separados.tables.find((t) => t.guests.some((g) => g.id === ana.id))!.table.number
    const mesaBeto = separados.tables.find((t) => t.guests.some((g) => g.id === beto.id))!.table.number
    expect(mesaAna).not.toBe(mesaBeto)
  })

  it('deja quietos a los que ya tienen mesa y completa la suya si son del mismo grupo', () => {
    const t1 = table({ number: 1, capacity: 6 })
    const t2 = table({ number: 2, capacity: 6 })
    const abuela = guest({ name: 'Abuela', guest_group: 'familia_novia', table_id: t2.id })
    const primo = guest({ name: 'Primo', guest_group: 'familia_novia' })
    const plan = planSeatingByGroup([t1, t2], [abuela, primo], [])
    expect(namesAt(plan, 2)).toEqual(['Abuela', 'Primo'])
    expect(namesAt(plan, 1)).toEqual([])
    expect(plan.moves.map((m) => m.guest.name)).toEqual(['Primo'])
  })

  it('con "rehacer todo" reparte también a los que ya tenían mesa', () => {
    const t1 = table({ number: 1, capacity: 6 })
    const t2 = table({ number: 2, capacity: 6 })
    const abuela = guest({ name: 'Abuela', guest_group: 'familia_novia', table_id: t2.id })
    const primo = guest({ name: 'Primo', guest_group: 'familia_novia' })
    const plan = planSeatingByGroup([t1, t2], [abuela, primo], [], { reassignAll: true })
    expect(namesAt(plan, 1)).toEqual(['Abuela', 'Primo'])
  })

  it('ignora a los que no asisten y reporta a quien no cupo', () => {
    const t1 = table({ number: 1, capacity: 2 })
    const guests = [
      guest({ name: 'Va', guest_group: 'amigos' }),
      guest({ name: 'No va', guest_group: 'amigos', rsvp_status: 'rechazado' }),
      guest({ name: 'Con acompañantes', guest_group: 'amigos', plus_ones_allowed: 4 }),
    ]
    const plan = planSeatingByGroup([t1], guests, [])
    expect(namesAt(plan, 1)).toEqual(['Va'])
    expect(plan.unseated.map((g) => g.name)).toEqual(['Con acompañantes'])
  })
})
