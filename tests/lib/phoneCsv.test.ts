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

  it('con dos invitados del mismo nombre no le adivina el teléfono a ninguno', () => {
    const a = guest({ name: 'Raul Daza' })
    const b = guest({ name: 'Raul Daza' })
    const csv = ['Nombre;Teléfono', 'Raul Daza;3001112222', 'Raul Daza;3003334444'].join('\n')
    const result = readPhonesCsv(csv, [a, b])
    expect(result.updates).toEqual([])
    expect(result.counts.repetido).toBe(2)
    expect(result.rows[0]).toMatchObject({ status: 'repetido', note: 'Nombre repetido: usa la columna Código' })
  })

  it('tampoco cuando el archivo trae una sola fila con ese nombre', () => {
    const a = guest({ name: 'Raul Daza' })
    const b = guest({ name: 'Raul Daza' })
    const result = readPhonesCsv(['Nombre;Teléfono', 'Raul Daza;3001112222'].join('\n'), [a, b])
    expect(result.updates).toEqual([])
    expect(result.counts.repetido).toBe(1)
  })

  it('con el código sí sabe de cuál de los dos es', () => {
    const a = guest({ name: 'Raul Daza' })
    const b = guest({ name: 'Raul Daza' })
    const csv = ['Código;Invitado;Teléfono', `${b.id};Raul Daza;3001112222`].join('\n')
    expect(readPhonesCsv(csv, [a, b]).updates).toEqual([{ id: b.id, phone: '573001112222' }])
  })

  it('no le pone a un invitado un número que ya está guardado en otro', () => {
    // Raul Daza hijo ya tiene su número; el archivo trae ese mismo para el papá
    const hijo = guest({ name: 'Raul Daza', phone: '573107187757' })
    const papa = guest({ name: 'Sr Raul Daza' })
    const result = readPhonesCsv(['Nombre;Teléfono', 'Sr Raul Daza;3107187757'].join('\n'), [hijo, papa])
    expect(result.updates).toEqual([])
    expect(result.rows[0]).toMatchObject({ status: 'repetido', note: 'Ese número ya es de Raul Daza' })
  })

  it('reconoce el número repetido aunque el otro lo tenga guardado como se tecleó', () => {
    // Así quedaron guardados los que se escribieron a mano en el formulario
    const alberto = guest({ name: 'Alberto Cuan', phone: '300 6551912' })
    const otro = guest({ name: 'Rafa Zuñiga' })
    const result = readPhonesCsv(['Nombre;Teléfono', 'Rafa Zuñiga;3006551912'].join('\n'), [alberto, otro])
    expect(result.updates).toEqual([])
    expect(result.rows[0]).toMatchObject({ status: 'repetido', note: 'Ese número ya es de Alberto Cuan' })
  })

  it('en cadena: si una fila se bloquea, ese invitado conserva su número y nadie más lo puede tomar', () => {
    // Ana no se puede pasar al de Bruno; entonces Carla tampoco puede quedarse con el de Ana
    const ana = guest({ name: 'Ana', phone: '573001110000' })
    const bruno = guest({ name: 'Bruno', phone: '573002220000' })
    const carla = guest({ name: 'Carla' })
    const csv = ['Código;Invitado;Teléfono', `${ana.id};Ana;573002220000`, `${carla.id};Carla;573001110000`].join('\n')
    const result = readPhonesCsv(csv, [ana, bruno, carla])
    expect(result.updates).toEqual([])
    expect(result.rows[0]).toMatchObject({ status: 'repetido', note: 'Ese número ya es de Bruno' })
    expect(result.rows[1]).toMatchObject({ status: 'repetido', note: 'Ese número ya es de Ana' })
  })

  it('en cadena también cuando el primer bloqueo es entre dos filas nuevas', () => {
    const ana = guest({ name: 'Ana', phone: '573001110000' })
    const bruno = guest({ name: 'Bruno' })
    const carla = guest({ name: 'Carla' })
    const csv = [
      'Código;Invitado;Teléfono',
      `${ana.id};Ana;573003330000`,
      `${bruno.id};Bruno;573001110000`,
      `${carla.id};Carla;573003330000`,
    ].join('\n')
    const result = readPhonesCsv(csv, [ana, bruno, carla])
    expect(result.updates).toEqual([])
    expect(result.rows[1]).toMatchObject({ status: 'repetido', note: 'Ese número ya es de Ana' })
  })

  it('un intercambio de números entre dos invitados sí se deja', () => {
    const ana = guest({ name: 'Ana', phone: '573001110000' })
    const bruno = guest({ name: 'Bruno', phone: '573002220000' })
    const csv = ['Nombre;Teléfono', 'Ana;3002220000', 'Bruno;3001110000'].join('\n')
    expect(readPhonesCsv(csv, [ana, bruno]).updates).toEqual([
      { id: ana.id, phone: '573002220000' },
      { id: bruno.id, phone: '573001110000' },
    ])
  })

  it('el mismo invitado dos veces con su código: toma la primera y avisa de la otra', () => {
    const ana = guest({ name: 'Ana' })
    const csv = ['Código;Invitado;Teléfono', `${ana.id};Ana;3005556666`, `${ana.id};Ana;3007778888`].join('\n')
    const result = readPhonesCsv(csv, [ana])
    expect(result.updates).toEqual([{ id: ana.id, phone: '573005556666' }])
    expect(result.rows[1]).toMatchObject({ status: 'repetido', note: 'Ese invitado viene dos veces en el archivo' })
  })

  it('un número guardado como se tecleó cuenta como el mismo, no como un cambio', () => {
    const alberto = guest({ name: 'Alberto Cuan', phone: '300 6551912' })
    const result = readPhonesCsv(['Nombre;Teléfono', 'Alberto Cuan;3006551912'].join('\n'), [alberto])
    expect(result.rows[0].status).toBe('igual')
    expect(result.updates).toEqual([])
  })

  it('pero sí lo deja si en el mismo archivo el otro cambia de número', () => {
    const a = guest({ name: 'Ana', phone: '573001112222' })
    const b = guest({ name: 'Bruno' })
    const csv = ['Nombre;Teléfono', 'Ana;3009998888', 'Bruno;3001112222'].join('\n')
    expect(readPhonesCsv(csv, [a, b]).updates).toEqual([
      { id: a.id, phone: '573009998888' },
      { id: b.id, phone: '573001112222' },
    ])
  })

  it('no le deja el mismo número a dos invitados distintos', () => {
    const ana = guest({ name: 'Ana' })
    const bruno = guest({ name: 'Bruno' })
    const csv = ['Nombre;Teléfono', 'Ana;3001112222', 'Bruno;3001112222'].join('\n')
    const result = readPhonesCsv(csv, [ana, bruno])
    expect(result.updates).toEqual([])
    expect(result.rows[0]).toMatchObject({ status: 'repetido', note: 'Ese número le quedaría a dos invitados' })
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
    expect(result.rows[0]).toMatchObject({ status: 'invalido', note: 'Elige un contacto de la lista' })
    expect(result.updates).toEqual([])
    // Sin agenda cargada, lo que se escribe solo puede ser un número
    const sinAgenda = applyManual({ ...base, contacts: [] }, [marta], { [marta.id]: 'el de la finca' })
    expect(sinAgenda.rows[0]).toMatchObject({ status: 'invalido', note: 'No tiene números' })
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

  it('espera a que el número esté completo antes de darlo por bueno', () => {
    const sinAgenda = { ...base, contacts: [] }
    // Mientras teclea 3001234567: con 8 o 9 dígitos pasaría sin el 57 y no sirve
    expect(applyManual(sinAgenda, [marta], { [marta.id]: '30012345' }).updates).toEqual([])
    expect(applyManual(sinAgenda, [marta], { [marta.id]: '300123456' }).rows[0]).toMatchObject({
      status: 'invalido',
      note: 'Número incompleto',
    })
    expect(applyManual(sinAgenda, [marta], { [marta.id]: '3001234567' }).updates).toEqual([
      { id: marta.id, phone: '573001234567' },
    ])
    // Con indicativo escrito a mano sí se acepta un número de otro país
    expect(applyManual(sinAgenda, [marta], { [marta.id]: '+34 600 260 242' }).updates).toEqual([
      { id: marta.id, phone: '34600260242' },
    ])
  })

  it('al dictar a mano tampoco deja repetir un número que ya es de otro invitado', () => {
    const hijo = guest({ name: 'Raul Daza', phone: '573107187757' })
    const result = applyManual({ ...base, contacts: [] }, [marta, hijo], { [marta.id]: '310 718 7757' })
    expect(result.updates).toEqual([])
    expect(result.rows[0]).toMatchObject({ status: 'repetido', note: 'Ese número ya es de Raul Daza' })
  })

  it('ignora lo vacío y lo que no corresponde a un invitado', () => {
    expect(applyManual(base, [marta], { [marta.id]: '   ' })).toBe(base)
    expect(applyManual(base, [marta], { 'otro-id': '3001234567' }).rows).toEqual([])
  })
})
