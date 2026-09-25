import { toast } from 'sonner'
import { whatsappLink } from '../../lib/contact'
import { appUrl } from '../../lib/appUrl'
import { formatDate, formatWeddingDate } from '../../lib/format'
import {
  DEFAULT_INVITATION,
  DEFAULT_REMINDER,
  renderMessage,
  type MessageValues,
} from '../../lib/messages'
import type { Guest, WeddingSettings } from '../../types/database'

/** Lo mínimo para armarle el link a un invitado */
type GuestLink = Pick<Guest, 'rsvp_token' | 'short_url'>

/** El link que ve el invitado: el corto si lo tiene, si no el largo de siempre */
export function rsvpUrl(guest: GuestLink): string {
  return guest.short_url?.trim() || appUrl(`rsvp/${guest.rsvp_token}`)
}

type GuestForMessage = GuestLink & Pick<Guest, 'name'>

export function messageValues(guest: GuestForMessage, settings?: WeddingSettings): MessageValues {
  return {
    nombre: guest.name,
    novios: settings ? `${settings.partner_1_name} y ${settings.partner_2_name}` : 'Nosotros',
    // formatWeddingDate devuelve "sábado 8 de mayo de 2027, 5:00 p. m."
    fecha: settings ? formatWeddingDate(settings.wedding_date).replace(', ', ' a las ') : '',
    lugar: settings?.venue_name ?? '',
    link: rsvpUrl(guest),
    limite: settings?.rsvp_deadline ? formatDate(settings.rsvp_deadline, "d 'de' MMMM") : '',
  }
}

export function invitationText(guest: GuestForMessage, settings?: WeddingSettings): string {
  return renderMessage(settings?.invitation_template?.trim() || DEFAULT_INVITATION, messageValues(guest, settings))
}

export function invitationWhatsapp(guest: Guest, settings?: WeddingSettings): string {
  return whatsappLink(guest.phone, invitationText(guest, settings))
}

/** Recordatorio amable para quien aún no confirma */
export function reminderText(guest: GuestForMessage, settings?: WeddingSettings): string {
  return renderMessage(settings?.reminder_template?.trim() || DEFAULT_REMINDER, messageValues(guest, settings))
}

export function reminderWhatsapp(guest: Guest, settings?: WeddingSettings): string {
  return whatsappLink(guest.phone, reminderText(guest, settings))
}

export async function copyRsvpLink(guest: GuestLink) {
  try {
    await navigator.clipboard.writeText(rsvpUrl(guest))
    toast.success('Link de confirmación copiado')
  } catch {
    toast.error('No se pudo copiar. Mantén presionado el link para copiarlo.')
  }
}
