# Nuestra boda · Robinson & Ángela

App web para planear la boda (mayo 2027): presupuesto, proveedores, comparador, invitados con RSVP público, mesas, tareas, cronograma del día, documentos, mesa de regalos y agradecimientos. Es para uso personal de los dos novios.

**Stack:** React 19 + Vite + TypeScript + Tailwind 4 · Supabase (Postgres, Auth y Storage) · React Query · dnd-kit · Recharts.

## Módulos

| Ruta | Qué hace |
| --- | --- |
| `/` | Cuenta regresiva, resumen de presupuesto, confirmaciones, tareas próximas, próximos pagos y alertas |
| `/presupuesto` | Categorías con estimado vs. comprometido, abonos y pagos programados, gráficos y alerta de sobrecosto |
| `/proveedores` | Ficha de cada proveedor: contacto, costos, pagos y contratos adjuntos |
| `/comparador` | Hasta 4 opciones de una categoría lado a lado; "Reservar este" descarta las demás |
| `/invitados` | Lista con grupo, edad (niños y adultos mayores), acompañantes (con o sin nombre), RSVP, dieta y mesa; link por invitado para copiar, enviar por WhatsApp o imprimir como QR; recordatorio a pendientes |
| `/invitados/qr` | Hoja imprimible con el QR de cada invitado y tarjetas del álbum de fotos para las mesas |
| `/mesas` | Arrastrar invitados a las mesas (o tocarlos para elegir la mesa), ocupación, niños y adultos mayores por mesa y vínculos "juntos/separados" |
| `/tareas` | Plantilla de 74 tareas por etapa (incluye trámite civil, plan B de lluvia, cortejo y lo de después de la boda), tablero kanban y lista por etapa |
| `/cronograma` | Minuto a minuto del día, vista para imprimir o guardar en PDF por proveedor y canciones pedidas para el DJ |
| `/cronograma/coordinador` | Hoja para la persona de confianza: personas clave, cronograma, teléfonos de proveedores, pagos pendientes, conteo de invitados por edad y restricciones alimentarias |
| `/documentos` | Contratos, cotizaciones, facturas e inspiración (bucket privado) |
| `/regalos` | Lista de regalos (artículos o aportes en efectivo) y quién los apartó |
| `/agradecimientos` | A quién ya se le agradeció, sobres recibidos (monto privado) y mensajes de agradecimiento con plantilla |
| `/configuracion` | Datos de la boda, página del invitado (vestimenta, cómo llegar, hospedaje, preguntas, álbum, transmisión, lluvia de sobres, mostrar mesa), plantillas y respaldo |
| `/rsvp/:token` | **Página pública** para que cada invitado confirme (y marque qué acompañantes van), pida una canción, vea su mesa y aparte regalos, sin iniciar sesión |

Los montos están en pesos colombianos y las fechas en hora de Bogotá.

## 1. Crear el proyecto en Supabase (una sola vez)

