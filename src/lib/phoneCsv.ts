import type { Guest } from '../types/database'
import { guestGroup } from './labels'
import { checkTypedPhone, normalizePhone } from './phones'

export const PHONE_CSV_HEADER = ['Código', 'Invitado', 'Grupo', 'Teléfono'] as const

function cell(value: unknown): string {
  const text = value == null ? '' : String(value)
  // Excel ejecutaría como fórmula un texto que empiece por = + - @
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text
  return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

/** Planilla para llenar los teléfonos en Excel: una fila por invitado */
export function phonesCsv(guests: Guest[]): string {
  const rows = guests.map((g) => [g.id, g.name, guestGroup[g.guest_group], g.phone ?? ''])
  return [PHONE_CSV_HEADER, ...rows].map((r) => r.map(cell).join(';')).join('\r\n')
}

/** Lee un CSV con comillas y separador ; o , */
export function parseCsv(text: string): string[][] {
  const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  const separator = (clean.split('\n')[0]?.match(/;/g)?.length ?? 0) >= (clean.split('\n')[0]?.match(/,/g)?.length ?? 0) ? ';' : ','
  const rows: string[][] = []
  let row: string[] = []
  let value = ''
  let quoted = false
  for (let i = 0; i < clean.length; i++) {
    const char = clean[i]
    if (quoted) {
      if (char === '"') {
        if (clean[i + 1] === '"') {
          value += '"'
          i++
        } else quoted = false
      } else value += char
    } else if (char === '"') quoted = true
    else if (char === separator) {
      row.push(value)
      value = ''
    } else if (char === '\n') {
      row.push(value)
      rows.push(row)
      row = []
      value = ''
    } else if (char !== '\r') value += char
  }
  row.push(value)
  rows.push(row)
  return rows.filter((r) => r.some((c) => c.trim()))
}

export type PhoneRowStatus = 'nuevo' | 'cambio' | 'igual' | 'sin_telefono' | 'invalido' | 'desconocido' | 'repetido'

export interface PhoneRow {
  guestId: string | null
  /** Nombre del invitado en la app, o lo que traía el archivo si no se encontró */
  name: string
  raw: string
  phone: string | null
  status: PhoneRowStatus
  note?: string
}

export interface Contact {
  name: string
  phone: string
}

/** Como se ve un contacto en el buscador: sirve para reconocer dos que se llamen igual */
export const contactLabel = (c: Contact) => `${c.name} — ${c.phone}`

export interface PhoneImport {
  /** De dónde salió: la planilla de la app o una exportación de Google Contactos */
  kind: 'planilla' | 'google'
  rows: PhoneRow[]
  /** La agenda del archivo, para poder asignar a mano */
  contacts: Contact[]
  /** Lo que se va a guardar */
  updates: { id: string; phone: string }[]
  counts: Record<PhoneRowStatus, number>
}

export const toUpdates = (rows: PhoneRow[]) =>
  rows
    .filter((r) => r.guestId && r.phone && (r.status === 'nuevo' || r.status === 'cambio'))
    .map((r) => ({ id: r.guestId!, phone: r.phone! }))

const guarda = (r: PhoneRow) => !!r.guestId && !!r.phone && (r.status === 'nuevo' || r.status === 'cambio')

/**
 * Cierra el resultado: antes de contar, aparta los números que terminarían en
 * dos invitados distintos, contando también los que ya estaban guardados (el
 * del hijo no puede quedarle también al papá). Si no, a ese teléfono le llegan
 * dos invitaciones con links distintos y el otro se queda sin poder confirmar.
 */
export function buildImport(
  kind: PhoneImport['kind'],
  rows: PhoneRow[],
  contacts: Contact[],
  guests: Guest[],
): PhoneImport {
  // Hay teléfonos viejos guardados como se tecleaban ("300 6551912"): se comparan
  // ya limpios, o el mismo número no se reconocería como repetido
  const limpio = (phone: string) => normalizePhone(phone).digits ?? phone
  const guardado = new Map<string, string>()
  for (const g of guests) if (g.phone) guardado.set(g.id, limpio(g.phone))
  const guardadoEn = new Map<string, Guest>()
  for (const g of guests) if (g.phone && !guardadoEn.has(limpio(g.phone))) guardadoEn.set(limpio(g.phone), g)

  // El teléfono con que quedaría cada invitado: el nuevo si su fila pasa, el
  // guardado si se bloquea
  const quedaria = (bloqueadas: Set<number>) => {
    const final = new Map(guardado)
    rows.forEach((r, i) => {
      if (guarda(r) && !bloqueadas.has(i)) final.set(r.guestId!, r.phone!)
    })
    return final
  }

  // Se bloquea por vueltas: al bloquear una fila ese invitado se queda con su
  // número de antes, y ese número puede chocar ahora con otra fila (Ana no se
  // puede pasar al de Bruno, así que Carla ya no puede tomar el de Ana).
  // Solo se agregan bloqueos, así que termina.
  const bloqueadas = new Set<number>()
  for (;;) {
    const dueños = new Map<string, number>()
    for (const phone of quedaria(bloqueadas).values()) dueños.set(phone, (dueños.get(phone) ?? 0) + 1)
    const nuevas = rows.flatMap((r, i) =>
      guarda(r) && !bloqueadas.has(i) && (dueños.get(r.phone!) ?? 0) > 1 ? [i] : [],
    )
    if (nuevas.length === 0) break
    for (const i of nuevas) bloqueadas.add(i)
  }
  const final = quedaria(bloqueadas)

  const out = rows.map((r, i): PhoneRow => {
    if (!bloqueadas.has(i)) return r
    const otro = guardadoEn.get(r.phone!)
    const deOtro = otro && otro.id !== r.guestId && final.get(otro.id) === r.phone
    return {
      ...r,
      phone: null,
      status: 'repetido',
      note: deOtro ? `Ese número ya es de ${otro.name}` : 'Ese número le quedaría a dos invitados',
    }
  })

  const counts = emptyCounts()
  for (const r of out) counts[r.status]++
  return { kind, rows: out, contacts, updates: toUpdates(out), counts }
}

export const emptyCounts = (): Record<PhoneRowStatus, number> => ({
  nuevo: 0,
  cambio: 0,
  igual: 0,
  sin_telefono: 0,
  invalido: 0,
  desconocido: 0,
  repetido: 0,
})

/** Nombre comparable: sin mayúsculas, sin tildes y sin espacios de más */
export const nameKey = (name: string) =>
  name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')

/**
 * Cruza el archivo con los invitados: primero por el código de la planilla y,
 * si no viene, por nombre. Solo devuelve como "updates" lo que cambia.
 */
export function readPhonesCsv(text: string, guests: Guest[]): PhoneImport {
  const table = parseCsv(text)
  const header = (table[0] ?? []).map((h) => nameKey(h))
  const idCol = header.findIndex((h) => h === 'codigo' || h === 'id')
  const nameCol = header.findIndex((h) => h.includes('invitado') || h === 'nombre')
  const phoneCol = header.findIndex((h) => h.includes('telefono') || h.includes('celular') || h === 'phone')
  const body = phoneCol >= 0 || idCol >= 0 ? table.slice(1) : table
  // Sin encabezado reconocible: se asume "nombre;teléfono"
  const nameAt = nameCol >= 0 ? nameCol : 0
  const phoneAt = phoneCol >= 0 ? phoneCol : 1

  const byId = new Map(guests.map((g) => [g.id, g]))
  const byName = new Map<string, Guest>()
  // Dos invitados con el mismo nombre (Raul Daza padre e hijo): sin el código
  // no hay forma de saber de cuál es el teléfono, así que no se adivina
  const homonimos = new Set<string>()
  for (const g of guests) {
    const key = nameKey(g.name)
    if (byName.has(key)) homonimos.add(key)
    else byName.set(key, g)
  }

  // Si dos filas caen en el mismo invitado, tampoco se adivina
  const seen = new Set<string>()
  const rows = body.map((cells): PhoneRow => {
    const raw = (cells[phoneAt] ?? '').trim()
    const fileName = (cells[nameAt] ?? '').trim()
    const byIdMatch = idCol >= 0 ? byId.get((cells[idCol] ?? '').trim()) : undefined
    const guest = byIdMatch ?? byName.get(nameKey(fileName))
    if (!guest) return { guestId: null, name: fileName || '(sin nombre)', raw, phone: null, status: 'desconocido' }
    // El mismo invitado dos veces tampoco, aunque venga con su código: se toma
    // la primera fila y se avisa de la otra (si no, al guardar ganaría cualquiera)
    const homonimo = !byIdMatch && homonimos.has(nameKey(fileName))
    if (homonimo || seen.has(guest.id)) {
      return {
        guestId: null,
        name: fileName,
        raw,
        phone: null,
        status: 'repetido',
        note: byIdMatch ? 'Ese invitado viene dos veces en el archivo' : 'Nombre repetido: usa la columna Código',
      }
    }
    seen.add(guest.id)

    const base = { guestId: guest.id, name: guest.name, raw }
    if (!raw) return { ...base, phone: null, status: 'sin_telefono' }
    const check = normalizePhone(raw)
    if (!check.digits) return { ...base, phone: null, status: 'invalido', note: check.error }
    if (check.digits === normalizePhone(guest.phone).digits) {
      return { ...base, phone: check.digits, status: 'igual', note: check.warning }
    }
    return {
      ...base,
      phone: check.digits,
      status: guest.phone ? 'cambio' : 'nuevo',
      note: check.warning,
    }
  })

  return buildImport('planilla', rows, [], guests)
}

/**
 * Aplica lo que el novio asignó a mano: por cada invitado, un contacto de la
 * agenda o un número escrito directamente. Manda sobre lo que encontró solo.
 */
export function applyManual(base: PhoneImport, guests: Guest[], manual: Record<string, string>): PhoneImport {
  const entries = Object.entries(manual).filter(([, value]) => value.trim())
  if (entries.length === 0) return base

  const byId = new Map(guests.map((g) => [g.id, g]))
  const byLabel = new Map<string, Contact>()
  const byContactName = new Map<string, Contact>()
  for (const c of base.contacts) {
    byLabel.set(nameKey(contactLabel(c)), c)
    if (!byContactName.has(nameKey(c.name))) byContactName.set(nameKey(c.name), c)
  }

  const hechos = new Map<string, PhoneRow>()
  for (const [guestId, value] of entries) {
    const guest = byId.get(guestId)
    if (!guest) continue
    const written = value.trim()
    const contact = byLabel.get(nameKey(written)) ?? byContactName.get(nameKey(written))
    const raw = contact ? contact.phone : written
    // Lo escrito a mano tiene que venir completo; lo de la agenda se toma como está
    const check = contact ? normalizePhone(raw) : checkTypedPhone(raw)
    const row = { guestId, name: guest.name, raw }
    if (!check.digits) {
      // Si está escribiendo el apodo de un contacto, no es un error: le falta elegirlo
      const buscando = base.contacts.length > 0 && !/\d/.test(written)
      const note = buscando ? 'Elige un contacto de la lista' : (check.error ?? 'No parece un número')
      hechos.set(guestId, { ...row, phone: null, status: 'invalido', note })
      continue
    }
    hechos.set(guestId, {
      ...row,
      phone: check.digits,
      status: check.digits === normalizePhone(guest.phone).digits ? 'igual' : guest.phone ? 'cambio' : 'nuevo',
      note: ['A mano', contact && `Contacto: ${contact.name}`, check.warning].filter(Boolean).join(' · '),
    })
  }

  const rows = base.rows.map((r) => (r.guestId && hechos.get(r.guestId)) || r)
  const yaEstan = new Set(base.rows.map((r) => r.guestId))
  for (const [guestId, row] of hechos) if (!yaEstan.has(guestId)) rows.push(row)

  return buildImport(base.kind, rows, base.contacts, guests)
}
