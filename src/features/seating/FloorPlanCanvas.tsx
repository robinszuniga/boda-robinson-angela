import {
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type Ref,
} from 'react'
import { Maximize, Minus, Plus } from 'lucide-react'
import {
  clampElementSize,
  clampViewW,
  fitView,
  rotate,
  snap,
  zoomView,
  type PlanLayout,
  type Point,
  type SeatPerson,
  type ViewBox,
} from '../../lib/floorPlan'
import { IconButton } from '../../components/ui/Button'
import type { VenueElement } from '../../types/database'
import { ElementView, TableShapeView, type TableInfo } from './PlanDrawing'

export type PlanSelection = { type: 'table' | 'element'; id: string }

export interface ElementBox {
  pos_x: number
  pos_y: number
  width: number
  height: number
}

export interface FloorPlanHandle {
  /** Centro de lo que se ve, para poner ahí lo nuevo */
  center: () => Point
  /** Vuelve a mostrar todo el salón */
  fit: () => void
}

type Target =
  | { type: 'background' }
  | { type: 'table'; id: string }
  | { type: 'seat'; tableId: string; index: number }
  | { type: 'element'; id: string }
  | { type: 'handle'; id: string }

type Action = 'pan' | 'move-table' | 'move-element' | 'resize'

interface Gesture {
  pointerId: number
  pointerType: string
  target: Target
  startClient: Point
  startView: ViewBox
  moved: boolean
  seq: number
  action: Action | null
  /** Posición y tamaño del objeto al empezar a arrastrarlo */
  origin: { id: string; x: number; y: number; w: number; h: number; rotation: number } | null
}

interface Pinch {
  startDist: number
  startView: ViewBox
  midWorld: Point
}

/** `seq` distingue un arrastre de otro del mismo objeto: al terminar de guardar uno no se borra el siguiente */
type Drag = { seq: number; type: 'table' | 'element'; id: string; x: number; y: number; w: number; h: number }

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)
const middle = (a: Point, b: Point) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })

function targetOf(node: EventTarget | null): Target {
  const el = (node as Element | null)?.closest?.('[data-plan]') as SVGElement | null
  const data = el?.dataset
  switch (data?.plan) {
    case 'table':
      return { type: 'table', id: data.id! }
    case 'seat':
      return { type: 'seat', tableId: data.table!, index: Number(data.index) }
    case 'element':
      return { type: 'element', id: data.id! }
    case 'handle':
      return { type: 'handle', id: data.id! }
    default:
      return { type: 'background' }
  }
}

const ARROWS: Record<string, Point> = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
}

/**
 * El plano interactivo. Con mouse se arrastran las mesas directamente; con el
 * dedo primero se toca la mesa (queda seleccionada) y luego se arrastra, para
 * que mover el plano no cambie mesas de lugar sin querer.
 */
