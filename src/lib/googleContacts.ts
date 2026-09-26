import type { Guest } from '../types/database'
import { normalizePhone } from './phones'
import {
  emptyCounts,
  nameKey,
  parseCsv,
  readPhonesCsv,
  toUpdates,
  type Contact,
  type PhoneImport,
  type PhoneRow,
} from './phoneCsv'

export type { Contact }

/** Columnas de teléfono de Google: "Phone 1 - Value", "Phone 2 - Value"… */
const PHONE_COLUMN = /^phone \d+ - value$/
/** Google separa varios valores de una misma columna con " ::: " */
const MANY = ' ::: '
/** Partículas que no sirven para reconocer a una persona */
const FILLER = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'san', 'santa'])

const words = (name: string) => nameKey(name).split(' ').filter((w) => w.length > 1 && !FILLER.has(w))

/**
 * Saca nombre y teléfono de una exportación de Google Contactos.
 * Devuelve null si el archivo no es de Google (entonces se lee como planilla).
 */
export function googleContacts(table: string[][]): Contact[] | null {
  const header = (table[0] ?? []).map(nameKey)
  const phoneCols = header.flatMap((h, i) => (PHONE_COLUMN.test(h) ? [i] : []))
  // "First/Middle/Last Name" es el formato actual; "Given/Family Name" el viejo
  const partCols = ['first name', 'given name', 'middle name', 'additional name', 'last name', 'family name']
    .map((h) => header.indexOf(h))
    .filter((i) => i >= 0)
  const fullCol = header.indexOf('name')
  if (phoneCols.length === 0 || (partCols.length === 0 && fullCol < 0)) return null

  const contacts: Contact[] = []
  for (const cells of table.slice(1)) {
    const full = fullCol >= 0 ? (cells[fullCol] ?? '').trim() : ''
    const name = full || partCols.map((i) => (cells[i] ?? '').trim()).filter(Boolean).join(' ')
    // De varios teléfonos se toma el primero que sirva
    const phone = phoneCols.map((i) => (cells[i] ?? '').split(MANY)[0].trim()).find(Boolean) ?? ''
    if (name && phone) contacts.push({ name, phone })
  }
  return contacts
}

/**
 * Qué tanto se parecen dos nombres:
 * 3 el mismo, 2 uno cabe dentro del otro o comparten nombre y apellido, 1 solo el nombre de pila.
 */
export function nameScore(guest: string[], contact: string[]): number {
  if (guest.length === 0 || contact.length === 0) return 0
  const common = guest.filter((w) => contact.includes(w))
  if (common.length === 0) return 0
  if (common.length === guest.length && guest.length === contact.length) return 3
  if (common.length === guest.length || common.length === contact.length) return common.length >= 2 ? 2 : 1
  return common.length >= 2 ? 2 : 0
}

/**
 * Le busca teléfono a cada invitado entre los contactos. Los contactos que no
 * son invitados se ignoran (una agenda tiene cientos que no van a la boda).
 */
export function matchContacts(contacts: Contact[], guests: Guest[]): PhoneImport {
  const agenda = contacts.map((c) => ({ ...c, words: words(c.name) }))

  const rows = guests.map((guest): PhoneRow => {
    const suyas = words(guest.name)
    let best = 0
    let found: typeof agenda = []
    for (const c of agenda) {
      const score = nameScore(suyas, c.words)
      if (score === 0 || score < best) continue
      if (score > best) {
        best = score
        found = [c]
      } else found.push(c)
    }

    if (found.length === 0) {
      return {
        guestId: guest.id,
        name: guest.name,
        raw: '',
        phone: null,
        status: 'sin_telefono',
        note: 'No está en tus contactos',
      }
    }

    // Varios contactos parecidos con números distintos: mejor no adivinar
    const numeros = new Set(found.map((c) => normalizePhone(c.phone).digits ?? c.phone))
    if (numeros.size > 1) {
      return {
        guestId: guest.id,
        name: guest.name,
        raw: found.map((c) => c.name).join(', '),
        phone: null,
        status: 'repetido',
        note: `${found.length} contactos parecidos: ponlo a mano`,
      }
    }

    const contacto = found[0]
    const base = { guestId: guest.id, name: guest.name, raw: contacto.phone }
    // Si el contacto no se llama igual, se dice con quién coincidió para que él revise
    const deQuien = best < 3 ? `Contacto: ${contacto.name}` : undefined
    const check = normalizePhone(contacto.phone)
    if (!check.digits) return { ...base, phone: null, status: 'invalido', note: check.error }
    const note = [deQuien, check.warning].filter(Boolean).join(' · ') || undefined
    if (check.digits === guest.phone) return { ...base, phone: check.digits, status: 'igual', note }
    return { ...base, phone: check.digits, status: guest.phone ? 'cambio' : 'nuevo', note }
  })

  const counts = emptyCounts()
  for (const r of rows) counts[r.status]++

  return { kind: 'google', rows, contacts, updates: toUpdates(rows), counts }
}

/** Lee el archivo, sea la planilla de la app o la exportación de Google */
export function readPhonesFile(text: string, guests: Guest[]): PhoneImport {
  const contacts = googleContacts(parseCsv(text))
  return contacts ? matchContacts(contacts, guests) : readPhonesCsv(text, guests)
}
