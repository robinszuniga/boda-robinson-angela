import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { ArrowLeft, NotebookPen, Printer } from 'lucide-react'
import {
  categoriesApi,
  guestMembersApi,
  guestsApi,
  paymentsApi,
  scheduleApi,
  seatingTablesApi,
  useSettings,
  useUpdateSettings,
  vendorsApi,
} from '../../lib/api'
import { vendorBalances } from '../../lib/budget'
import { ageSummary } from '../../lib/ages'
import { coordinatorGuests, type PersonAtTable } from '../../lib/coordinator'
import { formatCOP, formatDate, formatTime, formatWeddingDate, plural } from '../../lib/format'
import { attempt } from '../../lib/attempt'
import { Button } from '../../components/ui/Button'
import { ErrorState, LoadingState } from '../../components/ui/Display'
import { Textarea } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { cn } from '../../components/ui/cn'
import { sortSchedule } from './scheduleActions'
import { ScheduleTable } from './ScheduleTable'

const NOTES_PLACEHOLDER = `Coordinadora del día: Laura · 300 123 4567
Padrinos: …
Quién guarda las argollas y los documentos: …
Quién entrega los sobres a los proveedores: …
Si llueve: …`

function Section({
  title,
  subtitle,
  className,
  children,
}: {
  title: string
  subtitle?: string
  className?: string
  children: ReactNode
}) {
  return (
    <section className={cn('mt-9', className)}>
      <h2 className="border-b border-ink/30 pb-1 text-lg font-semibold break-after-avoid">{title}</h2>
      {subtitle && <p className="mt-1 text-xs text-muted">{subtitle}</p>}
      <div className="mt-3">{children}</div>
    </section>
  )
}

const atTable = (p: PersonAtTable) => (p.table ? `${p.name} (mesa ${p.table})` : p.name)

