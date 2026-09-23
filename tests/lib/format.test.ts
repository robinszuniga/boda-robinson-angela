import { describe, expect, it } from 'vitest'
import {
  bogotaDay,
  daysFromToday,
  formatCOP,
  formatCOPShort,
  formatDate,
  formatTime,
  fromBogotaInput,
  parseMoney,
  toBogotaInput,
  todayISO,
} from '../../src/lib/format'
import { getCountdown } from '../../src/lib/countdown'

describe('dinero en COP', () => {
  it('formatea sin decimales y con puntos de miles', () => {
    expect(formatCOP(45_000_000)).toBe('$ 45.000.000')
    expect(formatCOP(null)).toBe('—')
  })

  it('formato corto para gráficos', () => {
    expect(formatCOPShort(45_000_000)).toBe('$ 45 M')
    expect(formatCOPShort(2_500_000)).toBe('$ 2,5 M')
    expect(formatCOPShort(850_000)).toBe('$ 850 mil')
  })

  it('interpreta lo que escribe el usuario', () => {
    expect(parseMoney('45.000.000')).toBe(45_000_000)
    expect(parseMoney('$ 1.200')).toBe(1_200)
    expect(parseMoney('')).toBeNull()
  })
})

describe('fechas y horas', () => {
  it('formatea fechas en español', () => {
    expect(formatDate('2027-05-15')).toBe('15 may 2027')
  })

  it('formatea horas en 12 h', () => {
    expect(formatTime('16:00:00')).toBe('4:00 p. m.')
    expect(formatTime('00:30')).toBe('12:30 a. m.')
    expect(formatTime('12:05')).toBe('12:05 p. m.')
  })

  it('convierte entre timestamptz y la hora local de Bogotá', () => {
    expect(toBogotaInput('2027-05-15T21:00:00Z')).toBe('2027-05-15T16:00')
    expect(fromBogotaInput('2027-05-15T16:00')).toBe('2027-05-15T16:00:00-05:00')
    expect(new Date(fromBogotaInput('2027-05-15T16:00')).toISOString()).toBe('2027-05-15T21:00:00.000Z')
  })

  it('usa la fecha de Bogotá para "hoy"', () => {
    // 03:00 UTC del 21 = 22:00 del 20 en Bogotá
    expect(todayISO(new Date('2026-09-21T03:00:00Z'))).toBe('2026-09-20')
    expect(daysFromToday('2026-09-25', new Date('2026-09-21T03:00:00Z'))).toBe(5)
  })
})

describe('getCountdown', () => {
  it('descompone el tiempo restante', () => {
    const now = new Date('2027-05-10T12:00:00Z')
    const target = new Date('2027-05-15T14:30:15Z')
    expect(getCountdown(target, now)).toEqual({ days: 5, hours: 2, minutes: 30, seconds: 15, isPast: false })
  })

  it('marca cuando ya pasó', () => {
    expect(getCountdown(new Date('2020-01-01'), new Date('2021-01-01')).isPast).toBe(true)
  })
})

describe('fechas con hora (timestamptz)', () => {
  it('lee el día en Bogotá, no en UTC', () => {
    // 22 sep 8:30 p. m. en Bogotá ya es 23 de septiembre en UTC
    expect(bogotaDay('2026-09-23T01:30:00.000Z')).toBe('2026-09-22')
    expect(formatDate('2026-09-23T01:30:00.000Z')).toBe('22 sep 2026')
  })

  it('una fecha sin hora se usa tal cual', () => {
    expect(bogotaDay('2027-05-08')).toBe('2027-05-08')
    expect(formatDate('2027-05-08')).toBe('8 may 2027')
  })

  it('cuenta los días desde hoy en Bogotá', () => {
    const ahora = new Date('2026-09-23T14:00:00.000Z') // 9 a. m. en Bogotá
    expect(daysFromToday('2026-09-23T01:30:00.000Z', ahora)).toBe(-1)
    expect(daysFromToday('2026-09-23T14:00:00.000Z', ahora)).toBe(0)
  })
})
