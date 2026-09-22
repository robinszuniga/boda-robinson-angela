import type { Guest } from '../types/database'
import { guestGroup } from './labels'
import { normalizePhone } from './phones'

export const PHONE_CSV_HEADER = ['Código', 'Invitado', 'Grupo', 'Teléfono'] as const

function cell(value: unknown): string {
  const text = value == null ? '' : String(value)
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
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

export type PhoneRowStatus = 'nuevo' | 'cambio' | 'igual' | 'sin_telefono' | 'invalido' | 'desconocido'

export interface PhoneRow {
  guestId: string | null
  /** Nombre del invitado en la app, o lo que traía el archivo si no se encontró */
  name: string
  raw: string
  phone: string | null
  status: PhoneRowStatus
  note?: string
}

export interface PhoneImport {
  rows: PhoneRow[]
  /** Lo que se va a guardar */
  updates: { id: string; phone: string }[]
  counts: Record<PhoneRowStatus, number>
}

const key = (name: string) =>
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
  const header = (table[0] ?? []).map((h) => key(h))
  const idCol = header.findIndex((h) => h === 'codigo' || h === 'id')
  const nameCol = header.findIndex((h) => h.includes('invitado') || h === 'nombre')
  const phoneCol = header.findIndex((h) => h.includes('telefono') || h.includes('celular') || h === 'phone')
  const body = phoneCol >= 0 || idCol >= 0 ? table.slice(1) : table
  // Sin encabezado reconocible: se asume "nombre;teléfono"
  const nameAt = nameCol >= 0 ? nameCol : 0
  const phoneAt = phoneCol >= 0 ? phoneCol : 1

  const byId = new Map(guests.map((g) => [g.id, g]))
  const byName = new Map<string, Guest>()
  for (const g of guests) if (!byName.has(key(g.name))) byName.set(key(g.name), g)

  const rows = body.map((cells): PhoneRow => {
    const raw = (cells[phoneAt] ?? '').trim()
    const fileName = (cells[nameAt] ?? '').trim()
    const guest = (idCol >= 0 ? byId.get((cells[idCol] ?? '').trim()) : undefined) ?? byName.get(key(fileName))
    if (!guest) return { guestId: null, name: fileName || '(sin nombre)', raw, phone: null, status: 'desconocido' }

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

  const counts: Record<PhoneRowStatus, number> = {
    nuevo: 0,
    cambio: 0,
    igual: 0,
    sin_telefono: 0,
    invalido: 0,
    desconocido: 0,
  }
  for (const r of rows) counts[r.status]++

  return {
    rows,
    updates: rows
      .filter((r) => r.guestId && r.phone && (r.status === 'nuevo' || r.status === 'cambio'))
      .map((r) => ({ id: r.guestId!, phone: r.phone! })),
    counts,
  }
}
