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
import { AlertTriangle, Armchair, Pencil, Plus, Search, UserMinus } from 'lucide-react'
import { guestLinksApi, guestsApi, seatingTablesApi } from '../../lib/api'
import { linkConflicts, occupancy, seatsFor, type TableOccupancy, type TableStatus } from '../../lib/seating'
import { Button, IconButton } from '../../components/ui/Button'
import { Badge, EmptyState, ErrorState, LoadingState, PageHeader, Segmented } from '../../components/ui/Display'
import { Input } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { cn } from '../../components/ui/cn'
import type { Guest, SeatingTable } from '../../types/database'
import { TableFormModal } from './TableFormModal'
import { LinksPanel } from './LinksPanel'

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

function ChipContent({ guest, warn }: { guest: Guest; warn?: boolean }) {
  const extra = seatsFor(guest) - 1
  return (
    <>
      <span className="min-w-0 flex-1 truncate">{guest.name}</span>
      {extra > 0 && <span className="shrink-0 text-xs text-muted">+{extra}</span>}
      {warn && <AlertTriangle className="size-3.5 shrink-0 text-red-600" aria-label="Conflicto de vínculo" />}
    </>
  )
}

function GuestChip({ guest, warn, onClick }: { guest: Guest; warn?: boolean; onClick?: () => void }) {
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
      <ChipContent guest={guest} warn={warn} />
    </button>
  )
}

/** Copia que sigue al puntero mientras se arrastra */
function DraggingChip({ guest }: { guest: Guest }) {
  return (
    <div className={chipClass(guest, 'rotate-1 shadow-lg ring-2 ring-brand-300')}>
      <ChipContent guest={guest} />
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
  const update = guestsApi.useUpdate()
  const [filter, setFilter] = useState<Filter>('todas')
  const [search, setSearch] = useState('')
  const [tableForm, setTableForm] = useState<{ table?: SeatingTable } | null>(null)
  const [assigning, setAssigning] = useState<Guest | null>(null)
  const [dragging, setDragging] = useState<Guest | null>(null)

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  )

  const queries = [tables, guests, links]
  const failed = queries.find((q) => q.isError)
  if (failed) return <ErrorState error={failed.error} onRetry={() => queries.forEach((q) => q.refetch())} />
  if (queries.some((q) => q.isPending)) return <LoadingState />

  const attending = (guests.data ?? []).filter((g) => g.rsvp_status !== 'rechazado')
  const occ = occupancy(tables.data ?? [], attending)
  const conflicts = linkConflicts(links.data ?? [], guests.data ?? [])
  const conflictGuests = new Set(conflicts.flatMap((c) => [c.a.id, c.b.id]))
  const tableIds = new Set((tables.data ?? []).map((t) => t.id))
  const term = search.trim().toLowerCase()
  const unassigned = attending
    .filter((g) => !g.table_id || !tableIds.has(g.table_id))
    .filter((g) => !term || g.name.toLowerCase().includes(term))
  const unassignedPeople = attending
    .filter((g) => !g.table_id || !tableIds.has(g.table_id))
    .reduce((s, g) => s + seatsFor(g), 0)
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
    if (target && target.used + seatsFor(guest) > target.table.capacity) {
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
          <Button icon={<Plus className="size-4" />} onClick={() => setTableForm({})}>
            Mesas
          </Button>
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
                    <GuestChip key={g.id} guest={g} warn={conflictGuests.has(g.id)} onClick={() => setAssigning(g)} />
                  ))
                )}
              </div>
              <p className="mt-3 text-xs text-muted">Borde punteado = aún no confirma (se le reservan sus acompañantes).</p>
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
                    conflictGuests={conflictGuests}
                    onEdit={() => setTableForm({ table: t.table })}
                    onGuestClick={setAssigning}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
        <DragOverlay>{dragging && <DraggingChip guest={dragging} />}</DragOverlay>
      </DndContext>

      {tableForm && <TableFormModal {...tableForm} nextNumber={nextNumber} onClose={() => setTableForm(null)} />}
      {assigning && (
        <AssignModal
          guest={assigning}
          tables={occ}
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
  conflictGuests,
  onEdit,
  onGuestClick,
}: {
  occ: TableOccupancy
  conflictGuests: Set<string>
  onEdit: () => void
  onGuestClick: (g: Guest) => void
}) {
  const style = statusStyle[occ.status]
  return (
    <DropZone id={occ.table.id} className={cn('flex flex-col rounded-2xl border-2 bg-white p-4 shadow-xs transition', style.ring)}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold">Mesa {occ.table.number}</h3>
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
      </p>
      <div className="flex min-h-12 flex-col gap-1.5">
        {occ.guests.map((g) => (
          <GuestChip key={g.id} guest={g} warn={conflictGuests.has(g.id)} onClick={() => onGuestClick(g)} />
        ))}
        {occ.guests.length === 0 && (
          <p className="rounded-lg border border-dashed border-line py-3 text-center text-xs text-muted">Suelta invitados aquí</p>
        )}
      </div>
    </DropZone>
  )
}

function AssignModal({
  guest,
  tables,
  onPick,
  onClose,
}: {
  guest: Guest
  tables: TableOccupancy[]
  onPick: (tableId: string | null) => void
  onClose: () => void
}) {
  const needed = seatsFor(guest)
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
