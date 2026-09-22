import { describe, expect, it } from 'vitest'
import { guestsCsv } from '../../src/lib/backup'
import { guest, member, table } from './factories'

describe('guestsCsv', () => {
  it('arma el CSV con acompañantes, dietas y mesa, escapando comillas y punto y coma', () => {
    const t = table({ number: 4 })
    const g = guest({
      name: 'Carlos "Charly" Pérez',
      rsvp_status: 'confirmado',
      plus_ones_allowed: 2,
      plus_ones_confirmed: 1,
      table_id: t.id,
      dietary: 'Sin gluten; sin lactosa',
      song_request: 'La bicicleta',
      needs_transport: true,
    })
    const members = [
      member({ guest_id: g.id, name: 'Ana', attending: true, dietary: 'Vegana' }),
      member({ guest_id: g.id, name: 'Sofía', attending: false, sort_order: 1 }),
      member({ guest_id: g.id, name: 'Tomás', attending: true, age_group: 'nino', sort_order: 2 }),
    ]
    const [header, row] = guestsCsv([g], [t], members).split('\r\n')
    expect(header.split(';')[0]).toBe('Invitado')
    expect(row).toContain('"Carlos ""Charly"" Pérez"')
    expect(row).toContain('Confirmado')
    expect(row).toContain('Ana (sí), Sofía (no), Tomás (sí, niño(a))')
    expect(header).toContain('Edad')
    expect(row).toContain('"Sin gluten; sin lactosa | Ana: Vegana"')
    expect(row).toContain(';4;')
    expect(row).toContain('La bicicleta;Sí')
  })
})
