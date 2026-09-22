import { describe, expect, it } from 'vitest'
import {
  DEFAULT_INVITATION,
  DEFAULT_REMINDER,
  renderMessage,
  unknownFields,
  type MessageValues,
} from '../../src/lib/messages'

const values: MessageValues = {
  nombre: 'Tía Marta',
  novios: 'Robinson y Ángela',
  fecha: 'sábado 8 de mayo de 2027 a las 5:00 p. m.',
  lugar: 'Casa Sotillo',
  link: 'https://ejemplo.co/rsvp/abc',
  limite: '8 de abril',
}

describe('renderMessage', () => {
  it('reemplaza los campos de la plantilla por defecto', () => {
    expect(renderMessage(DEFAULT_INVITATION, values)).toBe(
      '¡Hola, Tía Marta!\nRobinson y Ángela queremos invitarte a nuestra boda el sábado 8 de mayo de 2027 a las 5:00 p. m.\nConfirma tu asistencia aquí: https://ejemplo.co/rsvp/abc',
    )
    expect(renderMessage(DEFAULT_REMINDER, values)).toContain('¡Hola, Tía Marta!')
  })

  it('usa el mismo campo varias veces y respeta los saltos de línea', () => {
    expect(renderMessage('{nombre}, {nombre}\n\nen {lugar}', values)).toBe('Tía Marta, Tía Marta\n\nen Casa Sotillo')
  })

  it('deja tal cual lo que no reconoce, para que se note el error', () => {
    expect(renderMessage('Hola {nombrre}', values)).toBe('Hola {nombrre}')
    expect(unknownFields('Hola {nombrre} y {lugar}')).toEqual(['nombrre'])
    expect(unknownFields(DEFAULT_INVITATION)).toEqual([])
  })

  it('si un campo está vacío no deja espacios de sobra', () => {
    const sinLimite = { ...values, limite: '' }
    expect(renderMessage('Responde antes del {limite} por favor', sinLimite)).toBe('Responde antes del por favor')
    expect(renderMessage('  {limite}  ', sinLimite)).toBe('')
  })
})
