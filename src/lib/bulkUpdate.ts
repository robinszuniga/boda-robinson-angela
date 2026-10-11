import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { describeError, friendlyError } from './errors'
import type { TableName, UpdateOf } from '../types/database'

// Sin tipar, como en crud.ts: los tipos de cada fila se aplican en la firma
const db = supabase as unknown as SupabaseClient

/** De a 10 peticiones, para no disparar cientos a la vez */
const CHUNK = 10

/** Un cambio distinto para cada fila de una tabla (su mesa, su teléfono, su posición…) */
export async function updateEach<T extends TableName>(table: T, rows: { id: string; values: UpdateOf<T> }[]) {
  let applied = 0
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK)
    const results = await Promise.all(chunk.map((r) => db.from(table).update(r.values).eq('id', r.id)))
    applied += results.filter((r) => !r.error).length
    const failed = results.find((r) => r.error)
    if (failed?.error) {
      // Lo que ya se guardó no se deshace: hay que decir cuánto alcanzó a quedar
      const parcial = applied > 0 ? `Se guardaron ${applied} de ${rows.length} y falló el resto. ` : ''
      throw friendlyError(`${parcial}${describeError(failed.error)}`)
    }
  }
}
