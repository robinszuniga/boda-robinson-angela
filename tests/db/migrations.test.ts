import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'

const root = join(import.meta.dirname, '..', '..')
const migrationsDir = join(root, 'supabase', 'migrations')

const COUPLE = 'novio@ejemplo.com'
const STRANGER = 'intruso@ejemplo.com'

type Role = 'anon' | 'authenticated' | 'postgres'

let db: PGlite

async function as(role: Role, email?: string) {
  await db.exec('reset role')
  const claims = email ? JSON.stringify({ email, role }) : ''
  await db.query(`select set_config('request.jwt.claims', $1, false)`, [claims])
  if (role !== 'postgres') await db.exec(`set role ${role}`)
}

async function rows<T>(sql: string, params: unknown[] = []) {
  return (await db.query<T>(sql, params)).rows
}

async function newGuest(name: string, plusOnes = 0) {
  await as('postgres')
  const [g] = await rows<{ id: string; rsvp_token: string }>(
    'insert into public.guests (name, plus_ones_allowed) values ($1, $2) returning id, rsvp_token',
    [name, plusOnes],
  )
  return g
}

beforeAll(async () => {
  db = new PGlite()
  await db.exec(readFileSync(join(root, 'tests', 'db', 'supabaseStubs.sql'), 'utf8'))
  for (const file of readdirSync(migrationsDir).sort()) {
    await db.exec(readFileSync(join(migrationsDir, file), 'utf8'))
  }
  await db.query('insert into public.app_users (email, display_name) values ($1, $2)', [COUPLE, 'Novio'])
})

beforeEach(async () => {
  await as('postgres')
  await db.exec(`
    delete from public.gift_claims; delete from public.gifts; delete from public.guest_members;
    delete from public.guests; delete from public.seating_tables;
    update public.wedding_settings set rsvp_deadline = null;
  `)
})

describe('esquema y datos iniciales', () => {
  it('crea la configuración y las 14 categorías por defecto, con "Otros" de última', async () => {
    await as('authenticated', COUPLE)
    const settings = await rows<{ partner_1_name: string }>('select * from public.wedding_settings')
    expect(settings).toHaveLength(1)
    expect(settings[0].partner_1_name).toBe('Robinson')
    const cats = await rows<{ name: string }>('select name from public.budget_categories order by sort_order')
    expect(cats).toHaveLength(14)
    expect(cats.map((c) => c.name)).toContain('Ceremonia y trámites')
    expect(cats.at(-1)?.name).toBe('Otros')
  })

  it('rechaza acompañantes confirmados por encima de los permitidos', async () => {
    await as('authenticated', COUPLE)
    await expect(
      db.query(`insert into public.guests (name, plus_ones_allowed, plus_ones_confirmed) values ('X', 1, 2)`),
    ).rejects.toThrow(/plus_ones_within_allowed/)
  })

  it('no permite vincular a un invitado consigo mismo ni duplicar la pareja', async () => {
    const a = await newGuest('A')
    const b = await newGuest('B')
    await as('authenticated', COUPLE)
    await expect(
      db.query('insert into public.guest_links (guest_a, guest_b) values ($1, $1)', [a.id]),
    ).rejects.toThrow()
    await db.query('insert into public.guest_links (guest_a, guest_b) values ($1, $2)', [a.id, b.id])
    await expect(
      db.query('insert into public.guest_links (guest_a, guest_b) values ($1, $2)', [b.id, a.id]),
    ).rejects.toThrow(/guest_links_pair_idx/)
  })
})

