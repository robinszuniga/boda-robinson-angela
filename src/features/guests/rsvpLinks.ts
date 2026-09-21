import { toast } from 'sonner'
import { whatsappLink } from '../../lib/contact'
import { formatDate, formatWeddingDate } from '../../lib/format'
import type { Guest, WeddingSettings } from '../../types/database'

export function rsvpUrl(token: string): string {
  return `${window.location.origin}/rsvp/${token}`
}

export function invitationText(guest: Pick<Guest, 'name' | 'rsvp_token'>, settings?: WeddingSettings): string {
  const couple = settings ? `${settings.partner_1_name} y ${settings.partner_2_name}` : 'Nosotros'
  // formatWeddingDate termina en "p. m." / "a. m.", así que no se agrega otro punto
  const invite = settings
    ? `${couple} queremos invitarte a nuestra boda el ${formatWeddingDate(settings.wedding_date).replace(', ', ' a las ')}`
    : `${couple} queremos invitarte a nuestra boda.`
  return `¡Hola, ${guest.name}!\n${invite}\nConfirma tu asistencia aquí: ${rsvpUrl(guest.rsvp_token)}`
}

export function invitationWhatsapp(guest: Guest, settings?: WeddingSettings): string {
  return whatsappLink(guest.phone, invitationText(guest, settings))
}

/** Recordatorio amable para quien aún no confirma */
export function reminderText(guest: Pick<Guest, 'name' | 'rsvp_token'>, settings?: WeddingSettings): string {
  const deadline = settings?.rsvp_deadline ? ` antes del ${formatDate(settings.rsvp_deadline, "d 'de' MMMM")}` : ''
  return `¡Hola, ${guest.name}! Te escribimos para recordarte que nos cuentes${deadline} si nos acompañas en nuestra boda. Es solo un clic aquí: ${rsvpUrl(guest.rsvp_token)}`
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
