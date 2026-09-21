import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
import { categoriesApi, paymentsApi, vendorsApi } from '../../lib/api'
import { todayISO } from '../../lib/format'
import { attempt } from '../../lib/attempt'
import { Button } from '../../components/ui/Button'
import { Field, FormGrid, Input, Select } from '../../components/ui/Field'
import { MoneyInput } from '../../components/ui/MoneyInput'
import { Modal } from '../../components/ui/Modal'
import { Segmented } from '../../components/ui/Display'
import { useConfirm } from '../../components/ui/Confirm'
import type { Payment } from '../../types/database'

interface Props {
  payment?: Payment
  defaults?: Partial<Pick<Payment, 'category_id' | 'vendor_id' | 'is_paid'>>
  onClose: () => void
}

interface FormValues {
  vendor_id: string
  category_id: string
  amount: number | null
  date: string
  status: 'pagado' | 'programado'
  note: string
}

export function PaymentFormModal({ payment, defaults, onClose }: Props) {
  const categories = categoriesApi.useList()
  const vendors = vendorsApi.useList()
  const create = paymentsApi.useCreate()
  const update = paymentsApi.useUpdate()
  const remove = paymentsApi.useRemove()
  const confirm = useConfirm()

  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      vendor_id: payment?.vendor_id ?? defaults?.vendor_id ?? '',
      category_id: payment?.category_id ?? defaults?.category_id ?? '',
      amount: payment?.amount ?? null,
      date: payment?.date ?? todayISO(),
      status: (payment?.is_paid ?? defaults?.is_paid ?? true) ? 'pagado' : 'programado',
      note: payment?.note ?? '',
    },
  })

  const vendorOptions = (vendors.data ?? []).filter((v) => v.status !== 'descartado' || v.id === payment?.vendor_id)

  const onSubmit = async (v: FormValues) => {
    const values = {
      vendor_id: v.vendor_id || null,
      category_id: v.category_id,
      amount: v.amount!,
      date: v.date,
      is_paid: v.status === 'pagado',
      note: v.note.trim() || null,
    }
    const ok = await attempt(
      payment ? update.mutateAsync({ id: payment.id, values }) : create.mutateAsync(values),
    )
    if (!ok) return
    toast.success(payment ? 'Pago actualizado' : 'Pago registrado')
    onClose()
  }

  const onDelete = async () => {
    if (!payment) return
    const ok = await confirm({ title: '¿Borrar este pago?', confirmLabel: 'Borrar', danger: true })
    if (!ok) return
    if (await attempt(remove.mutateAsync(payment.id))) onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={payment ? 'Editar pago' : 'Registrar pago'}
      description="Abonos hechos o pagos programados a futuro"
      footer={
        <>
          {payment && (
            <Button variant="ghost" className="mr-auto text-red-700" icon={<Trash2 className="size-4" />} onClick={onDelete}>
              Borrar
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="payment-form" disabled={isSubmitting}>
            Guardar
          </Button>
        </>
      }
    >
      <form id="payment-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <Controller
          control={control}
          name="status"
          render={({ field }) => (
            <Segmented
              label="Estado del pago"
              value={field.value}
              onChange={field.onChange}
              options={[
                { value: 'pagado', label: 'Ya pagado' },
                { value: 'programado', label: 'Programado' },
              ]}
            />
          )}
        />
        <FormGrid>
          <Field label="Proveedor" hint="Opcional">
            {(id) => (
              <Select
                id={id}
                {...register('vendor_id', {
                  onChange: (e) => {
                    const vendor = vendorOptions.find((x) => x.id === e.target.value)
                    if (vendor?.category_id) setValue('category_id', vendor.category_id)
                  },
                })}
              >
                <option value="">— Sin proveedor —</option>
                {vendorOptions.map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>
                    {vendor.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Categoría" error={errors.category_id?.message}>
            {(id) => (
              <Select id={id} aria-invalid={!!errors.category_id} {...register('category_id', { required: 'Elige una categoría' })}>
                <option value="">Elige…</option>
                {(categories.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Monto" error={errors.amount?.message}>
            {(id) => (
              <Controller
                control={control}
                name="amount"
                rules={{ validate: (v) => (v != null && v > 0) || 'Escribe el monto' }}
                render={({ field }) => (
                  <MoneyInput id={id} value={field.value} onChange={field.onChange} onBlur={field.onBlur} aria-invalid={!!errors.amount} />
                )}
              />
            )}
          </Field>
          <Field label="Fecha" error={errors.date?.message}>
            {(id) => <Input id={id} type="date" {...register('date', { required: 'Elige la fecha' })} />}
          </Field>
        </FormGrid>
        <Field label="Nota">
          {(id) => <Input id={id} placeholder="Ej: anticipo 50 %" {...register('note')} />}
        </Field>
      </form>
    </Modal>
  )
}
