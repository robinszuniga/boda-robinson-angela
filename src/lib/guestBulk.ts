import { supabase } from './supabase'
import { describeError } from './errors'
import type { UpdateOf } from '../types/database'

/** De a 10 peticiones, para no disparar cientos a la vez */
const CHUNK = 10

async function run(rows: { id: string; values: UpdateOf<'guests'> }[]) {
  let applied = 0
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK)
    const results = await Promise.all(
      chunk.map((r) => supabase.from('guests').update(r.values).eq('id', r.id)),
    )
    const failed = results.find((r) => r.error)
    if (failed?.error) {
      // Lo de las tandas anteriores ya quedó guardado: hay que decirlo
      const parcial = applied > 0 ? `Se guardaron ${applied} de ${rows.length} y falló el resto. ` : ''
      throw new Error(`${parcial}${describeError(failed.error)}`)
    }
    applied += chunk.length
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
