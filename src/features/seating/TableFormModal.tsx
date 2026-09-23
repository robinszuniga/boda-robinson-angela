import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
import { seatingTablesApi } from '../../lib/api'
import { attempt } from '../../lib/attempt'
import { Button } from '../../components/ui/Button'
import { Checkbox, Field, FormGrid, Input } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { Segmented } from '../../components/ui/Display'
import { useConfirm } from '../../components/ui/Confirm'
import type { SeatingTable } from '../../types/database'

interface FormValues {
  number: number
  name: string
  capacity: number
  count: number
  locked: boolean
}

export function TableFormModal({
  table,
  nextNumber,
  onClose,
}: {
  table?: SeatingTable
  nextNumber: number
  onClose: () => void
}) {
  const create = seatingTablesApi.useCreate()
  const update = seatingTablesApi.useUpdate()
  const remove = seatingTablesApi.useRemove()
  const confirm = useConfirm()
  const [mode, setMode] = useState<'una' | 'varias'>('una')
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      number: table?.number ?? nextNumber,
      name: table?.name ?? '',
      capacity: table?.capacity ?? 10,
      count: 5,
      locked: table?.locked ?? false,
    },
  })

  const onSubmit = async (v: FormValues) => {
    let ok: boolean
    if (table) {
      ok = await attempt(
        update.mutateAsync({
          id: table.id,
          values: { number: v.number, name: v.name.trim() || null, capacity: v.capacity, locked: v.locked },
        }),
      )
    } else if (mode === 'varias') {
      const rows = Array.from({ length: v.count }, (_, i) => ({ number: v.number + i, capacity: v.capacity }))
      ok = await attempt(create.mutateAsync(rows))
    } else {
      ok = await attempt(
        create.mutateAsync({ number: v.number, name: v.name.trim() || null, capacity: v.capacity, locked: v.locked }),
      )
    }
    if (!ok) return
    toast.success(table ? 'Mesa actualizada' : mode === 'varias' ? `${v.count} mesas creadas` : 'Mesa creada')
    onClose()
  }

  const onDelete = async () => {
    if (!table) return
    const ok = await confirm({
      title: `¿Borrar la mesa ${table.number}?`,
      message: 'Los invitados sentados ahí quedan sin mesa.',
      confirmLabel: 'Borrar',
      danger: true,
    })
    if (ok && (await attempt(remove.mutateAsync(table.id)))) onClose()
  }

  const intRules = (min: number, max: number, label: string) => ({
    valueAsNumber: true,
    validate: (n: number) => (Number.isInteger(n) && n >= min && n <= max) || `${label}: entre ${min} y ${max}`,
  })

  return (
    <Modal
      open
      onClose={onClose}
      title={table ? `Mesa ${table.number}` : 'Nueva mesa'}
      footer={
        <>
          {table && (
            <Button variant="ghost" className="mr-auto text-red-700" icon={<Trash2 className="size-4" />} onClick={onDelete}>
              Borrar
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="table-form" disabled={isSubmitting}>
            Guardar
          </Button>
        </>
      }
    >
      <form id="table-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        {!table && (
          <Segmented
            label="Cuántas mesas"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'una', label: 'Una mesa' },
              { value: 'varias', label: 'Varias iguales' },
            ]}
          />
        )}
        <FormGrid>
          <Field label={mode === 'varias' ? 'Desde el número' : 'Número'} error={errors.number?.message}>
            {(id) => <Input id={id} type="number" min={1} inputMode="numeric" {...register('number', intRules(1, 999, 'Número'))} />}
          </Field>
          <Field label="Puestos por mesa" error={errors.capacity?.message}>
            {(id) => <Input id={id} type="number" min={1} max={50} inputMode="numeric" {...register('capacity', intRules(1, 50, 'Puestos'))} />}
          </Field>
          {mode === 'varias' && !table ? (
            <Field label="Cantidad de mesas" error={errors.count?.message}>
              {(id) => <Input id={id} type="number" min={1} max={60} inputMode="numeric" {...register('count', intRules(1, 60, 'Cantidad'))} />}
            </Field>
          ) : (
            <Field label="Nombre" hint="Opcional, ej: Mesa de honor">
              {(id) => <Input id={id} {...register('name')} />}
            </Field>
          )}
        </FormGrid>
        {mode === 'una' && (
          <Checkbox
            label="Fijar esta mesa: el reparto automático no la toca"
            {...register('locked')}
          />
        )}
      </form>
    </Modal>
  )
}
