import { describe, expect, it } from 'vitest'
import { summarizeBudget, upcomingPayments, vendorBalances, vendorBookedCost } from '../../src/lib/budget'
import { category, payment, vendor } from './factories'

describe('vendorBookedCost', () => {
  it('usa el costo final, o el cotizado si no hay final, solo si está reservado o pagado', () => {
    expect(vendorBookedCost(vendor({ status: 'reservado', quoted_cost: 100, final_cost: 120 }))).toBe(120)
    expect(vendorBookedCost(vendor({ status: 'pagado', quoted_cost: 100 }))).toBe(100)
    expect(vendorBookedCost(vendor({ status: 'cotizando', quoted_cost: 100 }))).toBe(0)
    expect(vendorBookedCost(vendor({ status: 'descartado', final_cost: 100 }))).toBe(0)
  })
})

describe('summarizeBudget', () => {
  it('calcula comprometido, pagado y pendiente por categoría', () => {
    const cat = category({ estimated: 10_000_000 })
    const foto = vendor({ category_id: cat.id, status: 'reservado', final_cost: 6_000_000 })
    const summary = summarizeBudget(
      [cat],
      [foto],
      [
        payment({ category_id: cat.id, vendor_id: foto.id, amount: 2_000_000, is_paid: true }),
        payment({ category_id: cat.id, vendor_id: foto.id, amount: 4_000_000, is_paid: false }),
        payment({ category_id: cat.id, amount: 500_000, is_paid: true }), // gasto suelto
      ],
    )
    const row = summary.rows[0]
    expect(row.committed).toBe(6_500_000)
    expect(row.paid).toBe(2_500_000)
    expect(row.scheduled).toBe(4_000_000)
    expect(row.pending).toBe(4_000_000)
    expect(row.overBudget).toBe(false)
  })

  it('un abono a un proveedor que sigue cotizando cuenta como comprometido', () => {
    const cat = category({ estimated: 1_000 })
    const v = vendor({ category_id: cat.id, status: 'cotizando', quoted_cost: 5_000 })
    const summary = summarizeBudget([cat], [v], [payment({ category_id: cat.id, vendor_id: v.id, amount: 800 })])
    expect(summary.rows[0].committed).toBe(800)
  })

  it('no cuenta dos veces los pagos si superan el costo del proveedor', () => {
    const cat = category()
    const v = vendor({ category_id: cat.id, status: 'pagado', final_cost: 1_000 })
    const summary = summarizeBudget([cat], [v], [
      payment({ category_id: cat.id, vendor_id: v.id, amount: 700 }),
      payment({ category_id: cat.id, vendor_id: v.id, amount: 500 }),
    ])
    expect(summary.rows[0].committed).toBe(1_200)
    expect(summary.rows[0].pending).toBe(0)
  })

  it('marca sobrecupo solo cuando hay estimado y se supera', () => {
    const conEstimado = category({ estimated: 1_000 })
    const sinEstimado = category({ estimated: 0 })
    const summary = summarizeBudget([conEstimado, sinEstimado], [], [
      payment({ category_id: conEstimado.id, amount: 1_500 }),
      payment({ category_id: sinEstimado.id, amount: 1_500 }),
    ])
    expect(summary.rows.map((r) => r.overBudget)).toEqual([true, false])
    expect(summary.overBudgetCount).toBe(1)
    expect(summary.totals.committed).toBe(3_000)
  })

  it('un pago ligado a un proveedor de otra categoría cuenta como gasto suelto en la suya', () => {
    const a = category()
    const b = category()
    const v = vendor({ category_id: a.id, status: 'reservado', final_cost: 1_000 })
    const summary = summarizeBudget([a, b], [v], [payment({ category_id: b.id, vendor_id: v.id, amount: 300 })])
    expect(summary.rows[0].committed).toBe(1_000)
    expect(summary.rows[1].committed).toBe(300)
  })

  it('no cuenta proveedores descartados en el número de proveedores', () => {
    const cat = category()
    const summary = summarizeBudget(
      [cat],
      [vendor({ category_id: cat.id }), vendor({ category_id: cat.id, status: 'descartado' })],
      [],
    )
    expect(summary.rows[0].vendorCount).toBe(1)
  })
})

describe('upcomingPayments', () => {
  it('devuelve los pagos sin hacer ordenados por fecha', () => {
    const list = upcomingPayments([
      payment({ category_id: 'c', amount: 1, date: '2026-12-01', is_paid: false }),
      payment({ category_id: 'c', amount: 1, date: '2026-10-01', is_paid: false }),
      payment({ category_id: 'c', amount: 1, date: '2026-09-01', is_paid: true }),
    ])
    expect(list.map((p) => p.date)).toEqual(['2026-10-01', '2026-12-01'])
  })
})

describe('vendorBalances', () => {
  it('calcula el saldo de los proveedores reservados y lista sus pagos programados', () => {
    const foto = vendor({ name: 'Foto', status: 'reservado', final_cost: 3_000_000 })
    const dj = vendor({ name: 'DJ', status: 'pagado', quoted_cost: 2_000_000 })
    const flores = vendor({ name: 'Flores', status: 'reservado', quoted_cost: 500_000 })
    const cotizando = vendor({ name: 'Otro', status: 'cotizando', quoted_cost: 1 })
    const balances = vendorBalances(
      [foto, dj, flores, cotizando],
      [
        payment({ category_id: 'c', vendor_id: foto.id, amount: 1_000_000 }),
        payment({ category_id: 'c', vendor_id: foto.id, amount: 2_000_000, date: '2027-05-15', is_paid: false }),
        payment({ category_id: 'c', vendor_id: flores.id, amount: 600_000 }),
      ],
    )
    expect(balances.map((b) => b.vendor.name)).toEqual(['Foto', 'DJ', 'Flores'])
    expect(balances[0]).toMatchObject({ cost: 3_000_000, paid: 1_000_000, pending: 2_000_000 })
    expect(balances[0].scheduled.map((p) => p.date)).toEqual(['2027-05-15'])
    // Marcado como pagado aunque no haya pagos registrados
    expect(balances[1]).toMatchObject({ cost: 2_000_000, paid: 0, pending: 0 })
    // Pagaron más de lo cotizado: el costo real es lo pagado
    expect(balances[2]).toMatchObject({ cost: 600_000, paid: 600_000, pending: 0 })
  })
})