1. Entra a [supabase.com](https://supabase.com), crea un proyecto gratis y elige la región **South America (São Paulo)**.
2. Abre **SQL Editor → New query** y pega todo el contenido de [`supabase/setup.sql`](supabase/setup.sql). **Antes de ejecutarlo, cambia los dos correos del bloque final** por los de ustedes (en minúsculas) y dale **Run**. Esto crea las tablas, la seguridad (RLS), las funciones del RSVP público, el bucket de documentos y las 14 categorías del presupuesto, y autoriza sus correos.
3. En **Authentication → Users → Add user → Create new user** crea los dos usuarios con esos mismos correos y marca **Auto Confirm User**.
4. En **Authentication → Sign In / Providers** desactiva **Allow new users to sign up**, para que nadie más pueda registrarse.
5. En **Project Settings → API** copia la **Project URL** y la **anon / publishable key**.

Solo los correos de la tabla `app_users` pueden ver o editar datos, aunque alguien lograra crear una cuenta. Si al entrar la app dice "Tu usuario no está autorizado", agrega el correo desde el SQL Editor:

```sql
insert into public.app_users (email, display_name) values ('correo@ejemplo.com', 'Nombre');
```

## 2. Correrla en tu computador

Requiere Node 22 o superior.

```bash
npm install
```

```bash
cp .env.example .env.local
```

Pega la URL y la key en `.env.local` y luego (el repositorio ya trae `.env.production` con la URL y la publishable key del proyecto `boda-robinson-angela`, que es lo que usa la versión publicada):

```bash
npm run dev
```

Abre http://localhost:5188 e inicia sesión con uno de los dos usuarios. En **Configuración** ajusta la fecha exacta, el lugar, la capacidad y el presupuesto, y carga la plantilla de tareas.

## 3. Publicación (GitHub Pages)

La app está publicada en **https://robinszuniga.github.io/boda-robinson-angela/**.

- Cada push a `main` la compila, corre las pruebas y la publica ([`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml)). En la pestaña **Actions** del repositorio se ve si salió bien.
- En GitHub Pages la app vive en la subruta `/boda-robinson-angela/` (variable `BASE_PATH` al compilar) y `404.html` hace que links como `/rsvp/...` carguen la app.
- En Supabase, **Authentication → URL Configuration** tiene como **Site URL** la dirección publicada y en **Redirect URLs** también `http://localhost:5188/**` para desarrollo.
- El repositorio es público: se ve el código, pero los datos (invitados, pagos, documentos) están en Supabase protegidos por RLS. La clave de `.env.production` es la publishable, pensada para el navegador.

> Los links de RSVP se arman con el dominio desde el que los copias. Cópienlos o envíenlos por WhatsApp desde la versión publicada, no desde `localhost`.

### Link corto de la invitación

Para que la invitación no muestre la dirección larga de GitHub Pages, cada invitado
puede tener un link corto guardado en `guests.short_url`. Si lo tiene, la app usa ese
link en el mensaje de WhatsApp, en el botón de copiar y en el QR; si no, usa el largo
de siempre. En **Enviar invitaciones** se avisa cuántos van todavía con el link largo.

Los links se crean en TinyURL con un alias derivado del token, así que se pueden
regenerar y volver a guardar sin depender de una lista:

```
alias  = BodaRobinsonAngela-<primeros 8 del rsvp_token>
destino= https://robinszuniga.github.io/boda-robinson-angela/rsvp/<rsvp_token>
```

Para crear los que falten: `https://tinyurl.com/api-create.php?url=<destino>&alias=<alias>`
(no necesita cuenta). Y para guardarlos, en el SQL Editor de Supabase:

```sql
update public.guests
set short_url = 'https://tinyurl.com/BodaRobinsonAngela-' || left(rsvp_token, 8)
where short_url is null;
```

Si algún día prefieren Vercel o Netlify, `vercel.json` y `public/_redirects` ya están listos (sin `BASE_PATH`, la app vive en la raíz).

## Scripts

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Revisa tipos y genera `dist/` |
| `npm test` | Pruebas de lógica y de base de datos (las migraciones corren en Postgres real vía PGlite) |
| `npm run lint` | ESLint |
| `npm run db:bundle` | Regenera `supabase/setup.sql` a partir de `supabase/migrations/` |

## Estructura

```
supabase/migrations/   Esquema, RLS, funciones del RSVP público y storage
supabase/setup.sql     Todas las migraciones en un solo archivo (generado)
src/lib/               Cliente de Supabase, hooks de datos y lógica pura (presupuesto, mesas, tareas…)
src/features/<módulo>/ Páginas y formularios de cada módulo
src/components/        Kit de UI y layout
src/data/              Plantilla de tareas y ejemplo de cronograma
tests/                 Pruebas de la lógica y de la base de datos
```

## Plan gratis de Supabase: pausa y respaldos

- **Pausa por inactividad:** Supabase pausa los proyectos gratis con poca actividad durante 7 días. La tarea [`.github/workflows/keep-alive.yml`](.github/workflows/keep-alive.yml) llama a `keep_alive()` tres veces al día desde GitHub Actions, y [`repo-activity.yml`](.github/workflows/repo-activity.yml) hace un commit vacío en la rama `keepalive` dos veces al mes, porque en repositorios públicos GitHub desactiva las tareas programadas tras 60 días sin actividad. Si alguna vez se pausa igual, se reactiva con "Restore" en el dashboard.
- **Sin copias automáticas:** en **Configuración → Respaldo** descarguen un JSON con todas las tablas (y un CSV de invitados para Excel) de vez en cuando. Los archivos de Documentos no van en el respaldo.

## Seguridad

- Todas las tablas tienen RLS: solo los correos de `app_users` leen o escriben.
- El rol anónimo no tiene acceso a las tablas. La página pública usa tres funciones (`rsvp_get`, `rsvp_submit`, `rsvp_claim_gift`) que solo exponen los datos del invitado dueño del token.
- Los documentos están en un bucket privado y se abren con URLs firmadas que duran una hora.
- La anon key puede ir en el frontend. Nunca pongas la `service_role` key en la app.

## Si cambian el esquema

1. Crea una migración nueva en `supabase/migrations/` (por ejemplo `0005_...sql`) y ejecútala en el SQL Editor.
2. Actualiza `src/types/database.ts`, a mano o con `npx supabase gen types typescript --project-id <id>`.
3. Corre `npm run db:bundle` y `npm test`.
