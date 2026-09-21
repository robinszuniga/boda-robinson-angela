import { Controller, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
import { giftsApi } from '../../lib/api'
import { attempt } from '../../lib/attempt'
import { Button } from '../../components/ui/Button'
import { Field, FormGrid, Input, Textarea } from '../../components/ui/Field'
import { MoneyInput } from '../../components/ui/MoneyInput'
import { Modal } from '../../components/ui/Modal'
import { Segmented } from '../../components/ui/Display'
import { useConfirm } from '../../components/ui/Confirm'
import type { Gift, GiftKind } from '../../types/database'

interface FormValues {
  kind: GiftKind
  name: string
  description: string
  price: number | null
  store_url: string
  bank_details: string
  quantity: number
}

export function GiftFormModal({ gift, nextOrder, onClose }: { gift?: Gift; nextOrder: number; onClose: () => void }) {
  const create = giftsApi.useCreate()
  const update = giftsApi.useUpdate()
  const remove = giftsApi.useRemove()
  const confirm = useConfirm()
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      kind: gift?.kind ?? 'articulo',
      name: gift?.name ?? '',
      description: gift?.description ?? '',
      price: gift?.price ?? null,
      store_url: gift?.store_url ?? '',
      bank_details: gift?.bank_details ?? '',
      quantity: gift?.quantity ?? 1,
    },
  })
  const kind = useWatch({ control, name: 'kind' })

  const onSubmit = async (v: FormValues) => {
    const values = {
      kind: v.kind,
      name: v.name.trim(),
      description: v.description.trim() || null,
      price: v.price,
      store_url: v.kind === 'articulo' ? v.store_url.trim() || null : null,
      bank_details: v.kind === 'efectivo' ? v.bank_details.trim() || null : null,
      quantity: v.kind === 'articulo' ? v.quantity : 1,
    }
    const ok = await attempt(
      gift ? update.mutateAsync({ id: gift.id, values }) : create.mutateAsync({ ...values, sort_order: nextOrder }),
    )
    if (!ok) return
    toast.success(gift ? 'Regalo actualizado' : 'Regalo agregado a la lista')
    onClose()
  }

  const onDelete = async () => {
    if (!gift) return
    const ok = await confirm({
      title: `¿Quitar "${gift.name}" de la lista?`,
      message: 'Si alguien ya lo apartó, esa reserva también se borra.',
      confirmLabel: 'Quitar',
      danger: true,
    })
    if (ok && (await attempt(remove.mutateAsync(gift.id)))) onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={gift ? 'Editar regalo' : 'Nuevo regalo'}
      footer={
        <>
          {gift && (
            <Button variant="ghost" className="mr-auto text-red-700" icon={<Trash2 className="size-4" />} onClick={onDelete}>
              Quitar
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="gift-form" disabled={isSubmitting}>
            Guardar
          </Button>
        </>
      }
    >
      <form id="gift-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <Controller
          control={control}
          name="kind"
          render={({ field }) => (
            <Segmented
              label="Tipo de regalo"
              value={field.value}
              onChange={field.onChange}
              options={[
                { value: 'articulo', label: 'Artículo' },
                { value: 'efectivo', label: 'Aporte en efectivo' },
              ]}
            />
          )}
        />
        <Field label="Nombre" error={errors.name?.message}>
          {(id) => (
            <Input
              id={id}
              placeholder={kind === 'efectivo' ? 'Ej: Fondo para la luna de miel' : 'Ej: Juego de ollas'}
              {...register('name', { validate: (v) => !!v.trim() || 'Escribe el nombre' })}
            />
          )}
        </Field>
        <Field label="Descripción">{(id) => <Textarea id={id} rows={2} {...register('description')} />}</Field>
        <FormGrid>
          <Field label={kind === 'efectivo' ? 'Meta (opcional)' : 'Precio aproximado'}>
            {(id) => (
              <Controller
                control={control}
                name="price"
                render={({ field }) => <MoneyInput id={id} value={field.value} onChange={field.onChange} onBlur={field.onBlur} />}
              />
            )}
          </Field>
          {kind === 'articulo' && (
            <Field label="Cantidad" hint="Cuántas personas lo pueden apartar" error={errors.quantity?.message}>
              {(id) => (
                <Input
                  id={id}
                  type="number"
                  min={1}
                  max={99}
                  {...register('quantity', {
                    valueAsNumber: true,
                    validate: (n) => (Number.isInteger(n) && n >= 1 && n <= 99) || 'Entre 1 y 99',
                  })}
                />
              )}
            </Field>
          )}
        </FormGrid>
        {kind === 'articulo' ? (
          <Field label="Link de la tienda">{(id) => <Input id={id} placeholder="https://…" {...register('store_url')} />}</Field>
        ) : (
          <Field label="Datos para el aporte" hint="Se muestran a los invitados en su página de confirmación">
            {(id) => <Textarea id={id} placeholder={'Bancolombia ahorros 000-000000-00\nA nombre de …\nNequi 300 …'} {...register('bank_details')} />}
          </Field>
        )}
      </form>
    </Modal>
  )
}
