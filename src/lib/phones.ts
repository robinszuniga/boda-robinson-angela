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

/** Cómo se muestra en pantalla: 573001234567 → +57 300 123 4567 */
export function formatPhone(phone: string | null | undefined): string {
  const digits = (phone ?? '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.length === 12 && digits.startsWith(COUNTRY_CODE)) {
    const n = digits.slice(2)
    return `+57 ${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}`
  }
  return `+${digits}`
}
