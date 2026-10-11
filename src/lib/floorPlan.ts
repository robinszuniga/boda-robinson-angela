import type { Guest, GuestMember, SeatingTable, TableShape, VenueElement, VenueElementKind } from '../types/database'
import { membersApart, seatsFor } from './seating'

// Unidades del plano: 1 ≈ 1 cm del salón a escala libre. Lo que importa es la proporción.
/** Radio del círculo de cada puesto */
export const SEAT_R = 13
/** Distancia mínima entre centros de puestos vecinos */
const SEAT_PITCH = 32
/** Del borde de la mesa al centro de los puestos */
const SEAT_OFFSET = 20
const MIN_ROUND_R = 34
const MIN_RECT_W = 80
/** Las posiciones se guardan en una cuadrícula de 10 para que todo quede alineado */
export const GRID = 10

export interface Point {
  x: number
  y: number
}

export interface Bounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export type TableBody = { kind: 'circle'; r: number } | { kind: 'rect'; w: number; h: number }

export interface TableGeometry {
  body: TableBody
  /** Centro de cada puesto respecto al centro de la mesa, sin girar */
  seats: Point[]
  /** Mitad del ancho y del alto que ocupa con los puestos, sin girar */
  halfW: number
  halfH: number
}

/** Puestos alrededor de una mesa: los que caben, o más si está en sobrecupo */
export function seatCount(capacity: number, used: number): number {
  return Math.max(capacity, used, 1)
}

/** Forma y puestos de una mesa. Crece con el número de puestos para que siempre quepan. */
export function tableGeometry(shape: TableShape, seats: number): TableGeometry {
  const n = Math.max(1, seats)
  const reach = SEAT_OFFSET + SEAT_R

  if (shape === 'redonda') {
    const r = Math.max(MIN_ROUND_R, (n * SEAT_PITCH) / (2 * Math.PI) - SEAT_OFFSET)
    const ring = r + SEAT_OFFSET
    const points = Array.from({ length: n }, (_, i) => {
      // Empieza arriba y va en el sentido del reloj
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n
      return { x: round2(ring * Math.cos(angle)), y: round2(ring * Math.sin(angle)) }
    })
    return { body: { kind: 'circle', r: round2(r) }, seats: points, halfW: r + reach, halfH: r + reach }
  }

  // Presidencial: todos del mismo lado, mirando a los invitados. Rectangular: por los dos lados largos.
  const top = shape === 'presidencial' ? n : Math.ceil(n / 2)
  const bottom = n - top
  const h = shape === 'presidencial' ? 48 : 56
  const w = Math.max(MIN_RECT_W, Math.max(top, bottom) * SEAT_PITCH)
  const side = (count: number, y: number) =>
    Array.from({ length: count }, (_, i) => ({ x: round2(-w / 2 + ((i + 0.5) * w) / count), y }))
  const points = [...side(top, -(h / 2 + SEAT_OFFSET)), ...side(bottom, h / 2 + SEAT_OFFSET)]
  return { body: { kind: 'rect', w, h }, seats: points, halfW: w / 2, halfH: h / 2 + reach }
}

const round2 = (n: number) => Math.round(n * 100) / 100

/** Gira un punto alrededor del origen (grados, en el sentido del reloj como en SVG) */
export function rotate(p: Point, degrees: number): Point {
  const a = (degrees * Math.PI) / 180
  const cos = Math.cos(a)
  const sin = Math.sin(a)
  return { x: round2(p.x * cos - p.y * sin), y: round2(p.x * sin + p.y * cos) }
}

/** Mitad del ancho y del alto de la caja que encierra un rectángulo girado */
export function rotatedHalf(halfW: number, halfH: number, degrees: number): { hw: number; hh: number } {
  const a = (degrees * Math.PI) / 180
  const cos = Math.abs(Math.cos(a))
  const sin = Math.abs(Math.sin(a))
  return { hw: round2(halfW * cos + halfH * sin), hh: round2(halfW * sin + halfH * cos) }
}

export function boundsAround(center: Point, hw: number, hh: number): Bounds {
  return { minX: center.x - hw, minY: center.y - hh, maxX: center.x + hw, maxY: center.y + hh }
}

export function unionBounds(list: Bounds[]): Bounds | null {
  if (list.length === 0) return null
  return list.reduce((a, b) => ({
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  }))
}

export const snap = (v: number, grid = GRID) => Math.round(v / grid) * grid

/** Lleva cualquier ángulo a 0–359 */
export const normalizeRotation = (deg: number) => ((Math.round(deg) % 360) + 360) % 360

