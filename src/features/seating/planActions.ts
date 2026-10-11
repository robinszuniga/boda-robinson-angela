import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { tableKey } from '../../lib/crud'
import { attemptLoud } from '../../lib/attempt'
import { describeError, friendlyError } from '../../lib/errors'
import type { SeatingTable } from '../../types/database'

export interface TablePosition {
  id: string
  pos_x: number
  pos_y: number
}

const CHUNK = 10

async function savePositions(rows: TablePosition[]) {
  for (let i = 0; i < rows.length; i += CHUNK) {
    const results = await Promise.all(
      rows
        .slice(i, i + CHUNK)
        .map((r) => supabase.from('seating_tables').update({ pos_x: r.pos_x, pos_y: r.pos_y }).eq('id', r.id)),
    )
    const failed = results.find((r) => r.error)
    if (failed?.error) throw friendlyError(`No se pudo guardar dónde quedó la mesa. ${describeError(failed.error)}`)
  }
}

/**
 * Guarda la posición de una o varias mesas. Se ve al instante y, si falla,
 * las mesas vuelven a donde estaban.
 */
export function useSaveTablePositions() {
  const qc = useQueryClient()
  const key = tableKey('seating_tables')
  return async (rows: TablePosition[]) => {
    if (rows.length === 0) return true
    await qc.cancelQueries({ queryKey: key })
    const previous = qc.getQueryData<SeatingTable[]>(key)
    const byId = new Map(rows.map((r) => [r.id, r]))
    if (previous) {
      qc.setQueryData<SeatingTable[]>(
        key,
        previous.map((t) => {
          const r = byId.get(t.id)
          return r ? { ...t, pos_x: r.pos_x, pos_y: r.pos_y } : t
        }),
      )
    }
    const ok = await attemptLoud(savePositions(rows))
    if (!ok && previous) qc.setQueryData(key, previous)
    await qc.invalidateQueries({ queryKey: key })
    return ok
  }
}

/** Todas las mesas vuelven a la zona de "sin ubicar", ordenadas por número */
export async function resetTablePositions() {
  const { error } = await supabase
    .from('seating_tables')
    .update({ pos_x: null, pos_y: null })
    .not('pos_x', 'is', null)
  if (error) throw error
}