describe('RLS', () => {
  it('los novios pueden crear y leer invitados', async () => {
    await as('authenticated', COUPLE)
    await db.query(`insert into public.guests (name) values ('Tía Marta')`)
    expect(await rows('select * from public.guests')).toHaveLength(1)
  })

  it('un usuario autenticado que no está en app_users no ve ni crea nada', async () => {
    await newGuest('Tía Marta')
    await as('authenticated', STRANGER)
    expect(await rows('select * from public.guests')).toHaveLength(0)
    expect(await rows('select * from public.wedding_settings')).toHaveLength(0)
    await expect(db.query(`insert into public.guests (name) values ('Colado')`)).rejects.toThrow(
      /row-level security/,
    )
  })

  it('el rol anónimo no tiene acceso directo a las tablas', async () => {
    await newGuest('Tía Marta')
    await as('anon')
    await expect(db.query('select * from public.guests')).rejects.toThrow(/permission denied/)
    await expect(db.query('select * from public.wedding_settings')).rejects.toThrow(/permission denied/)
  })

  it('app_users es de solo lectura desde la app', async () => {
    await as('authenticated', COUPLE)
    await expect(
      db.query(`insert into public.app_users (email, display_name) values ('otro@x.com', 'Otro')`),
    ).rejects.toThrow()
  })

  it('la configuración no se puede borrar desde la app', async () => {
    await as('authenticated', COUPLE)
    await expect(db.query('delete from public.wedding_settings')).rejects.toThrow(/permission denied/)
  })

  it('storage: solo los novios suben archivos al bucket documentos', async () => {
    await as('authenticated', COUPLE)
    await db.query(`insert into storage.objects (bucket_id, name) values ('documentos', 'a.pdf')`)
    await as('authenticated', STRANGER)
    await expect(
      db.query(`insert into storage.objects (bucket_id, name) values ('documentos', 'b.pdf')`),
    ).rejects.toThrow(/row-level security/)
    expect(await rows('select * from storage.objects')).toHaveLength(0)
  })
})

describe('RSVP público', () => {
  it('rsvp_get devuelve solo al invitado del token', async () => {
    const marta = await newGuest('Tía Marta', 1)
    await newGuest('Primo Juan')
    await as('anon')
    const [{ data }] = await rows<{ data: Record<string, unknown> }>(
      'select public.rsvp_get($1) as data',
      [marta.rsvp_token],
    )
    expect(data.guest).toMatchObject({ name: 'Tía Marta', plus_ones_allowed: 1, rsvp_status: 'pendiente' })
    expect(JSON.stringify(data)).not.toContain('Primo Juan')
    expect(data.wedding).toMatchObject({ partner_1_name: 'Robinson', partner_2_name: 'Ángela' })
  })

  it('rsvp_get con token inválido devuelve null', async () => {
    await as('anon')
    const [{ data }] = await rows<{ data: unknown }>('select public.rsvp_get($1) as data', [
      'token-que-no-existe-123',
    ])
    expect(data).toBeNull()
  })

  it('rsvp_submit confirma con acompañantes y rechaza si pasan del máximo', async () => {
    const g = await newGuest('Tía Marta', 2)
    await as('anon')
    await expect(
      db.query(`select public.rsvp_submit($1, 'confirmado', 3, null, null)`, [g.rsvp_token]),
    ).rejects.toThrow(/invalid_plus_ones/)

    const [{ data }] = await rows<{ data: { guest: Record<string, unknown> } }>(
      `select public.rsvp_submit($1, 'confirmado', 2, 'Vegetariana', '¡Felicitaciones!') as data`,
      [g.rsvp_token],
    )
    expect(data.guest).toMatchObject({
      rsvp_status: 'confirmado',
      plus_ones_confirmed: 2,
      dietary: 'Vegetariana',
      guest_message: '¡Felicitaciones!',
    })

    const [{ data: declined }] = await rows<{ data: { guest: Record<string, unknown> } }>(
      `select public.rsvp_submit($1, 'rechazado', 2, null, null) as data`,
      [g.rsvp_token],
    )
    expect(declined.guest).toMatchObject({ rsvp_status: 'rechazado', plus_ones_confirmed: 0 })
  })

  it('rsvp_submit rechaza estados inválidos, tokens falsos y respuestas fuera de plazo', async () => {
    const g = await newGuest('Tía Marta')
    await as('anon')
    await expect(
      db.query(`select public.rsvp_submit($1, 'pendiente', 0, null, null)`, [g.rsvp_token]),
    ).rejects.toThrow(/invalid_status/)
    await expect(
      db.query(`select public.rsvp_submit('falso-falso-falso-falso', 'confirmado', 0, null, null)`),
    ).rejects.toThrow(/invalid_token/)

    await as('postgres')
    await db.exec(`update public.wedding_settings set rsvp_deadline = current_date - 2`)
    await as('anon')
    await expect(
      db.query(`select public.rsvp_submit($1, 'confirmado', 0, null, null)`, [g.rsvp_token]),
    ).rejects.toThrow(/deadline_passed/)
  })

  it('rsvp_claim_gift respeta el cupo de artículos y no limita los aportes en efectivo', async () => {
    const a = await newGuest('Ana')
    const b = await newGuest('Beto')
    await as('postgres')
    const [item] = await rows<{ id: string }>(
      `insert into public.gifts (name, kind, quantity) values ('Licuadora', 'articulo', 1) returning id`,
    )
    const [cash] = await rows<{ id: string }>(
      `insert into public.gifts (name, kind) values ('Luna de miel', 'efectivo') returning id`,
    )

    await as('anon')
    await db.query('select public.rsvp_claim_gift($1, $2, true)', [a.rsvp_token, item.id])
    await expect(
      db.query('select public.rsvp_claim_gift($1, $2, true)', [b.rsvp_token, item.id]),
    ).rejects.toThrow(/gift_unavailable/)

    // Ana lo suelta y Beto puede apartarlo
    await db.query('select public.rsvp_claim_gift($1, $2, false)', [a.rsvp_token, item.id])
    const [{ data }] = await rows<{ data: { gifts: { id: string; remaining: number | null; claimed_by_me: boolean }[] } }>(
      'select public.rsvp_claim_gift($1, $2, true) as data',
      [b.rsvp_token, item.id],
    )
    expect(data.gifts.find((x) => x.id === item.id)).toMatchObject({ remaining: 0, claimed_by_me: true })

    await db.query('select public.rsvp_claim_gift($1, $2, true)', [a.rsvp_token, cash.id])
    await db.query('select public.rsvp_claim_gift($1, $2, true)', [b.rsvp_token, cash.id])
    await as('postgres')
    expect(await rows('select * from public.gift_claims where gift_id = $1', [cash.id])).toHaveLength(2)
  })
})

