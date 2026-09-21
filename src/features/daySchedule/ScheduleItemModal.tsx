import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
import { scheduleApi, vendorsApi } from '../../lib/api'
import { attempt } from '../../lib/attempt'
import { Button } from '../../components/ui/Button'
import { Field, FormGrid, Input, Select, Textarea } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { useConfirm } from '../../components/ui/Confirm'
import type { DayScheduleItem } from '../../types/database'

interface FormValues {
  start_time: string
  end_time: string
  title: string
  location: string
  vendor_id: string
  responsible: string
  description: string
}

const hhmm = (t: string | null | undefined) => (t ? t.slice(0, 5) : '')

export function ScheduleItemModal({ item, onClose }: { item?: DayScheduleItem; onClose: () => void }) {
  const vendors = vendorsApi.useList()
  const create = scheduleApi.useCreate()
  const update = scheduleApi.useUpdate()
  const remove = scheduleApi.useRemove()
  const confirm = useConfirm()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      start_time: hhmm(item?.start_time),
      end_time: hhmm(item?.end_time),
      title: item?.title ?? '',
      location: item?.location ?? '',
      vendor_id: item?.vendor_id ?? '',
      responsible: item?.responsible ?? '',
      description: item?.description ?? '',
    },
  })

  const onSubmit = async (v: FormValues) => {
    const values = {
      start_time: v.start_time,
      end_time: v.end_time || null,
      title: v.title.trim(),
      location: v.location.trim() || null,
      vendor_id: v.vendor_id || null,
      responsible: v.responsible.trim() || null,
      description: v.description.trim() || null,
    }
    const ok = await attempt(item ? update.mutateAsync({ id: item.id, values }) : create.mutateAsync(values))
    if (!ok) return
    toast.success('Cronograma actualizado')
    onClose()
  }

  const onDelete = async () => {
    if (!item) return
    const ok = await confirm({ title: `¿Quitar "${item.title}"?`, confirmLabel: 'Quitar', danger: true })
    if (ok && (await attempt(remove.mutateAsync(item.id)))) onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={item ? 'Editar momento' : 'Nuevo momento'}
      footer={
        <>
          {item && (
            <Button variant="ghost" className="mr-auto text-red-700" icon={<Trash2 className="size-4" />} onClick={onDelete}>
              Quitar
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="schedule-form" disabled={isSubmitting}>
            Guardar
          </Button>
        </>
      }
    >
      <form id="schedule-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <FormGrid>
          <Field label="Hora de inicio" error={errors.start_time?.message}>
            {(id) => <Input id={id} type="time" {...register('start_time', { required: 'Elige la hora' })} />}
          </Field>
          <Field label="Hora de fin" hint="Opcional">
            {(id) => <Input id={id} type="time" {...register('end_time')} />}
          </Field>
        </FormGrid>
        <Field label="Qué pasa" error={errors.title?.message}>
          {(id) => (
            <Input
              id={id}
              data-autofocus={!item || undefined}
              placeholder="Ej: Ceremonia"
              {...register('title', { validate: (v) => !!v.trim() || 'Escribe qué pasa' })}
            />
          )}
        </Field>
        <FormGrid>
          <Field label="Lugar">{(id) => <Input id={id} {...register('location')} />}</Field>
          <Field label="Proveedor a cargo">
            {(id) => (
              <Select id={id} {...register('vendor_id')}>
                <option value="">—</option>
                {(vendors.data ?? [])
                  .filter((v) => v.status !== 'descartado' || v.id === item?.vendor_id)
                  .map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
              </Select>
            )}
          </Field>
        </FormGrid>
        <Field label="Responsable" hint="Si no es un proveedor: mamá, padrino, coordinador…">
          {(id) => <Input id={id} {...register('responsible')} />}
        </Field>
        <Field label="Detalles">{(id) => <Textarea id={id} rows={2} {...register('description')} />}</Field>
      </form>
    </Modal>
  )
}
