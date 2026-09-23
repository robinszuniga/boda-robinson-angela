import { describe, expect, it } from 'vitest'
import { planSeatingByGroup } from '../../src/lib/autoSeating'
import { guest, link, member, table } from './factories'

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

  it('sienta junto a los del mismo círculo y usa otra mesa para el otro círculo', () => {
    const t1 = table({ number: 1, capacity: 4 })
    const t2 = table({ number: 2, capacity: 4 })
    const guests = [
      guest({ name: 'Ana', guest_group: 'amigos', circle: 'Universidad' }),
      guest({ name: 'Beto', guest_group: 'amigos', circle: 'Colegio' }),
      guest({ name: 'Caro', guest_group: 'amigos', circle: 'Universidad' }),
      guest({ name: 'Dani', guest_group: 'amigos', circle: 'Colegio' }),
    ]
    const plan = planSeatingByGroup([t1, t2], guests, [])
    expect(namesAt(plan, 1)).toEqual(['Ana', 'Caro'])
    expect(namesAt(plan, 2)).toEqual(['Beto', 'Dani'])
    expect(plan.tables.map((t) => t.circle)).toEqual(['Universidad', 'Colegio'])
  })

  it('si no quedan mesas libres, mezcla círculos del mismo grupo antes que dejar a alguien sin mesa', () => {
    const t1 = table({ number: 1, capacity: 3 })
    const guests = [
      guest({ name: 'Ana', guest_group: 'amigos', circle: 'Universidad' }),
      guest({ name: 'Beto', guest_group: 'amigos', circle: 'Colegio' }),
    ]
    const plan = planSeatingByGroup([t1], guests, [])
    expect(namesAt(plan, 1)).toEqual(['Ana', 'Beto'])
    expect(plan.tables[0].circle).toBeNull()
    expect(plan.unseated).toEqual([])
  })

  it('sin círculo, sigue el orden en que se agregaron a la lista y no el alfabético', () => {
    const t1 = table({ number: 1, capacity: 2 })
    const t2 = table({ number: 2, capacity: 2 })
    const guests = [
      guest({ name: 'Zulma', guest_group: 'trabajo', created_at: '2026-09-01T10:00:00Z' }),
      guest({ name: 'Andrés', guest_group: 'trabajo', created_at: '2026-09-05T10:00:00Z' }),
      guest({ name: 'Yolanda', guest_group: 'trabajo', created_at: '2026-09-01T10:01:00Z' }),
    ]
    const plan = planSeatingByGroup([t1, t2], guests, [])
    expect(namesAt(plan, 1)).toEqual(['Zulma', 'Yolanda'])
    expect(namesAt(plan, 2)).toEqual(['Andrés'])
  })

  it('no le agrega gente a una mesa fija ni saca a los que ya están en ella', () => {
    const principal = table({ number: 1, capacity: 10, locked: true })
    const normal = table({ number: 2, capacity: 10 })
    const novia = guest({ name: 'Mamá de Ángela', guest_group: 'familia_novia', table_id: principal.id })
    const otra = guest({ name: 'Prima', guest_group: 'familia_novia' })
    const plan = planSeatingByGroup([principal, normal], [novia, otra], [])
    expect(namesAt(plan, 1)).toEqual(['Mamá de Ángela'])
    expect(namesAt(plan, 2)).toEqual(['Prima'])
    expect(plan.moves.map((m) => m.guest.name)).toEqual(['Prima'])
  })

  it('con "rehacer todo" tampoco mueve a los de una mesa fija', () => {
    const principal = table({ number: 1, capacity: 10, locked: true })
    const normal = table({ number: 2, capacity: 10 })
    const novio = guest({ name: 'Papá de Robinson', guest_group: 'familia_novio', table_id: principal.id })
    const amigo = guest({ name: 'Amigo', guest_group: 'amigos', table_id: normal.id })
    const plan = planSeatingByGroup([principal, normal], [novio, amigo], [], { reassignAll: true })
    expect(namesAt(plan, 1)).toEqual(['Papá de Robinson'])
    expect(namesAt(plan, 2)).toEqual(['Amigo'])
    expect(plan.tables.find((t) => t.table.number === 1)?.locked).toBe(true)
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

describe('reparto con acompañantes sentados aparte', () => {
  it('cuenta el puesto que ya ocupa el acompañante en su mesa', () => {
    const t1 = table({ number: 1, capacity: 3 })
    const t2 = table({ number: 2, capacity: 3 })
    const abuela = guest({ name: 'Remedios', guest_group: 'familia_novio', table_id: t1.id, plus_ones_allowed: 2 })
    const primo = member({ guest_id: abuela.id, name: 'Vanessa', table_id: t2.id })
    const amigo = guest({ name: 'Otro', guest_group: 'familia_novio' })
    const plan = planSeatingByGroup([t1, t2], [abuela, amigo], [], { members: [primo] })
    const mesa2 = plan.tables.find((t) => t.table.number === 2)!
    // La mesa 2 ya tenía un puesto ocupado por Vanessa
    expect(mesa2.used).toBeGreaterThanOrEqual(1)
    expect(plan.unseated).toEqual([])
  })
})
