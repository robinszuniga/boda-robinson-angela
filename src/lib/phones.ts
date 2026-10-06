/** Indicativo de Colombia: los números se guardan y se envían con él */
export const COUNTRY_CODE = '57'

/**
 * Un número sin "+" y de este largo se toma como local de Colombia y se le pone
 * el 57. Por eso un extranjero que mida lo mismo (+32 2 123 45 67) tiene que
 * conservar su "+": sin él sería indistinguible y le llegaría el link a otro.
 */
const LOCAL_LENGTH = 10

export interface PhoneCheck {
  /**
   * Listo para guardar: solo dígitos y con indicativo. null si no sirve.
   * Lleva "+" delante únicamente cuando es de otro país y sin él tendría 10
   * dígitos, que es la forma de un número local colombiano (ver LOCAL_LENGTH).
   */
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

  if (!hadPlus && digits.length === LOCAL_LENGTH) {
    return digits.startsWith('3')
      ? { digits: `${COUNTRY_CODE}${digits}` }
      : { digits: `${COUNTRY_CODE}${digits}`, warning: 'No parece celular' }
  }
  // Con +57 escrito el número tiene que venir entero. Si no, "+57 300123"
  // pasaba como si fuera de otro país y se guardaba un número que no existe.
  if (hadPlus && digits.startsWith(COUNTRY_CODE) && digits.length !== 12) {
    return { digits: null, error: digits.length < 12 ? 'Número incompleto' : 'Número demasiado largo' }
  }
  if (digits.length === 12 && digits.startsWith(COUNTRY_CODE)) {
    return digits[2] === '3' ? { digits } : { digits, warning: 'No parece celular' }
  }
  // Otro país: se usa tal cual, pero se avisa
  if (hadPlus) {
    return { digits: digits.length === LOCAL_LENGTH ? `+${digits}` : digits, warning: 'De otro país' }
  }
  return { digits, warning: 'Revisa el indicativo' }
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
  const text = (phone ?? '').trim()
  const raw = text.replace(/\D/g, '')
  if (!raw) return ''
  // Los que quedaron guardados sin indicativo (300 123 4567) son de Colombia.
  // Con "+" delante ya trae el suyo y no se le supone nada.
  const local = !text.startsWith('+') && raw.length === LOCAL_LENGTH && raw.startsWith('3')
  const digits = local ? `${COUNTRY_CODE}${raw}` : raw
  if (digits.length === 12 && digits.startsWith(COUNTRY_CODE)) {
    const n = digits.slice(2)
    return `+57 ${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}`
  }
  return `+${digits}`
}
