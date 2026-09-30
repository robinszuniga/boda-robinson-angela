/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RsvpView } from '../../src/types/database'

// Supabase simulado: ninguna prueba toca la base real
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('../../src/lib/supabase', () => ({ supabase: { rpc } }))

import PublicRsvpPage from '../../src/features/rsvp/PublicRsvpPage'

const view = (rsvp_status: RsvpView['guest']['rsvp_status']): RsvpView => ({
  guest: {
    name: 'Tía Marta',
    plus_ones_allowed: 0,
    plus_ones_confirmed: 0,
    rsvp_status,
    dietary: null,
    guest_message: null,
    song_request: null,
    needs_transport: false,
    responded_at: null,
    table: null,
    members: [],
  },
  wedding: {
    partner_1_name: 'Robinson',
    partner_2_name: 'Ángela',
    wedding_date: '2027-05-08T23:00:00Z',
    venue_name: 'Casa Sotillo',
    venue_address: null,
    rsvp_deadline: null,
    guest_message: null,
    dress_code: null,
    logistics_info: null,
    lodging_info: null,
    faq: null,
    livestream_url: null,
    photo_album_url: null,
    envelope_rain: false,
    ask_song: false,
    offer_transport: false,
  },
  gifts: [],
})

const scrollIntoView = vi.fn()

beforeAll(() => {
  // jsdom no mueve la pantalla; solo se comprueba que se pida
  Element.prototype.scrollIntoView = scrollIntoView
})

beforeEach(() => {
  rpc.mockReset()
  scrollIntoView.mockClear()
  rpc.mockImplementation(async (fn: string) =>
    fn === 'rsvp_get' ? { data: view('pendiente'), error: null } : { data: view('rechazado'), error: null },
  )
})

afterEach(cleanup)

function abrir() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/rsvp/tok123']}>
        <Routes>
          <Route path="/rsvp/:token" element={<PublicRsvpPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('página del invitado', () => {
  it('si no marcó si asiste, lo dice junto a los botones y no envía nada', async () => {
    abrir()
    fireEvent.click(await screen.findByRole('button', { name: 'Enviar respuesta' }))
    expect(screen.getByRole('alert')).toHaveProperty('textContent', 'Falta esto: cuéntanos si nos acompañas.')
    expect(rpc).not.toHaveBeenCalledWith('rsvp_submit', expect.anything())
  })

  it('al responder, lleva al invitado hasta la confirmación y deja el foco en ella', async () => {
    abrir()
    fireEvent.click(await screen.findByRole('radio', { name: 'No podré ir' }))
    fireEvent.click(screen.getByRole('button', { name: 'Enviar respuesta' }))

    const titulo = await screen.findByRole('heading', { name: 'Gracias por avisarnos, Tía Marta' })
    await waitFor(() => expect(document.activeElement).toBe(titulo))
    expect(scrollIntoView).toHaveBeenCalled()
    expect(rpc).toHaveBeenCalledWith('rsvp_submit', expect.objectContaining({ p_token: 'tok123', p_status: 'rechazado' }))
  })
})
