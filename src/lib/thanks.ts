import type { GiftReceived, Guest } from '../types/database'

export interface ThanksRow {
  key: string
  name: string
  /** Invitado de la lista (null si el regalo vino de otra persona) */
  guest: Guest | null
  /** Registro del regalo cuando no es de un invitado */
  external: GiftReceived | null
  received: GiftReceived[]
  attended: boolean
  sentAt: string | null
}

/**
 * A quién hay que agradecer: invitados que confirmaron, que dieron un regalo o que ya
 * fueron marcados; más las personas fuera de la lista que enviaron un regalo.
 * Primero los pendientes y luego por nombre.
 */
export function thanksRows(guests: Guest[], received: GiftReceived[]): ThanksRow[] {
  const byGuest = new Map<string, GiftReceived[]>()
  for (const r of received) {
    if (r.guest_id) byGuest.set(r.guest_id, [...(byGuest.get(r.guest_id) ?? []), r])
  }

  const rows: ThanksRow[] = guests
    .filter((g) => g.rsvp_status === 'confirmado' || byGuest.has(g.id) || g.thank_you_sent_at)
    .map((g) => ({
      key: g.id,
      name: g.name,
      guest: g,
      external: null,
      received: byGuest.get(g.id) ?? [],
      attended: g.rsvp_status === 'confirmado',
      sentAt: g.thank_you_sent_at,
    }))

  for (const r of received) {
    if (r.guest_id) continue
    rows.push({
      key: r.id,
      name: r.from_name ?? 'Sin nombre',
      guest: null,
      external: r,
      received: [r],
      attended: false,
      sentAt: r.thank_you_sent_at,
    })
  }

  return rows.sort((a, b) => Number(!!a.sentAt) - Number(!!b.sentAt) || a.name.localeCompare(b.name, 'es'))
}

const OPENINGS = [
  (name: string) => `¡Hola, ${name}!`,
  (name: string) => `Querido(a) ${name}:`,
  (name: string) => `${name}, ¡qué alegría escribirte!`,
]

const CLOSINGS = [
  'Nos hizo muy felices compartir ese día contigo.',
  'Fue un día inolvidable y en parte fue gracias a ti.',
  'Lo vamos a recordar siempre con mucho cariño.',
]

/** Mensaje de agradecimiento listo para editar. `variant` cambia el saludo y el cierre. */
export function thankYouMessage(
  row: Pick<ThanksRow, 'name' | 'attended' | 'received'>,
  couple: { partner_1_name: string; partner_2_name: string },
  variant = 0,
): string {
  const i = Math.abs(variant) % OPENINGS.length
  const gifts = row.received.map((r) => r.description.trim()).filter(Boolean)
  const cash = row.received.some((r) => (r.amount ?? 0) > 0)
  const giftPart = gifts.length
    ? cash && gifts.every((g) => /sobre|efectivo|aporte|dinero/i.test(g))
      ? 'tu generoso regalo'
      : `tu detalle (${gifts.join(', ')})`
    : null

  let body: string
  if (row.attended && giftPart) body = `Gracias por acompañarnos en nuestra boda y por ${giftPart}.`
  else if (row.attended) body = 'Gracias por acompañarnos en nuestra boda; tu presencia fue el mejor regalo.'
  else if (giftPart) body = `Gracias por ${giftPart}. Aunque no pudiste estar, te sentimos muy cerca.`
  else body = 'Gracias por tu cariño en esta etapa tan especial para nosotros.'

  return `${OPENINGS[i](row.name)} ${body} ${CLOSINGS[i]}\nCon cariño, ${couple.partner_1_name} y ${couple.partner_2_name}.`
}
