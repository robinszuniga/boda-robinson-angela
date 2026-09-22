import { supabase } from './supabase'
import type { UpdateOf } from '../types/database'

/** De a 10 peticiones, para no disparar cientos a la vez */
const CHUNK = 10

async function run(rows: { id: string; values: UpdateOf<'guests'> }[]) {
  for (let i = 0; i < rows.length; i += CHUNK) {
    const results = await Promise.all(
      rows.slice(i, i + CHUNK).map((r) => supabase.from('guests').update(r.values).eq('id', r.id)),
    )
    const failed = results.find((r) => r.error)
    if (failed?.error) throw failed.error
  }
}

/** El mismo cambio para varios invitados */
export function updateGuests(ids: string[], values: UpdateOf<'guests'>) {
  return run(ids.map((id) => ({ id, values })))
}

/** Un cambio distinto para cada invitado (su mesa, su teléfono…) */
export function updateGuestsEach(rows: { id: string; values: UpdateOf<'guests'> }[]) {
  return run(rows)
}
