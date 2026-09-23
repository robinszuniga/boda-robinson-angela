import { useState, type ReactNode } from 'react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { toast } from 'sonner'
import { Accessibility, AlertTriangle, Armchair, Baby, Lock, Pencil, Plus, Search, Trash2, UserMinus, Wand2 } from 'lucide-react'
import { guestLinksApi, guestMembersApi, guestsApi, seatingTablesApi } from '../../lib/api'
import { linkConflicts, occupancy, seatsFor, type TableOccupancy, type TableStatus } from '../../lib/seating'
import { ageSummary, partyAges, type AgeCount } from '../../lib/ages'
import { Button, IconButton } from '../../components/ui/Button'
import { Badge, EmptyState, ErrorState, LoadingState, PageHeader, Segmented } from '../../components/ui/Display'
import { Input } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { cn } from '../../components/ui/cn'
import type { Guest, GuestMember, SeatingTable } from '../../types/database'
import { TableFormModal } from './TableFormModal'
import { LinksPanel } from './LinksPanel'
import { AutoSeatModal } from './AutoSeatModal'
import { DeleteTablesModal } from './DeleteTablesModal'

const UNASSIGNED = 'sin-mesa'

const statusStyle: Record<TableStatus, { label: string; tone: 'neutral' | 'amber' | 'green' | 'red'; ring: string }> = {
  vacia: { label: 'Vacía', tone: 'neutral', ring: 'border-line' },
  incompleta: { label: 'Incompleta', tone: 'amber', ring: 'border-amber-200' },
  completa: { label: 'Completa', tone: 'green', ring: 'border-emerald-300' },
  sobrecupo: { label: 'Sobrecupo', tone: 'red', ring: 'border-red-400' },
}

type Filter = 'todas' | 'incompletas' | 'sobrecupo'

function chipClass(guest: Guest, extra?: string) {
  return cn(
    'flex w-full touch-manipulation items-center gap-1.5 rounded-lg border bg-white px-2.5 py-1.5 text-left text-sm shadow-xs transition',
    guest.rsvp_status === 'pendiente' ? 'border-dashed border-amber-300' : 'border-line',
    extra,
  )
}

/** Niños y adultos mayores de cada invitación (con sus acompañantes con nombre) */
type AgesById = Map<string, AgeCount>

function AgeMarks({ ages }: { ages?: AgeCount }) {
  if (!ages) return null
  return (
    <>
      {ages.nino > 0 && (
        <span className="inline-flex shrink-0 items-center text-xs text-sky-700" title={ageSummary({ ...ages, mayor: 0 })}>
          <Baby className="size-3.5" aria-label={ageSummary({ ...ages, mayor: 0 })} />
          {ages.nino > 1 && ages.nino}
        </span>
      )}
      {ages.mayor > 0 && (
        <span className="inline-flex shrink-0 items-center text-xs text-violet-700" title={ageSummary({ ...ages, nino: 0 })}>
          <Accessibility className="size-3.5" aria-label={ageSummary({ ...ages, nino: 0 })} />
          {ages.mayor > 1 && ages.mayor}
        </span>
      )}
    </>
  )
}

function ChipContent({ guest, ages, warn, seats }: { guest: Guest; ages?: AgeCount; warn?: boolean; seats: number }) {
  const extra = seats - 1
  return (
    <>
      <span className="min-w-0 flex-1 truncate">{guest.name}</span>
      {extra > 0 && <span className="shrink-0 text-xs text-muted">+{extra}</span>}
      <AgeMarks ages={ages} />
      {warn && <AlertTriangle className="size-3.5 shrink-0 text-red-600" aria-label="Conflicto de vínculo" />}
    </>
  )
}

function GuestChip({
  guest,
  ages,
  warn,
  seats,
  onClick,
}: {
  guest: Guest
  ages?: AgeCount
  warn?: boolean
  seats: number
  onClick?: () => void
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: guest.id })
  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={onClick}
      {...listeners}
      {...attributes}
      className={chipClass(guest, isDragging ? 'opacity-30' : undefined)}
      title={guest.rsvp_status === 'pendiente' ? 'Pendiente de confirmar' : undefined}
    >
      <ChipContent guest={guest} ages={ages} warn={warn} seats={seats} />
    </button>
  )
}

/** Copia que sigue al puntero mientras se arrastra */
function DraggingChip({ guest, ages, seats }: { guest: Guest; ages?: AgeCount; seats: number }) {
  return (
    <div className={chipClass(guest, 'rotate-1 shadow-lg ring-2 ring-brand-300')}>
      <ChipContent guest={guest} ages={ages} seats={seats} />
    </div>
  )
}

