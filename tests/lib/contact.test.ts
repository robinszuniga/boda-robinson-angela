import { describe, expect, it } from 'vitest'
import { whatsappLink, whatsappNumber } from '../../src/lib/contact'

describe('whatsappNumber', () => {
  it('le pone el 57 a un celular colombiano guardado sin indicativo', () => {
    expect(whatsappNumber('300 123 4567')).toBe('573001234567')
    expect(whatsappNumber('3001234567')).toBe('573001234567')
  })

  it('deja igual el que ya viene con indicativo', () => {
    expect(whatsappNumber('573001234567')).toBe('573001234567')
    expect(whatsappNumber('+57 300 123 4567')).toBe('573001234567')
    expect(whatsappNumber('34600260242')).toBe('34600260242')
  })

  it('no le pone el 57 a uno de otro país que mide lo mismo que uno colombiano', () => {
    // Bélgica: 10 dígitos y empieza por 3. Con el 57 el mensaje le llegaría a otra persona
    expect(whatsappNumber('+3221234567')).toBe('3221234567')
    expect(whatsappNumber('+32 2 123 45 67')).toBe('3221234567')
    expect(whatsappLink('+3221234567')).toBe('https://wa.me/3221234567')
  })

  it('sin teléfono no arma número', () => {
    expect(whatsappNumber(null)).toBeNull()
    expect(whatsappNumber('sin número')).toBeNull()
    expect(whatsappLink(null)).toBe('https://wa.me/')
  })
})