describe('experiencia del invitado (0005)', () => {
  type View = {
    guest: {
      plus_ones_confirmed: number
      song_request: string | null
      needs_transport: boolean
      table: { number: number; name: string | null } | null
      members: { id: string; name: string; attending: boolean | null; dietary: string | null }[]
    }
    wedding: Record<string, unknown>
  }

  it('acompañantes con nombre: cuenta a los que vienen y guarda su dieta', async () => {
    const g = await newGuest('Carlos Pérez', 2)
    const [ana, sofi] = await rows<{ id: string }>(
      `insert into public.guest_members (guest_id, name, sort_order) values ($1, 'Ana', 1), ($1, 'Sofía', 2) returning id`,
      [g.id],
    )
    await as('anon')
    const members = JSON.stringify([
      { id: ana.id, attending: true, dietary: 'Vegana' },
      { id: sofi.id, attending: false, dietary: '' },
    ])
    const [{ data }] = await rows<{ data: View }>(
      `select public.rsvp_submit($1, 'confirmado', 0, null, null, 'La bicicleta', true, $2::jsonb) as data`,
      [g.rsvp_token, members],
    )
    expect(data.guest.plus_ones_confirmed).toBe(1)
    expect(data.guest.song_request).toBe('La bicicleta')
    expect(data.guest.needs_transport).toBe(true)
    expect(data.guest.members).toEqual([
      { id: ana.id, name: 'Ana', attending: true, dietary: 'Vegana' },
      { id: sofi.id, name: 'Sofía', attending: false, dietary: null },
    ])

    const [{ data: declined }] = await rows<{ data: View }>(
      `select public.rsvp_submit($1, 'rechazado', 0, null, null) as data`,
      [g.rsvp_token],
    )
    expect(declined.guest.plus_ones_confirmed).toBe(0)
    expect(declined.guest.needs_transport).toBe(false)
    expect(declined.guest.members.every((m) => m.attending === false)).toBe(true)
  })

  it('no deja marcar acompañantes de otra invitación', async () => {
    const a = await newGuest('Ana', 1)
    const b = await newGuest('Beto', 1)
    const [ajeno] = await rows<{ id: string }>(
      `insert into public.guest_members (guest_id, name) values ($1, 'Ajeno') returning id`,
      [b.id],
    )
    await rows(`insert into public.guest_members (guest_id, name) values ($1, 'Propio')`, [a.id])
    await as('anon')
    await db.query(`select public.rsvp_submit($1, 'confirmado', 0, null, null, null, false, $2::jsonb)`, [
      a.rsvp_token,
      JSON.stringify([{ id: ajeno.id, attending: true }]),
    ])
    await as('postgres')
    const [row] = await rows<{ attending: boolean | null }>('select attending from public.guest_members where id = $1', [
      ajeno.id,
    ])
    expect(row.attending).toBeNull()
  })

  it('muestra la mesa solo si está activado y el invitado confirmó', async () => {
    const g = await newGuest('Tía Marta')
    await as('postgres')
    const [t] = await rows<{ id: string }>(
      `insert into public.seating_tables (number, name) values (7, 'Familia') returning id`,
    )
    await db.query(`update public.guests set table_id = $1, rsvp_status = 'confirmado' where id = $2`, [t.id, g.id])

    await as('anon')
    const view = async () =>
      (await rows<{ data: View }>('select public.rsvp_get($1) as data', [g.rsvp_token]))[0].data
    expect((await view()).guest.table).toBeNull()

    await as('postgres')
    await db.exec('update public.wedding_settings set show_table_to_guests = true')
    await as('anon')
    expect((await view()).guest.table).toEqual({ number: 7, name: 'Familia' })

    await as('postgres')
    await db.exec('update public.wedding_settings set show_table_to_guests = false')
  })

  it('expone la información para invitados configurada por los novios', async () => {
    const g = await newGuest('Primo Juan')
    await as('postgres')
    await db.exec(`update public.wedding_settings set dress_code = 'Formal', envelope_rain = true`)
    await as('anon')
    const [{ data }] = await rows<{ data: View }>('select public.rsvp_get($1) as data', [g.rsvp_token])
    expect(data.wedding).toMatchObject({ dress_code: 'Formal', envelope_rain: true, ask_song: true })
    await as('postgres')
    await db.exec(`update public.wedding_settings set dress_code = null, envelope_rain = false`)
  })

  it('el rol anónimo no lee acompañantes y sí puede llamar keep_alive', async () => {
    await as('anon')
    await expect(db.query('select * from public.guest_members')).rejects.toThrow(/permission denied/)
    const [{ n }] = await rows<{ n: number }>('select public.keep_alive() as n')
    expect(n).toBe(1)
  })
})

