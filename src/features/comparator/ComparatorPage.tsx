import { useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { Check, CheckCircle2, ExternalLink, Pencil, Plus, Scale, X } from 'lucide-react'
import { categoriesApi, vendorsApi } from '../../lib/api'
import { attempt } from '../../lib/attempt'
import { safeUrl } from '../../lib/contact'
import { formatCOP } from '../../lib/format'
import { vendorStatus } from '../../lib/labels'
import { Button, IconButton } from '../../components/ui/Button'
import { Badge, EmptyState, ErrorState, LoadingState, PageHeader } from '../../components/ui/Display'
import { Checkbox } from '../../components/ui/Field'
import { cn } from '../../components/ui/cn'
import { useConfirm } from '../../components/ui/Confirm'
import type { Vendor } from '../../types/database'
import { VendorFormModal } from '../vendors/VendorFormModal'
import { ContactLinks } from '../vendors/ContactLinks'

const MAX_COLUMNS = 4

export default function ComparatorPage() {
  const categories = categoriesApi.useList()
  const vendors = vendorsApi.useList()
  const update = vendorsApi.useUpdate()
  const confirm = useConfirm()
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [showDiscarded, setShowDiscarded] = useState(false)
  const [picked, setPicked] = useState<string[] | null>(null)
  const [form, setForm] = useState<{ vendor?: Vendor } | null>(null)

  if (categories.isError || vendors.isError) {
    return <ErrorState error={categories.error ?? vendors.error} onRetry={() => { categories.refetch(); vendors.refetch() }} />
  }
  if (categories.isPending || vendors.isPending) return <LoadingState />

  const countByCategory = new Map<string, number>()
  for (const v of vendors.data) {
    if (v.category_id && v.status !== 'descartado') countByCategory.set(v.category_id, (countByCategory.get(v.category_id) ?? 0) + 1)
  }
  const current =
    categoryId ??
    categories.data.find((c) => (countByCategory.get(c.id) ?? 0) > 1)?.id ??
    categories.data[0]?.id ??
    null

  const inCategory = vendors.data.filter((v) => v.category_id === current)
  const candidates = inCategory.filter((v) => showDiscarded || v.status !== 'descartado')
  const selectedIds = (picked ?? candidates.slice(0, MAX_COLUMNS).map((v) => v.id)).filter((id) =>
    candidates.some((v) => v.id === id),
  )
  const columns = candidates.filter((v) => selectedIds.includes(v.id))
  const booked = inCategory.find((v) => v.status === 'reservado' || v.status === 'pagado')
  const price = (v: Vendor) => v.final_cost ?? v.quoted_cost
  const prices = columns.map(price).filter((p): p is number => p != null)
  const cheapest = prices.length > 1 ? Math.min(...prices) : null

  // Fija la categoría mostrada para que no cambie sola al reservar o descartar opciones
  const pin = () => {
    if (!categoryId && current) setCategoryId(current)
  }

  const selectCategory = (id: string) => {
    setCategoryId(id)
    setPicked(null)
  }

  const toggle = (id: string) => {
    pin()
    const next = selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]
    if (next.length > MAX_COLUMNS) {
      toast.info(`Puedes comparar hasta ${MAX_COLUMNS} a la vez`)
      return
    }
    setPicked(next)
  }

  const book = async (vendor: Vendor) => {
    pin()
    const ok = await confirm({
      title: `¿Reservar a ${vendor.name}?`,
      message: 'Pasa a estado "Reservado" y su costo empieza a contar como comprometido en el presupuesto.',
      confirmLabel: 'Reservar',
    })
    if (!ok) return
    if (!(await attempt(update.mutateAsync({ id: vendor.id, values: { status: 'reservado' } })))) return
    toast.success(`${vendor.name} reservado`)

    const others = inCategory.filter((v) => v.id !== vendor.id && v.status === 'cotizando')
    if (others.length === 0) return
    const discard = await confirm({
      title: '¿Descartar las demás opciones?',
      message: `${others.map((o) => o.name).join(', ')} ${others.length === 1 ? 'pasará' : 'pasarán'} a "Descartado" (no se borra nada, por si cambian de idea).`,
      confirmLabel: 'Descartar',
    })
    if (discard) {
      await Promise.all(others.map((o) => attempt(update.mutateAsync({ id: o.id, values: { status: 'descartado' } }))))
    }
  }

  const rows: { label: string; render: (v: Vendor) => React.ReactNode }[] = [
    {
      label: 'Precio',
      render: (v) => (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-base font-semibold tabular-nums">{formatCOP(price(v))}</span>
          {cheapest != null && price(v) === cheapest && <Badge tone="green">Más económico</Badge>}
        </div>
      ),
    },
    { label: 'Qué incluye', render: (v) => v.includes },
    { label: 'Disponibilidad', render: (v) => v.availability },
    {
      label: 'Pros',
      render: (v) =>
        v.pros && (
          <span className="flex gap-1.5">
            <Check className="mt-0.5 size-4 shrink-0 text-brand-600" />
            {v.pros}
          </span>
        ),
    },
    {
      label: 'Contras',
      render: (v) =>
        v.cons && (
          <span className="flex gap-1.5">
            <X className="mt-0.5 size-4 shrink-0 text-accent-500" />
            {v.cons}
          </span>
        ),
    },
    {
      label: 'Portafolio',
      render: (v) => {
        const url = safeUrl(v.portfolio_url) ?? safeUrl(v.website)
        return (
          url && (
            <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand-700 hover:underline">
              Ver <ExternalLink className="size-3.5" />
            </a>
          )
        )
      },
    },
    {
      label: 'Contacto',
      render: (v) => (v.phone || v.email || v.instagram || v.website ? <ContactLinks vendor={v} /> : null),
    },
    { label: 'Notas', render: (v) => v.notes },
  ]

  return (
    <>
      <PageHeader
        title="Comparador"
        description="Pon lado a lado hasta 4 opciones de una misma categoría antes de reservar"
        actions={
          current && (
            <Button
              icon={<Plus className="size-4" />}
              onClick={() => {
                pin()
                setForm({})
              }}
            >
              Opción
            </Button>
          )
        }
      />

      <div className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="tablist" aria-label="Categorías">
        {categories.data.map((c) => {
          const count = countByCategory.get(c.id) ?? 0
          return (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={c.id === current}
              onClick={() => selectCategory(c.id)}
              className={cn(
                'inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors',
                c.id === current ? 'border-brand-600 bg-brand-600 text-white' : 'border-line bg-white hover:border-brand-300',
              )}
            >
              <span className="size-2 rounded-full" style={{ backgroundColor: c.color }} />
              {c.name}
              {count > 0 && <span className={cn('text-xs', c.id === current ? 'text-white/80' : 'text-muted')}>{count}</span>}
            </button>
          )
        })}
      </div>

      {booked && (
        <p className="mb-4 flex items-center gap-2 rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-800">
          <CheckCircle2 className="size-4 shrink-0" />
          Ya reservaron a{' '}
          <Link to={`/proveedores/${booked.id}`} className="font-semibold hover:underline">
            {booked.name}
          </Link>{' '}
          en esta categoría.
        </p>
      )}

      {candidates.length === 0 ? (
        <EmptyState
          icon={<Scale className="size-8" />}
          title="No hay opciones en esta categoría"
          action={<Button icon={<Plus className="size-4" />} onClick={() => setForm({})}>Agregar opción</Button>}
        >
          Agrega los proveedores que estén cotizando, con precio, qué incluye y pros/contras.
        </EmptyState>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="text-sm text-muted">Comparar:</span>
            {candidates.map((v) => (
              <Checkbox
                key={v.id}
                checked={selectedIds.includes(v.id)}
                onChange={() => toggle(v.id)}
                label={
                  <span className={v.status === 'descartado' ? 'text-muted line-through' : ''}>{v.name}</span>
                }
              />
            ))}
            {inCategory.some((v) => v.status === 'descartado') && (
              <Checkbox
                className="ml-auto text-muted"
                checked={showDiscarded}
                onChange={(e) => setShowDiscarded(e.target.checked)}
                label="Mostrar descartados"
              />
            )}
          </div>

          {columns.length > 0 && (
            <div className="overflow-x-auto rounded-2xl border border-line bg-white shadow-xs">
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-line">
                    <th className="sticky left-0 z-10 w-36 bg-white" />
                    {columns.map((v) => (
                      <th key={v.id} scope="col" className="min-w-52 px-4 py-4 text-left align-top font-normal">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <Link to={`/proveedores/${v.id}`} className="font-sans text-base font-semibold hover:underline">
                              {v.name}
                            </Link>
                            <div className="mt-1">
                              <Badge tone={vendorStatus[v.status].tone}>{vendorStatus[v.status].label}</Badge>
                            </div>
                          </div>
                          <IconButton label={`Editar ${v.name}`} onClick={() => setForm({ vendor: v })}>
                            <Pencil className="size-4" />
                          </IconButton>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.label} className="border-b border-line last:border-0">
                      <th scope="row" className="sticky left-0 z-10 bg-ivory px-4 py-3 text-left align-top text-xs font-semibold tracking-wide text-muted uppercase">
                        {row.label}
                      </th>
                      {columns.map((v) => (
                        <td key={v.id} className="px-4 py-3 align-top whitespace-pre-line">
                          {row.render(v) || <span className="text-muted/60">—</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr>
                    <th className="sticky left-0 z-10 bg-ivory" />
                    {columns.map((v) => (
                      <td key={v.id} className="px-4 py-4">
                        {v.status === 'cotizando' || v.status === 'descartado' ? (
                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" onClick={() => book(v)}>
                              Reservar este
                            </Button>
                            {v.status === 'cotizando' && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  pin()
                                  attempt(update.mutateAsync({ id: v.id, values: { status: 'descartado' } }))
                                }}
                              >
                                Descartar
                              </Button>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700">
                            <CheckCircle2 className="size-4" /> Elegido
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {form && (
        <VendorFormModal
          vendor={form.vendor}
          defaults={{ category_id: current ?? undefined, status: 'cotizando' }}
          onClose={() => setForm(null)}
          onSaved={(saved) => {
            if (!form.vendor && picked && picked.length < MAX_COLUMNS) setPicked([...picked, saved.id])
          }}
        />
      )}
    </>
  )
}
