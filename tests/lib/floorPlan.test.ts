import { describe, expect, it } from 'vitest'
import {
  autoPositions,
  declinedAtTable,
  fitView,
  initials,
  layoutPlan,
  normalizeRotation,
  peopleAtTable,
  rotate,
  rotatedHalf,
  seatCount,
  SEAT_R,
  snap,
  tableGeometry,
  zoomView,
} from '../../src/lib/floorPlan'
import { seatsFor } from '../../src/lib/seating'
import type { VenueElement } from '../../src/types/database'
import { guest, member, table } from './factories'

const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y)

function element(overrides: Partial<VenueElement> = {}): VenueElement {
  return {
    id: 'el-1',
    kind: 'pista',
    label: null,
    pos_x: 0,
    pos_y: 0,
    width: 300,
    height: 300,
    rotation: 0,
    created_at: '2026-09-20T12:00:00Z',
    ...overrides,
  }
}

describe('tableGeometry', () => {
  it('pone un puesto por persona y los puestos no se montan entre sí', () => {
    for (const shape of ['redonda', 'rectangular', 'presidencial'] as const) {
      for (const n of [1, 2, 8, 10, 14, 20]) {
        const g = tableGeometry(shape, n)
        expect(g.seats).toHaveLength(n)
        for (let i = 0; i < n; i++) {
          for (let j = i + 1; j < n; j++) {
            expect(distance(g.seats[i], g.seats[j])).toBeGreaterThanOrEqual(SEAT_R * 2)
          }
        }
      }
    }
  })

  it('la mesa redonda crece con los puestos', () => {
    const r = (n: number) => {
      const body = tableGeometry('redonda', n).body
      return body.kind === 'circle' ? body.r : 0
    }
    expect(r(20)).toBeGreaterThan(r(10))
    expect(r(4)).toBe(r(1))
  })

  it('la rectangular reparte en los dos lados y la presidencial deja todos de un lado', () => {
    const rect = tableGeometry('rectangular', 7)
    expect(rect.seats.filter((p) => p.y < 0)).toHaveLength(4)
    expect(rect.seats.filter((p) => p.y > 0)).toHaveLength(3)
    const pres = tableGeometry('presidencial', 7)
    expect(pres.seats.every((p) => p.y < 0)).toBe(true)
  })

  it('los puestos quedan dentro de la caja que ocupa la mesa', () => {
    for (const shape of ['redonda', 'rectangular', 'presidencial'] as const) {
      const g = tableGeometry(shape, 12)
      for (const p of g.seats) {
        expect(Math.abs(p.x) + SEAT_R).toBeLessThanOrEqual(g.halfW + 0.01)
        expect(Math.abs(p.y) + SEAT_R).toBeLessThanOrEqual(g.halfH + 0.01)
      }
    }
  })
})

describe('seatCount', () => {
  it('muestra todos los puestos de la mesa, o más si hay sobrecupo', () => {
    expect(seatCount(10, 4)).toBe(10)
    expect(seatCount(10, 12)).toBe(12)
  })
})

describe('giros', () => {
  it('gira puntos en el sentido del reloj y calcula la caja girada', () => {
    expect(rotate({ x: 10, y: 0 }, 90)).toEqual({ x: 0, y: 10 })
    expect(rotatedHalf(100, 20, 90)).toEqual({ hw: 20, hh: 100 })
    expect(rotatedHalf(100, 20, 0)).toEqual({ hw: 100, hh: 20 })
  })

  it('normaliza ángulos y redondea a la cuadrícula', () => {
    expect(normalizeRotation(-45)).toBe(315)
    expect(normalizeRotation(405)).toBe(45)
    expect(snap(123)).toBe(120)
    expect(snap(-126)).toBe(-130)
  })
})

