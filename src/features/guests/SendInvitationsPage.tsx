import { useState } from 'react'
import { toast } from 'sonner'
import { Check, Copy, MessageCircle, Phone, RotateCcw, Send, Upload } from 'lucide-react'
import { guestsApi, useSettings } from '../../lib/api'
import { attempt } from '../../lib/attempt'
import { whatsappLink } from '../../lib/contact'
import { formatPhone } from '../../lib/phones'
import { formatDate } from '../../lib/format'
import { guestGroup, options } from '../../lib/labels'
import { Button } from '../../components/ui/Button'
import { Card, EmptyState, ErrorState, LoadingState, PageHeader, ProgressBar, Segmented } from '../../components/ui/Display'
import { Select } from '../../components/ui/Field'
import type { Guest, GuestGroup } from '../../types/database'
import { copyRsvpLink, invitationText } from './rsvpLinks'
import { PhonesCsvModal } from './PhonesCsvModal'

type Tab = 'por_enviar' | 'enviadas' | 'sin_telefono'

/** Cuántas seguidas antes de sugerir una pausa (WhatsApp marca los envíos muy rápidos) */
const BATCH = 25

export default function SendInvitationsPage() {
  const settings = useSettings()
  const guests = guestsApi.useList()
  const update = guestsApi.useUpdate()
  const [tab, setTab] = useState<Tab>('por_enviar')
  const [group, setGroup] = useState<GuestGroup | ''>('')
  const [phonesOpen, setPhonesOpen] = useState(false)
  const [sentNow, setSentNow] = useState(0)

  const queries = [settings, guests]
  const failed = queries.find((q) => q.isError)
  if (failed) return <ErrorState error={failed.error} onRetry={() => queries.forEach((q) => q.refetch())} />
  if (queries.some((q) => q.isPending)) return <LoadingState />

  const all = [...(guests.data ?? [])].sort(
    (a, b) => a.guest_group.localeCompare(b.guest_group) || a.name.localeCompare(b.name, 'es'),
  )
  const sent = all.filter((g) => g.invitation_sent_at)
  const withoutPhone = all.filter((g) => !g.invitation_sent_at && !g.phone)
  const toSend = all.filter((g) => !g.invitation_sent_at && g.phone)
  // Los que se irían con la dirección larga de GitHub en vez del link corto
  const longLink = toSend.filter((g) => !g.short_url)
  const shown = (tab === 'por_enviar' ? toSend : tab === 'enviadas' ? sent : withoutPhone).filter(
    (g) => !group || g.guest_group === group,
  )

  const mark = (guest: Guest, value: string | null) =>
    update.mutate({ id: guest.id, values: { invitation_sent_at: value } })

  const markAsSent = async (guest: Guest) => {
    const ok = await attempt(update.mutateAsync({ id: guest.id, values: { invitation_sent_at: new Date().toISOString() } }))
    if (ok) toast.success(`Invitación de ${guest.name} marcada como enviada`)
  }

  const send = async (guest: Guest) => {
    window.open(whatsappLink(guest.phone, invitationText(guest, settings.data)), '_blank', 'noopener')
    const ok = await attempt(
      update.mutateAsync({ id: guest.id, values: { invitation_sent_at: new Date().toISOString() } }),
    )
    if (ok) setSentNow((n) => n + 1)
  }

  return (
    <>
      <PageHeader
        title="Enviar invitaciones"
        description="Abre el chat con el mensaje listo; tú das Enter en WhatsApp"
        actions={
          <Button variant="secondary" icon={<Upload className="size-4" />} onClick={() => setPhonesOpen(true)}>
            Teléfonos por archivo
          </Button>
        }
      />

      <Card className="mb-5">
        <div className="p-5">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted">Invitaciones enviadas</span>
            <span className="text-2xl font-semibold tabular-nums">
              {sent.length} <span className="text-base font-normal text-muted">de {all.length}</span>
            </span>
          </div>
          <ProgressBar className="mt-2" value={sent.length} max={all.length || 1} label="Invitaciones enviadas" />
          <p className="mt-2 text-xs text-muted">
            {toSend.length} listas para enviar
            {withoutPhone.length > 0 && (
              <>
                {' '}
                · <span className="font-medium text-amber-700">{withoutPhone.length} sin teléfono</span>
              </>
            )}
            {longLink.length > 0 && (
              <>
                {' '}
                · <span className="font-medium text-amber-700">{longLink.length} sin link corto</span>
              </>
            )}
          </p>
        </div>
      </Card>

      {sentNow >= BATCH && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span>
            Llevas {sentNow} seguidas. Descansa unos minutos antes de seguir: WhatsApp puede bloquear los números que
            envían muchos mensajes de corrido.
          </span>
          <Button size="sm" variant="secondary" onClick={() => setSentNow(0)}>
            Ya descansé
          </Button>
        </div>
      )}

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Segmented
          label="Qué invitaciones ver"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'por_enviar', label: `Por enviar (${toSend.length})` },
            { value: 'enviadas', label: `Enviadas (${sent.length})` },
            { value: 'sin_telefono', label: `Sin teléfono (${withoutPhone.length})` },
          ]}
        />
        <Select aria-label="Filtrar por grupo" className="sm:w-56" value={group} onChange={(e) => setGroup(e.target.value as GuestGroup | '')}>
          <option value="">Todos los grupos</option>
          {options(guestGroup).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </div>

      {shown.length === 0 ? (
        <EmptyState
          icon={tab === 'sin_telefono' ? <Phone className="size-8" /> : <Send className="size-8" />}
          title={
            tab === 'por_enviar'
              ? all.length === 0
                ? 'Aún no hay invitados'
                : toSend.length === 0 && withoutPhone.length > 0
                  ? 'Faltan los teléfonos'
                  : 'No queda nadie por enviar'
              : tab === 'enviadas'
                ? 'Todavía no has enviado ninguna'
                : 'Todos tienen teléfono'
          }
          action={
            toSend.length === 0 && withoutPhone.length > 0 && tab === 'por_enviar' ? (
              <Button onClick={() => setPhonesOpen(true)}>Cargar teléfonos</Button>
            ) : undefined
          }
        >
          {tab === 'por_enviar' && withoutPhone.length > 0 && 'Sin número no se puede abrir el chat de WhatsApp.'}
        </EmptyState>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white shadow-xs">
          {shown.map((g) => (
            <li key={g.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
              <div className="min-w-[10rem] flex-1">
                <p className="font-medium">{g.name}</p>
                <p className="text-xs text-muted">
                  {guestGroup[g.guest_group]}
                  {g.phone && ` · ${formatPhone(g.phone)}`}
                  {g.invitation_sent_at && ` · enviada el ${formatDate(g.invitation_sent_at)}`}
                </p>
              </div>
              {tab === 'enviadas' ? (
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" icon={<RotateCcw className="size-4" />} onClick={() => mark(g, null)}>
                    Deshacer
                  </Button>
                  {g.phone && (
                    <Button size="sm" variant="secondary" icon={<MessageCircle className="size-4" />} onClick={() => send(g)}>
                      Reenviar
                    </Button>
                  )}
                </div>
              ) : (
                <div className="flex gap-2">
                  {g.phone ? (
                    <Button size="sm" icon={<MessageCircle className="size-4" />} onClick={() => send(g)}>
                      Abrir WhatsApp
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={<Copy className="size-4" />}
                      onClick={() => copyRsvpLink(g)}
                    >
                      Copiar link
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<Check className="size-4" />}
                    onClick={() => markAsSent(g)}
                  >
                    Marcar enviada
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {shown.length > 0 && tab === 'por_enviar' && (
        <p className="mt-3 text-xs text-muted">
          Al abrir WhatsApp la invitación queda marcada como enviada. Si al final no la mandaste, búscala en "Enviadas"
          y usa Deshacer.
        </p>
      )}

      {phonesOpen && <PhonesCsvModal guests={all} onClose={() => setPhonesOpen(false)} />}
    </>
  )
}
