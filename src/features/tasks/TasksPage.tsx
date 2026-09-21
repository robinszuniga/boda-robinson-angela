import { useState } from 'react'
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
} from '@dnd-kit/core'
import { toast } from 'sonner'
import { CalendarDays, Columns3, List, ListChecks, Plus, Search } from 'lucide-react'
import { tasksApi, useSettings } from '../../lib/api'
import { attempt } from '../../lib/attempt'
import { daysFromToday, formatDate, plural } from '../../lib/format'
import { assigneeLabel, taskPriority, taskStatus } from '../../lib/labels'
import { Button } from '../../components/ui/Button'
import { Badge, EmptyState, ErrorState, LoadingState, PageHeader, ProgressBar, Segmented } from '../../components/ui/Display'
import { Input, Select } from '../../components/ui/Field'
import { cn } from '../../components/ui/cn'
import type { Task, TaskAssignee, TaskStatus, WeddingSettings } from '../../types/database'
import { TASK_STAGES } from '../../data/taskTemplate'
import { TaskFormModal } from './TaskFormModal'
import { useLoadTaskTemplate } from './templateActions'

type View = 'kanban' | 'lista'
const COLUMNS: TaskStatus[] = ['por_hacer', 'en_proceso', 'listo']

function DueLabel({ task }: { task: Task }) {
  if (!task.due_date) return null
  const days = daysFromToday(task.due_date)
  const late = task.status !== 'listo' && days < 0
  const soon = task.status !== 'listo' && days >= 0 && days <= 7
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs', late ? 'font-medium text-red-700' : soon ? 'text-amber-700' : 'text-muted')}>
      <CalendarDays className="size-3" />
      {formatDate(task.due_date)}
      {late && ' · atrasada'}
    </span>
  )
}

function TaskCardBody({ task, settings }: { task: Task; settings?: WeddingSettings }) {
  return (
    <>
      <p className={cn('text-sm font-medium', task.status === 'listo' && 'text-muted line-through')}>{task.title}</p>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <DueLabel task={task} />
        <span className="text-xs text-muted">{assigneeLabel(task.assignee, settings)}</span>
        {task.priority === 'alta' && task.status !== 'listo' && <Badge tone="red">Alta</Badge>}
      </div>
    </>
  )
}

function KanbanCard({ task, settings, onOpen }: { task: Task; settings?: WeddingSettings; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id })
  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={onOpen}
      {...listeners}
      {...attributes}
      className={cn(
        'w-full touch-manipulation rounded-xl border border-line bg-white p-3 text-left shadow-xs transition hover:border-brand-300',
        isDragging && 'opacity-30',
      )}
    >
      <TaskCardBody task={task} settings={settings} />
    </button>
  )
}

function KanbanColumn({ status, children, count }: { status: TaskStatus; children: React.ReactNode; count: number }) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  return (
    <section
      ref={setNodeRef}
      aria-label={taskStatus[status].label}
      className={cn('flex min-h-40 flex-col rounded-2xl bg-stone-100/70 p-3 transition', isOver && 'bg-brand-50 ring-2 ring-brand-300')}
    >
      <h2 className="mb-3 flex items-center justify-between px-1 font-sans text-sm font-semibold">
        {taskStatus[status].label}
        <span className="rounded-full bg-white px-2 text-xs text-muted">{count}</span>
      </h2>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  )
}

