import { useState } from 'react'
import { toast } from 'sonner'
import { AlertCircle, RotateCcw } from 'lucide-react'
import { guestsApi, useUpdateSettings } from '../../lib/api'
import { attempt } from '../../lib/attempt'
import {
  DEFAULT_INVITATION,
  DEFAULT_REMINDER,
  FIELD_HELP,
  MESSAGE_FIELDS,
  renderMessage,
  unknownFields,
} from '../../lib/messages'
import { Button } from '../../components/ui/Button'
import { Card, CardHeader } from '../../components/ui/Display'
import { Field, Textarea } from '../../components/ui/Field'
import type { Guest, WeddingSettings } from '../../types/database'
import { messageValues } from '../guests/rsvpLinks'

const EXAMPLE: Pick<Guest, 'name' | 'rsvp_token'> = { name: 'Tía Marta', rsvp_token: 'ejemplo1234567890abcd' }

/** Textos de la invitación y del recordatorio que se envían por WhatsApp */
export function MessagesSettings({ settings }: { settings: WeddingSettings }) {
  const update = useUpdateSettings()
  const guests = guestsApi.useList()
  const [invitation, setInvitation] = useState(settings.invitation_template ?? DEFAULT_INVITATION)
  const [reminder, setReminder] = useState(settings.reminder_template ?? DEFAULT_REMINDER)

  const example = guests.data?.[0] ?? EXAMPLE
  const values = messageValues(example, settings)
  const dirty =
    invitation !== (settings.invitation_template ?? DEFAULT_INVITATION) ||
    reminder !== (settings.reminder_template ?? DEFAULT_REMINDER)
  const errors = [...unknownFields(invitation), ...unknownFields(reminder)]

  const save = async () => {
    const ok = await attempt(
      update.mutateAsync({
        invitation_template: invitation.trim() === DEFAULT_INVITATION ? null : invitation.trim() || null,
        reminder_template: reminder.trim() === DEFAULT_REMINDER ? null : reminder.trim() || null,
      }),
    )
    if (ok) toast.success('Mensajes guardados')
  }

  return (
    <Card>
      <CardHeader
        title="Mensajes de WhatsApp"
        subtitle="Lo que se envía al invitar y al recordar. La app reemplaza los campos entre llaves."
      />
      <div className="flex flex-col gap-5 px-5 pb-5">
        <p className="text-xs text-muted">
          Campos disponibles:{' '}
          {MESSAGE_FIELDS.map((f, i) => (
            <span key={f}>
              {i > 0 && ' · '}
              <code className="rounded bg-stone-100 px-1">{`{${f}}`}</code> {FIELD_HELP[f]}
            </span>
          ))}
        </p>

        <MessageField
          label="Invitación"
          value={invitation}
          preview={renderMessage(invitation, values)}
          onChange={setInvitation}
          onReset={() => setInvitation(DEFAULT_INVITATION)}
          isDefault={invitation === DEFAULT_INVITATION}
        />
        <MessageField
          label="Recordatorio"
          value={reminder}
          preview={renderMessage(reminder, values)}
          onChange={setReminder}
          onReset={() => setReminder(DEFAULT_REMINDER)}
          isDefault={reminder === DEFAULT_REMINDER}
        />

        {errors.length > 0 && (
          <p className="flex items-center gap-1.5 text-xs text-red-700">
            <AlertCircle className="size-3.5" /> Estos campos no existen y se enviarían tal cual:{' '}
            {errors.map((e) => `{${e}}`).join(', ')}
          </p>
        )}

        <div className="flex justify-end">
          <Button onClick={save} disabled={!dirty || errors.length > 0 || update.isPending}>
            {update.isPending ? 'Guardando…' : 'Guardar mensajes'}
          </Button>
        </div>
      </div>
    </Card>
  )
}

function MessageField({
  label,
  value,
  preview,
  onChange,
  onReset,
  isDefault,
}: {
  label: string
  value: string
  preview: string
  onChange: (value: string) => void
  onReset: () => void
  isDefault: boolean
}) {
  return (
    <div>
      <Field label={label}>
        {(id) => <Textarea id={id} rows={4} value={value} onChange={(e) => onChange(e.target.value)} />}
      </Field>
      <div className="mt-2 rounded-xl border border-line bg-ivory px-4 py-3">
        <p className="text-xs font-medium text-muted">Así se vería</p>
        <p className="mt-1 text-sm whitespace-pre-line">{preview || '—'}</p>
      </div>
      {!isDefault && (
        <Button className="mt-2" size="sm" variant="ghost" icon={<RotateCcw className="size-3.5" />} onClick={onReset}>
          Volver al texto original
        </Button>
      )}
    </div>
  )
}
