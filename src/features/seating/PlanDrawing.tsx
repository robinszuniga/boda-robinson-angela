import { memo } from 'react'
import { elementLabel, rotate, SEAT_R, type Point, type SeatPerson, type TableGeometry } from '../../lib/floorPlan'
import type { TableStatus } from '../../lib/seating'
import { cn } from '../../components/ui/cn'
import type { SeatingTable, VenueElement, VenueElementKind } from '../../types/database'

/** Lo que se dibuja de cada mesa además de su forma */
export interface TableInfo {
  people: SeatPerson[]
  used: number
  status: TableStatus
  /** Nombres de los que dijeron que no y siguen anotados en la mesa */
  declined: string[]
}

const tableStroke: Record<TableStatus, string> = {
  vacia: 'stroke-stone-300',
  incompleta: 'stroke-amber-300',
  completa: 'stroke-emerald-400',
  sobrecupo: 'stroke-red-400',
}

const elementStyle: Record<VenueElementKind, string> = {
  pista: 'fill-brand-50 stroke-brand-300',
  tarima: 'fill-accent-50 stroke-accent-300',
  banos: 'fill-sky-50 stroke-sky-300',
  entrada: 'fill-stone-100 stroke-stone-400',
  bar: 'fill-amber-50 stroke-amber-300',
  buffet: 'fill-amber-50 stroke-amber-300',
  otro: 'fill-stone-50 stroke-stone-300',
}

/** Largo de la línea horizontal que pasa por el centro de un rectángulo girado */
function chord(w: number, h: number, degrees: number) {
  const a = (degrees * Math.PI) / 180
  const cos = Math.abs(Math.cos(a))
  const sin = Math.abs(Math.sin(a))
  return Math.min(cos > 1e-6 ? w / cos : Infinity, sin > 1e-6 ? h / sin : Infinity)
}

const truncate = (text: string, max: number) =>
  text.length <= max ? text : `${text.slice(0, Math.max(1, max - 1)).trimEnd()}…`

/** Cuántas letras caben en un ancho a un tamaño de letra (aproximado para Inter) */
const fits = (width: number, fontSize: number) => Math.max(3, Math.floor(width / (fontSize * 0.56)))

function Seat({
  at,
  person,
  over,
  rotation,
  tableId,
  index,
  interactive,
}: {
  at: Point
  person: SeatPerson | undefined
  over: boolean
  rotation: number
  tableId: string
  index: number
  interactive: boolean
}) {
  const title = person
    ? `${person.name} · ${person.status === 'confirmado' ? 'confirmado' : 'sin confirmar (puesto reservado)'}${
        person.kind === 'aparte' ? ' · se sienta aparte de su invitación' : ''
      }`
    : 'Puesto libre'
  return (
    <g
      transform={`translate(${at.x} ${at.y})`}
      data-plan={interactive ? 'seat' : undefined}
      data-table={tableId}
      data-index={index}
      className={interactive ? 'cursor-pointer' : undefined}
    >
      <title>{interactive && !person ? 'Puesto libre: toca para sentar a alguien' : title}</title>
      <circle
        r={SEAT_R}
        strokeWidth={over ? 2.5 : 1.5}
        strokeDasharray={person?.status === 'pendiente' || !person ? '3 2.5' : undefined}
        className={cn(
          !person && 'fill-white stroke-stone-300',
          person?.status === 'confirmado' && 'fill-emerald-100 stroke-emerald-600',
          person?.status === 'pendiente' && 'fill-amber-50 stroke-amber-500',
          over && 'stroke-red-600',
        )}
      />
      {(person || interactive) && (
        <text
          transform={`rotate(${-rotation})`}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={person ? 9.5 : 15}
          fontWeight={person ? 600 : 400}
          className={cn(
            'pointer-events-none select-none',
            !person && 'fill-stone-400',
            person?.status === 'confirmado' && 'fill-emerald-900',
            person?.status === 'pendiente' && 'fill-amber-900',
          )}
        >
          {person ? person.initials : '+'}
        </text>
      )}
    </g>
  )
}

