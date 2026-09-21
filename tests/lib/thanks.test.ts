import { describe, expect, it } from 'vitest'
import { thankYouMessage, thanksRows } from '../../src/lib/thanks'
import { sortSchedule } from '../../src/features/daySchedule/scheduleActions'
import { safeUrl, whatsappLink, whatsappNumber, instagramLink } from '../../src/lib/contact'
import type { GiftReceived } from '../../src/types/database'
import { guest } from './factories'

function received(overrides: Partial<GiftReceived>): GiftReceived {
  return {
    id: `rec-${Math.random()}`,
    guest_id: null,
    from_name: null,
    description: 'Regalo',
    gift_id: null,
    received_on: '2027-05-16',
    notes: null,
    amount: null,
    thank_you_sent_at: null,
    created_at: '2027-05-16T00:00:00Z',
    ...overrides,
  }
}

describe('thanksRows', () => {
  it('incluye confirmados, quienes dieron regalo y personas fuera de la lista; pendientes primero', () => {
    const ana = guest({ name: 'Ana', rsvp_status: 'confirmado', thank_you_sent_at: '2027-05-20T00:00:00Z' })
    const beto = guest({ name: 'Beto', rsvp_status: 'rechazado' })
    const caro = guest({ name: 'Caro', rsvp_status: 'pendiente' })
    const dani = guest({ name: 'Dani', rsvp_status: 'confirmado' })
    const rows = thanksRows(
      [ana, beto, caro, dani],
      [
        received({ guest_id: beto.id, description: 'Licuadora' }),
        received({ from_name: 'Compañeros de trabajo', description: 'Bono' }),
      ],
    )
    expect(rows.map((r) => r.name)).toEqual(['Beto', 'Compañeros de trabajo', 'Dani', 'Ana'])
    expect(rows.find((r) => r.name === 'Beto')?.received[0].description).toBe('Licuadora')
    expect(rows.find((r) => r.name === 'Compañeros de trabajo')?.guest).toBeNull()
    expect(rows.some((r) => r.name === 'Caro')).toBe(false)
  })
})

describe('thankYouMessage', () => {
  const couple = { partner_1_name: 'Robinson', partner_2_name: 'Ángela' }

  it('menciona el regalo y la asistencia', () => {
    const msg = thankYouMessage({ name: 'Tía Marta', attended: true, received: [received({ description: 'Juego de ollas' })] }, couple)
    expect(msg).toContain('¡Hola, Tía Marta!')
    expect(msg).toContain('Gracias por acompañarnos en nuestra boda y por tu detalle (Juego de ollas).')
    expect(msg).toContain('Con cariño, Robinson y Ángela.')
  })

  it('no menciona montos de sobres', () => {
    const msg = thankYouMessage(
      { name: 'Beto', attended: true, received: [received({ description: 'Sobre', amount: 200000 })] },
      couple,
    )
    expect(msg).toContain('tu generoso regalo')
    expect(msg).not.toMatch(/200/)
  })

  it('cambia de versión y cubre a quien no asistió', () => {
    const a = thankYouMessage({ name: 'Caro', attended: false, received: [received({ description: 'Bono' })] }, couple, 0)
    const b = thankYouMessage({ name: 'Caro', attended: false, received: [received({ description: 'Bono' })] }, couple, 1)
    expect(a).not.toBe(b)
    expect(a).toContain('Aunque no pudiste estar')
  })
})

describe('sortSchedule', () => {
  it('pone la madrugada al final del día', () => {
    const items = ['23:30:00', '01:30:00', '14:00:00', '16:00:00'].map((start_time) => ({ start_time }))
    expect(sortSchedule(items).map((i) => i.start_time)).toEqual(['14:00:00', '16:00:00', '23:30:00', '01:30:00'])
  })
})

describe('contacto', () => {
  it('agrega el indicativo de Colombia a celulares de 10 dígitos', () => {
    expect(whatsappNumber('300 123 4567')).toBe('573001234567')
    expect(whatsappNumber('+57 300 123 4567')).toBe('573001234567')
    expect(whatsappLink('3001234567', 'Hola')).toBe('https://wa.me/573001234567?text=Hola')
    expect(whatsappLink(null, 'Hola mundo')).toBe('https://wa.me/?text=Hola%20mundo')
  })

  it('arma enlaces seguros', () => {
    expect(safeUrl('mitienda.com/regalo')).toBe('https://mitienda.com/regalo')
    expect(safeUrl('javascript:alert(1)')).toBeNull()
    expect(instagramLink('@estudio.luz')).toBe('https://instagram.com/estudio.luz')
  })
})