export default function TasksPage() {
  const settings = useSettings()
  const tasks = tasksApi.useList()
  const update = tasksApi.useUpdate()
  const loadTemplate = useLoadTaskTemplate()
  const [view, setView] = useState<View>('kanban')
  const [assignee, setAssignee] = useState<TaskAssignee | ''>('')
  const [search, setSearch] = useState('')
  const [hideDone, setHideDone] = useState(false)
  const [form, setForm] = useState<{ task?: Task; defaults?: Partial<Task> } | null>(null)
  const [dragging, setDragging] = useState<Task | null>(null)

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  )

  if (settings.isError || tasks.isError) {
    return <ErrorState error={settings.error ?? tasks.error} onRetry={() => { settings.refetch(); tasks.refetch() }} />
  }
  if (settings.isPending || tasks.isPending) return <LoadingState />

  const all = tasks.data
  const done = all.filter((t) => t.status === 'listo').length
  const overdue = all.filter((t) => t.status !== 'listo' && t.due_date && daysFromToday(t.due_date) < 0).length
  const term = search.trim().toLowerCase()
  const filtered = all.filter(
    (t) =>
      (!assignee || t.assignee === assignee || t.assignee === 'ambos') &&
      (!term || t.title.toLowerCase().includes(term)),
  )

  const setStatus = (task: Task, status: TaskStatus) => {
    if (task.status === status) return
    update.mutate({
      id: task.id,
      values: { status, completed_at: status === 'listo' ? new Date().toISOString() : null },
    })
  }

  const onDragEnd = (e: DragEndEvent) => {
    setDragging(null)
    const task = all.find((t) => t.id === e.active.id)
    if (task && e.over) setStatus(task, e.over.id as TaskStatus)
  }

  const loadTemplateNow = async () => {
    if (await attempt(loadTemplate.mutateAsync(settings.data.wedding_date))) toast.success('Plantilla cargada')
  }

  return (
    <>
      <PageHeader
        title="Tareas"
        description={`${done} de ${all.length} listas${overdue ? ` · ${plural(overdue, 'atrasada', 'atrasadas')}` : ''}`}
        actions={
          <Button icon={<Plus className="size-4" />} onClick={() => setForm({})}>
            Tarea
          </Button>
        }
      />

      {all.length > 0 && <ProgressBar className="-mt-3 mb-6" value={done} max={all.length} label="Tareas listas" />}

      {all.length === 0 ? (
        <EmptyState
          icon={<ListChecks className="size-8" />}
          title="No hay tareas todavía"
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={loadTemplateNow} disabled={loadTemplate.isPending}>
                Cargar plantilla de boda
              </Button>
              <Button variant="secondary" onClick={() => setForm({})}>
                Crear una tarea
              </Button>
            </div>
          }
        >
          La plantilla trae unas 50 tareas típicas organizadas por meses, con fechas calculadas desde la fecha de la boda.
        </EmptyState>
      ) : (
        <>
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
            <Segmented
              label="Vista"
              value={view}
              onChange={setView}
              options={[
                { value: 'kanban', label: <><Columns3 className="size-4" /> Tablero</> },
                { value: 'lista', label: <><List className="size-4" /> Por etapa</> },
              ]}
            />
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
              <Input aria-label="Buscar tarea" placeholder="Buscar…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select aria-label="Responsable" className="sm:w-44" value={assignee} onChange={(e) => setAssignee(e.target.value as TaskAssignee | '')}>
              <option value="">Todos</option>
              <option value="novio">{assigneeLabel('novio', settings.data)}</option>
              <option value="novia">{assigneeLabel('novia', settings.data)}</option>
              <option value="ambos">Solo las de ambos</option>
            </Select>
          </div>

          {view === 'kanban' ? (
            <DndContext
              sensors={sensors}
              onDragStart={(e) => setDragging(all.find((t) => t.id === e.active.id) ?? null)}
              onDragEnd={onDragEnd}
              onDragCancel={() => setDragging(null)}
            >
              <div className="grid gap-4 md:grid-cols-3">
                {COLUMNS.map((status) => {
                  const items = filtered.filter((t) => t.status === status)
                  const shown = status === 'listo' ? [...items].sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? '')).slice(0, 30) : items
                  return (
                    <KanbanColumn key={status} status={status} count={items.length}>
                      {shown.map((t) => (
                        <KanbanCard key={t.id} task={t} settings={settings.data} onOpen={() => setForm({ task: t })} />
                      ))}
                      <button
                        type="button"
                        onClick={() => setForm({ defaults: { status } })}
                        className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-muted hover:bg-white hover:text-ink"
                      >
                        <Plus className="size-4" /> Agregar
                      </button>
                    </KanbanColumn>
                  )
                })}
              </div>
              <DragOverlay>
                {dragging && (
                  <div className="rotate-1 rounded-xl border border-line bg-white p-3 shadow-lg ring-2 ring-brand-300">
                    <TaskCardBody task={dragging} settings={settings.data} />
                  </div>
                )}
              </DragOverlay>
            </DndContext>
          ) : (
            <StageList
              tasks={hideDone ? filtered.filter((t) => t.status !== 'listo') : filtered}
              settings={settings.data}
              hideDone={hideDone}
              onToggleHideDone={() => setHideDone(!hideDone)}
              onToggle={(t) => setStatus(t, t.status === 'listo' ? 'por_hacer' : 'listo')}
              onOpen={(t) => setForm({ task: t })}
            />
          )}
        </>
      )}

      {form && <TaskFormModal {...form} onClose={() => setForm(null)} />}
    </>
  )
}

function StageList({
  tasks,
  settings,
  hideDone,
  onToggleHideDone,
  onToggle,
  onOpen,
}: {
  tasks: Task[]
  settings?: WeddingSettings
  hideDone: boolean
  onToggleHideDone: () => void
  onToggle: (t: Task) => void
  onOpen: (t: Task) => void
}) {
  const known: string[] = [...TASK_STAGES]
  const custom = [...new Set(tasks.map((t) => t.stage).filter((s): s is string => !!s && !known.includes(s)))]
  const groups = [...known, ...custom, '']
    .map((stage) => ({ stage, items: tasks.filter((t) => (t.stage ?? '') === stage) }))
    .filter((g) => g.items.length > 0)

  return (
    <div className="flex flex-col gap-6">
      <label className="inline-flex items-center gap-2 self-end text-sm text-muted">
        <input type="checkbox" className="size-4 accent-brand-600" checked={hideDone} onChange={onToggleHideDone} />
        Ocultar las listas
      </label>
      {groups.map((g) => {
        const doneInGroup = g.items.filter((t) => t.status === 'listo').length
        return (
          <section key={g.stage || 'sin-etapa'}>
            <h2 className="mb-2 flex items-baseline gap-2 text-xl font-semibold">
              {g.stage || 'Sin etapa'}
              <span className="font-sans text-xs font-normal text-muted">
                {doneInGroup}/{g.items.length}
              </span>
            </h2>
            <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white shadow-xs">
              {g.items.map((t) => (
                <li key={t.id} className="flex items-start gap-3 px-4 py-3">
                  <input
                    type="checkbox"
                    className="mt-0.5 size-5 shrink-0 cursor-pointer accent-brand-600"
                    checked={t.status === 'listo'}
                    onChange={() => onToggle(t)}
                    aria-label={`Marcar "${t.title}" como ${t.status === 'listo' ? 'pendiente' : 'lista'}`}
                  />
                  <button type="button" onClick={() => onOpen(t)} className="min-w-0 flex-1 text-left">
                    <p className={cn('text-sm', t.status === 'listo' && 'text-muted line-through')}>{t.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <DueLabel task={t} />
                      <span className="text-xs text-muted">{assigneeLabel(t.assignee, settings)}</span>
                      {t.status === 'en_proceso' && <Badge tone="blue">En proceso</Badge>}
                    </div>
                  </button>
                  {t.status !== 'listo' && <Badge tone={taskPriority[t.priority].tone}>{taskPriority[t.priority].label}</Badge>}
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
