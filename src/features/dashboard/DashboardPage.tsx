import { Link } from 'react-router'
import { AlertTriangle, ArrowRight, CalendarDays, CheckCircle2, MapPin, Sparkles, Users, Wallet } from 'lucide-react'
import {
  categoriesApi,
  guestLinksApi,
  guestsApi,
  paymentsApi,
  tasksApi,
  useSettings,
  vendorsApi,
} from '../../lib/api'
import { summarizeBudget, upcomingPayments } from '../../lib/budget'
import { headcount, linkConflicts } from '../../lib/seating'
import { daysFromToday, formatCOP, formatDate, formatPercent, formatWeddingDate, plural } from '../../lib/format'
import { assigneeLabel, taskPriority } from '../../lib/labels'
import { Badge, Card, CardHeader, ErrorState, LoadingState, ProgressBar, Stat } from '../../components/ui/Display'
import { ButtonLink } from '../../components/ui/Button'
import { Countdown } from './Countdown'

function relativeDay(iso: string): string {
  const d = daysFromToday(iso)
  if (d < 0) return `hace ${-d} ${d === -1 ? 'día' : 'días'}`
  if (d === 0) return 'hoy'
  if (d === 1) return 'mañana'
  return `en ${d} días`
}

export default function DashboardPage() {
  const settings = useSettings()
  const categories = categoriesApi.useList()
  const vendors = vendorsApi.useList()
  const payments = paymentsApi.useList()
  const guests = guestsApi.useList()
  const links = guestLinksApi.useList()
  const tasks = tasksApi.useList()

  const queries = [settings, categories, vendors, payments, guests, tasks]
  const failed = queries.find((q) => q.isError)
  if (failed) return <ErrorState error={failed.error} onRetry={() => queries.forEach((q) => q.refetch())} />
  if (queries.some((q) => q.isPending) || !settings.data) return <LoadingState />

  const s = settings.data
  const budget = summarizeBudget(categories.data ?? [], vendors.data ?? [], payments.data ?? [])
  const people = headcount(guests.data ?? [])
  const conflicts = linkConflicts(links.data ?? [], guests.data ?? [])
  const nextPayments = upcomingPayments(payments.data ?? [])
  const vendorName = new Map((vendors.data ?? []).map((v) => [v.id, v.name]))
  const categoryName = new Map((categories.data ?? []).map((c) => [c.id, c.name]))

  const allTasks = tasks.data ?? []
  const openTasks = allTasks.filter((t) => t.status !== 'listo')
  const overdue = openTasks.filter((t) => t.due_date && daysFromToday(t.due_date) < 0)
  const soon = openTasks
    .filter((t) => t.due_date && daysFromToday(t.due_date) <= 14)
    .sort((a, b) => a.due_date!.localeCompare(b.due_date!))
    .slice(0, 6)
  const doneCount = allTasks.length - openTasks.length

  const budgetBase = s.total_budget || budget.totals.estimated
  const alerts: { text: string; to: string }[] = []
  for (const row of budget.rows.filter((r) => r.overBudget)) {
    alerts.push({
      text: `${row.category.name} supera lo estimado por ${formatCOP(row.committed - row.estimated)}`,
      to: '/presupuesto',
    })
  }
  if (s.total_budget > 0 && budget.totals.committed > s.total_budget) {
    alerts.push({ text: `Lo comprometido supera el presupuesto total por ${formatCOP(budget.totals.committed - s.total_budget)}`, to: '/presupuesto' })
  }
  if (s.venue_capacity > 0 && people.confirmedPeople > s.venue_capacity) {
    alerts.push({ text: `Hay ${people.confirmedPeople} personas confirmadas y el lugar es para ${s.venue_capacity}`, to: '/invitados' })
  } else if (s.venue_capacity > 0 && people.expectedPeople > s.venue_capacity) {
    alerts.push({ text: `Si todos los pendientes vienen serían ${people.expectedPeople} personas (capacidad ${s.venue_capacity})`, to: '/invitados' })
  }
  if (overdue.length > 0) {
    alerts.push({ text: `${overdue.length} ${overdue.length === 1 ? 'tarea atrasada' : 'tareas atrasadas'}`, to: '/tareas' })
  }
  if (conflicts.length > 0) {
    alerts.push({ text: `${conflicts.length} ${conflicts.length === 1 ? 'conflicto' : 'conflictos'} en la distribución de mesas`, to: '/mesas' })
  }

  const gettingStarted = [
    { done: s.total_budget > 0, text: 'Definir el presupuesto total y la fecha exacta', to: '/configuracion' },
    { done: allTasks.length > 0, text: 'Cargar la plantilla de tareas', to: '/configuracion' },
    { done: (vendors.data ?? []).length > 0, text: 'Agregar los primeros proveedores', to: '/proveedores' },
    { done: (guests.data ?? []).length > 0, text: 'Empezar la lista de invitados', to: '/invitados' },
  ]
  const showGettingStarted = gettingStarted.some((g) => !g.done)

  return (
    <div className="flex flex-col gap-6">
      <section className="relative overflow-hidden rounded-3xl border border-brand-100 bg-gradient-to-br from-brand-50 via-white to-accent-50 p-6 sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium tracking-wide text-brand-600 uppercase">Nuestra boda</p>
            <h1 className="mt-1 text-4xl font-semibold tracking-tight sm:text-5xl">
              {s.partner_1_name} <span className="text-accent-400 italic">&amp;</span> {s.partner_2_name}
            </h1>
            <p className="mt-3 flex items-center gap-2 text-sm text-muted">
              <CalendarDays className="size-4" /> {formatWeddingDate(s.wedding_date)}
            </p>
            {s.venue_name && (
              <p className="mt-1 flex items-center gap-2 text-sm text-muted">
                <MapPin className="size-4" /> {s.venue_name}
              </p>
            )}
          </div>
          <Countdown target={s.wedding_date} />
        </div>
      </section>

      {showGettingStarted && (
        <Card className="border-accent-100 bg-accent-50/40">
          <CardHeader title={<span className="flex items-center gap-2"><Sparkles className="size-5 text-accent-400" /> Primeros pasos</span>} />
          <ul className="grid gap-2 px-5 pb-5 sm:grid-cols-2">
            {gettingStarted.map((g) => (
              <li key={g.text}>
                <Link to={g.to} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-white">
                  <CheckCircle2 className={`size-4 shrink-0 ${g.done ? 'text-brand-500' : 'text-stone-300'}`} />
                  <span className={g.done ? 'text-muted line-through' : ''}>{g.text}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          icon={<Wallet className="size-4" />}
          label="Pagado"
          value={formatCOP(budget.totals.paid)}
          sub={budgetBase > 0 ? `${formatPercent(budget.totals.paid / budgetBase)} del presupuesto` : 'Define el presupuesto total'}
        />
        <Stat
          icon={<Wallet className="size-4" />}
          label="Comprometido"
          value={formatCOP(budget.totals.committed)}
          sub={budgetBase > 0 ? `${formatPercent(budget.totals.committed / budgetBase)} de ${formatCOP(budgetBase)}` : undefined}
        />
        <Stat
          icon={<Users className="size-4" />}
          label="Personas confirmadas"
          value={`${people.confirmedPeople}${s.venue_capacity ? ` / ${s.venue_capacity}` : ''}`}
          sub={`${plural(people.pendingGuests, 'invitación pendiente', 'invitaciones pendientes')} · ${people.declinedGuests} no ${people.declinedGuests === 1 ? 'asiste' : 'asisten'}`}
        />
        <Stat
          icon={<CheckCircle2 className="size-4" />}
          label="Tareas listas"
          value={`${doneCount} / ${allTasks.length}`}
          sub={overdue.length ? plural(overdue.length, 'atrasada', 'atrasadas') : 'Nada atrasado'}
        />
      </div>

      {alerts.length > 0 && (
        <Card className="border-red-200 bg-red-50/50">
          <ul className="flex flex-col divide-y divide-red-100">
            {alerts.map((a) => (
              <li key={a.text}>
                <Link to={a.to} className="flex items-center gap-3 px-5 py-3 text-sm text-red-900 hover:bg-red-50">
                  <AlertTriangle className="size-4 shrink-0 text-red-700" />
                  <span className="flex-1">{a.text}</span>
                  <ArrowRight className="size-4 text-red-400" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Tareas próximas"
            subtitle="Atrasadas y de los próximos 14 días"
            action={<ButtonLink to="/tareas" variant="ghost" size="sm">Ver todas</ButtonLink>}
          />
          {soon.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-muted">No hay tareas para las próximas dos semanas.</p>
          ) : (
            <ul className="divide-y divide-line border-t border-line">
              {soon.map((t) => {
                const late = daysFromToday(t.due_date!) < 0
                return (
                  <li key={t.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{t.title}</p>
                      <p className={`text-xs ${late ? 'font-medium text-red-700' : 'text-muted'}`}>
                        {formatDate(t.due_date)} · {relativeDay(t.due_date!)} · {assigneeLabel(t.assignee, s)}
                      </p>
                    </div>
                    <Badge tone={taskPriority[t.priority].tone}>{taskPriority[t.priority].label}</Badge>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Próximos pagos"
            subtitle="Pagos programados que faltan por hacer"
            action={<ButtonLink to="/presupuesto" variant="ghost" size="sm">Presupuesto</ButtonLink>}
          />
          {nextPayments.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-muted">No hay pagos programados.</p>
          ) : (
            <ul className="divide-y divide-line border-t border-line">
              {nextPayments.map((p) => {
                const late = daysFromToday(p.date) < 0
                return (
                  <li key={p.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {(p.vendor_id && vendorName.get(p.vendor_id)) || p.note || categoryName.get(p.category_id)}
                      </p>
                      <p className={`text-xs ${late ? 'font-medium text-red-700' : 'text-muted'}`}>
                        {formatDate(p.date)} · {relativeDay(p.date)}
                      </p>
                    </div>
                    <span className="text-sm font-semibold tabular-nums">{formatCOP(p.amount)}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader
            title="Confirmaciones"
            subtitle={`${plural(people.invitations, 'invitación', 'invitaciones')} · hasta ${plural(people.expectedPeople, 'persona', 'personas')} si todos los pendientes vienen`}
            action={<ButtonLink to="/invitados" variant="ghost" size="sm">Invitados</ButtonLink>}
          />
          <div className="grid gap-4 px-5 pb-5 sm:grid-cols-3">
            {[
              { label: 'Confirmadas', value: people.confirmedGuests, tone: 'brand' as const },
              { label: 'Pendientes', value: people.pendingGuests, tone: 'amber' as const },
              { label: 'No asisten', value: people.declinedGuests, tone: 'red' as const },
            ].map((row) => (
              <div key={row.label}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="text-muted">{row.label}</span>
                  <span className="font-semibold tabular-nums">{row.value}</span>
                </div>
                <ProgressBar value={row.value} max={Math.max(people.invitations, 1)} tone={row.tone} label={row.label} />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