function DropZone({ id, className, children }: { id: string; className?: string; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div ref={setNodeRef} className={cn(className, isOver && 'bg-brand-50 ring-2 ring-brand-300')}>
      {children}
    </div>
  )
}

export default function SeatingPage() {
  const tables = seatingTablesApi.useList()
  const guests = guestsApi.useList()
  const links = guestLinksApi.useList()
  const members = guestMembersApi.useList()
  const update = guestsApi.useUpdate()
  const [filter, setFilter] = useState<Filter>('todas')
  const [search, setSearch] = useState('')
  const [tableForm, setTableForm] = useState<{ table?: SeatingTable } | null>(null)
  const [assigning, setAssigning] = useState<Guest | null>(null)
  const [autoSeat, setAutoSeat] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [dragging, setDragging] = useState<Guest | null>(null)

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  )

  const queries = [tables, guests, links, members]
  const failed = queries.find((q) => q.isError)
  if (failed) return <ErrorState error={failed.error} onRetry={() => queries.forEach((q) => q.refetch())} />
  if (queries.some((q) => q.isPending)) return <LoadingState />

  const attending = (guests.data ?? []).filter((g) => g.rsvp_status !== 'rechazado')
  const ages: AgesById = new Map(attending.map((g) => [g.id, partyAges(g, members.data ?? [])]))
  const occ = occupancy(tables.data ?? [], attending, members.data ?? [])
  const conflicts = linkConflicts(links.data ?? [], guests.data ?? [])
  const conflictGuests = new Set(conflicts.flatMap((c) => [c.a.id, c.b.id]))
  const tableIds = new Set((tables.data ?? []).map((t) => t.id))
  const term = search.trim().toLowerCase()
  const unassigned = attending
    .filter((g) => !g.table_id || !tableIds.has(g.table_id))
    .filter((g) => !term || g.name.toLowerCase().includes(term))
  const guestName = new Map(attending.map((g) => [g.id, g.name]))
  const seatsOf = (g: Guest) => seatsFor(g, members.data ?? [])
  const unassignedPeople = attending
    .filter((g) => !g.table_id || !tableIds.has(g.table_id))
    .reduce((s, g) => s + seatsFor(g, members.data ?? []), 0)
  const totalSeats = occ.reduce((s, t) => s + t.table.capacity, 0)
  const seatedPeople = occ.reduce((s, t) => s + t.used, 0)
  const visible = occ.filter(
    (t) =>
      filter === 'todas' ||
      (filter === 'incompletas' && (t.status === 'incompleta' || t.status === 'vacia')) ||
      (filter === 'sobrecupo' && t.status === 'sobrecupo'),
  )
  const nextNumber = Math.max(0, ...(tables.data ?? []).map((t) => t.number)) + 1

  const assign = (guest: Guest, tableId: string | null) => {
    if (guest.table_id === tableId) return
    const target = occ.find((t) => t.table.id === tableId)
    if (target && target.used + seatsOf(guest) > target.table.capacity) {
      toast.warning(`La mesa ${target.table.number} queda con sobrecupo`)
    }
    update.mutate({ id: guest.id, values: { table_id: tableId } })
  }

  const onDragStart = (e: DragStartEvent) => setDragging(attending.find((g) => g.id === e.active.id) ?? null)
  const onDragEnd = (e: DragEndEvent) => {
    setDragging(null)
    const guest = attending.find((g) => g.id === e.active.id)
    if (!guest || !e.over) return
    assign(guest, e.over.id === UNASSIGNED ? null : String(e.over.id))
  }

  return (
    <>
      <PageHeader
        title="Mesas"
        description="Arrastra a los invitados a su mesa, o tócalos para elegirla"
        actions={
          <>
            {(tables.data?.length ?? 0) > 0 && (
              <>
                <Button variant="secondary" icon={<Trash2 className="size-4" />} onClick={() => setDeleting(true)}>
                  Borrar mesas
                </Button>
                <Button variant="secondary" icon={<Wand2 className="size-4" />} onClick={() => setAutoSeat(true)}>
                  Armar por grupo
                </Button>
              </>
            )}
            <Button icon={<Plus className="size-4" />} onClick={() => setTableForm({})}>
              Mesas
            </Button>
          </>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <span>
          <strong className="tabular-nums">{occ.length}</strong> <span className="text-muted">mesas</span>
        </span>
        <span>
          <strong className="tabular-nums">
            {seatedPeople}/{totalSeats}
          </strong>{' '}
          <span className="text-muted">puestos ocupados</span>
        </span>
        <span>
          <strong className="tabular-nums">{unassignedPeople}</strong>{' '}
          <span className="text-muted">{unassignedPeople === 1 ? 'persona sin mesa' : 'personas sin mesa'}</span>
        </span>
        {conflicts.length > 0 && (
          <Badge tone="red">
            <AlertTriangle className="size-3" /> {conflicts.length} {conflicts.length === 1 ? 'conflicto' : 'conflictos'}
          </Badge>
        )}
      </div>

      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <div className="flex flex-col gap-6 lg:sticky lg:top-6 lg:self-start">
            <DropZone id={UNASSIGNED} className="rounded-2xl border border-line bg-white p-4 shadow-xs transition">
              <h2 className="text-lg font-semibold">Sin mesa</h2>
              <div className="relative mt-2">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
                <Input aria-label="Buscar invitado sin mesa" placeholder="Buscar…" className="h-9 pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <div className="mt-3 flex max-h-[50vh] flex-col gap-1.5 overflow-y-auto pr-1">
                {unassigned.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted">{term ? 'Nadie coincide' : 'Todos tienen mesa'}</p>
                ) : (
                  unassigned.map((g) => (
                    <GuestChip
                      key={g.id}
                      guest={g}
                      ages={ages.get(g.id)}
                      warn={conflictGuests.has(g.id)}
                      seats={seatsOf(g)}
                      onClick={() => setAssigning(g)}
                    />
                  ))
                )}
              </div>
              <p className="mt-3 text-xs text-muted">Borde punteado = aún no confirma (se le reservan sus acompañantes).</p>
              <p className="mt-1 text-xs text-muted">
                Un acompañante puede sentarse en otra mesa: se elige en su ficha, y aquí aparece con borde punteado verde.
              </p>
              <p className="mt-1 text-xs text-muted">
                <Baby className="inline size-3.5 -translate-y-px text-sky-700" /> niños ·{' '}
                <Accessibility className="inline size-3.5 -translate-y-px text-violet-700" /> adultos mayores (siéntenlos
                cerca de baños y salida)
              </p>
            </DropZone>
            <LinksPanel guests={attending} links={links.data ?? []} conflicts={conflicts} />
          </div>

          <div>
            <div className="mb-4">
              <Segmented
                label="Filtrar mesas"
                value={filter}
                onChange={setFilter}
                options={[
                  { value: 'todas', label: 'Todas' },
                  { value: 'incompletas', label: 'Incompletas' },
                  { value: 'sobrecupo', label: 'Sobrecupo' },
                ]}
              />
            </div>
            {occ.length === 0 ? (
              <EmptyState
                icon={<Armchair className="size-8" />}
                title="Aún no hay mesas"
                action={<Button onClick={() => setTableForm({})}>Crear mesas</Button>}
              >
                Crea varias mesas iguales de una vez y luego ajusta las especiales.
              </EmptyState>
            ) : visible.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted">No hay mesas con ese filtro.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {visible.map((t) => (
                  <TableCard
                    key={t.table.id}
                    occ={t}
                    ages={ages}
                    guestName={guestName}
                    seatsOf={seatsOf}
                    conflictGuests={conflictGuests}
                    onEdit={() => setTableForm({ table: t.table })}
                    onGuestClick={setAssigning}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
        <DragOverlay>
          {dragging && <DraggingChip guest={dragging} ages={ages.get(dragging.id)} seats={seatsOf(dragging)} />}
        </DragOverlay>
      </DndContext>

      {tableForm && <TableFormModal {...tableForm} nextNumber={nextNumber} onClose={() => setTableForm(null)} />}
      {deleting && <DeleteTablesModal tables={occ} onClose={() => setDeleting(false)} />}
      {autoSeat && (
        <AutoSeatModal
          tables={tables.data ?? []}
          guests={guests.data ?? []}
          links={links.data ?? []}
          members={members.data ?? []}
          onClose={() => setAutoSeat(false)}
        />
      )}
      {assigning && (
        <AssignModal
          guest={assigning}
          tables={occ}
          seats={seatsOf(assigning)}
          onPick={(tableId) => {
            assign(assigning, tableId)
            setAssigning(null)
          }}
          onClose={() => setAssigning(null)}
        />
      )}
    </>
  )
}

