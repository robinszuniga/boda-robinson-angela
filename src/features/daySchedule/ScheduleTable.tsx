import { formatTime } from '../../lib/format'
import type { DayScheduleItem } from '../../types/database'

/** Tabla imprimible del cronograma. `markVendorId` resalta con ● los momentos de ese proveedor. */
export function ScheduleTable({
  items,
  vendorName,
  markVendorId,
}: {
  items: DayScheduleItem[]
  vendorName: Map<string, string>
  markVendorId?: string
}) {
  if (items.length === 0) return <p className="text-sm text-muted">No hay momentos en el cronograma.</p>
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-ink/30 text-left text-xs tracking-wide text-muted uppercase">
          <th className="w-32 py-2 pr-4 font-medium">Hora</th>
          <th className="py-2 pr-4 font-medium">Momento</th>
          <th className="py-2 font-medium">A cargo</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => {
          const mine = markVendorId && item.vendor_id === markVendorId
          return (
            <tr key={item.id} className="border-b border-line align-top break-inside-avoid">
              <td className="py-3 pr-4 font-semibold whitespace-nowrap tabular-nums">
                {formatTime(item.start_time)}
                {item.end_time && <span className="font-normal text-muted"> – {formatTime(item.end_time)}</span>}
              </td>
              <td className="py-3 pr-4">
                <span className={mine ? 'font-semibold' : ''}>
                  {mine && '● '}
                  {item.title}
                </span>
                {item.location && <div className="text-xs text-muted">{item.location}</div>}
                {item.description && <div className="mt-1 text-xs whitespace-pre-line text-muted">{item.description}</div>}
              </td>
              <td className="py-3 text-xs">
                {[item.vendor_id && vendorName.get(item.vendor_id), item.responsible].filter(Boolean).join(' · ')}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
