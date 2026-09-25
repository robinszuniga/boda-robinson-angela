import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ArrowLeft, Printer } from 'lucide-react'
import { guestsApi, useSettings } from '../../lib/api'
import { safeUrl } from '../../lib/contact'
import { Button } from '../../components/ui/Button'
import { ErrorState, LoadingState, Segmented } from '../../components/ui/Display'
import { Checkbox } from '../../components/ui/Field'
import { QrCode } from '../../components/ui/QrCode'
import { rsvpUrl } from './rsvpLinks'

type Sheet = 'invitaciones' | 'album'

/** Hoja imprimible: un QR por invitado (para las invitaciones) o tarjetas del álbum de fotos (para las mesas) */
export default function QrSheetPage() {
  const [params, setParams] = useSearchParams()
  const sheet: Sheet = params.get('hoja') === 'album' ? 'album' : 'invitaciones'
  const settings = useSettings()
  const guests = guestsApi.useList()
  const [onlyPending, setOnlyPending] = useState(false)

  if (settings.isError || guests.isError) return <ErrorState error={settings.error ?? guests.error} />
  if (settings.isPending || guests.isPending) return <LoadingState />

  const s = settings.data
  const album = safeUrl(s.photo_album_url)
  const list = guests.data.filter((g) => g.rsvp_status !== 'rechazado' && (!onlyPending || g.rsvp_status === 'pendiente'))

  return (
    <div className="min-h-dvh bg-white">
      <div className="no-print sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-line bg-white/95 px-4 py-3 backdrop-blur">
        <Link to="/invitados" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
          <ArrowLeft className="size-4" /> Volver
        </Link>
        <Segmented
          label="Qué imprimir"
          value={sheet}
          onChange={(v) => setParams(v === 'album' ? { hoja: 'album' } : {})}
          options={[
            { value: 'invitaciones', label: 'QR de cada invitado' },
            { value: 'album', label: 'Álbum de fotos (mesas)' },
          ]}
        />
        {sheet === 'invitaciones' && (
          <Checkbox label="Solo pendientes" checked={onlyPending} onChange={(e) => setOnlyPending(e.target.checked)} />
        )}
        <Button className="ml-auto" icon={<Printer className="size-4" />} onClick={() => window.print()}>
          Imprimir
        </Button>
      </div>

      <div className="mx-auto max-w-5xl p-6 print:max-w-none print:p-0">
        {sheet === 'invitaciones' ? (
          list.length === 0 ? (
            <p className="text-sm text-muted">No hay invitados para imprimir.</p>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 print:grid-cols-3">
              {list.map((g) => (
                <div key={g.id} className="flex break-inside-avoid flex-col items-center gap-2 rounded-xl border border-line p-4 text-center">
                  <p className="font-display text-lg leading-tight font-semibold">{g.name}</p>
                  <QrCode value={rsvpUrl(g)} label={`QR de ${g.name}`} className="w-36" />
                  <p className="text-xs text-muted">Escanea para confirmar tu asistencia</p>
                </div>
              ))}
            </div>
          )
        ) : !album ? (
          <p className="text-sm text-muted">
            Primero pega el link del álbum compartido en <Link to="/configuracion" className="underline">Configuración → Página del invitado</Link>.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 print:grid-cols-2">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="flex break-inside-avoid flex-col items-center gap-3 rounded-2xl border border-line p-6 text-center">
                <p className="text-xs tracking-[0.25em] text-muted uppercase">
                  {s.partner_1_name} &amp; {s.partner_2_name}
                </p>
                <p className="font-display text-2xl font-semibold">Comparte tus fotos</p>
                <QrCode value={album} label="QR del álbum de fotos" className="w-44" />
                <p className="text-sm text-muted">Escanea y sube las fotos y videos que tomes hoy</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
