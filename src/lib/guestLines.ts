export const MAX_PLUS_ONES = 10
const MAX_NAME = 120

export interface GuestLine {
  name: string
  plusOnes: number
  /** Acompañantes con nombre (si la línea los trae) */
  members: string[]
  error?: string
}

/**
 * Lee una lista pegada, un invitado por línea:
 * - "Tía Marta" → usa los acompañantes por defecto
 * - "Tía Marta +2" → 2 acompañantes sin nombre
 * - "Familia Pérez: Ana, Tomás y Sara" → acompañantes con nombre
 */
export function parseGuestLines(text: string, defaultPlusOnes: number): GuestLine[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line): GuestLine => {
      const colon = line.indexOf(':')
      let result: GuestLine
      if (colon >= 0) {
        const members = line
          .slice(colon + 1)
          .split(/,|\s+y\s+/i)
          .map((m) => m.trim())
          .filter(Boolean)
        result = { name: line.slice(0, colon).trim(), plusOnes: members.length, members }
      } else {
        const plus = line.match(/^(.*?)\s*\+\s*(\d+)$/)
        result = plus
          ? { name: plus[1].trim(), plusOnes: Number(plus[2]), members: [] }
          : { name: line, plusOnes: defaultPlusOnes, members: [] }
      }

      if (!result.name) result.error = 'Falta el nombre'
      else if ([result.name, ...result.members].some((n) => n.length > MAX_NAME)) result.error = 'Nombre muy largo'
      else if (result.plusOnes > MAX_PLUS_ONES) result.error = `Máximo ${MAX_PLUS_ONES} acompañantes`
      return result
    })
}
