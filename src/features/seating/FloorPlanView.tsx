import { useMemo, useRef, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  Armchair,
  LayoutGrid,
  Pencil,
  Printer,
  RotateCcw,
  RotateCw,
  Shapes,
  Trash2,
  UserPlus,
} from 'lucide-react'
import { guestMembersApi, guestsApi, seatingTablesApi, venueElementsApi } from '../../lib/api'
import { tableKey } from '../../lib/crud'
import { attempt, attemptLoud } from '../../lib/attempt'
import {
  autoPositions,
  clampElementSize,
  declinedAtTable,
  ELEMENT_SIZE,
  elementLabel,
  layoutPlan,
  normalizeRotation,
  peopleAtTable,
  snap,
  type DeclinedAtTable,
  type Point,
  type SeatPerson,
} from '../../lib/floorPlan'
import { seatsFor, type TableOccupancy } from '../../lib/seating'
import { plural } from '../../lib/format'
import { options, tableShape, venueElementKind } from '../../lib/labels'
import { Button, ButtonLink, IconButton } from '../../components/ui/Button'
import { Badge, ErrorState, LoadingState } from '../../components/ui/Display'
import { Input } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { useConfirm } from '../../components/ui/Confirm'
import { cn } from '../../components/ui/cn'
import type { Guest, GuestMember, SeatingTable, TableShape, VenueElement, VenueElementKind } from '../../types/database'
import { FloorPlanCanvas, type ElementBox, type FloorPlanHandle, type PlanSelection } from './FloorPlanCanvas'
import type { TableInfo } from './PlanDrawing'
import { SeatGuestsModal } from './SeatGuestsModal'
import { AssignModal } from './AssignModal'
import { TableFormModal } from './TableFormModal'
import { resetTablePositions, useSaveTablePositions } from './planActions'
import { OpenedNote } from '../guests/OpenedNote'

const ROTATE_STEP = 45
const clampPos = (v: number) => Math.max(-10000, Math.min(10000, v))

/** La migración 0016 no se ha ejecutado en Supabase */
function missingMigration(error: unknown) {
  const code = (error as { code?: string } | null)?.code
  return code === 'PGRST205' || code === '42P01' || code === 'PGRST204' || code === '42703'
}

type Declined = DeclinedAtTable & { tableNumber: number }

