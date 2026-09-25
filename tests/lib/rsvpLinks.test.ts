import { beforeAll, describe, expect, it, vi } from 'vitest'
import { rsvpUrl } from '../../src/features/guests/rsvpLinks'
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
