import { beforeAll, describe, expect, it, vi } from 'vitest'
import { invitationText, rsvpUrl } from '../../src/features/guests/rsvpLinks'
import { guest } from './factories'

beforeAll(() => {
  // rsvpUrl arma el link largo con la dirección donde está publicada la app
  vi.stubGlobal('window', { location: { origin: 'https://robinszuniga.github.io' } })
})

describe('rsvpUrl', () => {
  it('usa el link corto cuando el invitado lo tiene', () => {
    const g = guest({ rsvp_token: 'abc123', short_url: 'https://tinyurl.com/BodaRobinsonAngela-h7k2m' })
    expect(rsvpUrl(g)).toBe('https://tinyurl.com/BodaRobinsonAngela-h7k2m')
  })

  it('si no hay link corto, manda el de siempre y nadie se queda sin link', () => {
    expect(rsvpUrl(guest({ rsvp_token: 'abc123' }))).toBe('https://robinszuniga.github.io/rsvp/abc123')
    expect(rsvpUrl(guest({ rsvp_token: 'abc123', short_url: '   ' }))).toBe('https://robinszuniga.github.io/rsvp/abc123')
  })
})

describe('invitationText', () => {
  it('le dice al invitado para cuántas personas es su invitación', () => {
    expect(invitationText(guest({ name: 'Tía Marta', plus_ones_allowed: 2 }))).toContain(
      'Tu invitación es para 3 personas.',
    )
    expect(invitationText(guest({ name: 'Juan', plus_ones_allowed: 0 }))).toContain('Tu invitación es para 1 persona.')
  })

  it('manda el link corto cuando lo tiene', () => {
    const g = guest({ plus_ones_allowed: 1, short_url: 'https://tinyurl.com/BodaRobinsonAngela-h7k2m' })
    expect(invitationText(g)).toContain('https://tinyurl.com/BodaRobinsonAngela-h7k2m')
  })
})
