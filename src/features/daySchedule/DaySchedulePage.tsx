import { useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { ClipboardList, Clock, Copy, MapPin, Music, Plus, Printer, User } from 'lucide-react'
import { guestsApi, scheduleApi, useSettings, vendorsApi } from '../../lib/api'
import { attempt } from '../../lib/attempt'
import { formatTime, formatWeddingDate } from '../../lib/format'
import { Button } from '../../components/ui/Button'
import { buttonClass } from '../../components/ui/buttonStyles'
import { Card, CardHeader, EmptyState, ErrorState, LoadingState, PageHeader } from '../../components/ui/Display'
import { Checkbox, Select } from '../../components/ui/Field'
import { cn } from '../../components/ui/cn'
import type { DayScheduleItem } from '../../types/database'
import { ScheduleItemModal } from './ScheduleItemModal'
import { sortSchedule, useLoadScheduleExample } from './scheduleActions'

export default function DaySchedulePage() {
  const settings = useSettings()
  const items = scheduleApi.useList()
  const vendors = vendorsApi.useList()
  const guests = guestsApi.useList()
  const loadExample = useLoadScheduleExample()
  const [form, setForm] = useState<{ item?: DayScheduleItem } | null>(null)
  const [vendorId, setVendorId] = useState('')
  const [onlyVendor, setOnlyVendor] = useState(false)

  const queries = [settings, items, vendors]
  const failed = queries.find((q) => q.isError)
  if (failed) return <ErrorState error={failed.error} onRetry={() => queries.forEach((q) => q.refetch())} />
  if (queries.some((q) => q.isPending)) return <LoadingState />

  const vendorName = new Map((vendors.data ?? []).map((v) => [v.id, v.name]))
  const involved = (vendors.data ?? []).filter((v) => (items.data ?? []).some((i) => i.vendor_id === v.id))
  const sorted = sortSchedule(items.data ?? [])
  const shown = vendorId && onlyVendor ? sorted.filter((i) => i.vendor_id === vendorId) : sorted
  const printParams = new URLSearchParams()
  if (vendorId) printParams.set('proveedor', vendorId)
  if (vendorId && onlyVendor) printParams.set('solo', '1')

  return (
    <>
      <PageHeader
        title="Cronograma del día"
        description={settings.data ? formatWeddingDate(settings.data.wedding_date) : undefined}
        actions={
          <>
            <Link to={`/cronograma/imprimir?${printParams}`} className={buttonClass({ variant: 'secondary' })}>
              <Printer className="size-4" /> Imprimir / PDF
            </Link>
            <Link to="/cronograma/coordinador" className={buttonClass({ variant: 'secondary' })}>
              <ClipboardList className="size-4" /> Hoja del coordinador
            </Link>
            <Button icon={<Plus className="size-4" />} onClick={() => setForm({})}>
              Momento
            </Button>
          </>
        }
      />

      {sorted.length === 0 ? (
        <EmptyState
          icon={<Clock className="size-8" />}
          title="El día está en blanco"
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button
                disabled={loadExample.isPending}
                onClick={async () => {
                  if (await attempt(loadExample.mutateAsync())) toast.success('Ejemplo cargado: ajústalo a su gusto')
                }}
              >
                Cargar un ejemplo
              </Button>
              <Button variant="secondary" onClick={() => setForm({})}>
                Empezar desde cero
              </Button>
            </div>
          }
        >
          Arma el minuto a minuto: maquillaje, ceremonia, cóctel, cena, hora loca… y compártelo con fotógrafo, DJ y coordinador.
        </EmptyState>
      ) : (
        <>
          {involved.length > 0 && (
            <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center">
              <Select aria-label="Ver para proveedor" className="sm:w-64" value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
                <option value="">Ver el día completo</option>
                {involved.map((v) => (
                  <option key={v.id} value={v.id}>
                    Resaltar: {v.name}
                  </option>
                ))}
              </Select>
              {vendorId && (
                <Checkbox label="Solo sus momentos" checked={onlyVendor} onChange={(e) => setOnlyVendor(e.target.checked)} />
              )}
            </div>
          )}

          <ol className="relative flex flex-col gap-3 before:absolute before:top-2 before:bottom-2 before:left-[7rem] before:w-px before:bg-line sm:before:left-[8.25rem]">
            {shown.map((item) => {
              const highlighted = vendorId && item.vendor_id === vendorId
              return (
                <li key={item.id} className="relative flex gap-8 sm:gap-10">
                  <div className="w-24 shrink-0 pt-3 text-right sm:w-28">
                    <div className="text-sm font-semibold tabular-nums">{formatTime(item.start_time)}</div>
                    {item.end_time && <div className="text-xs text-muted tabular-nums">{formatTime(item.end_time)}</div>}
                  </div>
                  <span
                    className={cn(
                      'absolute top-4 left-[calc(7rem-5px)] size-2.5 rounded-full ring-4 ring-ivory sm:left-[calc(8.25rem-5px)]',
                      highlighted ? 'bg-accent-400' : 'bg-brand-500',
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => setForm({ item })}
                    className={cn(
                      'min-w-0 flex-1 rounded-xl border bg-white px-4 py-3 text-left shadow-xs transition hover:border-brand-300',
                      highlighted ? 'border-accent-300 bg-accent-50/50' : 'border-line',
                    )}
                  >
                    <p className="font-medium">{item.title}</p>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                      {item.location && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="size-3" /> {item.location}
                        </span>
                      )}
                      {(item.vendor_id || item.responsible) && (
                        <span className="inline-flex items-center gap-1">
                          <User className="size-3" />
                          {[item.vendor_id && vendorName.get(item.vendor_id), item.responsible].filter(Boolean).join(' · ')}
                        </span>
                      )}
                    </div>
                    {item.description && <p className="mt-1.5 text-sm whitespace-pre-line text-muted">{item.description}</p>}
                  </button>
                </li>
              )
            })}
          </ol>
        </>
      )}

      <SongRequests
        songs={(guests.data ?? [])
          .filter((g) => g.song_request && g.rsvp_status !== 'rechazado')
          .map((g) => ({ song: g.song_request!, by: g.name }))}
      />

      {form && <ScheduleItemModal {...form} onClose={() => setForm(null)} />}
    </>
  )
}

/** Canciones que pidieron los invitados al confirmar, para pasárselas al DJ */
function SongRequests({ songs }: { songs: { song: string; by: string }[] }) {
  if (songs.length === 0) return null
  const copy = async () => {
    try {
      const lines = ['Canciones pedidas por los invitados:', ...songs.map((s) => `• ${s.song} (${s.by})`)]
      await navigator.clipboard.writeText(lines.join('\n'))
      toast.success('Lista copiada: pégala en el chat con el DJ')
    } catch {
      toast.error('No se pudo copiar')
    }
  }
  return (
    <Card className="mt-8">
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <Music className="size-5 text-accent-400" /> Canciones pedidas
          </span>
        }
        subtitle="Lo que respondieron los invitados en su página de confirmación"
        action={
          <Button size="sm" variant="secondary" icon={<Copy className="size-3.5" />} onClick={copy}>
            Copiar para el DJ
          </Button>
        }
      />
      <ul className="grid gap-x-6 gap-y-1.5 px-5 pb-5 text-sm sm:grid-cols-2">
        {songs.map((s, i) => (
          <li key={i} className="truncate">
            {s.song} <span className="text-muted">· {s.by}</span>
          </li>
        ))}
      </ul>
    </Card>
  )
}