describe('layoutPlan', () => {
  it('deja las mesas ubicadas donde están y acomoda las demás debajo, por número', () => {
    const fija = table({ number: 1, pos_x: 100, pos_y: 100 })
    const t3 = table({ number: 3 })
    const t2 = table({ number: 2 })
    const plan = layoutPlan([t3, fija, t2], new Map())
    expect(plan.tables.map((p) => p.table.number)).toEqual([1, 2, 3])
    const [uno, dos, tres] = plan.tables
    expect(uno).toMatchObject({ center: { x: 100, y: 100 }, auto: false })
    expect(dos.auto && tres.auto).toBe(true)
    // Debajo de la mesa ubicada y sin montarse entre ellas
    expect(dos.bounds.minY).toBeGreaterThan(uno.bounds.maxY)
    expect(dos.bounds.maxX).toBeLessThanOrEqual(tres.bounds.minX)
    expect(plan.unplacedOrigin).not.toBeNull()
  })

  it('las sin ubicar tampoco se montan sobre los elementos del salón', () => {
    const plan = layoutPlan([table({ number: 1 })], new Map(), [element({ pos_y: 500, height: 400 })])
    expect(plan.tables[0].bounds.minY).toBeGreaterThan(700)
  })

  it('si nada está ubicado arranca en el origen y no rotula la zona', () => {
    const plan = layoutPlan([table({ number: 1 }), table({ number: 2 })], new Map())
    expect(plan.unplacedOrigin).toBeNull()
    expect(plan.tables[0].bounds.minX).toBeGreaterThanOrEqual(0)
    expect(plan.bounds).not.toBeNull()
  })

  it('una mesa con sobrecupo se dibuja con más puestos', () => {
    const t = table({ capacity: 8, pos_x: 0, pos_y: 0 })
    const plan = layoutPlan([t], new Map([[t.id, 11]]))
    expect(plan.tables[0].geometry.seats).toHaveLength(11)
  })

  it('sin mesas ni elementos no hay límites', () => {
    expect(layoutPlan([], new Map()).bounds).toBeNull()
  })
})

describe('autoPositions', () => {
  it('da dónde quedaron las mesas sin ubicar, para guardarlas antes de cambiar el plano', () => {
    const fija = table({ number: 1, pos_x: 100, pos_y: 100 })
    const t2 = table({ number: 2 })
    const t3 = table({ number: 3 })
    const plan = layoutPlan([fija, t2, t3], new Map())
    const rows = autoPositions(plan)
    expect(rows.map((r) => r.id)).toEqual([t2.id, t3.id])
    expect(rows[0]).toEqual({ id: t2.id, pos_x: plan.tables[1].center.x, pos_y: plan.tables[1].center.y })
    expect(autoPositions(plan, t2.id).map((r) => r.id)).toEqual([t3.id])
  })

  it('guardadas ahí, ya no se mueven aunque cambie lo demás del salón', () => {
    const fija = table({ number: 1, pos_x: 100, pos_y: 100 })
    const t2 = table({ number: 2 })
    const before = layoutPlan([fija, t2], new Map())
    const [saved] = autoPositions(before)
    const frozen = { ...t2, pos_x: saved.pos_x, pos_y: saved.pos_y }
    // Una pista grande más abajo empujaría la fila de las sin ubicar
    const after = layoutPlan([fija, frozen], new Map(), [element({ pos_y: 900, height: 600 })])
    expect(after.tables[1].center).toEqual(before.tables[1].center)
    expect(autoPositions(after)).toEqual([])
  })
})

describe('initials', () => {
  it('toma la inicial de las dos primeras palabras', () => {
    expect(initials('ángela maría Ruiz')).toBe('ÁM')
    expect(initials('Robinson')).toBe('RO')
    expect(initials('  ')).toBe('?')
  })
})