export function FloorPlanView({
  tables,
  guests,
  members,
  occ,
  nextNumber,
  unseatedPeople,
  assign,
}: {
  tables: SeatingTable[]
  guests: Guest[]
  members: GuestMember[]
  occ: TableOccupancy[]
  nextNumber: number
  /** Personas que aún no tienen mesa (las cuenta la página de Mesas) */
  unseatedPeople: number
  /** Sentar a un invitado en una mesa (o sacarlo), con el mismo aviso de sobrecupo que la lista */
  assign: (guest: Guest, tableId: string | null) => void
}) {
  const qc = useQueryClient()
  const confirm = useConfirm()
  const elements = venueElementsApi.useList()
  const updateTable = seatingTablesApi.useUpdate()
  const updateElement = venueElementsApi.useUpdate()
  const createElement = venueElementsApi.useCreate()
  const removeElement = venueElementsApi.useRemove()
  const updateGuest = guestsApi.useUpdate()
  const updateMember = guestMembersApi.useUpdate()
  const savePositions = useSaveTablePositions()
  const canvas = useRef<FloorPlanHandle>(null)
  const panel = useRef<HTMLElement>(null)
  const [selected, setSelected] = useState<PlanSelection | null>(null)
  const [seatingAt, setSeatingAt] = useState<string | null>(null)
  const [assigning, setAssigning] = useState<Guest | null>(null)
  const [editing, setEditing] = useState<SeatingTable | null>(null)
  const [adding, setAdding] = useState(false)

  const elementList = elements.data
  const layout = useMemo(
    () => layoutPlan(tables, new Map(occ.map((o) => [o.table.id, o.used])), elementList ?? []),
    [tables, occ, elementList],
  )
  // Los que dijeron que no y siguen en una mesa: para el aviso rojo de cada mesa y la lista del panel
  const declined = useMemo<Declined[]>(
    () =>
      occ.flatMap((o) =>
        declinedAtTable(o.table.id, guests, members).map((d) => ({ ...d, tableNumber: o.table.number })),
      ),
    [occ, guests, members],
  )
  const infos = useMemo(
    () =>
      new Map<string, TableInfo>(
        occ.map((o) => [
          o.table.id,
          {
            people: peopleAtTable(o.table.id, guests, members),
            used: o.used,
            status: o.status,
            declined: declined.filter((d) => d.tableNumber === o.table.number).map((d) => d.name),
          },
        ]),
      ),
    [occ, guests, members, declined],
  )

  if (elements.isError) {
    return missingMigration(elements.error) ? (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-6 py-8 text-sm text-amber-900">
        <p className="font-medium">Falta un paso en la base de datos para usar el plano.</p>
        <p className="mt-1">
          En Supabase, abran <strong>SQL Editor</strong>, peguen el archivo{' '}
          <code className="rounded bg-white px-1">supabase/migrations/0016_plano_salon.sql</code> y denle <strong>Run</strong>.
          La vista de lista sigue funcionando mientras tanto.
        </p>
      </div>
    ) : (
      <ErrorState error={elements.error} onRetry={() => elements.refetch()} />
    )
  }
  if (elements.isPending) return <LoadingState />

  const allElements = elements.data
  const occById = new Map(occ.map((o) => [o.table.id, o]))
  const attending = guests.filter((g) => g.rsvp_status !== 'rechazado')

  const selTable = selected?.type === 'table' ? occById.get(selected.id) : undefined
  const selElement = selected?.type === 'element' ? allElements.find((e) => e.id === selected.id) : undefined
  const seatingOcc = seatingAt ? occById.get(seatingAt) : undefined

  /** Dónde quedaron las mesas sin ubicar (menos `exceptId`), listas para guardarse */
  const unplaced = (exceptId?: string) =>
    autoPositions(layout, exceptId).map((r) => ({ ...r, pos_x: clampPos(r.pos_x), pos_y: clampPos(r.pos_y) }))

  /**
   * Antes de cambiar algo que mueve los bordes del plano (un elemento, la forma o
   * el giro de una mesa), las mesas sin ubicar se guardan donde están para que no salten.
   */
  const keepingUnplaced = async <T,>(change: () => Promise<T>) => {
    const rows = unplaced()
    if (rows.length > 0) await savePositions(rows)
    return change()
  }

  const moveTable = (id: string, to: Point) =>
    savePositions([{ id, pos_x: clampPos(to.x), pos_y: clampPos(to.y) }, ...unplaced(id)])

  const moveElement = (id: string, to: Point) =>
    keepingUnplaced(() => updateElement.mutateAsync({ id, values: { pos_x: clampPos(to.x), pos_y: clampPos(to.y) } }))

  const resizeElement = (id: string, box: ElementBox) =>
    keepingUnplaced(() =>
      updateElement.mutateAsync({
        id,
        values: {
          pos_x: clampPos(box.pos_x),
          pos_y: clampPos(box.pos_y),
          width: clampElementSize(box.width),
          height: clampElementSize(box.height),
        },
      }),
    )

  const updatePlanTable = (id: string, values: { shape?: TableShape; rotation?: number }) =>
    keepingUnplaced(() => updateTable.mutateAsync({ id, values })).catch(() => {
      // El error ya lo mostró el toast de las mutaciones
    })

  const onSeatTap = async (tableId: string, person: SeatPerson | null) => {
    if (!person) {
      setSeatingAt(tableId)
      return
    }
    const owner = guests.find((g) => g.id === person.guestId)
    if (!owner) return
    if (person.kind !== 'aparte') {
      setAssigning(owner)
      return
    }
    const member = members.find((m) => m.id === person.key)
    if (!member) return
    const ok = await confirm({
      title: person.name,
      message: `Es acompañante de ${owner.name} y se sienta en esta mesa, aparte de su invitación. ¿Lo devuelves a la mesa de ${owner.name}?`,
      confirmLabel: 'Devolver',
    })
    if (ok) updateMember.mutate({ id: member.id, values: { table_id: null } })
  }

  const removeDeclined = (d: Pick<Declined, 'guestId' | 'memberId'>) => {
    if (d.memberId) updateMember.mutate({ id: d.memberId, values: { table_id: null } })
    else updateGuest.mutate({ id: d.guestId, values: { table_id: null } })
  }

  const addElement = async (kind: VenueElementKind) => {
    const at = canvas.current?.center() ?? { x: 0, y: 0 }
    const size = ELEMENT_SIZE[kind]
    setAdding(false)
    try {
      const [row] = await keepingUnplaced(() =>
        createElement.mutateAsync({
          kind,
          pos_x: clampPos(snap(at.x)),
          pos_y: clampPos(snap(at.y)),
          width: size.width,
          height: size.height,
        }),
      )
      if (row) setSelected({ type: 'element', id: row.id })
    } catch {
      // El error ya lo mostró el toast de las mutaciones
    }
  }

  const reorder = async () => {
    const ok = await confirm({
      title: '¿Volver a ordenar las mesas?',
      message:
        'Todas las mesas quedan en filas por número, como al principio. Los invitados siguen en su mesa y la pista, los baños y lo demás del salón no se mueven.',
      confirmLabel: 'Ordenar',
    })
    if (!ok) return
    await attemptLoud(resetTablePositions())
    await qc.invalidateQueries({ queryKey: tableKey('seating_tables') })
    // Las filas quedan debajo de todo: si estaban viendo otra parte del salón, no las verían
    canvas.current?.fit()
  }

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" icon={<Shapes className="size-4" />} onClick={() => setAdding(true)}>
          Agregar al salón
        </Button>
        {tables.some((t) => t.pos_x != null) && (
          <Button size="sm" variant="ghost" icon={<LayoutGrid className="size-4" />} onClick={reorder}>
            Volver a ordenar las mesas
          </Button>
        )}
        <ButtonLink size="sm" variant="ghost" className="sm:ml-auto" icon={<Printer className="size-4" />} to="/mesas/plano/imprimir">
          Imprimir plano
        </ButtonLink>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0">
          {tables.length === 0 && allElements.length === 0 ? (
            <div className="flex h-[50vh] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-line bg-white/60 px-6 text-center">
              <Armchair className="size-8 text-brand-400" />
              <p className="font-medium">El salón está vacío</p>
              <p className="max-w-sm text-sm text-muted">
                Creen las mesas con el botón «Mesas» de arriba y agreguen la pista, la tarima, los baños y la entrada para
                ubicarlas.
              </p>
            </div>
          ) : (
            <FloorPlanCanvas
              ref={canvas}
              layout={layout}
              infos={infos}
              elements={allElements}
              selected={selected}
              onSelect={setSelected}
              onMoveTable={moveTable}
              onMoveElement={moveElement}
              onResizeElement={resizeElement}
              onSeatTap={onSeatTap}
              overlay={
                (selTable || selElement) && (
                  // En el celular el panel queda debajo del plano: esta barra avisa que hay opciones
                  <div className="absolute inset-x-3 bottom-3 flex items-center gap-2 rounded-xl border border-line bg-white/95 p-2 pl-3 shadow-md lg:hidden">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {selTable
                        ? `Mesa ${selTable.table.number} · ${selTable.used}/${selTable.table.capacity}`
                        : elementLabel(selElement!)}
                    </span>
                    {selTable && (
                      <Button size="sm" icon={<UserPlus className="size-4" />} onClick={() => setSeatingAt(selTable.table.id)}>
                        Sentar
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => panel.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                    >
                      Opciones
                    </Button>
                  </div>
                )
              }
            />
          )}
          <Legend />
        </div>

        <aside ref={panel} className="flex scroll-mt-4 flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
          {selTable ? (
            <TablePanel
              key={selTable.table.id}
              occ={selTable}
              members={members}
              declined={declined.filter((d) => d.tableNumber === selTable.table.number)}
              onShape={(shape) => updatePlanTable(selTable.table.id, { shape })}
              onRotate={(delta) =>
                updatePlanTable(selTable.table.id, { rotation: normalizeRotation(selTable.table.rotation + delta) })
              }
              onSeat={() => setSeatingAt(selTable.table.id)}
              onEdit={() => setEditing(selTable.table)}
              onGuest={setAssigning}
              onRemoveDeclined={removeDeclined}
              onClose={() => setSelected(null)}
            />
          ) : selElement ? (
            <ElementPanel
              key={selElement.id}
              element={selElement}
              onRename={(label) => updateElement.mutate({ id: selElement.id, values: { label } })}
              onRotate={(delta) =>
                keepingUnplaced(() =>
                  updateElement.mutateAsync({
                    id: selElement.id,
                    values: { rotation: normalizeRotation(selElement.rotation + delta) },
                  }),
                ).catch(() => {})
              }
              onDelete={async () => {
                if (await attempt(keepingUnplaced(() => removeElement.mutateAsync(selElement.id)))) setSelected(null)
              }}
              onClose={() => setSelected(null)}
            />
          ) : (
            <OverviewPanel declined={declined} unseatedPeople={unseatedPeople} onRemoveDeclined={removeDeclined} />
          )}
        </aside>
      </div>

      {adding && <AddElementModal onPick={addElement} onClose={() => setAdding(false)} />}
      {seatingOcc && (
        <SeatGuestsModal
          occ={seatingOcc}
          guests={attending}
          members={members}
          tables={tables}
          onClose={() => setSeatingAt(null)}
        />
      )}
      {assigning && (
        <AssignModal
          guest={assigning}
          tables={occ}
          seats={seatsFor(assigning, members)}
          onPick={(tableId) => {
            assign(assigning, tableId)
            setAssigning(null)
          }}
          onClose={() => setAssigning(null)}
        />
      )}
      {editing && <TableFormModal table={editing} nextNumber={nextNumber} onClose={() => setEditing(null)} />}
    </>
  )
}

function Legend() {
  return (
    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted">
      <span className="inline-flex items-center gap-1.5">
        <span className="size-3.5 rounded-full border-[1.5px] border-emerald-600 bg-emerald-100" /> Confirmado
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="size-3.5 rounded-full border-[1.5px] border-dashed border-amber-500 bg-amber-50" /> Sin confirmar
        (puesto reservado)
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-flex size-3.5 items-center justify-center rounded-full border-[1.5px] border-dashed border-stone-300 bg-white text-[10px] leading-none text-stone-400">
          +
        </span>
        Puesto libre
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-flex size-3.5 items-center justify-center rounded-full bg-red-600 text-[9px] font-bold text-white">
          1
        </span>
        Dijo que no va (su puesto ya está libre)
      </span>
    </div>
  )
}

function PanelShell({ title, subtitle, onClose, children }: { title: string; subtitle?: ReactNode; onClose?: () => void; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-white p-4 shadow-xs">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold">{title}</h2>
          {subtitle && <div className="text-xs text-muted">{subtitle}</div>}
        </div>
        {onClose && (
          <Button size="sm" variant="ghost" onClick={onClose}>
            Listo
          </Button>
        )}
      </div>
      <div className="mt-3 flex flex-col gap-4">{children}</div>
    </section>
  )
}

function DeclinedList({
  items,
  showTable,
  onRemove,
}: {
  items: Declined[]
  showTable: boolean
  onRemove: (d: Declined) => void
}) {
  if (items.length === 0) return null
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-3">
      <p className="flex items-center gap-1.5 text-sm font-medium text-red-800">
        <AlertTriangle className="size-4" />
        {items.length === 1 ? 'Dijo que no va' : 'Dijeron que no van'}
      </p>
      <p className="mt-0.5 text-xs text-red-800/80">Su puesto ya quedó libre. Quítenlos para llenar el hueco.</p>
      <ul className="mt-2 flex flex-col gap-1.5">
        {items.map((d) => (
          <li key={d.key} className="flex items-center justify-between gap-2 text-sm">
            <span className="min-w-0 truncate">
              {d.name}
              {showTable && <span className="text-red-800/70"> · mesa {d.tableNumber}</span>}
            </span>
            <Button size="sm" variant="secondary" className="h-7 shrink-0 px-2 text-xs" onClick={() => onRemove(d)}>
              Quitar
            </Button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function OverviewPanel({
  declined,
  unseatedPeople,
  onRemoveDeclined,
}: {
  declined: Declined[]
  unseatedPeople: number
  onRemoveDeclined: (d: Declined) => void
}) {
  return (
    <PanelShell title="Cómo usar el plano">
      <DeclinedList items={declined} showTable onRemove={onRemoveDeclined} />
      {unseatedPeople > 0 && (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {plural(unseatedPeople, 'persona sigue', 'personas siguen')} sin mesa. Toquen un puesto libre (+) para sentarlas.
        </p>
      )}
      <ul className="flex list-disc flex-col gap-1.5 pl-4 text-sm text-muted">
        <li>Toquen una mesa para elegirla: ahí se cambia la forma, se gira y se ve quién está sentado.</li>
        <li>En el computador las mesas se arrastran directamente. En el celular, tóquenla primero y luego arrástrenla.</li>
        <li>Con dos dedos, o con la rueda del mouse, se acerca y se aleja.</li>
        <li>«Agregar al salón» pone la pista, la tarima, los baños, la entrada, el bar o el buffet.</li>
      </ul>
    </PanelShell>
  )
}

function TablePanel({
  occ,
  members,
  declined,
  onShape,
  onRotate,
  onSeat,
  onEdit,
  onGuest,
  onRemoveDeclined,
  onClose,
}: {
  occ: TableOccupancy
  members: GuestMember[]
  declined: Declined[]
  onShape: (shape: TableShape) => void
  onRotate: (delta: number) => void
  onSeat: () => void
  onEdit: () => void
  onGuest: (guest: Guest) => void
  onRemoveDeclined: (d: Declined) => void
  onClose: () => void
}) {
  const t = occ.table
  const tone = { vacia: 'neutral', incompleta: 'amber', completa: 'green', sobrecupo: 'red' } as const
  return (
    <PanelShell
      title={`Mesa ${t.number}`}
      subtitle={
        <span className="inline-flex items-center gap-2">
          {t.name && <span className="truncate">{t.name}</span>}
          <Badge tone={tone[occ.status]}>
            {occ.used}/{t.capacity}
          </Badge>
        </span>
      }
      onClose={onClose}
    >
      <Button icon={<UserPlus className="size-4" />} onClick={onSeat}>
        Sentar invitados
      </Button>

      <DeclinedList items={declined} showTable={false} onRemove={onRemoveDeclined} />

      <div>
        <p className="mb-1.5 text-xs font-medium text-muted">Forma</p>
        <div role="radiogroup" aria-label="Forma de la mesa" className="grid grid-cols-3 gap-1 rounded-lg border border-line bg-white p-0.5">
          {options(tableShape).map((o) => (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={t.shape === o.value}
              onClick={() => onShape(o.value)}
              className={cn(
                'h-8 truncate rounded-md px-1 text-xs transition-colors',
                t.shape === o.value ? 'bg-brand-600 font-medium text-white shadow-sm' : 'text-muted hover:text-ink',
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-muted">Girar</span>
        <IconButton label={`Girar ${ROTATE_STEP}° a la izquierda`} className="border border-line" onClick={() => onRotate(-ROTATE_STEP)}>
          <RotateCcw className="size-4" />
        </IconButton>
        <IconButton label={`Girar ${ROTATE_STEP}° a la derecha`} className="border border-line" onClick={() => onRotate(ROTATE_STEP)}>
          <RotateCw className="size-4" />
        </IconButton>
        <span className="text-xs text-muted tabular-nums">{t.rotation}°</span>
        <Button size="sm" variant="ghost" className="ml-auto" icon={<Pencil className="size-3.5" />} onClick={onEdit}>
          Editar
        </Button>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-medium text-muted">Sentados aquí</p>
        {occ.guests.length === 0 && occ.apart.length === 0 ? (
          <p className="text-sm text-muted">Nadie todavía.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {occ.guests.map((g) => {
              const extra = seatsFor(g, members) - 1
              return (
                <li key={g.id}>
                  <button
                    type="button"
                    onClick={() => onGuest(g)}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-brand-50"
                    title="Cambiar de mesa"
                  >
                    <span
                      className={cn(
                        'size-2.5 shrink-0 rounded-full',
                        g.rsvp_status === 'confirmado' ? 'bg-emerald-500' : 'bg-amber-400',
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{g.name}</span>
                      <OpenedNote guest={g} block />
                    </span>
                    {extra > 0 && <span className="text-xs text-muted">+{extra}</span>}
                  </button>
                </li>
              )
            })}
            {occ.apart.map((m) => (
              <li key={m.id} className="flex items-center gap-2 px-2 py-1.5 text-sm">
                <span className="size-2.5 shrink-0 rounded-full border border-dashed border-brand-400" />
                <span className="min-w-0 flex-1 truncate">{m.name}</span>
                <span className="text-xs text-muted">aparte</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PanelShell>
  )
}

function ElementPanel({
  element,
  onRename,
  onRotate,
  onDelete,
  onClose,
}: {
  element: VenueElement
  onRename: (label: string | null) => void
  onRotate: (delta: number) => void
  onDelete: () => void
  onClose: () => void
}) {
  const [name, setName] = useState(elementLabel(element))
  const save = () => {
    const clean = name.trim().slice(0, 40)
    const label = clean && clean !== venueElementKind[element.kind] ? clean : null
    if (label !== element.label) onRename(label)
    if (!clean) setName(venueElementKind[element.kind])
  }
  return (
    <PanelShell title={elementLabel(element)} subtitle={venueElementKind[element.kind]} onClose={onClose}>
      <label className="flex flex-col gap-1.5 text-xs font-medium text-muted">
        Nombre
        <Input
          value={name}
          maxLength={40}
          onChange={(e) => setName(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
          }}
        />
      </label>
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-muted">Girar</span>
        <IconButton label={`Girar ${ROTATE_STEP}° a la izquierda`} className="border border-line" onClick={() => onRotate(-ROTATE_STEP)}>
          <RotateCcw className="size-4" />
        </IconButton>
        <IconButton label={`Girar ${ROTATE_STEP}° a la derecha`} className="border border-line" onClick={() => onRotate(ROTATE_STEP)}>
          <RotateCw className="size-4" />
        </IconButton>
        <span className="text-xs text-muted tabular-nums">{element.rotation}°</span>
      </div>
      <p className="text-xs text-muted">Para cambiar el tamaño, arrastren el cuadrito de la esquina.</p>
      <Button variant="ghost" className="justify-start text-red-700" icon={<Trash2 className="size-4" />} onClick={onDelete}>
        Quitar del plano
      </Button>
    </PanelShell>
  )
}

function AddElementModal({ onPick, onClose }: { onPick: (kind: VenueElementKind) => void; onClose: () => void }) {
  return (
    <Modal open onClose={onClose} title="Agregar al salón" description="Aparece en el centro de lo que están viendo; luego lo arrastran a su lugar.">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {options(venueElementKind).map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onPick(o.value)}
            className="rounded-xl border border-line px-3 py-3 text-left text-sm font-medium transition-colors hover:border-brand-300 hover:bg-brand-50"
          >
            {o.label}
          </button>
        ))}
      </div>
    </Modal>
  )
}
