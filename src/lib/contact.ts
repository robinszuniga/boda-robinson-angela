/**
 * Normaliza un teléfono para wa.me: 300 123 4567 → 573001234567.
 * Si viene con "+" ya trae su indicativo, sea el que sea, y no se le pone el 57:
 * +32 2 123 45 67 también tiene 10 dígitos y empieza por 3, pero es de Bélgica.
 */
export function whatsappNumber(phone: string | null | undefined): string | null {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '')
  if (!digits) return null
  if (!phone.trim().startsWith('+') && digits.length === 10 && digits.startsWith('3')) return `57${digits}`
  return digits
}

/** Enlace de WhatsApp con el mensaje escrito (lo envía la persona desde su WhatsApp) */
export function whatsappLink(phone: string | null | undefined, text?: string): string {
  const number = whatsappNumber(phone)
  const query = text ? `?text=${encodeURIComponent(text)}` : ''
  return `https://wa.me/${number ?? ''}${query}`
}

export function instagramLink(handle: string | null | undefined): string | null {
  if (!handle) return null
  const trimmed = handle.trim()
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  const user = trimmed.replace(/^@/, '').replace(/[^\w.]/g, '')
  return user ? `https://instagram.com/${user}` : null
}

/** Asegura que un enlace escrito a mano tenga protocolo y sea http(s) */
export function safeUrl(url: string | null | undefined): string | null {
  if (!url) return null
  const trimmed = url.trim()
  const withProtocol = /^[a-z]+:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  try {
    const parsed = new URL(withProtocol)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : null
  } catch {
    return null
  }
}
