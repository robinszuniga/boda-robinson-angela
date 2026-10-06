import { describe, expect, it } from 'vitest'
import { checkTypedPhone, formatPhone, normalizePhone } from '../../src/lib/phones'

describe('checkTypedPhone', () => {
  it('pide los 10 dígitos de un celular escrito a mano', () => {
    expect(checkTypedPhone('300 655 19')).toEqual({ digits: null, error: 'Número incompleto' })
    expect(checkTypedPhone('300 6551912').digits).toBe('573006551912')
  })

  it('con "+" acepta un número de otro país', () => {
    expect(checkTypedPhone('+34 600 260 242').digits).toBe('34600260242')
  })

  it('lo que no tiene números no pasa', () => {
    expect(checkTypedPhone('el de la finca').digits).toBeNull()
  })
})

describe('formatPhone con números guardados como se tecleaban', () => {
  it('muestra con +57 un celular guardado sin indicativo', () => {
    expect(formatPhone('300 6551912')).toBe('+57 300 655 1912')
    expect(formatPhone('3006551912')).toBe('+57 300 655 1912')
  })

  it('no toca los de otro país', () => {
    expect(formatPhone('34600260242')).toBe('+34600260242')
  })
})

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

describe('números con indicativo escrito', () => {
  it('con +57 el número tiene que venir completo', () => {
    // Antes "+57 300123" pasaba como si fuera de otro país y se guardaba 57300123
    expect(normalizePhone('+57 300123')).toEqual({ digits: null, error: 'Número incompleto' })
    expect(checkTypedPhone('+57 300123')).toEqual({ digits: null, error: 'Número incompleto' })
    expect(normalizePhone('+57 300 123 45678')).toEqual({ digits: null, error: 'Número demasiado largo' })
    expect(normalizePhone('+57 300 123 4567')).toEqual({ digits: '573001234567' })
  })

  it('un extranjero de 10 dígitos conserva su + para no confundirse con uno colombiano', () => {
    expect(normalizePhone('+32 2 123 45 67')).toEqual({ digits: '+3221234567', warning: 'De otro país' })
    // Dinamarca también mide 10 aunque no empiece por 3: al releerlo se le pondría el 57
    expect(normalizePhone('+45 12 34 56 78').digits).toBe('+4512345678')
    // Lo ya guardado se vuelve a leer igual
    expect(normalizePhone('+3221234567').digits).toBe('+3221234567')
  })

  it('los demás extranjeros siguen guardándose solo con dígitos', () => {
    expect(normalizePhone('+34 600 260 242').digits).toBe('34600260242')
    expect(normalizePhone('+54 351 619 1096').digits).toBe('543516191096')
  })

  it('en pantalla, uno guardado con + no se muestra como colombiano', () => {
    // Antes +32 2 123 45 67 se veía como +57 322 123 4567
    expect(formatPhone('+3221234567')).toBe('+3221234567')
    expect(formatPhone('3221234567')).toBe('+57 322 123 4567')
  })
})

describe('formatPhone', () => {
  it('muestra los colombianos separados y los demás con +', () => {
    expect(formatPhone('573001234567')).toBe('+57 300 123 4567')
    expect(formatPhone('13055551234')).toBe('+13055551234')
    expect(formatPhone(null)).toBe('')
  })
})