export function FloorPlanCanvas({
  ref,
  layout,
  infos,
  elements,
  selected,
  onSelect,
  onMoveTable,
  onMoveElement,
  onResizeElement,
  onSeatTap,
  overlay,
}: {
  ref?: Ref<FloorPlanHandle>
  layout: PlanLayout
  infos: Map<string, TableInfo>
  elements: VenueElement[]
  selected: PlanSelection | null
  onSelect: (selection: PlanSelection | null) => void
  onMoveTable: (id: string, to: Point) => Promise<unknown>
  onMoveElement: (id: string, to: Point) => Promise<unknown>
  onResizeElement: (id: string, box: ElementBox) => Promise<unknown>
  onSeatTap: (tableId: string, person: SeatPerson | null) => void
  /** Lo que se muestra encima del plano (en el celular, la barra de la mesa elegida) */
  overlay?: ReactNode
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)
  // null = encuadre automático; deja de serlo cuando la persona mueve o acerca el plano
  const [manualView, setManualView] = useState<ViewBox | null>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  const dragRef = useRef<Drag | null>(null)
  const dragSeq = useRef(0)
  const pointers = useRef(new Map<number, Point>())
  const gesture = useRef<Gesture | null>(null)
  const pinch = useRef<Pinch | null>(null)
  const patternId = `puntos-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`

  const aspect = size ? size.w / size.h : 1.6
  const view = manualView ?? fitView(layout.bounds, aspect)
  const viewH = view.w / aspect

  const live = useRef({ view, aspect })
  useLayoutEffect(() => {
    live.current = { view, aspect }
  })

  useImperativeHandle(
    ref,
    () => ({ center: () => ({ x: view.x + view.w / 2, y: view.y + viewH / 2 }), fit: () => setManualView(null) }),
    [view, viewH],
  )

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      if (width > 0 && height > 0) setSize({ w: width, h: height })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const toWorld = (clientX: number, clientY: number, v: ViewBox): Point => {
    const rect = svgRef.current!.getBoundingClientRect()
    const s = v.w / rect.width
    return { x: v.x + (clientX - rect.left) * s, y: v.y + (clientY - rect.top) * s }
  }

  // La rueda del mouse (o el pellizco del touchpad) acerca y aleja donde está el puntero
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = svg.getBoundingClientRect()
      const speed = e.ctrlKey ? 0.01 : e.deltaMode === 1 ? 0.05 : 0.0015
      const factor = Math.exp(-e.deltaY * speed)
      // Sobre la vista más reciente: el touchpad manda varios eventos antes de que se vuelva a dibujar
      setManualView((prev) => {
        const v = prev ?? live.current.view
        const s = v.w / rect.width
        const at = { x: v.x + (e.clientX - rect.left) * s, y: v.y + (e.clientY - rect.top) * s }
        return zoomView(v, factor, at, live.current.aspect)
      })
    }
    svg.addEventListener('wheel', onWheel, { passive: false })
    return () => svg.removeEventListener('wheel', onWheel)
  }, [])

  const updateDrag = (next: Drag | null) => {
    dragRef.current = next
    setDrag(next)
  }

  const tableCenter = (id: string): Point | null => {
    const p = layout.tables.find((t) => t.table.id === id)
    return p ? p.center : null
  }

  const isSelected = (type: PlanSelection['type'], id: string) => selected?.type === type && selected.id === id

  const tap = (target: Target) => {
    switch (target.type) {
      case 'background':
        onSelect(null)
        break
      case 'table':
        onSelect({ type: 'table', id: target.id })
        break
      case 'seat': {
        onSelect({ type: 'table', id: target.tableId })
        onSeatTap(target.tableId, infos.get(target.tableId)?.people[target.index] ?? null)
        break
      }
      case 'element':
        onSelect({ type: 'element', id: target.id })
        break
    }
  }

  /** Mientras se guarda, la mesa se queda donde la soltaron (y no salta a la posición anterior) */
  const commit = (seq: number, save: Promise<unknown>) => {
    save
      .catch(() => {})
      .finally(() => {
        if (dragRef.current?.seq === seq) updateDrag(null)
      })
  }

  const startAction = (g: Gesture) => {
    const t = g.target
    const direct = g.pointerType !== 'touch'
    if (t.type === 'table' || t.type === 'seat') {
      const id = t.type === 'table' ? t.id : t.tableId
      const c = tableCenter(id)
      if (c && (direct || isSelected('table', id))) {
        const table = layout.tables.find((p) => p.table.id === id)!.table
        g.origin = { id, x: c.x, y: c.y, w: 0, h: 0, rotation: table.rotation }
        onSelect({ type: 'table', id })
        return 'move-table'
      }
      return 'pan'
    }
    if (t.type === 'element' || t.type === 'handle') {
      const el = elements.find((e) => e.id === t.id)
      if (!el) return 'pan'
      if (t.type === 'element' && !direct && !isSelected('element', el.id)) return 'pan'
      g.origin = { id: el.id, x: el.pos_x, y: el.pos_y, w: el.width, h: el.height, rotation: el.rotation }
      onSelect({ type: 'element', id: el.id })
      return t.type === 'handle' ? 'resize' : 'move-element'
    }
    return 'pan'
  }

  const onPointerDown = (e: PointerEvent<SVGSVGElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    setManualView((v) => v ?? view)
    if (pointers.current.size === 2) {
      // Segundo dedo: pasa a acercar/alejar y se olvida lo que hacía el primero
      if (gesture.current && dragRef.current?.seq === gesture.current.seq) updateDrag(null)
      gesture.current = null
      const [a, b] = [...pointers.current.values()]
      const m = middle(a, b)
      pinch.current = { startDist: Math.max(1, distance(a, b)), startView: view, midWorld: toWorld(m.x, m.y, view) }
      return
    }
    if (pointers.current.size > 2) return
    gesture.current = {
      pointerId: e.pointerId,
      pointerType: e.pointerType,
      target: targetOf(e.target),
      startClient: { x: e.clientX, y: e.clientY },
      startView: view,
      moved: false,
      seq: 0,
      action: null,
      origin: null,
    }
  }

  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const rect = e.currentTarget.getBoundingClientRect()

    const p = pinch.current
    if (p) {
      if (pointers.current.size < 2) return
      const [a, b] = [...pointers.current.values()]
      const w = clampViewW((p.startView.w * p.startDist) / Math.max(1, distance(a, b)))
      const s = w / rect.width
      const m = middle(a, b)
      setManualView({ x: p.midWorld.x - (m.x - rect.left) * s, y: p.midWorld.y - (m.y - rect.top) * s, w })
      return
    }

    const g = gesture.current
    if (!g || g.pointerId !== e.pointerId) return
    const dx = e.clientX - g.startClient.x
    const dy = e.clientY - g.startClient.y
    if (!g.moved) {
      if (Math.hypot(dx, dy) < (g.pointerType === 'mouse' ? 4 : 8)) return
      g.moved = true
      g.seq = ++dragSeq.current
      g.action = startAction(g)
    }
    const s = g.startView.w / rect.width
    const o = g.origin
    switch (g.action) {
      case 'pan':
        setManualView({ x: g.startView.x - dx * s, y: g.startView.y - dy * s, w: g.startView.w })
        break
      case 'move-table':
        updateDrag({ seq: g.seq, type: 'table', id: o!.id, x: o!.x + dx * s, y: o!.y + dy * s, w: 0, h: 0 })
        break
      case 'move-element':
        updateDrag({ seq: g.seq, type: 'element', id: o!.id, x: o!.x + dx * s, y: o!.y + dy * s, w: o!.w, h: o!.h })
        break
      case 'resize': {
        // La esquina contraria se queda quieta, aunque el elemento esté girado
        const local = rotate({ x: dx * s, y: dy * s }, -o!.rotation)
        // Con los mismos límites que se guardan, para que al soltar no se corra
        const w = clampElementSize(o!.w + local.x)
        const h = clampElementSize(o!.h + local.y)
        const shift = rotate({ x: (w - o!.w) / 2, y: (h - o!.h) / 2 }, o!.rotation)
        updateDrag({ seq: g.seq, type: 'element', id: o!.id, x: o!.x + shift.x, y: o!.y + shift.y, w, h })
        break
      }
    }
  }

  const finish = (e: PointerEvent<SVGSVGElement>, cancelled: boolean) => {
    pointers.current.delete(e.pointerId)
    if (pinch.current) {
      if (pointers.current.size < 2) pinch.current = null
      gesture.current = null
      return
    }
    const g = gesture.current
    if (!g || g.pointerId !== e.pointerId) return
    gesture.current = null
    if (cancelled) {
      // Solo el arrastre de este gesto; otro que se esté guardando sigue donde lo soltaron
      if (dragRef.current?.seq === g.seq) updateDrag(null)
      return
    }
    if (!g.moved) {
      tap(g.target)
      return
    }
    const d = dragRef.current
    if (!d || d.seq !== g.seq || !g.origin) return
    const x = snap(d.x)
    const y = snap(d.y)
    if (g.action === 'move-table') {
      updateDrag({ ...d, x, y })
      commit(d.seq, onMoveTable(d.id, { x, y }))
    } else if (g.action === 'move-element') {
      updateDrag({ ...d, x, y })
      commit(d.seq, onMoveElement(d.id, { x, y }))
    } else if (g.action === 'resize') {
      const box = { pos_x: Math.round(d.x), pos_y: Math.round(d.y), width: Math.round(d.w), height: Math.round(d.h) }
      updateDrag({ ...d, x: box.pos_x, y: box.pos_y, w: box.width, h: box.height })
      commit(d.seq, onResizeElement(d.id, box))
    }
  }

  const onKeyDown = (e: KeyboardEvent<SVGSVGElement>) => {
    const t = targetOf(e.target)
    if (t.type !== 'table' && t.type !== 'element') return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onSelect({ type: t.type, id: t.id })
      return
    }
    const arrow = ARROWS[e.key]
    if (!arrow || !isSelected(t.type, t.id)) return
    e.preventDefault()
    const step = e.shiftKey ? 50 : 10
    if (t.type === 'table') {
      const c = tableCenter(t.id)
      if (c) void onMoveTable(t.id, { x: snap(c.x + arrow.x * step), y: snap(c.y + arrow.y * step) }).catch(() => {})
    } else {
      const el = elements.find((x) => x.id === t.id)
      if (el) void onMoveElement(el.id, { x: snap(el.pos_x + arrow.x * step), y: snap(el.pos_y + arrow.y * step) }).catch(() => {})
    }
  }

  const zoomBy = (factor: number) =>
    setManualView(zoomView(view, factor, { x: view.x + view.w / 2, y: view.y + viewH / 2 }, aspect))

  return (
    <div
      ref={wrapRef}
      className="relative h-[68vh] min-h-[420px] overflow-hidden rounded-2xl border border-line bg-white shadow-xs"
    >
      <svg
        ref={svgRef}
        role="application"
        aria-label="Plano del salón. Toca una mesa para elegirla; con las flechas del teclado la mueves."
        viewBox={`${view.x} ${view.y} ${view.w} ${viewH}`}
        className="block size-full cursor-grab touch-none select-none active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => finish(e, false)}
        onPointerCancel={(e) => finish(e, true)}
        onKeyDown={onKeyDown}
      >
        <defs>
          <pattern id={patternId} width={40} height={40} patternUnits="userSpaceOnUse">
            <circle cx={20} cy={20} r={1.4} className="fill-stone-300" />
          </pattern>
        </defs>
        <rect x={view.x} y={view.y} width={view.w} height={viewH} fill={`url(#${patternId})`} />

        {elements.map((el) => {
          const d = drag?.type === 'element' && drag.id === el.id ? drag : null
          return (
            <ElementView
              key={el.id}
              element={el}
              x={d?.x ?? el.pos_x}
              y={d?.y ?? el.pos_y}
              width={d?.w ?? el.width}
              height={d?.h ?? el.height}
              selected={isSelected('element', el.id)}
              interactive
            />
          )
        })}

        {layout.unplacedOrigin && (
          <text
            x={layout.unplacedOrigin.x}
            y={layout.unplacedOrigin.y}
            fontSize={18}
            className="pointer-events-none fill-stone-500 select-none"
          >
            Mesas sin ubicar: arrástrenlas a su lugar
          </text>
        )}

        {layout.tables.map((p) => {
          const d = drag?.type === 'table' && drag.id === p.table.id ? drag : null
          const info = infos.get(p.table.id)
          if (!info) return null
          return (
            <TableShapeView
              key={p.table.id}
              table={p.table}
              geometry={p.geometry}
              info={info}
              x={d?.x ?? p.center.x}
              y={d?.y ?? p.center.y}
              selected={isSelected('table', p.table.id)}
              interactive
            />
          )
        })}
      </svg>

      <div className="absolute top-3 right-3 flex flex-col overflow-hidden rounded-xl border border-line bg-white/95 shadow-sm">
        <IconButton label="Acercar" className="size-10 rounded-none" onClick={() => zoomBy(1.3)}>
          <Plus className="size-4" />
        </IconButton>
        <IconButton label="Alejar" className="size-10 rounded-none border-t border-line" onClick={() => zoomBy(1 / 1.3)}>
          <Minus className="size-4" />
        </IconButton>
        <IconButton label="Ver todo el salón" className="size-10 rounded-none border-t border-line" onClick={() => setManualView(null)}>
          <Maximize className="size-4" />
        </IconButton>
      </div>
      {overlay}
    </div>
  )
}
