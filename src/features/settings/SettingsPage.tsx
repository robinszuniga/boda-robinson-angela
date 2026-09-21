import { useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { CalendarClock, ListChecks, RefreshCw } from 'lucide-react'
import { scheduleApi, tasksApi, useSettings, useUpdateSettings } from '../../lib/api'
import { formatWeddingDate, fromBogotaInput, toBogotaInput } from '../../lib/format'
import { Button } from '../../components/ui/Button'
import { Card, CardHeader, ErrorState, LoadingState, PageHeader } from '../../components/ui/Display'
import { Field, FormGrid, Input, Textarea } from '../../components/ui/Field'
import { MoneyInput } from '../../components/ui/MoneyInput'
import { useConfirm } from '../../components/ui/Confirm'
import type { WeddingSettings } from '../../types/database'
import { TASK_TEMPLATE } from '../../data/taskTemplate'
import { useLoadTaskTemplate, useRecalcTemplateDates } from '../tasks/templateActions'
import { useLoadScheduleExample } from '../daySchedule/scheduleActions'
import { attempt } from '../../lib/attempt'
import { GuestPageSettings } from './GuestPageSettings'
import { BackupCard } from './BackupCard'

interface FormValues {
  partner_1_name: string
  partner_2_name: string
  wedding_date: string
  venue_name: string
  venue_address: string
  venue_capacity: number
  total_budget: number | null
  rsvp_deadline: string
  guest_message: string
}

function toForm(s: WeddingSettings): FormValues {
  return {
    partner_1_name: s.partner_1_name,
    partner_2_name: s.partner_2_name,
    wedding_date: toBogotaInput(s.wedding_date),
    venue_name: s.venue_name ?? '',
    venue_address: s.venue_address ?? '',
    venue_capacity: s.venue_capacity,
    total_budget: s.total_budget,
    rsvp_deadline: s.rsvp_deadline ?? '',
    guest_message: s.guest_message ?? '',
  }
}

export default function SettingsPage() {
  const settings = useSettings()
  const update = useUpdateSettings()
  const tasks = tasksApi.useList()
  const schedule = scheduleApi.useList()
  const loadTemplate = useLoadTaskTemplate()
  const recalc = useRecalcTemplateDates()
  const loadExample = useLoadScheduleExample()
  const confirm = useConfirm()

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<FormValues>()

  useEffect(() => {
    if (settings.data) reset(toForm(settings.data))
  }, [settings.data, reset])

  if (settings.isPending) return <LoadingState />
  if (settings.isError) return <ErrorState error={settings.error} onRetry={() => settings.refetch()} />

  const onSubmit = async (v: FormValues) => {
    const dateChanged = toBogotaInput(settings.data.wedding_date) !== v.wedding_date
    await update.mutateAsync({
      partner_1_name: v.partner_1_name.trim(),
      partner_2_name: v.partner_2_name.trim(),
      wedding_date: fromBogotaInput(v.wedding_date),
      venue_name: v.venue_name.trim() || null,
      venue_address: v.venue_address.trim() || null,
      venue_capacity: v.venue_capacity,
      total_budget: v.total_budget ?? 0,
      rsvp_deadline: v.rsvp_deadline || null,
      guest_message: v.guest_message.trim() || null,
    })
    toast.success('Configuración guardada')
    const templateTasks = (tasks.data ?? []).filter((t) => t.template_key && t.status !== 'listo')
    if (dateChanged && templateTasks.length > 0) {
      const ok = await confirm({
        title: 'Cambió la fecha de la boda',
        message: `¿Recalculamos las fechas de ${templateTasks.length} tareas de la plantilla que no están listas?`,
        confirmLabel: 'Recalcular',
      })
      if (ok) {
        const n = await recalc.mutateAsync({ weddingDate: fromBogotaInput(v.wedding_date), tasks: tasks.data ?? [] })
        toast.success(`${n} tareas actualizadas`)
      }
    }
  }

  const loadedKeys = new Set((tasks.data ?? []).map((t) => t.template_key).filter(Boolean))
  const templateLoaded = loadedKeys.size > 0
  const missingTemplate = TASK_TEMPLATE.filter((t) => !loadedKeys.has(t.key)).length

  return (
    <>
      <PageHeader title="Configuración" description={`La boda: ${formatWeddingDate(settings.data.wedding_date)}`} />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-6">
        <Card>
          <CardHeader title="Datos de la boda" />
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 px-5 pb-5" noValidate>
            <FormGrid>
              <Field label="Novio" error={errors.partner_1_name?.message}>
                {(id) => <Input id={id} {...register('partner_1_name', { required: 'Requerido' })} />}
              </Field>
              <Field label="Novia" error={errors.partner_2_name?.message}>
                {(id) => <Input id={id} {...register('partner_2_name', { required: 'Requerido' })} />}
              </Field>
              <Field label="Fecha y hora" hint="Hora de Colombia" error={errors.wedding_date?.message}>
                {(id) => (
                  <Input id={id} type="datetime-local" {...register('wedding_date', { required: 'Requerida' })} />
                )}
              </Field>
              <Field label="Fecha límite para confirmar (RSVP)" hint="Opcional. Después de esta fecha el link público ya no deja responder.">
                {(id) => <Input id={id} type="date" {...register('rsvp_deadline')} />}
              </Field>
              <Field label="Lugar">
                {(id) => <Input id={id} placeholder="Hacienda …" {...register('venue_name')} />}
              </Field>
              <Field label="Dirección">
                {(id) => <Input id={id} {...register('venue_address')} />}
              </Field>
              <Field label="Capacidad del lugar (personas)" error={errors.venue_capacity?.message}>
                {(id) => (
                  <Input
                    id={id}
                    type="number"
                    min={0}
                    inputMode="numeric"
                    {...register('venue_capacity', {
                      valueAsNumber: true,
                      validate: (v) => (Number.isInteger(v) && v >= 0) || 'Escribe un número',
                    })}
                  />
                )}
              </Field>
              <Field label="Presupuesto total">
                {(id) => (
                  <Controller
                    control={control}
                    name="total_budget"
                    render={({ field }) => (
                      <MoneyInput id={id} value={field.value} onChange={field.onChange} onBlur={field.onBlur} />
                    )}
                  />
                )}
              </Field>
            </FormGrid>
            <Field label="Mensaje para los invitados" hint="Se muestra en la página pública de confirmación.">
              {(id) => (
                <Textarea
                  id={id}
                  placeholder="¡Nos encantaría celebrar este día contigo!"
                  {...register('guest_message')}
                />
              )}
            </Field>
            <div className="flex justify-end">
              <Button type="submit" disabled={!isDirty || isSubmitting}>
                {isSubmitting ? 'Guardando…' : 'Guardar cambios'}
              </Button>
            </div>
          </form>
        </Card>
        <GuestPageSettings settings={settings.data} />
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader title="Datos iniciales" subtitle="Atajos para no empezar de cero" />
            <div className="flex flex-col gap-4 px-5 pb-5 text-sm">
              <div>
                <p className="text-muted">
                  Plantilla de {TASK_TEMPLATE.length} tareas típicas, con fechas calculadas desde la fecha de la boda. Las
                  que ya quedaron atrasadas se reparten en las próximas 4 semanas.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    icon={<ListChecks className="size-4" />}
                    disabled={loadTemplate.isPending || missingTemplate === 0}
                    onClick={async () => {
                      if (await attempt(loadTemplate.mutateAsync(settings.data.wedding_date))) {
                        toast.success(templateLoaded ? `${missingTemplate} tareas nuevas agregadas` : 'Plantilla de tareas cargada')
                      }
                    }}
                  >
                    {!templateLoaded
                      ? 'Cargar plantilla'
                      : missingTemplate > 0
                        ? `Agregar ${missingTemplate} tareas nuevas`
                        : 'Plantilla cargada'}
                  </Button>
                  {templateLoaded && (
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={<RefreshCw className="size-4" />}
                      disabled={recalc.isPending}
                      onClick={async () => {
                        let n = 0
                        const ok = await attempt(
                          recalc
                            .mutateAsync({ weddingDate: settings.data.wedding_date, tasks: tasks.data ?? [] })
                            .then((count) => {
                              n = count
                            }),
                        )
                        if (ok) toast.success(`${n} fechas recalculadas`)
                      }}
                    >
                      Recalcular fechas
                    </Button>
                  )}
                </div>
              </div>
              <div className="border-t border-line pt-4">
                <p className="text-muted">Cronograma de ejemplo del día (maquillaje, ceremonia, cóctel, cena, hora loca…).</p>
                <Button
                  className="mt-2"
                  size="sm"
                  variant="secondary"
                  icon={<CalendarClock className="size-4" />}
                  disabled={loadExample.isPending || (schedule.data?.length ?? 0) > 0}
                  onClick={async () => {
                    if (await attempt(loadExample.mutateAsync())) toast.success('Cronograma de ejemplo cargado')
                  }}
                >
                  {(schedule.data?.length ?? 0) > 0 ? 'El cronograma ya tiene datos' : 'Cargar ejemplo'}
                </Button>
              </div>
            </div>
          </Card>
          <BackupCard />
        </div>
      </div>
    </>
  )
}