describe('peopleAtTable', () => {
  it('pone a cada invitado con sus acompañantes y cuadra con los puestos que ocupa', () => {
    const t = table()
    const laura = guest({ name: 'Laura', table_id: t.id, plus_ones_allowed: 2 })
    const ana = guest({ name: 'Ana', table_id: t.id, rsvp_status: 'confirmado', plus_ones_allowed: 2, plus_ones_confirmed: 1 })
    const no = guest({ name: 'Beto', table_id: t.id, rsvp_status: 'rechazado' })
    const members = [member({ guest_id: ana.id, name: 'Pedro', attending: true })]
    const people = peopleAtTable(t.id, [laura, ana, no], members)
    expect(people.map((p) => p.name)).toEqual(['Ana', 'Pedro', 'Laura', 'Acompañante de Laura', 'Acompañante de Laura'])
    expect(people.map((p) => p.status)).toEqual(['confirmado', 'confirmado', 'pendiente', 'pendiente', 'pendiente'])
    expect(people).toHaveLength(seatsFor(laura, members) + seatsFor(ana, members))
    expect(people[3].initials).toBe('+1')
  })

  it('el acompañante sentado aparte sale en su mesa y no en la de su invitación', () => {
    const t1 = table()
    const t2 = table()
    const abuela = guest({ name: 'Abuela', table_id: t1.id, rsvp_status: 'confirmado', plus_ones_allowed: 1, plus_ones_confirmed: 1 })
    const primo = member({ guest_id: abuela.id, name: 'Primo', attending: true, table_id: t2.id })
    expect(peopleAtTable(t1.id, [abuela], [primo]).map((p) => p.name)).toEqual(['Abuela'])
    expect(peopleAtTable(t2.id, [abuela], [primo])).toMatchObject([{ name: 'Primo', kind: 'aparte' }])
  })
})

describe('declinedAtTable', () => {
  it('lista a los que dijeron que no y siguen anotados en la mesa', () => {
    const t = table()
    const otra = table()
    const juan = guest({ name: 'Juan', table_id: t.id, rsvp_status: 'rechazado' })
    const sí = guest({ name: 'Sí va', table_id: otra.id, rsvp_status: 'confirmado', plus_ones_allowed: 1 })
    const primo = member({ guest_id: sí.id, name: 'Primo', attending: false, table_id: t.id })
    const list = declinedAtTable(t.id, [juan, sí], [primo])
    expect(list.map((d) => [d.name, d.memberId])).toEqual([
      ['Juan', null],
      ['Primo', primo.id],
    ])
    expect(declinedAtTable(otra.id, [juan, sí], [primo])).toEqual([])
  })

  it('no avisa por un acompañante que está en la misma mesa de su invitación: ese puesto lo cuenta la invitación', () => {
    const t = table()
    const pendiente = guest({ name: 'Ana', table_id: t.id, plus_ones_allowed: 1 })
    const primo = member({ guest_id: pendiente.id, name: 'Primo', attending: false, table_id: t.id })
    expect(declinedAtTable(t.id, [pendiente], [primo])).toEqual([])
  })
})

describe('vista', () => {
  it('encuadra todo con margen y respeta la proporción de la pantalla', () => {
    const v = fitView({ minX: 0, minY: 0, maxX: 1000, maxY: 200 }, 2)
    expect(v.w).toBe(1120)
    expect(v.x).toBe(-60)
    // El alto visible (w / 2) cubre el alto con margen
    expect(v.w / 2).toBeGreaterThanOrEqual(320)
  })

  it('al acercar, el punto bajo el dedo no se mueve', () => {
    const view = { x: 0, y: 0, w: 1000 }
    const at = { x: 250, y: 100 }
    const next = zoomView(view, 2, at, 2)
    expect(next.w).toBe(500)
    expect((at.x - next.x) / next.w).toBeCloseTo((at.x - view.x) / view.w)
    expect((at.y - next.y) / (next.w / 2)).toBeCloseTo((at.y - view.y) / (view.w / 2))
  })

  it('no deja acercar ni alejar sin límite', () => {
    expect(zoomView({ x: 0, y: 0, w: 300 }, 100, { x: 0, y: 0 }, 1).w).toBe(200)
    expect(zoomView({ x: 0, y: 0, w: 10000 }, 0.01, { x: 0, y: 0 }, 1).w).toBe(20000)
  })
})