describe('lista de chequeo (0006)', () => {
  it('invitados y acompañantes son adultos por defecto y solo aceptan edades válidas', async () => {
    const g = await newGuest('Abuela Rosa')
    await as('authenticated', COUPLE)
    const [row] = await rows<{ age_group: string }>('select age_group from public.guests where id = $1', [g.id])
    expect(row.age_group).toBe('adulto')
    await db.query(`update public.guests set age_group = 'mayor' where id = $1`, [g.id])
    await db.query(`insert into public.guest_members (guest_id, name, age_group) values ($1, 'Tomás', 'nino')`, [g.id])
    await expect(db.query(`update public.guests set age_group = 'bebe' where id = $1`, [g.id])).rejects.toThrow(
      /invalid input value for enum/,
    )
  })

  it('confirmar desde el link público no cambia la edad de los acompañantes', async () => {
    const g = await newGuest('Carlos Pérez', 1)
    const [tomas] = await rows<{ id: string }>(
      `insert into public.guest_members (guest_id, name, age_group) values ($1, 'Tomás', 'nino') returning id`,
      [g.id],
    )
    await as('anon')
    await db.query(`select public.rsvp_submit($1, 'confirmado', 0, null, null, null, false, $2::jsonb)`, [
      g.rsvp_token,
      JSON.stringify([{ id: tomas.id, attending: true, dietary: 'Menú infantil' }]),
    ])
    await as('postgres')
    const [row] = await rows<{ age_group: string; attending: boolean }>(
      'select age_group, attending from public.guest_members where id = $1',
      [tomas.id],
    )
    expect(row).toEqual({ age_group: 'nino', attending: true })
  })

  it('los novios guardan las notas del coordinador y el anónimo no las ve', async () => {
    const g = await newGuest('Primo Juan')
    await as('authenticated', COUPLE)
    await db.query(`update public.wedding_settings set coordinator_notes = 'Coordinadora: Laura 300 123 4567'`)
    await as('anon')
    const [{ data }] = await rows<{ data: { wedding: Record<string, unknown> } }>('select public.rsvp_get($1) as data', [
      g.rsvp_token,
    ])
    expect(JSON.stringify(data)).not.toContain('Laura')
    await as('postgres')
    await db.exec('update public.wedding_settings set coordinator_notes = null')
  })
})