function TableCard({
  occ,
  ages,
  guestName,
  seatsOf,
  conflictGuests,
  onEdit,
  onGuestClick,
}: {
  occ: TableOccupancy
  ages: AgesById
  guestName: Map<string, string>
  seatsOf: (guest: Guest) => number
  conflictGuests: Set<string>
  onEdit: () => void
  onGuestClick: (g: Guest) => void
}) {
  const style = statusStyle[occ.status]
  const tableAges = ageSummary(
    occ.guests.reduce<AgeCount>(
      (sum, g) => {
        const a = ages.get(g.id)
        return a ? { adulto: sum.adulto + a.adulto, nino: sum.nino + a.nino, mayor: sum.mayor + a.mayor } : sum
      },
      { adulto: 0, nino: 0, mayor: 0 },
    ),
  )
  return (
    <DropZone id={occ.table.id} className={cn('flex flex-col rounded-2xl border-2 bg-white p-4 shadow-xs transition', style.ring)}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-1.5 text-lg font-semibold">
            Mesa {occ.table.number}
            {occ.table.locked && <Lock className="size-3.5 text-muted" aria-label="Mesa fija" />}
          </h3>
          {occ.table.name && <p className="-mt-0.5 text-xs text-muted">{occ.table.name}</p>}
        </div>
        <div className="flex items-center gap-1">
          <Badge tone={style.tone}>
            {occ.used}/{occ.table.capacity}
          </Badge>
          <IconButton label={`Editar mesa ${occ.table.number}`} onClick={onEdit}>
            <Pencil className="size-3.5" />
          </IconButton>
        </div>
      </div>
      <p className={cn('mb-2 text-xs', occ.status === 'sobrecupo' ? 'font-medium text-red-700' : 'text-muted')}>
        {occ.status === 'sobrecupo'
          ? `${-occ.free} de más`
          : occ.status === 'completa'
            ? 'Completa'
            : `${occ.free} puestos libres`}
        {tableAges && <span className="text-muted"> · {tableAges}</span>}
      </p>
      <div className="flex min-h-12 flex-col gap-1.5">
        {occ.guests.map((g) => (
          <GuestChip
            key={g.id}
            guest={g}
            ages={ages.get(g.id)}
            warn={conflictGuests.has(g.id)}
            seats={seatsOf(g)}
            onClick={() => onGuestClick(g)}
          />
        ))}
        {occ.apart.map((m: GuestMember) => (
          <div
            key={m.id}
            className="flex items-center gap-1.5 rounded-lg border border-dashed border-brand-300 bg-brand-50/40 px-2.5 py-1.5 text-sm"
            title={`Acompañante de ${guestName.get(m.guest_id) ?? 'otra invitación'}, sentado aquí`}
          >
            <span className="min-w-0 flex-1 truncate">{m.name}</span>
            <span className="shrink-0 truncate text-xs text-muted">con {guestName.get(m.guest_id) ?? '—'}</span>
          </div>
        ))}
        {occ.guests.length === 0 && occ.apart.length === 0 && (
          <p className="rounded-lg border border-dashed border-line py-3 text-center text-xs text-muted">Suelta invitados aquí</p>
        )}
      </div>
    </DropZone>
  )
}

