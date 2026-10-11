import { useEffect } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ArrowLeft, Printer } from 'lucide-react'
import { guestMembersApi, guestsApi, seatingTablesApi, useSettings, venueElementsApi } from '../../lib/api'
import { declinedAtTable, layoutPlan, peopleAtTable } from '../../lib/floorPlan'
import { occupancy } from '../../lib/seating'
import { formatWeddingDate, plural } from '../../lib/format'
import { Button } from '../../components/ui/Button'
import { ErrorState, LoadingState } from '../../components/ui/Display'
import { ElementView, TableShapeView } from './PlanDrawing'

const PADDING = 40

/** El plano para el salón y el coordinador: el dibujo en una hoja y quién va en cada mesa */
export default function FloorPlanPrintPage() {
  const [params] = useSearchParams()
  const back = params.get('desde') === 'coordinador' ? '/cronograma/coordinador' : '/mesas?vista=plano'
  const settings = useSettings()
  const tables = seatingTablesApi.useList()
  const guests = guestsApi.useList()
  const members = guestMembersApi.useList()
  const elements = venueElementsApi.useList()
  const s = settings.data

  useEffect(() => {
    if (!s) return
    const previous = document.title
    document.title = `Plano del salón - boda ${s.partner_1_name} & ${s.partner_2_name}`
    return () => {
      document.title = previous
    }
  }, [s])

  const queries = [settings, tables, guests, members, elements]
  const failed = queries.find((q) => q.isError)
  if (failed) return <ErrorState error={failed.error} />
  if (queries.some((q) => q.isPending) || !s) return <LoadingState />

  const allGuests = guests.data ?? []
  const allMembers = members.data ?? []
  const allElements = elements.data ?? []
  const attending = allGuests.filter((g) => g.rsvp_status !== 'rechazado')
  const occ = occupancy(tables.data ?? [], attending, allMembers)
  const layout = layoutPlan(tables.data ?? [], new Map(occ.map((o) => [o.table.id, o.used])), allElements)
  const b = layout.bounds
  const viewBox = b
    ? `${b.minX - PADDING} ${b.minY - PADDING} ${b.maxX - b.minX + PADDING * 2} ${b.maxY - b.minY + PADDING * 2}`
    : '0 0 100 100'
  const byId = new Map(occ.map((o) => [o.table.id, o]))
  const pendingCount = occ.reduce(
    (n, o) => n + peopleAtTable(o.table.id, allGuests, allMembers).filter((p) => p.status === 'pendiente').length,
    0,
  )

  return (
    <div className="min-h-dvh bg-white">
      {/* El plano cabe mejor con la hoja acostada */}
      <style>{'@media print { @page { size: landscape; margin: 10mm; } }'}</style>
      <div className="no-print sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-line bg-white/95 px-4 py-3 backdrop-blur">
        <Link to={back} className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
          <ArrowLeft className="size-4" /> Volver
        </Link>
        <Button icon={<Printer className="size-4" />} onClick={() => window.print()}>
          Imprimir / Guardar PDF
        </Button>
      </div>

      <article className="mx-auto max-w-5xl px-6 py-8 print:max-w-none print:p-0">
        <header className="flex flex-wrap items-end justify-between gap-2 border-b-2 border-ink pb-3">
          <div>
            <p className="text-xs tracking-[0.2em] text-muted uppercase">Plano del salón</p>
            <h1 className="mt-1 text-3xl font-semibold">
              {s.partner_1_name} &amp; {s.partner_2_name}
            </h1>
          </div>
          <p className="text-sm">
            {formatWeddingDate(s.wedding_date)}
            {s.venue_name && ` · ${s.venue_name}`}
          </p>
        </header>

        {layout.tables.length === 0 && allElements.length === 0 ? (
          <p className="mt-8 text-sm text-muted">Todavía no hay mesas ni elementos en el plano.</p>
        ) : (
          <>
            <svg
              viewBox={viewBox}
              role="img"
              aria-label="Plano del salón con las mesas"
              className="mt-4 block h-auto max-h-[75dvh] w-full print:max-h-[160mm]"
            >
              {allElements.map((el) => (
                <ElementView
                  key={el.id}
                  element={el}
                  x={el.pos_x}
                  y={el.pos_y}
                  width={el.width}
                  height={el.height}
                  selected={false}
                  interactive={false}
                />
              ))}
              {layout.tables.map((p) => {
                const o = byId.get(p.table.id)!
                return (
                  <TableShapeView
                    key={p.table.id}
                    table={p.table}
                    geometry={p.geometry}
                    info={{
                      people: peopleAtTable(p.table.id, allGuests, allMembers),
                      used: o.used,
                      status: o.status,
                      // En el papel no hacen falta los avisos: solo lo que hay
                      declined: [],
                    }}
                    x={p.center.x}
                    y={p.center.y}
                    selected={false}
                    interactive={false}
                  />
                )
              })}
            </svg>
            <p className="mt-2 text-xs text-muted">
              Cada círculo alrededor de una mesa es un puesto, con las iniciales de quien se sienta ahí. Los de borde
              punteado aún no han confirmado. Los nombres completos están en la lista por mesa.
            </p>
          </>
        )}

        {occ.length > 0 && (
          <section className="mt-8 break-before-page">
            <h2 className="border-b border-ink/30 pb-1 text-lg font-semibold">Quién se sienta en cada mesa</h2>
            {pendingCount > 0 && (
              <p className="mt-1 text-xs text-muted">
                * Sin confirmar todavía ({plural(pendingCount, 'puesto reservado', 'puestos reservados')}).
              </p>
            )}
            <div className="mt-4 columns-1 gap-8 sm:columns-2 print:columns-3">
              {occ.map((o) => {
                const people = peopleAtTable(o.table.id, allGuests, allMembers)
                const leaving = declinedAtTable(o.table.id, allGuests, allMembers)
                return (
                  <div key={o.table.id} className="mb-5 break-inside-avoid">
                    <h3 className="font-sans text-sm font-semibold">
                      Mesa {o.table.number}
                      {o.table.name && <span className="font-normal"> · {o.table.name}</span>}
                      <span className="font-normal text-muted tabular-nums">
                        {' '}
                        ({o.used}/{o.table.capacity})
                      </span>
                    </h3>
                    {people.length === 0 ? (
                      <p className="text-sm text-muted">Vacía</p>
                    ) : (
                      <ol className="mt-1 list-decimal pl-5 text-sm">
                        {people.map((p) => (
                          <li key={p.key}>
                            {p.name}
                            {p.status === 'pendiente' && ' *'}
                          </li>
                        ))}
                      </ol>
                    )}
                    {leaving.length > 0 && (
                      <p className="no-print mt-1 text-xs text-red-700">
                        Siguen anotados aunque no van: {leaving.map((d) => d.name).join(', ')}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )}
      </article>
    </div>
  )
}
