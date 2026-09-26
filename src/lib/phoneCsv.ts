import type { Guest } from '../types/database'
import { guestGroup } from './labels'
import { normalizePhone } from './phones'

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
  for (const g of guests) if (!byName.has(nameKey(g.name))) byName.set(nameKey(g.name), g)

  // Si dos filas caen en el mismo invitado (nombres repetidos sin código), no se adivina
  const seen = new Set<string>()
  const rows = body.map((cells): PhoneRow => {
    const raw = (cells[phoneAt] ?? '').trim()
    const fileName = (cells[nameAt] ?? '').trim()
    const byIdMatch = idCol >= 0 ? byId.get((cells[idCol] ?? '').trim()) : undefined
    const guest = byIdMatch ?? byName.get(nameKey(fileName))
    if (!guest) return { guestId: null, name: fileName || '(sin nombre)', raw, phone: null, status: 'desconocido' }
    if (!byIdMatch && seen.has(guest.id)) {
      return {
        guestId: null,
        name: fileName,
        raw,
        phone: null,
        status: 'repetido',
        note: 'Nombre repetido: usa la columna Código',
      }
    }
    seen.add(guest.id)

    const base = { guestId: guest.id, name: guest.name, raw }
    if (!raw) return { ...base, phone: null, status: 'sin_telefono' }
    const check = normalizePhone(raw)
    if (!check.digits) return { ...base, phone: null, status: 'invalido', note: check.error }
    if (check.digits === guest.phone) return { ...base, phone: check.digits, status: 'igual', note: check.warning }
    return {
      ...base,
      phone: check.digits,
      status: guest.phone ? 'cambio' : 'nuevo',
      note: check.warning,
    }
  })

  const counts = emptyCounts()
  for (const r of rows) counts[r.status]++

  return { kind: 'planilla', rows, contacts: [], updates: toUpdates(rows), counts }
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
    const check = normalizePhone(raw)
    const row = { guestId, name: guest.name, raw }
    if (!check.digits) {
      hechos.set(guestId, { ...row, phone: null, status: 'invalido', note: check.error ?? 'No parece un número' })
      continue
    }
    hechos.set(guestId, {
      ...row,
      phone: check.digits,
      status: check.digits === guest.phone ? 'igual' : guest.phone ? 'cambio' : 'nuevo',
      note: ['A mano', contact && `Contacto: ${contact.name}`, check.warning].filter(Boolean).join(' · '),
    })
  }

  const rows = base.rows.map((r) => (r.guestId && hechos.get(r.guestId)) || r)
  const yaEstan = new Set(base.rows.map((r) => r.guestId))
  for (const [guestId, row] of hechos) if (!yaEstan.has(guestId)) rows.push(row)

  const counts = emptyCounts()
  for (const r of rows) counts[r.status]++
  return { ...base, rows, counts, updates: toUpdates(rows) }
}