function AssignModal({
  guest,
  tables,
  seats,
  onPick,
  onClose,
}: {
  guest: Guest
  tables: TableOccupancy[]
  seats: number
  onPick: (tableId: string | null) => void
  onClose: () => void
}) {
  const needed = seats
  return (
    <Modal open onClose={onClose} title={guest.name} description={`Ocupa ${needed} ${needed === 1 ? 'puesto' : 'puestos'}. Elige su mesa.`}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {tables.map((t) => {
          const current = guest.table_id === t.table.id
          const fits = current || t.free >= needed
          return (
            <button
              key={t.table.id}
              type="button"
              onClick={() => onPick(t.table.id)}
              className={cn(
                'rounded-xl border px-3 py-2 text-left text-sm transition-colors',
                current ? 'border-brand-600 bg-brand-50' : 'border-line hover:border-brand-300',
              )}
            >
              <div className="font-medium">Mesa {t.table.number}</div>
              <div className={cn('text-xs', fits ? 'text-muted' : 'text-red-700')}>
                {current ? 'Mesa actual' : `${Math.max(t.free, 0)} libres`}
              </div>
            </button>
          )
        })}
      </div>
      {guest.table_id && (
        <Button className="mt-4 w-full" variant="secondary" icon={<UserMinus className="size-4" />} onClick={() => onPick(null)}>
          Quitar de la mesa
        </Button>
      )}
    </Modal>
  )
}
