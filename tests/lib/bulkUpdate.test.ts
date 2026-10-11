import { beforeEach, describe, expect, it, vi } from 'vitest'

// Supabase simulado: cada fila responde según su id
const { from, calls, failing } = vi.hoisted(() => {
  const calls: { table: string; id: string; values: unknown }[] = []
  const failing = new Set<string>()
  const from = vi.fn((table: string) => ({
    update: (values: unknown) => ({
      eq: async (_col: string, id: string) => {
        calls.push({ table, id, values })
        return { error: failing.has(id) ? { code: '23514', message: 'check' } : null }
      },
    }),
  }))
  return { from, calls, failing }
})
vi.mock('../../src/lib/supabase', () => ({ supabase: { from } }))

import { updateEach } from '../../src/lib/bulkUpdate'
import { updateGuests } from '../../src/lib/guestBulk'

beforeEach(() => {
  calls.length = 0
  failing.clear()
})

describe('updateEach', () => {
  it('guarda cada fila en su tabla, de a 10', async () => {
    const rows = Array.from({ length: 12 }, (_, i) => ({ id: `m${i}`, values: { pos_x: i * 10, pos_y: 0 } }))
    await updateEach('seating_tables', rows)
    expect(calls).toHaveLength(12)
    expect(calls.every((c) => c.table === 'seating_tables')).toBe(true)
    expect(calls[3]).toEqual({ table: 'seating_tables', id: 'm3', values: { pos_x: 30, pos_y: 0 } })
  })

  it('si algo falla, dice cuánto alcanzó a quedar guardado', async () => {
    failing.add('m11')
    const rows = Array.from({ length: 12 }, (_, i) => ({ id: `m${i}`, values: { pos_x: 0, pos_y: 0 } }))
    await expect(updateEach('seating_tables', rows)).rejects.toThrow(/Se guardaron 11 de 12 y falló el resto/)
  })

  it('los invitados usan el mismo camino', async () => {
    await updateGuests(['a', 'b'], { table_id: null })
    expect(calls.map((c) => [c.table, c.id])).toEqual([
      ['guests', 'a'],
      ['guests', 'b'],
    ])
  })
})
