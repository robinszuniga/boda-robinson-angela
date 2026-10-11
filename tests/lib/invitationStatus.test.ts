import { describe, expect, it } from 'vitest'
import { invitationStage, openedNote, pendingByStage } from '../../src/lib/invitationStatus'
import { guest } from './factories'

const now = new Date('2026-10-11T15:00:00-05:00')

describe('invitationStage', () => {
  it('sigue la invitación desde que se envía hasta que responden', () => {
    expect(invitationStage(guest())).toBe('sin_enviar')
    expect(invitationStage(guest({ invitation_sent_at: '2026-10-01T12:00:00Z' }))).toBe('sin_abrir')
    expect(
      invitationStage(guest({ invitation_sent_at: '2026-10-01T12:00:00Z', rsvp_opened_at: '2026-10-02T12:00:00Z' })),
    ).toBe('abierta')
    expect(invitationStage(guest({ rsvp_status: 'confirmado' }))).toBe('respondio')
    expect(invitationStage(guest({ rsvp_status: 'rechazado', rsvp_opened_at: '2026-10-02T12:00:00Z' }))).toBe('respondio')
  })

  it('si la abrió sin estar marcada como enviada (un QR, un link copiado) cuenta como abierta', () => {
    expect(invitationStage(guest({ rsvp_opened_at: '2026-10-02T12:00:00Z' }))).toBe('abierta')
  })
})

describe('openedNote', () => {
  it('dice hace cuánto la abrió, en hora de Bogotá', () => {
    expect(openedNote(guest({ rsvp_opened_at: '2026-10-11T13:00:00Z' }), now)).toBe('la abrió hoy')
    // 10 de octubre a las 9 p. m. en Bogotá ya es 11 en UTC: sigue siendo "ayer"
    expect(openedNote(guest({ rsvp_opened_at: '2026-10-11T02:00:00Z' }), now)).toBe('la abrió ayer')
    expect(openedNote(guest({ rsvp_opened_at: '2026-10-08T15:00:00Z' }), now)).toBe('la abrió hace 3 días')
    expect(openedNote(guest({ rsvp_opened_at: '2026-09-20T15:00:00Z' }), now)).toBe('la abrió el 20 sep')
  })

  it('avisa si se envió y no la ha abierto, y calla si ya respondió o no se ha enviado', () => {
    expect(openedNote(guest({ invitation_sent_at: '2026-10-01T12:00:00Z' }), now)).toBe('aún no la abre')
    expect(openedNote(guest(), now)).toBeNull()
    expect(openedNote(guest({ rsvp_status: 'confirmado', rsvp_opened_at: '2026-10-02T12:00:00Z' }), now)).toBeNull()
  })
})

describe('pendingByStage', () => {
  it('cuenta solo a los pendientes', () => {
    const sent = '2026-10-01T12:00:00Z'
    expect(
      pendingByStage([
        guest(),
        guest({ invitation_sent_at: sent }),
        guest({ invitation_sent_at: sent }),
        guest({ invitation_sent_at: sent, rsvp_opened_at: sent }),
        guest({ rsvp_status: 'confirmado', invitation_sent_at: sent }),
      ]),
    ).toEqual({ sin_enviar: 1, sin_abrir: 2, abierta: 1 })
  })
})