export const TableShapeView = memo(function TableShapeView({
  table,
  geometry,
  info,
  x,
  y,
  selected,
  interactive,
}: {
  table: SeatingTable
  geometry: TableGeometry
  info: TableInfo
  x: number
  y: number
  selected: boolean
  interactive: boolean
}) {
  const rotation = table.rotation
  const body = geometry.body
  // El texto no gira: el ancho disponible es el de la línea horizontal que cruza la mesa ya girada
  const textWidth = 0.85 * (body.kind === 'circle' ? body.r * 2 : chord(body.w, body.h, rotation))
  const title = `Mesa ${table.number}`
  const lines: { text: string; size: number; className: string }[] =
    body.kind === 'circle'
      ? [
          { text: title, size: 13, className: 'fill-ink font-semibold' },
          ...(table.name ? [{ text: truncate(table.name, fits(textWidth, 10)), size: 10, className: 'fill-stone-500' }] : []),
        ]
      : [
          {
            text: truncate(table.name ? `${title} · ${table.name}` : title, fits(textWidth, 12)),
            size: 12,
            className: 'fill-ink font-semibold',
          },
        ]
  lines.push({
    text: `${info.used}/${table.capacity}`,
    size: 11,
    className: info.status === 'sobrecupo' ? 'fill-red-700 font-semibold' : 'fill-stone-500',
  })
  const lineHeight = 14
  const top = -((lines.length - 1) * lineHeight) / 2
  // El aviso va en la esquina de la mesa (girada con ella), sin taparle los puestos
  const corner =
    body.kind === 'circle'
      ? { x: body.r * 0.75, y: -body.r * 0.75 }
      : rotate({ x: body.w / 2, y: -body.h / 2 }, rotation)
  const label = `Mesa ${table.number}${table.name ? `, ${table.name}` : ''}: ${info.used} de ${table.capacity} puestos${
    info.declined.length > 0 ? `, ${info.declined.length} no vienen` : ''
  }`

  return (
    <g
      transform={`translate(${x} ${y})`}
      data-plan={interactive ? 'table' : undefined}
      data-id={table.id}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? label : undefined}
      aria-pressed={interactive ? selected : undefined}
      className={cn(interactive && 'cursor-move outline-none')}
    >
      <g transform={`rotate(${rotation})`}>
        {body.kind === 'circle' ? (
          <circle
            r={body.r}
            strokeWidth={selected ? 3.5 : 2}
            className={cn('fill-white', selected ? 'stroke-brand-600' : tableStroke[info.status])}
          />
        ) : (
          <rect
            x={-body.w / 2}
            y={-body.h / 2}
            width={body.w}
            height={body.h}
            rx={6}
            strokeWidth={selected ? 3.5 : 2}
            className={cn('fill-white', selected ? 'stroke-brand-600' : tableStroke[info.status])}
          />
        )}
        {geometry.seats.map((at, i) => (
          <Seat
            key={i}
            at={at}
            person={info.people[i]}
            over={i >= table.capacity}
            rotation={rotation}
            tableId={table.id}
            index={i}
            interactive={interactive}
          />
        ))}
      </g>
      <g className="pointer-events-none select-none">
        {lines.map((l, i) => (
          <text
            key={i}
            y={top + i * lineHeight}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={l.size}
            className={l.className}
          >
            {l.text}
          </text>
        ))}
      </g>
      {info.declined.length > 0 && (
        <g transform={`translate(${corner.x} ${corner.y})`}>
          <title>{`No vienen: ${info.declined.join(', ')}. Su puesto ya está libre.`}</title>
          <circle r={10} className="fill-red-600 stroke-white" strokeWidth={2} />
          <text textAnchor="middle" dominantBaseline="central" fontSize={10.5} fontWeight={700} className="pointer-events-none fill-white">
            {info.declined.length > 9 ? '9+' : `${info.declined.length}`}
          </text>
        </g>
      )}
    </g>
  )
})

export const ElementView = memo(function ElementView({
  element,
  x,
  y,
  width,
  height,
  selected,
  interactive,
}: {
  element: VenueElement
  x: number
  y: number
  width: number
  height: number
  selected: boolean
  interactive: boolean
}) {
  const text = elementLabel(element)
  const fontSize = Math.max(9, Math.min(22, height * 0.4, (width * 0.9) / (text.length * 0.56)))
  // Que el nombre nunca quede de cabeza
  const flip = element.rotation > 90 && element.rotation <= 270
  const handle = 18
  return (
    <g
      transform={`translate(${x} ${y}) rotate(${element.rotation})`}
      data-plan={interactive ? 'element' : undefined}
      data-id={element.id}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? text : undefined}
      aria-pressed={interactive ? selected : undefined}
      className={cn(interactive && 'cursor-move outline-none')}
    >
      <rect
        x={-width / 2}
        y={-height / 2}
        width={width}
        height={height}
        rx={10}
        strokeWidth={2}
        className={elementStyle[element.kind]}
      />
      <text
        transform={flip ? 'rotate(180)' : undefined}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={fontSize}
        className="pointer-events-none fill-stone-600 font-medium select-none"
      >
        {text}
      </text>
      {selected && (
        <rect
          x={-width / 2 - 5}
          y={-height / 2 - 5}
          width={width + 10}
          height={height + 10}
          rx={12}
          fill="none"
          strokeWidth={2}
          strokeDasharray="6 4"
          className="pointer-events-none stroke-brand-600"
        />
      )}
      {selected && interactive && (
        <rect
          data-plan="handle"
          data-id={element.id}
          x={width / 2 - handle / 2}
          y={height / 2 - handle / 2}
          width={handle}
          height={handle}
          rx={4}
          strokeWidth={2}
          className="cursor-nwse-resize fill-white stroke-brand-600"
        >
          <title>Arrastra para cambiar el tamaño</title>
        </rect>
      )}
    </g>
  )
})