export function elementBounds(e: Pick<VenueElement, 'pos_x' | 'pos_y' | 'width' | 'height' | 'rotation'>): Bounds {
  const { hw, hh } = rotatedHalf(e.width / 2, e.height / 2, e.rotation)
  return boundsAround({ x: e.pos_x, y: e.pos_y }, hw, hh)
}

export interface PlacedTable {
  table: SeatingTable
  center: Point
  geometry: TableGeometry
  /** La posición la puso el sistema: la mesa aún no se ha ubicado a mano */
  auto: boolean
  bounds: Bounds
}

export interface PlanLayout {
  tables: PlacedTable[]
  /** Dónde empiezan las mesas sin ubicar, para rotular esa zona */
  unplacedOrigin: Point | null
  bounds: Bounds | null
}

/**
 * Ubica todas las mesas: las que ya tienen posición se quedan donde están y las
 * que no, se ordenan por número en una cuadrícula debajo de todo lo demás.
 */
export function layoutPlan(
  tables: SeatingTable[],
  usedByTable: Map<string, number>,
  elements: VenueElement[] = [],
): PlanLayout {
  const sorted = [...tables].sort((a, b) => a.number - b.number)
  const geometryOf = (t: SeatingTable) => tableGeometry(t.shape, seatCount(t.capacity, usedByTable.get(t.id) ?? 0))
  const place = (table: SeatingTable, center: Point, auto: boolean): PlacedTable => {
    const geometry = geometryOf(table)
    const { hw, hh } = rotatedHalf(geometry.halfW, geometry.halfH, table.rotation)
    return { table, center, geometry, auto, bounds: boundsAround(center, hw, hh) }
  }

  const placed = sorted
    .filter((t) => t.pos_x != null && t.pos_y != null)
    .map((t) => place(t, { x: t.pos_x!, y: t.pos_y! }, false))
  const pending = sorted.filter((t) => t.pos_x == null || t.pos_y == null)

  const existing = unionBounds([...placed.map((p) => p.bounds), ...elements.map(elementBounds)])
  let unplacedOrigin: Point | null = null
  const auto: PlacedTable[] = []
  if (pending.length > 0) {
    const geometries = pending.map((t) => {
      const g = geometryOf(t)
      return rotatedHalf(g.halfW, g.halfH, t.rotation)
    })
    const cellW = snap(Math.max(...geometries.map((g) => g.hw)) * 2 + 60)
    const cellH = snap(Math.max(...geometries.map((g) => g.hh)) * 2 + 60)
    // Un salón suele ser más ancho que largo
    const columns = Math.max(3, Math.ceil(Math.sqrt(pending.length * 1.5)))
    const origin = existing ? { x: snap(existing.minX), y: snap(existing.maxY + 120) } : { x: 0, y: 0 }
    unplacedOrigin = existing ? origin : null
    pending.forEach((t, i) => {
      const center = {
        x: origin.x + (i % columns) * cellW + cellW / 2,
        y: origin.y + Math.floor(i / columns) * cellH + cellH / 2,
      }
      auto.push(place(t, center, true))
    })
  }

  const all = [...placed, ...auto].sort((a, b) => a.table.number - b.table.number)
  return {
    tables: all,
    unplacedOrigin,
    bounds: unionBounds([...all.map((p) => p.bounds), ...elements.map(elementBounds)]),
  }
}

// -------------------------------------------------------------
// Quién va en cada puesto
// -------------------------------------------------------------

export interface SeatPerson {
  key: string
  name: string
  initials: string
  status: 'confirmado' | 'pendiente'
  /** La invitación a la que pertenece */
  guestId: string
  kind: 'invitado' | 'acompanante' | 'aparte'
}

export function initials(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .filter((w) => /\p{L}/u.test(w))
  if (words.length === 0) return '?'
  const first = words[0][0]
  const second = words.length > 1 ? words[1][0] : (words[0][1] ?? '')
  return (first + second).toUpperCase()
}

/**
 * Las personas sentadas en una mesa, en orden: cada invitado seguido de sus
 * acompañantes (con nombre si los tiene) y al final los acompañantes de otras
 * invitaciones que se sientan aquí. Cuadra con los puestos que cuenta seatsFor.
 */
