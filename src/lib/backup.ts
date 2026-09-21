import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { todayISO } from './format'
import { guestGroup, rsvpStatus } from './labels'
import type { Guest, GuestMember, SeatingTable, TableName } from '../types/database'

const db = supabase as unknown as SupabaseClient

/** Tablas incluidas en el respaldo, en orden de dependencias */
export const BACKUP_TABLES: TableName[] = [
  'wedding_settings',
  'budget_categories',
  'vendors',
  'payments',
  'seating_tables',
  'guests',
  'guest_members',
  'guest_links',
  'tasks',
  'day_schedule_items',
  'documents',
  'gifts',
  'gift_claims',
  'gifts_received',
]

function download(content: BlobPart, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Descarga todas las tablas en un JSON (los archivos de Documentos no se incluyen) */
export async function downloadBackup(): Promise<number> {
  const tables: Record<string, unknown[]> = {}
  let total = 0
  for (const table of BACKUP_TABLES) {
    const { data, error } = await db.from(table).select('*')
    if (error) throw error
    tables[table] = data ?? []
    total += data?.length ?? 0
  }
  const payload = { app: 'boda-robinson-angela', version: 1, exported_at: new Date().toISOString(), tables }
  download(JSON.stringify(payload, null, 2), `respaldo-boda-${todayISO()}.json`, 'application/json')
  return total
}

function csvCell(value: unknown): string {
  const text = value == null ? '' : String(value)
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/** CSV con punto y coma (lo abre bien Excel en español) */
export function guestsCsv(guests: Guest[], tables: SeatingTable[], members: GuestMember[]): string {
  const tableNumber = new Map(tables.map((t) => [t.id, t.number]))
  const header = [
    'Invitado',
    'Grupo',
    'Confirmación',
    'Acompañantes permitidos',
    'Acompañantes confirmados',
    'Acompañantes (nombres)',
    'Restricciones alimentarias',
    'Mesa',
    'Teléfono',
    'Correo',
    'Canción pedida',
    'Necesita transporte',
    'Mensaje',
  ]
  const rows = guests.map((g) => {
    const own = members.filter((m) => m.guest_id === g.id)
    const names = own.map((m) => `${m.name}${m.attending === true ? ' (sí)' : m.attending === false ? ' (no)' : ''}`)
    const dietary = [g.dietary, ...own.filter((m) => m.dietary).map((m) => `${m.name}: ${m.dietary}`)]
      .filter(Boolean)
      .join(' | ')
    return [
      g.name,
      guestGroup[g.guest_group],
      rsvpStatus[g.rsvp_status].label,
      g.plus_ones_allowed,
      g.plus_ones_confirmed,
      names.join(', '),
      dietary,
      g.table_id ? (tableNumber.get(g.table_id) ?? '') : '',
      g.phone,
      g.email,
      g.song_request,
      g.needs_transport ? 'Sí' : '',
      g.guest_message,
    ]
  })
  return [header, ...rows].map((r) => r.map(csvCell).join(';')).join('\r\n')
}

export function downloadGuestsCsv(guests: Guest[], tables: SeatingTable[], members: GuestMember[]) {
  // BOM para que Excel reconozca las tildes
  download(String.fromCharCode(0xfeff) + guestsCsv(guests, tables, members), `invitados-${todayISO()}.csv`, 'text/csv;charset=utf-8')
}
