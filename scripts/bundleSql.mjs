// Une las migraciones en supabase/setup.sql para pegarlas de una vez en el SQL Editor de Supabase.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const dir = join(import.meta.dirname, '..', 'supabase', 'migrations')
const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()

const footer = `
-- =============================================================
-- ÚLTIMO PASO (obligatorio)
-- Cambia los dos correos por los que usaron al crear los usuarios en
-- Authentication → Users y ejecuta también este bloque.
-- =============================================================
insert into public.app_users (email, display_name) values
  ('correo-de-robinson@ejemplo.com', 'Robinson'),
  ('correo-de-angela@ejemplo.com', 'Ángela')
on conflict (email) do update set display_name = excluded.display_name;
`

const body = files
  .map((f) => `-- >>> ${f}\n${readFileSync(join(dir, f), 'utf8').trim()}\n`)
  .join('\n')

const header = `-- Archivo generado con "npm run db:bundle". No lo edites a mano:
-- cambia supabase/migrations/*.sql y vuelve a generarlo.
-- Pégalo completo en Supabase → SQL Editor → Run.

begin;

`

writeFileSync(join(dir, '..', 'setup.sql'), `${header}${body}\ncommit;\n${footer}`)
console.log(`supabase/setup.sql generado con ${files.length} migraciones`)
