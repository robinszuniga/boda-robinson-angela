import { Controller, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
import { giftsApi, giftsReceivedApi, guestsApi } from '../../lib/api'
import { attempt } from '../../lib/attempt'
import { todayISO } from '../../lib/format'
import { Button } from '../../components/ui/Button'
import { Field, FormGrid, Input, Select, Textarea } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { MoneyInput } from '../../components/ui/MoneyInput'
import { useConfirm } from '../../components/ui/Confirm'
import type { GiftReceived } from '../../types/database'

interface FormValues {
  guest_id: string
  from_name: string
  description: string
  gift_id: string
  received_on: string
  amount: number | null
  notes: string
}

export function ReceivedGiftModal({
  received,
  defaults,
  onClose,
}: {
  received?: GiftReceived
  defaults?: Partial<Pick<GiftReceived, 'guest_id' | 'gift_id' | 'description'>> & { envelope?: boolean }
  onClose: () => void
}) {
  const guests = guestsApi.useList()
  const gifts = giftsApi.useList()
  const create = giftsReceivedApi.useCreate()
  const update = giftsReceivedApi.useUpdate()
  const remove = giftsReceivedApi.useRemove()
  const confirm = useConfirm()
  const {
    register,
    handleSubmit,
    control,
    getValues,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      guest_id: received?.guest_id ?? defaults?.guest_id ?? '',
      from_name: received?.from_name ?? '',
      description: received?.description ?? defaults?.description ?? '',
      gift_id: received?.gift_id ?? defaults?.gift_id ?? '',
      received_on: received?.received_on ?? todayISO(),
      amount: received?.amount ?? null,
      notes: received?.notes ?? '',
    },
  })
  const guestId = useWatch({ control, name: 'guest_id' })
  const sortedGuests = [...(guests.data ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'es'))

  const onSubmit = async (v: FormValues) => {
    const values = {
      guest_id: v.guest_id || null,
      from_name: v.guest_id ? null : v.from_name.trim() || null,
      description: v.description.trim(),
      gift_id: v.gift_id || null,
      received_on: v.received_on,
      amount: v.amount,
      notes: v.notes.trim() || null,
    }
    const ok = await attempt(received ? update.mutateAsync({ id: received.id, values }) : create.mutateAsync(values))
    if (!ok) return
    toast.success('Regalo registrado')
    onClose()
  }

  const onDelete = async () => {
    if (!received) return
    const ok = await confirm({ title: '¿Borrar este registro?', confirmLabel: 'Borrar', danger: true })
    if (ok && (await attempt(remove.mutateAsync(received.id)))) onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={received ? 'Editar regalo recibido' : defaults?.envelope ? 'Sobre recibido' : 'Regalo recibido'}
      description={defaults?.envelope && !received ? 'El monto es privado: solo lo ven ustedes dos.' : undefined}
      footer={
        <>
          {received && (
            <Button variant="ghost" className="mr-auto text-red-700" icon={<Trash2 className="size-4" />} onClick={onDelete}>
              Borrar
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="received-form" disabled={isSubmitting}>
            Guardar
          </Button>
        </>
      }
    >
      <form id="received-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <FormGrid>
          <Field label="De parte de (invitado)">
            {(id) => (
              <Select id={id} {...register('guest_id')}>
                <option value="">— Otra persona —</option>
                {sortedGuests.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          {!guestId && (
            <Field label="Nombre" error={errors.from_name?.message}>
              {(id) => (
                <Input
                  id={id}
                  placeholder="Quien lo envió"
                  {...register('from_name', {
                    validate: (v, all) => !!all.guest_id || !!v.trim() || 'Elige un invitado o escribe el nombre',
                  })}
                />
              )}
            </Field>
          )}
        </FormGrid>
        <Field label="Regalo" error={errors.description?.message}>
          {(id) => (
            <Input
              id={id}
              placeholder="Ej: Juego de copas, aporte en efectivo…"
              {...register('description', { validate: (v) => !!v.trim() || 'Describe el regalo' })}
            />
          )}
        </Field>
        <FormGrid>
          <Field label="De la lista de regalos" hint="Opcional">
            {(id) => (
              <Select
                id={id}
                {...register('gift_id', {
                  onChange: (e) => {
                    const gift = gifts.data?.find((g) => g.id === e.target.value)
                    if (gift && !getValues('description').trim()) setValue('description', gift.name)
                  },
                })}
              >
                <option value="">—</option>
                {(gifts.data ?? []).map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Fecha">{(id) => <Input id={id} type="date" {...register('received_on', { required: true })} />}</Field>
          <Field label="Monto" hint="Si fue en efectivo o sobre (privado)">
            {(id) => (
              <Controller
                control={control}
                name="amount"
                render={({ field }) => (
                  <MoneyInput
                    id={id}
                    data-autofocus={defaults?.envelope || undefined}
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                  />
                )}
              />
            )}
          </Field>
        </FormGrid>
        <Field label="Notas">{(id) => <Textarea id={id} rows={2} {...register('notes')} />}</Field>
      </form>
    </Modal>
  )
}
