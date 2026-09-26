import { describe, expect, it } from 'vitest'
import { googleContacts, matchContacts, nameScore, readPhonesFile } from '../../src/lib/googleContacts'
import { parseCsv } from '../../src/lib/phoneCsv'
import { guest } from './factories'

const HEADER =
  'First Name,Middle Name,Last Name,Phonetic First Name,Nickname,File As,Organization Name,Labels,E-mail 1 - Value,Phone 1 - Label,Phone 1 - Value,Phone 2 - Label,Phone 2 - Value'

const csv = (...filas: string[]) => [HEADER, ...filas].join('\n')

/** first,middle,last,…,phone1,…,phone2 */
const fila = (first: string, last: string, phone1: string, phone2 = '') =>
  `${first},,${last},,,,,,,Mobile,${phone1},Home,${phone2}`

describe('googleContacts', () => {
  it('saca nombre y teléfono de la exportación de Google', () => {
    const contacts = googleContacts(parseCsv(csv(fila('Abigail', 'Bruges', '+57 300 123 4567'))))
    expect(contacts).toEqual([{ name: 'Abigail Bruges', phone: '+57 300 123 4567' }])
  })

  it('con varios números toma el primero y deja fuera a quien no tiene teléfono', () => {
    const contacts = googleContacts(
      parseCsv(csv(fila('Ana', 'Cotes', '3001112222 ::: 3003334444'), fila('Sin', 'Numero', ''))),
    )
    expect(contacts).toEqual([{ name: 'Ana Cotes', phone: '3001112222' }])
  })

  it('entiende también el formato viejo con la columna Name', () => {
    const viejo = ['Name,Given Name,Family Name,Phone 1 - Value', 'Tía Marta,Marta,Pérez,3001234567'].join('\n')
    expect(googleContacts(parseCsv(viejo))).toEqual([{ name: 'Tía Marta', phone: '3001234567' }])
  })

  it('devuelve null si el archivo no es de Google', () => {
    expect(googleContacts(parseCsv('Código;Invitado;Grupo;Teléfono\nabc;Juan;Amigos;3001234567'))).toBeNull()
  })
})

describe('nameScore', () => {
  const w = (name: string) => name.toLowerCase().split(' ')

  it('distingue el mismo nombre, el que cabe dentro del otro y el que solo comparte el de pila', () => {
    expect(nameScore(w('abigail bruges'), w('abigail bruges'))).toBe(3)
    expect(nameScore(w('andres rodriguez zuniga'), w('andres rodriguez'))).toBe(2)
    expect(nameScore(w('amarilis'), w('amarilis gomez'))).toBe(1)
    expect(nameScore(w('alberto ariza'), w('alberto cuan'))).toBe(0)
    expect(nameScore(w('juan'), [])).toBe(0)
  })
})

describe('matchContacts', () => {
  it('le pone el teléfono a quien coincide e ignora los contactos que no son invitados', () => {
    const abigail = guest({ name: 'Abigail Bruges' })
    const result = matchContacts(
      [
        { name: 'Abigail Bruges', phone: '3001234567' },
        { name: 'Dentista', phone: '3009999999' },
      ],
      [abigail],
    )
    expect(result.kind).toBe('google')
    expect(result.updates).toEqual([{ id: abigail.id, phone: '573001234567' }])
    expect(result.rows[0]).toMatchObject({ status: 'nuevo', note: undefined })
    expect(result.counts.desconocido).toBe(0)
  })

  it('avisa con quién coincidió cuando el contacto se llama distinto', () => {
    const andres = guest({ name: 'Andres Rodriguez Zuñiga' })
    const result = matchContacts([{ name: 'Andrés Rodríguez', phone: '3001112222' }], [andres])
    expect(result.rows[0]).toMatchObject({ status: 'nuevo', note: 'Contacto: Andrés Rodríguez' })
    expect(result.updates).toEqual([{ id: andres.id, phone: '573001112222' }])
  })

  it('no adivina cuando hay varios contactos parecidos con números distintos', () => {
    const amarilis = guest({ name: 'Amarilis' })
    const result = matchContacts(
      [
        { name: 'Amarilis Gomez', phone: '3001112222' },
        { name: 'Amarilis Perez', phone: '3003334444' },
      ],
      [amarilis],
    )
    expect(result.rows[0]).toMatchObject({ status: 'repetido', note: '2 contactos parecidos: ponlo a mano' })
    expect(result.updates).toEqual([])
  })

  it('dice quién no está en la agenda y no repite el que ya estaba guardado', () => {
    const perdido = guest({ name: 'Alexa Barliza' })
    const yaEsta = guest({ name: 'Ana Cotes', phone: '573001112222' })
    const result = matchContacts([{ name: 'Ana Cotes', phone: '300 111 2222' }], [perdido, yaEsta])
    expect(result.rows[0]).toMatchObject({ status: 'sin_telefono', note: 'No está en tus contactos' })
    expect(result.rows[1].status).toBe('igual')
    expect(result.updates).toEqual([])
  })
})

describe('readPhonesFile', () => {
  it('elige solo el lector que corresponde a cada archivo', () => {
    const juan = guest({ name: 'Juan' })
    expect(readPhonesFile(csv(fila('Juan', '', '3001234567')), [juan]).kind).toBe('google')
    expect(readPhonesFile('Nombre;Teléfono\nJuan;3001234567', [juan]).kind).toBe('planilla')
    expect(readPhonesFile('Nombre;Teléfono\nJuan;3001234567', [juan]).updates).toEqual([
      { id: juan.id, phone: '573001234567' },
    ])
  })
})
