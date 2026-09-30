/** Indicativo de Colombia: los números se guardan y se envían con él */
export const COUNTRY_CODE = '57'

export interface PhoneCheck {
  /** Solo dígitos, con indicativo, listo para WhatsApp. null si no sirve */
  digits: string | null
  /** Se puede usar, pero conviene revisarlo */
  warning?: string
  /** Por qué no sirve */
  error?: string
}

/**
 * Deja el teléfono como lo necesita WhatsApp: solo dígitos y con indicativo.
 * Un número colombiano de 10 dígitos (300 123 4567) queda como 573001234567.
 */
export function normalizePhone(raw: string | null | undefined): PhoneCheck {
  const trimmed = (raw ?? '').trim()
  if (!trimmed) return { digits: null }

  const hadPlus = trimmed.startsWith('+')
  const digits = trimmed.replace(/\D/g, '').replace(/^0+/, '')
  if (!digits) return { digits: null, error: 'No tiene números' }
  if (digits.length < 8) return { digits: null, error: 'Número incompleto' }
  if (digits.length > 15) return { digits: null, error: 'Número demasiado largo' }

  if (!hadPlus && digits.length === 10) {
    return digits.startsWith('3')
      ? { digits: `${COUNTRY_CODE}${digits}` }
      : { digits: `${COUNTRY_CODE}${digits}`, warning: 'No parece celular' }
  }
  if (digits.length === 12 && digits.startsWith(COUNTRY_CODE)) {
    return digits[2] === '3' ? { digits } : { digits, warning: 'No parece celular' }
  }
  // Otro país u otra longitud: se usa tal cual, pero se avisa
  return { digits, warning: hadPlus ? 'De otro país' : 'Revisa el indicativo' }
}

/**
 * Para lo que se escribe a mano. Un celular sin indicativo tiene que traer sus
 * 10 dígitos: con 8 o 9 ya pasaría como válido, pero sin el 57 y sin servir
 * para WhatsApp. Con "+" delante se acepta tal cual (otro país).
 */
export function checkTypedPhone(raw: string): PhoneCheck {
  const trimmed = raw.trim()
  const digits = trimmed.replace(/\D/g, '').length
  if (!trimmed.startsWith('+') && digits > 0 && digits < 10) return { digits: null, error: 'Número incompleto' }
  return normalizePhone(trimmed)
}

/** Cómo se muestra en pantalla: 573001234567 → +57 300 123 4567 */
export function formatPhone(phone: string | null | undefined): string {
  const raw = (phone ?? '').replace(/\D/g, '')
  if (!raw) return ''
  // Los que quedaron guardados sin indicativo (300 123 4567) también son de Colombia
  const digits = raw.length === 10 && raw.startsWith('3') ? `${COUNTRY_CODE}${raw}` : raw
  if (digits.length === 12 && digits.startsWith(COUNTRY_CODE)) {
    const n = digits.slice(2)
    return `+57 ${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}`
  }
  return `+${digits}`
}
