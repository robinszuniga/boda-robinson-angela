import { describe, expect, it } from 'vitest'
import { parseGuestLines } from '../../src/lib/guestLines'

describe('parseGuestLines', () => {
  it('lee nombres sueltos, "+N" y acompañantes con nombre, ignorando líneas vacías', () => {
    const lines = parseGuestLines(
      ['Juan Camilo Rojas', '', '  Tía Marta +2 ', 'Familia Pérez: Ana, Tomás y Sara', 'Primo Luis+1'].join('\n'),
      1,
    )
    expect(lines).toEqual([
      { name: 'Juan Camilo Rojas', plusOnes: 1, members: [] },
      { name: 'Tía Marta', plusOnes: 2, members: [] },
      { name: 'Familia Pérez', plusOnes: 3, members: ['Ana', 'Tomás', 'Sara'] },
      { name: 'Primo Luis', plusOnes: 1, members: [] },
    ])
  })

  it('"+0" deja al invitado sin acompañantes aunque el valor por defecto sea otro', () => {
    expect(parseGuestLines('Carlos +0', 2)[0]).toMatchObject({ name: 'Carlos', plusOnes: 0 })
  })

  it('no confunde un nombre con "y" antes de los dos puntos', () => {
    expect(parseGuestLines('Familia Pérez y Gómez: Ana', 0)[0]).toMatchObject({
      name: 'Familia Pérez y Gómez',
      members: ['Ana'],
    })
  })

  it('marca las líneas que no se pueden guardar', () => {
    const [sinNombre, muchos, largo] = parseGuestLines(
      [': Ana', 'Tío Jorge +11', `${'x'.repeat(121)} +1`].join('\n'),
      0,
    )
    expect(sinNombre.error).toBe('Falta el nombre')
    expect(muchos.error).toBe('Máximo 10 acompañantes')
    expect(largo.error).toBe('Nombre muy largo')
  })
})
