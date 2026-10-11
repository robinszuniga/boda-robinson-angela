import type { Guest } from '../types/database'
import { daysFromToday, formatDate } from './format'

/** En qué va cada invitación, del envío a la respuesta */
export type InvitationStage = 'sin_enviar' | 'sin_abrir' | 'abierta' | 'respondio'

type Tracked = Pick<Guest, 'rsvp_status' | 'invitation_sent_at' | 'rsvp_opened_at'>

export function invitationStage(g: Tracked): InvitationStage {
  if (g.rsvp_status !== 'pendiente') return 'respondio'
  // Puede haberla abierto sin que la marcaran como enviada (un QR, un link copiado)
  if (g.rsvp_opened_at) return 'abierta'
  return g.invitation_sent_at ? 'sin_abrir' : 'sin_enviar'
}

function ago(iso: string, now: Date) {
  const days = -daysFromToday(iso, now)
  if (days <= 0) return 'hoy'
  if (days === 1) return 'ayer'
  if (days < 7) return `hace ${days} días`
  return `el ${formatDate(iso, 'd MMM')}`
}

/** "la abrió ayer", "aún no la abre"… Solo mientras no ha respondido; después ya no importa. */
export function openedNote(g: Tracked, now: Date = new Date()): string | null {
  switch (invitationStage(g)) {
    case 'abierta':
      return `la abrió ${ago(g.rsvp_opened_at!, now)}`
    case 'sin_abrir':
      return 'aún no la abre'
    default:
      return null
  }
}

/** Pendientes separados por si ya vieron la invitación, para saber a quién llamar */
export function pendingByStage(guests: Tracked[]) {
  const count = { sin_enviar: 0, sin_abrir: 0, abierta: 0 }
  for (const g of guests) {
    const stage = invitationStage(g)
    if (stage !== 'respondio') count[stage]++
  }
  return count
}