describe('acompañantes que escribe el invitado (0009)', () => {
  it('crea los acompañantes con los nombres que escribió y los cuenta', async () => {
    const g = await newGuest('Tía Marta', 2)
    await as('anon')
    const [{ data }] = await rows<{ data: { guest: { plus_ones_confirmed: number; members: { name: string }[] } } }>(
      `select public.rsvp_submit($1, 'confirmado', 2, null, null, null, false, null, $2::jsonb) as data`,
      [g.rsvp_token, JSON.stringify(['Luis Pérez', '  Ana  '])],
    )
    expect(data.guest.plus_ones_confirmed).toBe(2)
    expect(data.guest.members.map((m) => m.name)).toEqual(['Luis Pérez', 'Ana'])
  })

  it('no acepta más acompañantes de los permitidos ni nombres vacíos', async () => {
    const g = await newGuest('Primo Juan', 1)
    await as('anon')
    await expect(
      db.query(`select public.rsvp_submit($1, 'confirmado', 2, null, null, null, false, null, $2::jsonb)`, [
        g.rsvp_token,
        JSON.stringify(['Uno', 'Dos']),
      ]),
    ).rejects.toThrow(/invalid_plus_ones/)
    await expect(
      db.query(`select public.rsvp_submit($1, 'confirmado', 1, null, null, null, false, null, $2::jsonb)`, [
        g.rsvp_token,
        JSON.stringify(['   ']),
      ]),
    ).rejects.toThrow(/invalid_member_name/)
  })

  it('responder dos veces no duplica ni borra los acompañantes ya guardados', async () => {
    const g = await newGuest('Carlos', 2)
    await as('anon')
    const submit = (names: string[]) =>
      db.query(`select public.rsvp_submit($1, 'confirmado', $3, null, null, null, false, null, $2::jsonb)`, [
        g.rsvp_token,
        JSON.stringify(names),
        names.length,
      ])
    await submit(['Ana', 'Luis'])
    await submit(['Sofía'])
    await as('postgres')
    const members = await rows<{ name: string }>(
      'select name from public.guest_members where guest_id = $1 order by sort_order',
      [g.id],
    )
    expect(members.map((m) => m.name)).toEqual(['Ana', 'Luis'])
  })

  it('el link público no puede reemplazar la lista que cargaron los novios (0012)', async () => {
    const g = await newGuest('Familia Ruiz', 2)
    await rows(`insert into public.guest_members (guest_id, name, age_group) values ($1, 'Tomás', 'nino')`, [g.id])
    await as('anon')
    // Sin p_members, como lo haría una llamada directa a la API
    await db.query(`select public.rsvp_submit($1, 'confirmado', 1, null, null, null, false, null, $2::jsonb)`, [
      g.rsvp_token,
      JSON.stringify(['Intruso']),
    ])
    await as('postgres')
    const members = await rows<{ name: string; age_group: string }>(
      'select name, age_group from public.guest_members where guest_id = $1',
      [g.id],
    )
    expect(members).toEqual([{ name: 'Tomás', age_group: 'nino' }])
  })

  it('si los novios ya pusieron los acompañantes, manda la lista con casillas y no se tocan', async () => {
    const g = await newGuest('Familia Pérez', 2)
    const [ana] = await rows<{ id: string }>(
      `insert into public.guest_members (guest_id, name, age_group) values ($1, 'Ana', 'nino') returning id`,
      [g.id],
    )
    await as('anon')
    await db.query(`select public.rsvp_submit($1, 'confirmado', 1, null, null, null, false, $2::jsonb, $3::jsonb)`, [
      g.rsvp_token,
      JSON.stringify([{ id: ana.id, attending: true }]),
      JSON.stringify(['Intruso']),
    ])
    await as('postgres')
    const members = await rows<{ name: string; age_group: string }>(
      'select name, age_group from public.guest_members where guest_id = $1',
      [g.id],
    )
    expect(members).toEqual([{ name: 'Ana', age_group: 'nino' }])
  })
})

describe('setup.sql', () => {
  it('está sincronizado con las migraciones', () => {
    const setup = readFileSync(join(root, 'supabase', 'setup.sql'), 'utf8')
    for (const file of readdirSync(migrationsDir)) {
      const sql = readFileSync(join(migrationsDir, file), 'utf8').trim()
      expect(setup, `setup.sql desactualizado: ejecuta npm run db:bundle (${file})`).toContain(sql)
    }
  })
})
