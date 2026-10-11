import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { tableKey } from '../../lib/crud'
import { attemptLoud } from '../../lib/attempt'
import { updateEach } from '../../lib/bulkUpdate'
import type { SeatingTable } from '../../types/database'

export interface TablePosition {
  id: string
  pos_x: number
  pos_y: number
}

/**
 * Guarda la posición de una o varias mesas. Se ve al instante; si falla,
 * se vuelve a leer lo que de verdad quedó guardado (no se restaura una copia
 * vieja, que borraría otros movimientos hechos mientras tanto).
 */
export function useSaveTablePositions() {
  const qc = useQueryClient()
  const key = tableKey('seating_tables')
  return async (rows: TablePosition[]) => {
    if (rows.length === 0) return true
    await qc.cancelQueries({ queryKey: key })
    const byId = new Map(rows.map((r) => [r.id, r]))
    qc.setQueryData<SeatingTable[]>(key, (current) =>
      current?.map((t) => {
        const r = byId.get(t.id)
        return r ? { ...t, pos_x: r.pos_x, pos_y: r.pos_y } : t
      }),
    )
    const ok = await attemptLoud(
      updateEach(
        'seating_tables',
        rows.map((r) => ({ id: r.id, values: { pos_x: r.pos_x, pos_y: r.pos_y } })),
      ),
    )
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
