import { useState } from 'react'
import { Link } from 'react-router'
import { AlertTriangle, ChevronDown, Pencil, Plus, Wallet } from 'lucide-react'
import { categoriesApi, paymentsApi, useSettings, vendorsApi } from '../../lib/api'
import { summarizeBudget, vendorBookedCost, type CategorySummary } from '../../lib/budget'
import { daysFromToday, formatCOP, formatDate, formatPercent } from '../../lib/format'
import { vendorStatus } from '../../lib/labels'
import { Button, IconButton } from '../../components/ui/Button'
import { Badge, Card, CardHeader, EmptyState, ErrorState, LoadingState, PageHeader, ProgressBar, Stat } from '../../components/ui/Display'
import { cn } from '../../components/ui/cn'
import type { BudgetCategory, Payment, Vendor } from '../../types/database'
import { CategoryFormModal } from './CategoryFormModal'
import { PaymentFormModal } from './PaymentFormModal'
import { DistributionChart, EstimatedVsRealChart } from './BudgetCharts'

type PaymentForm = { payment?: Payment; defaults?: { category_id?: string; vendor_id?: string } }
type CategoryForm = { category?: BudgetCategory }

export default function BudgetPage() {
  const settings = useSettings()
  const categories = categoriesApi.useList()
  const vendors = vendorsApi.useList()
  const payments = paymentsApi.useList()
  const [paymentForm, setPaymentForm] = useState<PaymentForm | null>(null)
  const [categoryForm, setCategoryForm] = useState<CategoryForm | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  const queries = [settings, categories, vendors, payments]
  const failed = queries.find((q) => q.isError)
  if (failed) return <ErrorState error={failed.error} onRetry={() => queries.forEach((q) => q.refetch())} />
  if (queries.some((q) => q.isPending)) return <LoadingState />

  const summary = summarizeBudget(categories.data ?? [], vendors.data ?? [], payments.data ?? [])
  const total = settings.data?.total_budget ?? 0
  const { totals } = summary
  const available = total - totals.committed
  const estimatedOverTotal = total > 0 && totals.estimated > total

  return (
    <>
      <PageHeader
        title="Presupuesto"
        description="Estimado vs. comprometido por categoría, con abonos y pagos programados"
        actions={
          <>
            <Button variant="secondary" icon={<Plus className="size-4" />} onClick={() => setCategoryForm({})}>
              Categoría
            </Button>
            <Button icon={<Wallet className="size-4" />} onClick={() => setPaymentForm({})}>
              Registrar pago
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Presupuesto total"
          value={total > 0 ? formatCOP(total) : '—'}
          sub={
            <Link to="/configuracion" className="underline-offset-2 hover:underline">
              {total > 0 ? 'Cambiar en Configuración' : 'Definirlo en Configuración'}
            </Link>
          }
        />
        <Stat
          label="Comprometido"
          value={formatCOP(totals.committed)}
          sub={
            total > 0 ? (
              <span className={available < 0 ? 'font-medium text-red-700' : ''}>
                {available >= 0 ? `Quedan ${formatCOP(available)} libres` : `Excede en ${formatCOP(-available)}`}
              </span>
            ) : undefined
          }
        />
        <Stat label="Pagado" value={formatCOP(totals.paid)} sub={total > 0 ? `${formatPercent(totals.paid / total)} del total` : undefined} />
        <Stat label="Por pagar" value={formatCOP(totals.pending)} sub={`${formatCOP(totals.scheduled)} ya programado`} />
      </div>

      {estimatedOverTotal && (
        <p className="mt-4 flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle className="size-4 shrink-0" />
          La suma de los estimados ({formatCOP(totals.estimated)}) supera el presupuesto total en {formatCOP(totals.estimated - total)}.
        </p>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader title="Categorías" subtitle={`Estimado total: ${formatCOP(totals.estimated)}`} />
          {summary.rows.length === 0 ? (
            <div className="px-5 pb-5">
              <EmptyState title="Sin categorías" action={<Button onClick={() => setCategoryForm({})}>Crear categoría</Button>} />
            </div>
          ) : (
            <ul className="divide-y divide-line border-t border-line">
              {summary.rows.map((row) => (
                <CategoryRow
                  key={row.category.id}
                  row={row}
                  vendors={(vendors.data ?? []).filter((v) => v.category_id === row.category.id)}
                  payments={(payments.data ?? []).filter((p) => p.category_id === row.category.id)}
                  vendorName={(id) => vendors.data?.find((v) => v.id === id)?.name}
                  open={expanded === row.category.id}
                  onToggle={() => setExpanded(expanded === row.category.id ? null : row.category.id)}
                  onEdit={() => setCategoryForm({ category: row.category })}
                  onAddPayment={() => setPaymentForm({ defaults: { category_id: row.category.id } })}
                  onEditPayment={(payment) => setPaymentForm({ payment })}
                />
              ))}
            </ul>
          )}
        </Card>

        <div className="flex flex-col gap-6">
          <Card className="p-5">
            <DistributionChart rows={summary.rows} />
          </Card>
          <Card className="p-5">
            <EstimatedVsRealChart rows={summary.rows} />
          </Card>
        </div>
      </div>

      {paymentForm && <PaymentFormModal {...paymentForm} onClose={() => setPaymentForm(null)} />}
      {categoryForm && (
        <CategoryFormModal
          {...categoryForm}
          nextOrder={(categories.data?.length ?? 0) + 1}
          onClose={() => setCategoryForm(null)}
        />
      )}
    </>
  )
}

function CategoryRow({
  row,
  vendors,
  payments,
  vendorName,
  open,
  onToggle,
  onEdit,
  onAddPayment,
  onEditPayment,
}: {
  row: CategorySummary
  vendors: Vendor[]
  payments: Payment[]
  vendorName: (id: string) => string | undefined
  open: boolean
  onToggle: () => void
  onEdit: () => void
  onAddPayment: () => void
  onEditPayment: (p: Payment) => void
}) {
  const { category } = row
  const booked = vendors.filter((v) => vendorBookedCost(v) > 0)
  const sortedPayments = [...payments].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <li>
      <div className="flex items-center gap-2 px-5 py-3">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex min-w-0 flex-1 flex-col gap-2 text-left"
        >
          <div className="flex w-full items-center gap-2">
            <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: category.color }} />
            <span className="truncate font-medium">{category.name}</span>
            {row.overBudget && (
              <Badge tone="red">
                <AlertTriangle className="size-3" /> Excedido
              </Badge>
            )}
            <ChevronDown className={cn('ml-auto size-4 shrink-0 text-muted transition-transform', open && 'rotate-180')} />
          </div>
          <ProgressBar
            value={row.committed}
            max={row.estimated || row.committed || 1}
            tone={row.overBudget ? 'red' : 'brand'}
            label={`${category.name}: comprometido vs estimado`}
          />
          <div className="flex w-full flex-wrap justify-between gap-x-4 gap-y-0.5 text-xs text-muted tabular-nums">
            <span>
              <span className={cn('font-semibold', row.overBudget ? 'text-red-700' : 'text-ink')}>{formatCOP(row.committed)}</span>
              {row.estimated > 0 ? ` de ${formatCOP(row.estimated)}` : ' · sin estimado'}
            </span>
            <span>
              Pagado {formatCOP(row.paid)} · Falta {formatCOP(row.pending)}
            </span>
          </div>
        </button>
        <IconButton label={`Editar ${category.name}`} onClick={onEdit}>
          <Pencil className="size-4" />
        </IconButton>
      </div>

      {open && (
        <div className="space-y-4 bg-ivory/60 px-5 py-4 text-sm">
          {booked.length > 0 && (
            <div>
              <h3 className="mb-1 font-sans text-xs font-semibold tracking-wide text-muted uppercase">Proveedores reservados</h3>
              <ul className="space-y-1">
                {booked.map((v) => (
                  <li key={v.id} className="flex items-center justify-between gap-2">
                    <Link to={`/proveedores/${v.id}`} className="truncate hover:underline">
                      {v.name}
                    </Link>
                    <span className="flex items-center gap-2 tabular-nums">
                      <Badge tone={vendorStatus[v.status].tone}>{vendorStatus[v.status].label}</Badge>
                      {formatCOP(vendorBookedCost(v))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <h3 className="font-sans text-xs font-semibold tracking-wide text-muted uppercase">Pagos</h3>
              <Button size="sm" variant="secondary" icon={<Plus className="size-3.5" />} onClick={onAddPayment}>
                Pago
              </Button>
            </div>
            {sortedPayments.length === 0 ? (
              <p className="text-muted">Sin pagos registrados.</p>
            ) : (
              <ul className="divide-y divide-line rounded-lg border border-line bg-white">
                {sortedPayments.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => onEditPayment(p)}
                      className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-brand-50/50"
                    >
                      <span className="w-24 shrink-0 text-xs text-muted">{formatDate(p.date)}</span>
                      <span className="min-w-0 flex-1 truncate">
                        {(p.vendor_id && vendorName(p.vendor_id)) || p.note || 'Gasto'}
                        {p.vendor_id && p.note && <span className="text-muted"> · {p.note}</span>}
                      </span>
                      {!p.is_paid && (
                        <Badge tone={daysFromToday(p.date) < 0 ? 'red' : 'amber'}>
                          {daysFromToday(p.date) < 0 ? 'Vencido' : 'Programado'}
                        </Badge>
                      )}
                      <span className="font-medium tabular-nums">{formatCOP(p.amount)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </li>
  )
}
