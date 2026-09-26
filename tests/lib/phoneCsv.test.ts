import { describe, expect, it } from 'vitest'
import { applyManual, parseCsv, phonesCsv, readPhonesCsv } from '../../src/lib/phoneCsv'
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

describe('seguridad y casos raros del CSV', () => {
  it('neutraliza lo que Excel tomaría como fórmula', () => {
    const g = guest({ name: '=HYPERLINK("http://malo","clic")' })
    const [, fila] = phonesCsv([g]).split(/\r?\n/)
    expect(fila).toContain("'=HYPERLINK")
  })

  it('marca las filas con nombre repetido en vez de adivinar', () => {
    const a = guest({ name: 'Raul Daza' })
    const b = guest({ name: 'Raul Daza' })
    const csv = ['Nombre;Teléfono', 'Raul Daza;3001112222', 'Raul Daza;3003334444'].join('\n')
    const result = readPhonesCsv(csv, [a, b])
    expect(result.updates).toEqual([{ id: a.id, phone: '573001112222' }])
    expect(result.counts.repetido).toBe(1)
    expect(result.rows[1]).toMatchObject({ status: 'repetido', note: 'Nombre repetido: usa la columna Código' })
  })
})

describe('applyManual', () => {
  const marta = guest({ name: 'Tía Marta' })
  const base = {
    kind: 'planilla' as const,
    rows: [],
    contacts: [
      { name: 'Martica la del Valle', phone: '3001112222' },
      { name: 'Marta oficina', phone: '3003334444' },
    ],
    updates: [],
    counts: {
      nuevo: 0,
      cambio: 0,
      igual: 0,
      sin_telefono: 0,
      invalido: 0,
      desconocido: 0,
      repetido: 0,
    },
  }

  it('toma el contacto que él eligió, aunque esté guardado con apodo', () => {
    const result = applyManual(base, [marta], { [marta.id]: 'Martica la del Valle — 3001112222' })
    expect(result.updates).toEqual([{ id: marta.id, phone: '573001112222' }])
    expect(result.rows[0]).toMatchObject({ status: 'nuevo', note: 'A mano · Contacto: Martica la del Valle' })
  })

  it('también sirve escribiendo solo el nombre del contacto o el número directo', () => {
    expect(applyManual(base, [marta], { [marta.id]: 'marta oficina' }).updates).toEqual([
      { id: marta.id, phone: '573003334444' },
    ])
    expect(applyManual(base, [marta], { [marta.id]: '300 123 4567' }).updates).toEqual([
      { id: marta.id, phone: '573001234567' },
    ])
  })

  it('avisa si lo escrito no sirve como teléfono y no lo guarda', () => {
    const result = applyManual(base, [marta], { [marta.id]: 'el de la finca' })
    expect(result.rows[0]).toMatchObject({ status: 'invalido' })
    expect(result.updates).toEqual([])
  })

  it('manda sobre lo que el archivo había encontrado y deja quietos a los demás', () => {
    const juan = guest({ name: 'Juan' })
    const csv = ['Nombre;Teléfono', 'Tía Marta;3009998877', 'Juan;3005554444'].join('\n')
    const delArchivo = readPhonesCsv(csv, [marta, juan])
    const result = applyManual({ ...delArchivo, contacts: base.contacts }, [marta, juan], {
      [marta.id]: 'Marta oficina',
    })
    expect(result.updates).toEqual([
      { id: marta.id, phone: '573003334444' },
      { id: juan.id, phone: '573005554444' },
    ])
    expect(result.rows).toHaveLength(2)
  })

  it('ignora lo vacío y lo que no corresponde a un invitado', () => {
    expect(applyManual(base, [marta], { [marta.id]: '   ' })).toBe(base)
    expect(applyManual(base, [marta], { 'otro-id': '3001234567' }).rows).toEqual([])
  })
})
