import type { BudgetCategory, Payment, Vendor } from '../types/database'

export interface CategorySummary {
  category: BudgetCategory
  estimated: number
  /** Comprometido: lo que ya se debe (proveedores reservados/pagados + gastos sueltos) */
  committed: number
  /** Pagos ya hechos */
  paid: number
  /** Pagos programados (aún no hechos) */
  scheduled: number
  /** Comprometido que falta por pagar */
  pending: number
  overBudget: boolean
  vendorCount: number
}

export interface BudgetSummary {
  rows: CategorySummary[]
  totals: {
    estimated: number
    committed: number
    paid: number
    scheduled: number
    pending: number
  }
  overBudgetCount: number
}

const BOOKED: Vendor['status'][] = ['reservado', 'pagado']

export function vendorBookedCost(vendor: Vendor): number {
  if (!BOOKED.includes(vendor.status)) return 0
  return vendor.final_cost ?? vendor.quoted_cost ?? 0
}

/**
 * Resume el presupuesto por categoría. Cada pago cuenta una sola vez en el comprometido:
 * - si está ligado a un proveedor de la misma categoría, el proveedor aporta
 *   max(costo reservado, suma de sus pagos), así un abono a un proveedor aún "cotizando" también cuenta;
 * - si no (sin proveedor o de otra categoría), cuenta como gasto suelto.
 */
export function summarizeBudget(
  categories: BudgetCategory[],
  vendors: Vendor[],
  payments: Payment[],
): BudgetSummary {
  const rows = categories.map((category): CategorySummary => {
    const catPayments = payments.filter((p) => p.category_id === category.id)
    const catVendors = vendors.filter((v) => v.category_id === category.id)
    const vendorIds = new Set(catVendors.map((v) => v.id))

    const vendorsCommitted = catVendors.reduce((sum, v) => {
      const ownPayments = catPayments
        .filter((p) => p.vendor_id === v.id)
        .reduce((s, p) => s + p.amount, 0)
      return sum + Math.max(vendorBookedCost(v), ownPayments)
    }, 0)
    const loose = catPayments
      .filter((p) => !p.vendor_id || !vendorIds.has(p.vendor_id))
      .reduce((s, p) => s + p.amount, 0)

    const committed = vendorsCommitted + loose
    const paid = catPayments.filter((p) => p.is_paid).reduce((s, p) => s + p.amount, 0)
    const scheduled = catPayments.filter((p) => !p.is_paid).reduce((s, p) => s + p.amount, 0)

    return {
      category,
      estimated: category.estimated,
      committed,
      paid,
      scheduled,
      pending: Math.max(committed - paid, 0),
      overBudget: category.estimated > 0 ? committed > category.estimated : false,
      vendorCount: catVendors.filter((v) => v.status !== 'descartado').length,
    }
  })

  const sum = (key: 'estimated' | 'committed' | 'paid' | 'scheduled' | 'pending') =>
    rows.reduce((s, r) => s + r[key], 0)

  return {
    rows,
    totals: {
      estimated: sum('estimated'),
      committed: sum('committed'),
      paid: sum('paid'),
      scheduled: sum('scheduled'),
      pending: sum('pending'),
    },
    overBudgetCount: rows.filter((r) => r.overBudget).length,
  }
}

export interface VendorBalance {
  vendor: Vendor
  /** Lo que se le debe en total: costo reservado, o la suma de sus pagos si es mayor */
  cost: number
  paid: number
  pending: number
  /** Pagos programados que aún no se han hecho, los más próximos primero */
  scheduled: Payment[]
}

/** Saldo de cada proveedor reservado o pagado. Si está marcado "Pagado" no se le debe nada. */
export function vendorBalances(vendors: Vendor[], payments: Payment[]): VendorBalance[] {
  return vendors
    .filter((v) => BOOKED.includes(v.status))
    .map((vendor) => {
      const own = payments.filter((p) => p.vendor_id === vendor.id)
      const cost = Math.max(vendorBookedCost(vendor), own.reduce((s, p) => s + p.amount, 0))
      const paid = own.filter((p) => p.is_paid).reduce((s, p) => s + p.amount, 0)
      return {
        vendor,
        cost,
        paid,
        pending: vendor.status === 'pagado' ? 0 : Math.max(cost - paid, 0),
        scheduled: own.filter((p) => !p.is_paid).sort((a, b) => a.date.localeCompare(b.date)),
      }
    })
}

/** Pagos programados sin hacer (incluye vencidos), los más próximos primero */
export function upcomingPayments(payments: Payment[], limit = 5): Payment[] {
  return payments
    .filter((p) => !p.is_paid)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, limit)
}
