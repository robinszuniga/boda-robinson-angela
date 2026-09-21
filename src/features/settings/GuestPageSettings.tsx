import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { useUpdateSettings } from '../../lib/api'
import { attempt } from '../../lib/attempt'
import { safeUrl } from '../../lib/contact'
import { Button } from '../../components/ui/Button'
import { Card, CardHeader } from '../../components/ui/Display'
import { Checkbox, Field, FormGrid, Input, Textarea } from '../../components/ui/Field'
import type { WeddingSettings } from '../../types/database'

interface FormValues {
  dress_code: string
  logistics_info: string
  lodging_info: string
  faq: string
  livestream_url: string
  photo_album_url: string
  show_table_to_guests: boolean
  envelope_rain: boolean
  ask_song: boolean
  offer_transport: boolean
}

function toForm(s: WeddingSettings): FormValues {
  return {
    dress_code: s.dress_code ?? '',
    logistics_info: s.logistics_info ?? '',
    lodging_info: s.lodging_info ?? '',
    faq: s.faq ?? '',
    livestream_url: s.livestream_url ?? '',
    photo_album_url: s.photo_album_url ?? '',
    show_table_to_guests: s.show_table_to_guests,
    envelope_rain: s.envelope_rain,
    ask_song: s.ask_song,
    offer_transport: s.offer_transport,
  }
}

const urlRule = (v: string) => !v.trim() || !!safeUrl(v) || 'Escribe un enlace válido (https://…)'

/** Lo que ve cada invitado en su página de confirmación */
export function GuestPageSettings({ settings }: { settings: WeddingSettings }) {
  const update = useUpdateSettings()
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<FormValues>({ defaultValues: toForm(settings) })

  useEffect(() => {
    reset(toForm(settings))
  }, [settings, reset])

  const onSubmit = async (v: FormValues) => {
    const text = (s: string) => s.trim() || null
    const ok = await attempt(
      update.mutateAsync({
        dress_code: text(v.dress_code),
        logistics_info: text(v.logistics_info),
        lodging_info: text(v.lodging_info),
        faq: text(v.faq),
        livestream_url: v.livestream_url.trim() ? safeUrl(v.livestream_url) : null,
        photo_album_url: v.photo_album_url.trim() ? safeUrl(v.photo_album_url) : null,
        show_table_to_guests: v.show_table_to_guests,
        envelope_rain: v.envelope_rain,
        ask_song: v.ask_song,
        offer_transport: v.offer_transport,
      }),
    )
    if (ok) toast.success('Página del invitado actualizada')
  }

  return (
    <Card>
      <CardHeader title="Página del invitado" subtitle="Lo que ve cada invitado al abrir su link de confirmación" />
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 px-5 pb-5" noValidate>
        <fieldset className="flex flex-col gap-2 rounded-xl border border-line bg-ivory/60 p-4">
          <legend className="px-1 text-sm font-medium">Opciones</legend>
          <Checkbox label="Preguntar qué canción no puede faltar en la fiesta" {...register('ask_song')} />
          <Checkbox label="Preguntar si necesitan transporte" {...register('offer_transport')} />
          <Checkbox label='Pedir "lluvia de sobres" (regalo en efectivo el día de la boda)' {...register('envelope_rain')} />
          <Checkbox
            label="Mostrar a cada invitado confirmado su número de mesa"
            {...register('show_table_to_guests')}
          />
          <p className="text-xs text-muted">Activa la mesa cuando la distribución esté lista, por ejemplo la semana de la boda.</p>
        </fieldset>
        <FormGrid>
          <Field label="Código de vestimenta" hint="Ej: Formal, coctel, etiqueta">
            {(id) => <Input id={id} {...register('dress_code')} />}
          </Field>
          <Field label="Transmisión en vivo" hint="Para quienes no pueden ir" error={errors.livestream_url?.message}>
            {(id) => <Input id={id} placeholder="https://…" {...register('livestream_url', { validate: urlRule })} />}
          </Field>
        </FormGrid>
        <Field
          label="Álbum compartido de fotos"
          hint="Creen un álbum compartido (por ejemplo en Google Fotos) y peguen el link. Los invitados lo verán en su página y en Invitados → Códigos QR hay una tarjeta para imprimir en las mesas."
          error={errors.photo_album_url?.message}
        >
          {(id) => <Input id={id} placeholder="https://photos.app.goo.gl/…" {...register('photo_album_url', { validate: urlRule })} />}
        </Field>
        <Field label="Cómo llegar, parqueadero y transporte">
          {(id) => <Textarea id={id} rows={3} {...register('logistics_info')} />}
        </Field>
        <Field label="Hospedaje para quienes viajan">
          {(id) => <Textarea id={id} rows={2} {...register('lodging_info')} />}
        </Field>
        <Field label="Preguntas frecuentes" hint="Ej: ¿Pueden ir niños? ¿Hasta qué hora es la fiesta?">
          {(id) => <Textarea id={id} rows={4} {...register('faq')} />}
        </Field>
        <div className="flex justify-end">
          <Button type="submit" disabled={!isDirty || isSubmitting}>
            {isSubmitting ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>
      </form>
    </Card>
  )
}
