import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { ArrowLeft, ExternalLink, Pencil, Plus, Trash2 } from 'lucide-react'
import { categoriesApi, documentsApi, paymentsApi, vendorsApi } from '../../lib/api'
import { attempt } from '../../lib/attempt'
import { safeUrl } from '../../lib/contact'
import { daysFromToday, formatCOP, formatDate } from '../../lib/format'
import { vendorStatus } from '../../lib/labels'
import { Button } from '../../components/ui/Button'
import { Badge, Card, CardHeader, EmptyState, ErrorState, LoadingState, ProgressBar } from '../../components/ui/Display'
import { useConfirm } from '../../components/ui/Confirm'
import type { Payment } from '../../types/database'
import { PaymentFormModal } from '../budget/PaymentFormModal'
import { DocumentList } from '../documents/DocumentList'
import { DocumentUploader } from '../documents/DocumentUploader'
import { VendorFormModal } from './VendorFormModal'
import { ContactLinks } from './ContactLinks'

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (value == null || value === '') return null
  return (
    <div className="py-2">
      <dt className="text-xs font-medium text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm whitespace-pre-line">{value}</dd>
    </div>
  )
}

export default function VendorDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const vendors = vendorsApi.useList()
  const categories = categoriesApi.useList()
  const payments = paymentsApi.useList()
  const documents = documentsApi.useList()
  const remove = vendorsApi.useRemove()
  const confirm = useConfirm()
  const [editing, setEditing] = useState(false)
  const [paymentForm, setPaymentForm] = useState<{ payment?: Payment } | null>(null)

  const queries = [vendors, categories, payments, documents]
  const failed = queries.find((q) => q.isError)
  if (failed) return <ErrorState error={failed.error} onRetry={() => queries.forEach((q) => q.refetch())} />
  if (queries.some((q) => q.isPending)) return <LoadingState />

  const vendor = vendors.data?.find((v) => v.id === id)
  if (!vendor) {
    return (
      <EmptyState title="No encontramos ese proveedor" action={<Link to="/proveedores" className="text-brand-700 underline">Volver a proveedores</Link>} />
    )
  }

  const category = categories.data?.find((c) => c.id === vendor.category_id)
  const vendorPayments = (payments.data ?? []).filter((p) => p.vendor_id === vendor.id).sort((a, b) => a.date.localeCompare(b.date))
  const vendorDocs = (documents.data ?? []).filter((d) => d.vendor_id === vendor.id)
  const cost = vendor.final_cost ?? vendor.quoted_cost ?? 0
  const paid = vendorPayments.filter((p) => p.is_paid).reduce((s, p) => s + p.amount, 0)
  const scheduled = vendorPayments.filter((p) => !p.is_paid).reduce((s, p) => s + p.amount, 0)
  const unscheduled = Math.max(cost - paid - scheduled, 0)
  const portfolio = safeUrl(vendor.portfolio_url)

  const onDelete = async () => {
    const ok = await confirm({
      title: `¿Borrar a ${vendor.name}?`,
      message: 'Sus pagos quedarán en el presupuesto como gastos sin proveedor y sus archivos se conservan en Documentos.',
      confirmLabel: 'Borrar',
      danger: true,
    })
    if (ok && (await attempt(remove.mutateAsync(vendor.id)))) {
      toast.success('Proveedor borrado')
      navigate('/proveedores')
    }
  }

  return (
    <>
      <Link to="/proveedores" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Proveedores
      </Link>

      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-semibold tracking-tight">{vendor.name}</h1>
            <Badge tone={vendorStatus[vendor.status].tone}>{vendorStatus[vendor.status].label}</Badge>
          </div>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
            {category && <span className="size-2.5 rounded-full" style={{ backgroundColor: category.color }} />}
            {category?.name ?? 'Sin categoría'}
            {vendor.contact_name && ` · ${vendor.contact_name}`}
          </p>
          <div className="mt-3">
            <ContactLinks vendor={vendor} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" icon={<Trash2 className="size-4" />} onClick={onDelete} className="text-red-700">
            Borrar
          </Button>
          <Button variant="secondary" icon={<Pencil className="size-4" />} onClick={() => setEditing(true)}>
            Editar
          </Button>
          <Button icon={<Plus className="size-4" />} onClick={() => setPaymentForm({})}>
            Pago
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader title="Pagos" subtitle="Aparecen también en Presupuesto" />
            <div className="px-5 pb-5">
              {cost > 0 && (
                <div className="mb-4">
                  <ProgressBar value={paid} max={cost} label="Pagado del total" />
                  <div className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                    <div>
                      <div className="text-xs text-muted">Total</div>
                      <div className="font-semibold tabular-nums">{formatCOP(cost)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted">Pagado</div>
                      <div className="font-semibold text-brand-700 tabular-nums">{formatCOP(paid)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted">Programado</div>
                      <div className="font-semibold tabular-nums">{formatCOP(scheduled)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted">Sin programar</div>
                      <div className="font-semibold tabular-nums">{formatCOP(unscheduled)}</div>
                    </div>
                  </div>
                </div>
              )}
              {vendorPayments.length === 0 ? (
                <p className="text-sm text-muted">Sin pagos todavía.</p>
              ) : (
                <ul className="divide-y divide-line rounded-xl border border-line">
                  {vendorPayments.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => setPaymentForm({ payment: p })}
                        className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-brand-50/50"
                      >
                        <span className="w-24 shrink-0 text-xs text-muted">{formatDate(p.date)}</span>
                        <span className="min-w-0 flex-1 truncate">{p.note ?? (p.is_paid ? 'Abono' : 'Pago programado')}</span>
                        {p.is_paid ? (
                          <Badge tone="green">Pagado</Badge>
                        ) : (
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
          </Card>

          <Card>
            <CardHeader title="Contratos y cotizaciones" />
            <div className="flex flex-col gap-3 px-5 pb-5">
              <DocumentList documents={vendorDocs} empty="Sube aquí el contrato o la cotización." />
              <DocumentUploader compact vendorId={vendor.id} category={vendor.status === 'cotizando' ? 'cotizacion' : 'contrato'} />
            </div>
          </Card>
        </div>

        <Card>
          <CardHeader title="Detalles" />
          <dl className="divide-y divide-line px-5 pb-4">
            <InfoRow label="Costo cotizado" value={vendor.quoted_cost != null ? formatCOP(vendor.quoted_cost) : null} />
            <InfoRow label="Costo final" value={vendor.final_cost != null ? formatCOP(vendor.final_cost) : null} />
            <InfoRow label="Teléfono" value={vendor.phone} />
            <InfoRow label="Correo" value={vendor.email} />
            <InfoRow label="Instagram" value={vendor.instagram} />
            <InfoRow
              label="Portafolio"
              value={
                portfolio && (
                  <a href={portfolio} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand-700 hover:underline">
                    Ver portafolio <ExternalLink className="size-3.5" />
                  </a>
                )
              }
            />
            <InfoRow label="Qué incluye" value={vendor.includes} />
            <InfoRow label="Disponibilidad" value={vendor.availability} />
            <InfoRow label="Pros" value={vendor.pros} />
            <InfoRow label="Contras" value={vendor.cons} />
            <InfoRow label="Notas" value={vendor.notes} />
          </dl>
        </Card>
      </div>

      {editing && <VendorFormModal vendor={vendor} onClose={() => setEditing(false)} />}
      {paymentForm && (
        <PaymentFormModal
          {...paymentForm}
          defaults={{ vendor_id: vendor.id, category_id: vendor.category_id ?? undefined }}
          onClose={() => setPaymentForm(null)}
        />
      )}
    </>
  )
}
