import { useEffect } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ArrowLeft, Printer } from 'lucide-react'
import { scheduleApi, useSettings, vendorsApi } from '../../lib/api'
import { formatTime, formatWeddingDate } from '../../lib/format'
import { Button } from '../../components/ui/Button'
import { ErrorState, LoadingState } from '../../components/ui/Display'
import { sortSchedule } from './scheduleActions'

/** Versión para imprimir o guardar como PDF y compartir con proveedores */
export default function PrintSchedulePage() {
  const [params] = useSearchParams()
  const vendorId = params.get('proveedor')
  const onlyVendor = params.get('solo') === '1'
  const settings = useSettings()
  const items = scheduleApi.useList()
  const vendors = vendorsApi.useList()

  const vendor = vendors.data?.find((v) => v.id === vendorId)
  const s = settings.data

  useEffect(() => {
    if (!s) return
    const previous = document.title
    document.title = `Cronograma boda ${s.partner_1_name} & ${s.partner_2_name}${vendor ? ` - ${vendor.name}` : ''}`
    return () => {
      document.title = previous
    }
  }, [s, vendor])

  const queries = [settings, items, vendors]
  const failed = queries.find((q) => q.isError)
  if (failed) return <ErrorState error={failed.error} />
  if (queries.some((q) => q.isPending) || !s) return <LoadingState />

  const vendorName = new Map((vendors.data ?? []).map((v) => [v.id, v.name]))
  const all = sortSchedule(items.data ?? [])
  const shown = vendor && onlyVendor ? all.filter((i) => i.vendor_id === vendor.id) : all

  return (
    <div className="min-h-dvh bg-white">
      <div className="no-print sticky top-0 flex items-center justify-between gap-2 border-b border-line bg-white/95 px-4 py-3 backdrop-blur">
        <Link to="/cronograma" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
          <ArrowLeft className="size-4" /> Volver
        </Link>
        <Button icon={<Printer className="size-4" />} onClick={() => window.print()}>
          Imprimir / Guardar PDF
        </Button>
      </div>

      <article className="mx-auto max-w-3xl px-6 py-10 print:max-w-none print:p-0">
        <header className="mb-8 border-b-2 border-ink pb-4">
          <p className="text-xs tracking-[0.2em] text-muted uppercase">Cronograma del día</p>
          <h1 className="mt-1 text-4xl font-semibold">
            {s.partner_1_name} &amp; {s.partner_2_name}
          </h1>
          <p className="mt-2 text-sm">
            {formatWeddingDate(s.wedding_date)}
            {s.venue_name && ` · ${s.venue_name}`}
            {s.venue_address && `, ${s.venue_address}`}
          </p>
          {vendor && (
            <p className="mt-2 text-sm">
              Para: <strong>{vendor.name}</strong>
              {!onlyVendor && ' (sus momentos están marcados con ●)'}
            </p>
          )}
        </header>

        {shown.length === 0 ? (
          <p className="text-sm text-muted">No hay momentos en el cronograma.</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-ink/30 text-left text-xs tracking-wide text-muted uppercase">
                <th className="w-32 py-2 pr-4 font-medium">Hora</th>
                <th className="py-2 pr-4 font-medium">Momento</th>
                <th className="py-2 font-medium">A cargo</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((item) => {
                const mine = vendor && item.vendor_id === vendor.id
                return (
                  <tr key={item.id} className="border-b border-line align-top break-inside-avoid">
                    <td className="py-3 pr-4 font-semibold whitespace-nowrap tabular-nums">
                      {formatTime(item.start_time)}
                      {item.end_time && <span className="font-normal text-muted"> – {formatTime(item.end_time)}</span>}
                    </td>
                    <td className="py-3 pr-4">
                      <span className={mine && !onlyVendor ? 'font-semibold' : ''}>
                        {mine && !onlyVendor && '● '}
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
        )}
      </article>
    </div>
  )
}
