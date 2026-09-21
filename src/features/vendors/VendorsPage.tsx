import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Plus, Search, Store } from 'lucide-react'
import { categoriesApi, paymentsApi, vendorsApi } from '../../lib/api'
import { formatCOP } from '../../lib/format'
import { options, vendorStatus } from '../../lib/labels'
import { Button } from '../../components/ui/Button'
import { Badge, EmptyState, ErrorState, LoadingState, PageHeader, ProgressBar } from '../../components/ui/Display'
import { Input, Select } from '../../components/ui/Field'
import type { VendorStatus } from '../../types/database'
import { VendorFormModal } from './VendorFormModal'
import { ContactLinks } from './ContactLinks'

export default function VendorsPage() {
  const vendors = vendorsApi.useList()
  const categories = categoriesApi.useList()
  const payments = paymentsApi.useList()
  const [creating, setCreating] = useState(false)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [status, setStatus] = useState<VendorStatus | 'activos' | ''>('activos')

  const paidByVendor = useMemo(() => {
    const map = new Map<string, number>()
    for (const p of payments.data ?? []) {
      if (p.vendor_id && p.is_paid) map.set(p.vendor_id, (map.get(p.vendor_id) ?? 0) + p.amount)
    }
    return map
  }, [payments.data])

  const queries = [vendors, categories, payments]
  const failed = queries.find((q) => q.isError)
  if (failed) return <ErrorState error={failed.error} onRetry={() => queries.forEach((q) => q.refetch())} />
  if (queries.some((q) => q.isPending)) return <LoadingState />

  const categoryById = new Map((categories.data ?? []).map((c) => [c.id, c]))
  const term = search.trim().toLowerCase()
  const filtered = (vendors.data ?? []).filter((v) => {
    if (category && v.category_id !== category) return false
    if (status === 'activos' && v.status === 'descartado') return false
    if (status && status !== 'activos' && v.status !== status) return false
    if (term && !`${v.name} ${v.contact_name ?? ''} ${v.notes ?? ''}`.toLowerCase().includes(term)) return false
    return true
  })

  return (
    <>
      <PageHeader
        title="Proveedores"
        description="Contactos, cotizaciones, pagos y contratos de cada proveedor"
        actions={
          <Button icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>
            Proveedor
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          <Input
            aria-label="Buscar proveedor"
            placeholder="Buscar…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select aria-label="Filtrar por categoría" className="sm:w-52" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">Todas las categorías</option>
          {(categories.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Filtrar por estado"
          className="sm:w-44"
          value={status}
          onChange={(e) => setStatus(e.target.value as VendorStatus | 'activos' | '')}
        >
          <option value="activos">Sin descartados</option>
          <option value="">Todos los estados</option>
          {options(vendorStatus).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Store className="size-8" />}
          title={(vendors.data ?? []).length === 0 ? 'Aún no hay proveedores' : 'Ningún proveedor coincide'}
          action={
            (vendors.data ?? []).length === 0 && (
              <Button icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>
                Agregar el primero
              </Button>
            )
          }
        >
          Agrega los proveedores que estén cotizando. Luego puedes compararlos lado a lado en el Comparador.
        </EmptyState>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((v) => {
            const cat = v.category_id ? categoryById.get(v.category_id) : undefined
            const cost = v.final_cost ?? v.quoted_cost
            const paid = paidByVendor.get(v.id) ?? 0
            return (
              <li key={v.id} className="flex flex-col rounded-2xl border border-line bg-white p-4 shadow-xs transition-shadow hover:shadow-md">
                <div className="flex items-start justify-between gap-2">
                  <Link to={`/proveedores/${v.id}`} className="min-w-0">
                    <h3 className="truncate font-sans text-base font-semibold hover:underline">{v.name}</h3>
                    <p className="flex items-center gap-1.5 text-xs text-muted">
                      {cat && <span className="size-2 rounded-full" style={{ backgroundColor: cat.color }} />}
                      {cat?.name ?? 'Sin categoría'}
                    </p>
                  </Link>
                  <Badge tone={vendorStatus[v.status].tone}>{vendorStatus[v.status].label}</Badge>
                </div>
                <div className="mt-3 flex items-baseline justify-between text-sm">
                  <span className="text-muted">{v.final_cost != null ? 'Costo final' : 'Cotizado'}</span>
                  <span className="font-semibold tabular-nums">{formatCOP(cost)}</span>
                </div>
                {cost != null && cost > 0 && (v.status === 'reservado' || v.status === 'pagado') && (
                  <div className="mt-2">
                    <ProgressBar value={paid} max={cost} label={`Pagado a ${v.name}`} />
                    <p className="mt-1 text-xs text-muted tabular-nums">
                      Pagado {formatCOP(paid)} · Falta {formatCOP(Math.max(cost - paid, 0))}
                    </p>
                  </div>
                )}
                <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                  <ContactLinks vendor={v} />
                  <Link to={`/proveedores/${v.id}`} className="text-sm font-medium text-brand-700 hover:underline">
                    Ver
                  </Link>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {creating && <VendorFormModal onClose={() => setCreating(false)} />}
    </>
  )
}
