import { useState } from 'react'
import { Gift, HandCoins, HandHeart, MessageSquareHeart, Plus } from 'lucide-react'
import { giftsReceivedApi, guestsApi, useSettings } from '../../lib/api'
import { formatCOP, formatDate, plural } from '../../lib/format'
import { thanksRows, type ThanksRow } from '../../lib/thanks'
import { Button } from '../../components/ui/Button'
import { Badge, EmptyState, ErrorState, LoadingState, PageHeader, ProgressBar } from '../../components/ui/Display'
import { Checkbox } from '../../components/ui/Field'
import { cn } from '../../components/ui/cn'
import type { GiftReceived } from '../../types/database'
import { ReceivedGiftModal } from './ReceivedGiftModal'
import { ThankYouMessageModal } from './ThankYouMessageModal'

const METHODS = ['Tarjeta', 'Mensaje', 'Llamada', 'En persona']

export default function ThanksPage() {
  const settings = useSettings()
  const guests = guestsApi.useList()
  const received = giftsReceivedApi.useList()
  const updateGuest = guestsApi.useUpdate()
  const updateReceived = giftsReceivedApi.useUpdate()
  const [onlyPending, setOnlyPending] = useState(false)
  const [form, setForm] = useState<{
    received?: GiftReceived
    defaults?: { guest_id?: string; description?: string; envelope?: boolean }
  } | null>(null)
  const [messageFor, setMessageFor] = useState<ThanksRow | null>(null)

  if (guests.isError || received.isError) {
    return <ErrorState error={guests.error ?? received.error} onRetry={() => { guests.refetch(); received.refetch() }} />
  }
  if (guests.isPending || received.isPending) return <LoadingState />

  const rows = thanksRows(guests.data, received.data)
  const sent = rows.filter((r) => r.sentAt).length
  const shown = onlyPending ? rows.filter((r) => !r.sentAt) : rows
  const withAmount = received.data.filter((r) => (r.amount ?? 0) > 0)
  const cashTotal = withAmount.reduce((sum, r) => sum + (r.amount ?? 0), 0)

  const setSent = (row: ThanksRow, value: boolean, method?: string | null) => {
    const sentAt = value ? (row.sentAt ?? new Date().toISOString()) : null
    if (row.guest) {
      updateGuest.mutate({
        id: row.guest.id,
        values: { thank_you_sent_at: sentAt, thank_you_method: value ? (method ?? row.guest.thank_you_method) : null },
      })
    } else if (row.external) {
      updateReceived.mutate({ id: row.external.id, values: { thank_you_sent_at: sentAt } })
    }
  }

  return (
    <>
      <PageHeader
        title="Agradecimientos"
        description="A quién ya le enviaron tarjeta o mensaje, con los regalos que dio cada uno"
        actions={
          <>
            <Button
              variant="secondary"
              icon={<HandCoins className="size-4" />}
              onClick={() => setForm({ defaults: { description: 'Sobre', envelope: true } })}
            >
              Sobre
            </Button>
            <Button icon={<Plus className="size-4" />} onClick={() => setForm({})}>
              Regalo recibido
            </Button>
          </>
        }
      />

      {rows.length === 0 ? (
        <EmptyState icon={<HandHeart className="size-8" />} title="Aún no hay a quién agradecer">
          Aquí aparecen los invitados que confirmaron asistencia y quienes les den regalos. Registra los regalos a medida que
          lleguen, o márcalos como recibidos desde la Mesa de regalos.
        </EmptyState>
      ) : (
        <>
          <div className="mb-5 rounded-2xl border border-line bg-white p-4 shadow-xs">
            <div className="mb-2 flex items-baseline justify-between text-sm">
              <span className="text-muted">Agradecimientos enviados</span>
              <span className="text-xl font-semibold tabular-nums">
                {sent} / {rows.length}
              </span>
            </div>
            <ProgressBar value={sent} max={rows.length} tone="accent" label="Agradecimientos enviados" />
            {withAmount.length > 0 && (
              <p className="mt-3 flex items-center gap-2 border-t border-line pt-3 text-sm">
                <HandCoins className="size-4 text-accent-500" />
                <span className="text-muted">Sobres y aportes en efectivo:</span>
                <strong className="tabular-nums">{formatCOP(cashTotal)}</strong>
                <span className="text-muted">({plural(withAmount.length, 'regalo', 'regalos')})</span>
              </p>
            )}
          </div>

          <Checkbox className="mb-3" label="Solo pendientes" checked={onlyPending} onChange={(e) => setOnlyPending(e.target.checked)} />

          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white shadow-xs">
            {shown.map((row) => (
              <li key={row.key} className="flex flex-wrap items-start gap-3 px-4 py-3">
                <input
                  type="checkbox"
                  className="mt-0.5 size-5 shrink-0 cursor-pointer accent-brand-600"
                  checked={!!row.sentAt}
                  onChange={(e) => setSent(row, e.target.checked)}
                  aria-label={`Agradecimiento enviado a ${row.name}`}
                />
                <div className="min-w-0 flex-1">
                  <p className={cn('font-medium', row.sentAt && 'text-muted')}>
                    {row.name}
                    {row.attended && <Badge className="ml-2 align-middle">Asiste</Badge>}
                  </p>
                  {row.received.length > 0 ? (
                    <ul className="mt-1 flex flex-wrap gap-1.5">
                      {row.received.map((r) => (
                        <li key={r.id}>
                          <button
                            type="button"
                            onClick={() => setForm({ received: r })}
                            className="inline-flex items-center gap-1 rounded-full bg-accent-50 px-2 py-0.5 text-xs text-accent-700 hover:bg-accent-100"
                          >
                            <Gift className="size-3" /> {r.description}
                            {r.amount ? ` · ${formatCOP(r.amount)}` : ''}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    row.guest && (
                      <button
                        type="button"
                        onClick={() => setForm({ defaults: { guest_id: row.guest!.id } })}
                        className="mt-1 text-xs text-muted hover:text-ink hover:underline"
                      >
                        + registrar regalo
                      </button>
                    )
                  )}
                </div>
                {!row.sentAt && settings.data && (
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<MessageSquareHeart className="size-4" />}
                    onClick={() => setMessageFor(row)}
                  >
                    Mensaje
                  </Button>
                )}
                {row.sentAt && (
                  <div className="flex items-center gap-2 text-xs text-muted">
                    {row.guest && (
                      <select
                        aria-label={`Cómo se le agradeció a ${row.name}`}
                        value={row.guest.thank_you_method ?? ''}
                        onChange={(e) => setSent(row, true, e.target.value || null)}
                        className="h-7 rounded-md border border-line bg-white px-2 text-xs"
                      >
                        <option value="">¿Cómo?</option>
                        {METHODS.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    )}
                    {formatDate(row.sentAt)}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      {form && <ReceivedGiftModal {...form} onClose={() => setForm(null)} />}
      {messageFor && settings.data && (
        <ThankYouMessageModal
          row={messageFor}
          settings={settings.data}
          onSent={() => setSent(messageFor, true, 'Mensaje')}
          onClose={() => setMessageFor(null)}
        />
      )}
    </>
  )
}
