import { describe, expect, it } from 'vitest'
import { formatPhone, normalizePhone } from '../../src/lib/phones'

describe('normalizePhone', () => {
  it('le pone el indicativo a los celulares colombianos de 10 dígitos', () => {
    expect(normalizePhone('300 123 4567')).toEqual({ digits: '573001234567' })
    expect(normalizePhone('(300) 123-4567')).toEqual({ digits: '573001234567' })
    expect(normalizePhone('0300 123 4567')).toEqual({ digits: '573001234567' })
  })

  it('deja igual los que ya vienen con indicativo', () => {
    expect(normalizePhone('+57 300 123 4567')).toEqual({ digits: '573001234567' })
    expect(normalizePhone('573001234567')).toEqual({ digits: '573001234567' })
  })

  it('avisa cuando no parece celular o es de otro país', () => {
    expect(normalizePhone('601 123 4567')).toEqual({ digits: '576011234567', warning: 'No parece celular' })
    expect(normalizePhone('+1 305 555 1234')).toEqual({ digits: '13055551234', warning: 'De otro país' })
    expect(normalizePhone('123456789')).toMatchObject({ warning: 'Revisa el indicativo' })
  })

  it('rechaza lo que no sirve y trata el vacío como "sin teléfono"', () => {
    expect(normalizePhone('')).toEqual({ digits: null })
    expect(normalizePhone('   ')).toEqual({ digits: null })
    expect(normalizePhone('123 45')).toEqual({ digits: null, error: 'Número incompleto' })
    expect(normalizePhone('1234567890123456')).toEqual({ digits: null, error: 'Número demasiado largo' })
    expect(normalizePhone('sin número')).toEqual({ digits: null, error: 'No tiene números' })
  })
})

describe('formatPhone', () => {
  it('muestra los colombianos separados y los demás con +', () => {
    expect(formatPhone('573001234567')).toBe('+57 300 123 4567')
    expect(formatPhone('13055551234')).toBe('+13055551234')
    expect(formatPhone(null)).toBe('')
  })
})
