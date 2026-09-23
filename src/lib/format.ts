import { differenceInCalendarDays, format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

export const TIME_ZONE = 'America/Bogota'
// Colombia no tiene horario de verano: el desfase es fijo.
const BOGOTA_OFFSET = '-05:00'

const copFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
})
const numberFormatter = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 })

export function formatCOP(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—'
  return copFormatter.format(value).replace(/[\u00a0\u202f]/g, ' ')
}

/** Versión compacta para gráficos: $ 45 M, $ 850 mil */
export function formatCOPShort(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1_000_000) {
    const m = value / 1_000_000
    return `$ ${m.toLocaleString('es-CO', { maximumFractionDigits: m % 1 === 0 ? 0 : 1 })} M`
  }
  if (abs >= 1_000) return `$ ${Math.round(value / 1_000).toLocaleString('es-CO')} mil`
  return `$ ${value}`
}

export function formatNumber(value: number): string {
  return numberFormatter.format(value)
}

/** "45.000.000" o "$ 45.000.000" → 45000000. Devuelve null si está vacío. */
export function parseMoney(input: string): number | null {
  const digits = input.replace(/[^\d]/g, '')
  if (!digits) return null
  return Number(digits)
}

export function formatPercent(ratio: number): string {
  if (!Number.isFinite(ratio)) return '—'
  return `${Math.round(ratio * 100)} %`
}

/** Fecha de hoy en Bogotá como 'yyyy-MM-dd' */
export function todayISO(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

/**
 * Día calendario en Bogotá. Una fecha suelta ('2027-05-08') se usa tal cual;
 * un instante con hora ('2026-09-22T23:30:00Z') se convierte, porque en UTC
 * ya sería el día siguiente.
 */
export function bogotaDay(iso: string): string {
  return /[T ]\d{2}:/.test(iso) ? todayISO(new Date(iso)) : iso.slice(0, 10)
}

/** '2027-05-15' → '15 may 2027' */
export function formatDate(iso: string | null | undefined, pattern = 'd MMM yyyy'): string {
  if (!iso) return '—'
  return format(parseISO(bogotaDay(iso)), pattern, { locale: es })
}

export function formatDateLong(iso: string | null | undefined): string {
  return formatDate(iso, "EEEE d 'de' MMMM 'de' yyyy")
}

/** Días entre hoy (Bogotá) y una fecha 'yyyy-MM-dd'. Negativo si ya pasó. */
export function daysFromToday(iso: string, now: Date = new Date()): number {
  return differenceInCalendarDays(parseISO(bogotaDay(iso)), parseISO(todayISO(now)))
}

/** '16:00:00' → '4:00 p. m.' */
export function formatTime(time: string | null | undefined): string {
  if (!time) return ''
  const [h, m] = time.split(':').map(Number)
  const suffix = h >= 12 ? 'p. m.' : 'a. m.'
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return `${hour12}:${String(m).padStart(2, '0')} ${suffix}`
}

/** timestamptz → valor para <input type="datetime-local"> en hora de Bogotá */
export function toBogotaInput(iso: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso))
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00'
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`
}

/** Valor de <input type="datetime-local"> (hora de Bogotá) → ISO con desfase */
export function fromBogotaInput(local: string): string {
  return `${local.length === 16 ? `${local}:00` : local}${BOGOTA_OFFSET}`
}

/** timestamptz → 'sábado 15 de mayo de 2027, 4:00 p. m.' en hora de Bogotá */
export function formatWeddingDate(iso: string): string {
  const local = toBogotaInput(iso)
  return `${formatDateLong(local.slice(0, 10))}, ${formatTime(local.slice(11))}`
}

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/** plural(1, 'tarea', 'tareas') → '1 tarea' */
export function plural(n: number, singular: string, pluralForm: string): string {
  return `${n} ${n === 1 ? singular : pluralForm}`
}