export function peopleAtTable(
  tableId: string,
  guests: Guest[],
  members: GuestMember[],
): SeatPerson[] {
  const people: SeatPerson[] = []
  const byId = new Map(guests.map((g) => [g.id, g]))
  const seated = guests
    .filter((g) => g.table_id === tableId && g.rsvp_status !== 'rechazado')
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))

  for (const g of seated) {
    const status = g.rsvp_status === 'confirmado' ? 'confirmado' : 'pendiente'
    people.push({ key: g.id, name: g.name, initials: initials(g.name), status, guestId: g.id, kind: 'invitado' })
    const companions = seatsFor(g, members) - 1
    const apart = new Set(membersApart(g, members).map((m) => m.id))
    const named = members
      .filter((m) => m.guest_id === g.id && m.attending !== false && !apart.has(m.id))
      .sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at))
    for (let i = 0; i < companions; i++) {
      const m = named[i]
      people.push(
        m
          ? { key: m.id, name: m.name, initials: initials(m.name), status, guestId: g.id, kind: 'acompanante' }
          : {
              key: `${g.id}-${i}`,
              name: `Acompañante de ${g.name}`,
              initials: '+1',
              status,
              guestId: g.id,
              kind: 'acompanante',
            },
      )
    }
  }

  // Acompañantes que se sientan aquí aunque su invitación esté en otra mesa
  for (const m of members) {
    const g = byId.get(m.guest_id)
    if (m.table_id !== tableId || m.attending === false || !g || g.rsvp_status === 'rechazado') continue
    if (g.table_id === tableId) continue
    const status = g.rsvp_status === 'confirmado' ? 'confirmado' : 'pendiente'
    people.push({ key: m.id, name: m.name, initials: initials(m.name), status, guestId: g.id, kind: 'aparte' })
  }
  return people
}

export interface DeclinedAtTable {
  key: string
  name: string
  guestId: string
  /** Si es un acompañante sentado aparte, su id (para quitarle la mesa a él y no a la invitación) */
  memberId: string | null
}

/** Los que dijeron que no van pero siguen anotados en la mesa: su puesto ya está libre */
export function declinedAtTable(tableId: string, guests: Guest[], members: GuestMember[]): DeclinedAtTable[] {
  const byId = new Map(guests.map((g) => [g.id, g]))
  const list: DeclinedAtTable[] = guests
    .filter((g) => g.table_id === tableId && g.rsvp_status === 'rechazado')
    .map((g) => ({ key: g.id, name: g.name, guestId: g.id, memberId: null }))
  for (const m of members) {
    if (m.table_id !== tableId) continue
    const g = byId.get(m.guest_id)
    if (!g) continue
    if (m.attending === false || g.rsvp_status === 'rechazado') {
      list.push({ key: m.id, name: m.name, guestId: g.id, memberId: m.id })
    }
  }
  return list.sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

// -------------------------------------------------------------
// Elementos del salón
// -------------------------------------------------------------

export const ELEMENT_SIZE: Record<VenueElementKind, { width: number; height: number }> = {
  pista: { width: 320, height: 320 },
  tarima: { width: 260, height: 110 },
  banos: { width: 140, height: 110 },
  entrada: { width: 160, height: 40 },
  bar: { width: 220, height: 70 },
  buffet: { width: 260, height: 70 },
  otro: { width: 160, height: 100 },
}

// -------------------------------------------------------------
// Vista (zoom y desplazamiento)
// -------------------------------------------------------------

export interface ViewBox {
  x: number
  y: number
  /** Ancho visible en unidades del plano; el alto sale de la proporción de la pantalla */
  w: number
}

export const MIN_VIEW_W = 200
export const MAX_VIEW_W = 20000

export const clampViewW = (w: number) => Math.min(MAX_VIEW_W, Math.max(MIN_VIEW_W, w))

/** Encuadra todo lo que hay en el plano, con margen */
export function fitView(bounds: Bounds | null, aspect: number, padding = 60): ViewBox {
  if (!bounds) return { x: -400, y: -400 / aspect, w: 800 }
  const bw = bounds.maxX - bounds.minX + padding * 2
  const bh = bounds.maxY - bounds.minY + padding * 2
  const w = clampViewW(Math.max(bw, bh * aspect))
  const h = w / aspect
  const cx = (bounds.minX + bounds.maxX) / 2
  const cy = (bounds.minY + bounds.maxY) / 2
  return { x: cx - w / 2, y: cy - h / 2, w }
}

/** Acerca o aleja manteniendo fijo el punto `at` (en unidades del plano) */
export function zoomView(view: ViewBox, factor: number, at: Point, aspect: number): ViewBox {
  const w = clampViewW(view.w / factor)
  const k = w / view.w
  const h = view.w / aspect
  // El punto `at` queda en el mismo lugar de la pantalla
  const rx = (at.x - view.x) / view.w
  const ry = (at.y - view.y) / h
  return { x: at.x - rx * w, y: at.y - ry * (h * k), w }
}
