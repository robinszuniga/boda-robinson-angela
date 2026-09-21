import { toast } from 'sonner'
import { Check, Copy, MessageCircle } from 'lucide-react'
import { guestsApi } from '../../lib/api'
import { whatsappNumber } from '../../lib/contact'
import { daysFromToday, formatDate } from '../../lib/format'
import { Modal } from '../../components/ui/Modal'
import { Button, IconButton } from '../../components/ui/Button'
import type { Guest, WeddingSettings } from '../../types/database'
import { reminderText, reminderWhatsapp } from './rsvpLinks'

/** Recordatorio a quienes no han confirmado: un WhatsApp con el mensaje ya escrito por cada uno */
export function RemindersModal({
  pending,
  settings,
  onClose,
}: {
  pending: Guest[]
  settings?: WeddingSettings
  onClose: () => void
}) {
  const update = guestsApi.useUpdate()
  const markReminded = (g: Guest) => update.mutate({ id: g.id, values: { rsvp_reminded_at: new Date().toISOString() } })

  const copy = async (g: Guest) => {
    try {
      await navigator.clipboard.writeText(reminderText(g, settings))
      markReminded(g)
      toast.success('Mensaje copiado')
    } catch {
      toast.error('No se pudo copiar')
    }
  }

  const sorted = [...pending].sort((a, b) => (a.rsvp_reminded_at ?? '').localeCompare(b.rsvp_reminded_at ?? ''))

  return (
    <Modal
      open
      size="lg"
      onClose={onClose}
      title="Recordar a quienes no han confirmado"
      description="Cada botón abre WhatsApp con el recordatorio ya escrito; tú decides si lo envías."
      footer={
        <Button variant="secondary" onClick={onClose}>
          Listo
        </Button>
      }
    >
      {sorted.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">Todos respondieron.</p>
      ) : (
        <ul className="divide-y divide-line">
          {sorted.map((g) => {
            const reminded = g.rsvp_reminded_at
            const recent = reminded && daysFromToday(reminded) > -3
            return (
              <li key={g.id} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{g.name}</p>
                  <p className="text-xs text-muted">
                    {reminded ? (
                      <span className={recent ? 'text-brand-700' : ''}>
                        <Check className="-mt-0.5 inline size-3" /> Recordado el {formatDate(reminded)}
                      </span>
                    ) : (
                      'Sin recordatorio'
                    )}
                    {!g.phone && ' · sin teléfono'}
                  </p>
                </div>
                <IconButton label={`Copiar recordatorio para ${g.name}`} onClick={() => copy(g)}>
                  <Copy className="size-4" />
                </IconButton>
                <a
                  href={reminderWhatsapp(g, settings)}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => markReminded(g)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-sm font-medium text-white hover:bg-emerald-700"
                >
                  <MessageCircle className="size-4" />
                  {whatsappNumber(g.phone) ? 'WhatsApp' : 'Elegir chat'}
                </a>
              </li>
            )
          })}
        </ul>
      )}
    </Modal>
  )
}
