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

export function rsvpUrl(token: string): string {
  return appUrl(`rsvp/${token}`)
}

type GuestForMessage = Pick<Guest, 'name' | 'rsvp_token'>

export function messageValues(guest: GuestForMessage, settings?: WeddingSettings): MessageValues {
  return {
    nombre: guest.name,
    novios: settings ? `${settings.partner_1_name} y ${settings.partner_2_name}` : 'Nosotros',
    // formatWeddingDate devuelve "sábado 8 de mayo de 2027, 5:00 p. m."
    fecha: settings ? formatWeddingDate(settings.wedding_date).replace(', ', ' a las ') : '',
    lugar: settings?.venue_name ?? '',
    link: rsvpUrl(guest.rsvp_token),
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

export async function copyRsvpLink(token: string) {
  try {
    await navigator.clipboard.writeText(rsvpUrl(token))
    toast.success('Link de confirmación copiado')
  } catch {
    toast.error('No se pudo copiar. Mantén presionado el link para copiarlo.')
  }
}
