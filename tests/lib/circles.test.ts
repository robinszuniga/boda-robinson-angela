import { describe, expect, it } from 'vitest'
import { suggestCircles } from '../../src/lib/circles'
import { guest } from './factories'

const at = (minutes: number) => new Date(Date.UTC(2026, 8, 20, 9, minutes)).toISOString()

describe('suggestCircles', () => {
  it('arma un lote con los que se agregaron seguidos y del mismo grupo', () => {
    const guests = [
      guest({ name: 'Ana Ruiz', guest_group: 'amigos', created_at: at(0) }),
      guest({ name: 'Beto Ruiz', guest_group: 'amigos', created_at: at(1) }),
      guest({ name: 'Caro Díaz', guest_group: 'amigos', created_at: at(2) }),
      // media hora después: otra tanda
      guest({ name: 'Jefe', guest_group: 'trabajo', created_at: at(40) }),
      guest({ name: 'Compañera', guest_group: 'trabajo', created_at: at(41) }),
    ]
    const [amigos, trabajo] = suggestCircles(guests)
    expect(amigos.guests.map((g) => g.name)).toEqual(['Ana Ruiz', 'Beto Ruiz', 'Caro Díaz'])
    expect(amigos.suggestion).toBe('Familia Ruiz')
    expect(trabajo.guests).toHaveLength(2)
    expect(trabajo.suggestion).toBe('')
  })

  it('corta el lote cuando cambia el grupo o pasa mucho tiempo', () => {
    const guests = [
      guest({ name: 'Uno', guest_group: 'amigos', created_at: at(0) }),
      guest({ name: 'Dos', guest_group: 'familia_novia', created_at: at(1) }),
      guest({ name: 'Tres', guest_group: 'familia_novia', created_at: at(2) }),
      guest({ name: 'Cuatro', guest_group: 'familia_novia', created_at: at(60) }),
    ]
    const suggestions = suggestCircles(guests)
    expect(suggestions).toHaveLength(1)
    expect(suggestions[0].guests.map((g) => g.name)).toEqual(['Dos', 'Tres'])
  })

  it('cuando se agregaron todos a la vez, separa por grupo', () => {
    const guests = [
      guest({ name: 'Amiga 1', guest_group: 'amigos', created_at: at(0) }),
      guest({ name: 'Prima 1', guest_group: 'familia_novia', created_at: at(0) }),
      guest({ name: 'Amiga 2', guest_group: 'amigos', created_at: at(0) }),
      guest({ name: 'Prima 2', guest_group: 'familia_novia', created_at: at(0) }),
    ]
    const suggestions = suggestCircles(guests)
    expect(suggestions).toHaveLength(2)
    expect(suggestions.map((s) => s.guests.map((g) => g.name))).toEqual([
      ['Amiga 1', 'Amiga 2'],
      ['Prima 1', 'Prima 2'],
    ])
  })

  it('no propone a quien ya tiene círculo ni lotes de una sola persona', () => {
    const guests = [
      guest({ name: 'Con círculo', guest_group: 'amigos', circle: 'Universidad', created_at: at(0) }),
      guest({ name: 'Otro', guest_group: 'amigos', circle: 'Universidad', created_at: at(1) }),
      guest({ name: 'Solitario', guest_group: 'otros', created_at: at(2) }),
    ]
    expect(suggestCircles(guests)).toEqual([])
  })
})
