import { Bar, BarChart, CartesianGrid, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { CategorySummary } from '../../lib/budget'
import { formatCOP, formatCOPShort } from '../../lib/format'

const moneyTooltip = (value: unknown) => formatCOP(Number(value))

export function DistributionChart({ rows }: { rows: CategorySummary[] }) {
  // Si aún no hay nada comprometido, se muestra cómo está repartido el estimado
  const useCommitted = rows.some((r) => r.committed > 0)
  const data = rows
    .map((r) => ({
      name: r.category.name,
      value: useCommitted ? r.committed : r.estimated,
      fill: r.category.color,
    }))
    .filter((d) => d.value > 0)

  if (data.length === 0) {
    return <p className="py-16 text-center text-sm text-muted">Pon montos estimados para ver la distribución.</p>
  }

  return (
    <div>
      <p className="mb-2 text-xs text-muted">{useCommitted ? 'Comprometido por categoría' : 'Estimado por categoría'}</p>
      <div className="h-64" role="img" aria-label="Gráfico de distribución del presupuesto por categoría">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="90%" paddingAngle={2} stroke="#fff" />
            <Tooltip formatter={moneyTooltip} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        {data.map((d) => (
          <li key={d.name} className="flex items-center gap-2 truncate">
            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: d.fill }} />
            <span className="truncate">{d.name}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function EstimatedVsRealChart({ rows }: { rows: CategorySummary[] }) {
  const data = rows
    .filter((r) => r.estimated > 0 || r.committed > 0)
    .map((r) => ({ name: r.category.name, Estimado: r.estimated, Comprometido: r.committed }))

  if (data.length === 0) {
    return <p className="py-16 text-center text-sm text-muted">Aún no hay montos para comparar.</p>
  }

  return (
    <div>
      <p className="mb-2 text-xs text-muted">Estimado vs. comprometido</p>
      <div className="h-72" role="img" aria-label="Gráfico de barras: estimado contra comprometido por categoría">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
            <CartesianGrid horizontal={false} stroke="#eee" />
            <XAxis type="number" tickFormatter={formatCOPShort} tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
            <Tooltip formatter={moneyTooltip} />
            <Legend wrapperStyle={{ fontSize: 12 }} formatter={(value) => <span className="text-ink">{value}</span>} />
            <Bar dataKey="Estimado" fill="#d6cfc4" radius={[0, 4, 4, 0]} />
            <Bar dataKey="Comprometido" fill="#6f8559" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