/** Hoja para la persona de confianza: lo que necesita para resolver el día sin molestar a los novios */
export default function CoordinatorSheetPage() {
  const settings = useSettings()
  const items = scheduleApi.useList()
  const vendors = vendorsApi.useList()
  const categories = categoriesApi.useList()
  const payments = paymentsApi.useList()
  const guests = guestsApi.useList()
  const members = guestMembersApi.useList()
  const tables = seatingTablesApi.useList()
  const [editing, setEditing] = useState(false)
  const s = settings.data

  useEffect(() => {
    if (!s) return
    const previous = document.title
    document.title = `Hoja del coordinador - boda ${s.partner_1_name} & ${s.partner_2_name}`
    return () => {
      document.title = previous
    }
  }, [s])

  const queries = [settings, items, vendors, categories, payments, guests, members, tables]
  const failed = queries.find((q) => q.isError)
  if (failed) return <ErrorState error={failed.error} />
  if (queries.some((q) => q.isPending) || !s) return <LoadingState />

  const schedule = sortSchedule(items.data ?? [])
  const vendorName = new Map((vendors.data ?? []).map((v) => [v.id, v.name]))
  const categoryName = new Map((categories.data ?? []).map((c) => [c.id, c.name]))
  const balances = vendorBalances(vendors.data ?? [], payments.data ?? [])
  const timesOf = (vendorId: string) =>
    schedule.filter((i) => i.vendor_id === vendorId).map((i) => formatTime(i.start_time))
  // Proveedores reservados: primero los que aparecen más temprano en el cronograma
  const booked = [...balances].sort((a, b) => {
    const ta = schedule.findIndex((i) => i.vendor_id === a.vendor.id)
    const tb = schedule.findIndex((i) => i.vendor_id === b.vendor.id)
    return (ta < 0 ? Infinity : ta) - (tb < 0 ? Infinity : tb) || a.vendor.name.localeCompare(b.vendor.name, 'es')
  })
  const owed = balances.filter((b) => b.pending > 0)
  const loose = (payments.data ?? [])
    .filter((p) => !p.is_paid && !p.vendor_id)
    .sort((a, b) => a.date.localeCompare(b.date))
  const totalOwed = owed.reduce((sum, b) => sum + b.pending, 0) + loose.reduce((sum, p) => sum + p.amount, 0)
  const info = coordinatorGuests(guests.data ?? [], members.data ?? [], tables.data ?? [])
  const ages = ageSummary(info.ages)

  return (
    <div className="min-h-dvh bg-white">
      <div className="no-print sticky top-0 flex items-center justify-between gap-2 border-b border-line bg-white/95 px-4 py-3 backdrop-blur">
        <Link to="/cronograma" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
          <ArrowLeft className="size-4" /> Volver
        </Link>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" icon={<NotebookPen className="size-4" />} onClick={() => setEditing(true)}>
            Personas clave
          </Button>
          <Button size="sm" icon={<Printer className="size-4" />} onClick={() => window.print()}>
            Imprimir
          </Button>
        </div>
      </div>

      <article className="mx-auto max-w-3xl px-6 py-10 print:max-w-none print:p-0">
        <header className="border-b-2 border-ink pb-4">
          <p className="text-xs tracking-[0.2em] text-muted uppercase">Hoja del coordinador</p>
          <h1 className="mt-1 text-4xl font-semibold">
            {s.partner_1_name} &amp; {s.partner_2_name}
          </h1>
          <p className="mt-2 text-sm">
            {formatWeddingDate(s.wedding_date)}
            {s.venue_name && ` · ${s.venue_name}`}
            {s.venue_address && `, ${s.venue_address}`}
          </p>
          <p className="mt-3 text-sm text-muted">
            Gracias por ayudarnos. Con esta hoja puedes resolver lo que pase durante el día sin tener que preguntarnos.
          </p>
        </header>

        <Section title="Personas clave e instrucciones" className={s.coordinator_notes ? undefined : 'print:hidden'}>
          {s.coordinator_notes ? (
            <p className="text-sm whitespace-pre-line">{s.coordinator_notes}</p>
          ) : (
            <div className="no-print rounded-xl border border-dashed border-line px-4 py-3 text-sm text-muted">
              Escriban quién coordina, los padrinos con su teléfono, quién guarda las argollas y qué hacer si llueve.{' '}
              <button type="button" className="font-medium text-brand-700 underline" onClick={() => setEditing(true)}>
                Escribir
              </button>
            </div>
          )}
        </Section>

        <Section title="Cronograma">
          <ScheduleTable items={schedule} vendorName={vendorName} />
        </Section>

        <Section title="Proveedores">
          {booked.length === 0 ? (
            <p className="text-sm text-muted">Aún no hay proveedores reservados.</p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-ink/30 text-left text-xs tracking-wide text-muted uppercase">
                  <th className="py-2 pr-4 font-medium">Proveedor</th>
                  <th className="py-2 pr-4 font-medium">Contacto</th>
                  <th className="py-2 font-medium">En el cronograma</th>
                </tr>
              </thead>
              <tbody>
                {booked.map(({ vendor }) => (
                  <tr key={vendor.id} className="border-b border-line align-top break-inside-avoid">
                    <td className="py-2.5 pr-4">
                      <span className="font-medium">{vendor.name}</span>
                      {vendor.category_id && categoryName.has(vendor.category_id) && (
                        <div className="text-xs text-muted">{categoryName.get(vendor.category_id)}</div>
                      )}
                    </td>
                    <td className="py-2.5 pr-4">
                      {vendor.contact_name && <div>{vendor.contact_name}</div>}
                      {vendor.phone ? (
                        <a href={`tel:${vendor.phone}`} className="tabular-nums">
                          {vendor.phone}
                        </a>
                      ) : (
                        !vendor.contact_name && <span className="text-muted">Sin teléfono</span>
                      )}
                    </td>
                    <td className="py-2.5 text-xs tabular-nums">{timesOf(vendor.id).join(', ') || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        <Section
          title="Pagos pendientes"
          subtitle="Según lo registrado en Presupuesto. Antes de imprimir, revisen que los abonos estén al día."
        >
          {owed.length === 0 && loose.length === 0 ? (
            <p className="text-sm text-muted">No hay saldos pendientes registrados.</p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <tbody>
                {owed.map((b) => (
                  <tr key={b.vendor.id} className="border-b border-line align-top break-inside-avoid">
                    <td className="py-2.5 pr-4">
                      <span className="font-medium">{b.vendor.name}</span>
                      {b.scheduled.length > 0 && (
                        <div className="text-xs text-muted">
                          Programado: {b.scheduled.map((p) => `${formatDate(p.date)} (${formatCOP(p.amount)})`).join(', ')}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 text-right font-medium whitespace-nowrap tabular-nums">{formatCOP(b.pending)}</td>
                  </tr>
                ))}
                {loose.map((p) => (
                  <tr key={p.id} className="border-b border-line align-top break-inside-avoid">
                    <td className="py-2.5 pr-4">
                      <span className="font-medium">{p.note || categoryName.get(p.category_id) || 'Pago'}</span>
                      <div className="text-xs text-muted">Programado: {formatDate(p.date)}</div>
                    </td>
                    <td className="py-2.5 text-right font-medium whitespace-nowrap tabular-nums">{formatCOP(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td className="pt-2.5 pr-4 font-semibold">Total</td>
                  <td className="pt-2.5 text-right font-semibold whitespace-nowrap tabular-nums">{formatCOP(totalOwed)}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </Section>

        <Section title="Invitados">
          <p className="text-sm">
            <strong>{plural(info.confirmedPeople, 'persona confirmada', 'personas confirmadas')}</strong>
            {ages && ` (${ages})`}
            {info.pendingInvitations > 0 && (
              <span className="text-muted">
                {' '}
                · {plural(info.pendingInvitations, 'invitación sin responder', 'invitaciones sin responder')}
              </span>
            )}
          </p>
          <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2 print:grid-cols-2">
            <div className="break-inside-avoid">
              <dt className="font-medium">Restricciones alimentarias</dt>
              <dd className="mt-1">
                {info.dietary.length === 0 ? (
                  <span className="text-muted">Ninguna</span>
                ) : (
                  <ul className="flex flex-col gap-0.5">
                    {info.dietary.map((d, i) => (
                      <li key={i}>
                        {atTable(d)}: <span className="text-muted">{d.dietary}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </dd>
            </div>
            <div className="flex flex-col gap-4">
              <div className="break-inside-avoid">
                <dt className="font-medium">Adultos mayores</dt>
                <dd className="mt-1">
                  {info.seniors.length === 0 ? (
                    <span className="text-muted">Ninguno</span>
                  ) : (
                    info.seniors.map(atTable).join(', ')
                  )}
                </dd>
              </div>
              {info.transport.length > 0 && (
                <div className="break-inside-avoid">
                  <dt className="font-medium">Necesitan transporte</dt>
                  <dd className="mt-1">{info.transport.map((t) => (t.people > 1 ? `${t.name} (${t.people})` : t.name)).join(', ')}</dd>
                </div>
              )}
            </div>
          </dl>
        </Section>
      </article>

      {editing && <NotesModal initial={s.coordinator_notes} onClose={() => setEditing(false)} />}
    </div>
  )
}

function NotesModal({ initial, onClose }: { initial: string | null; onClose: () => void }) {
  const update = useUpdateSettings()
  const [text, setText] = useState(initial ?? '')
  const save = async () => {
    if (await attempt(update.mutateAsync({ coordinator_notes: text.trim() || null }))) {
      toast.success('Guardado')
      onClose()
    }
  }
  return (
    <Modal
      open
      size="lg"
      onClose={onClose}
      title="Personas clave e instrucciones"
      description="Salen al comienzo de la hoja del coordinador."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={update.isPending}>
            Guardar
          </Button>
        </>
      }
    >
      <Textarea
        aria-label="Personas clave e instrucciones"
        data-autofocus
        rows={9}
        maxLength={4000}
        placeholder={NOTES_PLACEHOLDER}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
    </Modal>
  )
}
