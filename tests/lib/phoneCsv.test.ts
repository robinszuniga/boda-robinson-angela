import { describe, expect, it } from 'vitest'
import { parseCsv, phonesCsv, readPhonesCsv } from '../../src/lib/phoneCsv'
import { guest } from './factories'

describe('phonesCsv', () => {
  it('arma la planilla con el código de cada invitado y su teléfono actual', () => {
    const marta = guest({ name: 'Tía Marta; la del Valle', guest_group: 'familia_novia', phone: '573001234567' })
    const juan = guest({ name: 'Juan', guest_group: 'amigos' })
    const [header, fila1, fila2] = phonesCsv([marta, juan]).split('\r\n')
    expect(header).toBe('Código;Invitado;Grupo;Teléfono')
    expect(fila1).toBe(`${marta.id};"Tía Marta; la del Valle";Familia de la novia;573001234567`)
    expect(fila2).toBe(`${juan.id};Juan;Amigos;`)
  })
})

describe('parseCsv', () => {
  it('entiende comillas, comas o punto y coma, BOM y saltos de Windows', () => {
    expect(parseCsv('﻿a;b\r\n"x;1";2\r\n')).toEqual([
      ['a', 'b'],
      ['x;1', '2'],
    ])
    expect(parseCsv('a,b\n1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
    expect(parseCsv('a;b\n"dice ""hola""";2')).toEqual([
      ['a', 'b'],
      ['dice "hola"', '2'],
    ])
  })
})

describe('readPhonesCsv', () => {
  const marta = guest({ name: 'Tía Marta' })
  const juan = guest({ name: 'Juan Pérez', phone: '573001112222' })
  const guests = [marta, juan]

  it('cruza por código, normaliza y solo guarda lo que cambia', () => {
    const csv = [
      'Código;Invitado;Grupo;Teléfono',
      `${marta.id};Tía Marta;Familia;300 123 4567`,
      `${juan.id};Juan Pérez;Amigos;+57 300 111 2222`,
    ].join('\n')
    const result = readPhonesCsv(csv, guests)
    expect(result.updates).toEqual([{ id: marta.id, phone: '573001234567' }])
    expect(result.counts).toMatchObject({ nuevo: 1, igual: 1 })
  })

  it('si no viene el código cruza por nombre, sin importar tildes ni mayúsculas', () => {
    const result = readPhonesCsv('Nombre;Teléfono\nTIA MARTA;3001234567', guests)
    expect(result.updates).toEqual([{ id: marta.id, phone: '573001234567' }])
  })

  it('sin encabezado reconocible asume nombre y teléfono', () => {
    const result = readPhonesCsv('Tía Marta;3001234567', guests)
    expect(result.updates).toEqual([{ id: marta.id, phone: '573001234567' }])
  })

  it('reporta filas vacías, números malos e invitados que no existen', () => {
    const csv = [
      'Código;Invitado;Grupo;Teléfono',
      `${marta.id};Tía Marta;Familia;`,
      `${juan.id};Juan Pérez;Amigos;123`,
      ';Desconocida;Amigos;3001234567',
    ].join('\n')
    const result = readPhonesCsv(csv, guests)
    expect(result.updates).toEqual([])
    expect(result.counts).toMatchObject({ sin_telefono: 1, invalido: 1, desconocido: 1 })
    expect(result.rows[1]).toMatchObject({ status: 'invalido', note: 'Número incompleto' })
    expect(result.rows[2]).toMatchObject({ status: 'desconocido', name: 'Desconocida' })
  })
})
