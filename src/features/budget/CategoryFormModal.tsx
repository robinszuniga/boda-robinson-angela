import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
import { categoriesApi } from '../../lib/api'
import { attempt } from '../../lib/attempt'
import { Button } from '../../components/ui/Button'
import { Field, Input } from '../../components/ui/Field'
import { MoneyInput } from '../../components/ui/MoneyInput'
import { Modal } from '../../components/ui/Modal'
import { cn } from '../../components/ui/cn'
import { useConfirm } from '../../components/ui/Confirm'
import type { BudgetCategory } from '../../types/database'

const SWATCHES = ['#7d8f69', '#c07a5a', '#6b7fa3', '#b5838d', '#9c8a4a', '#5f8f8b', '#8a7560', '#a36b8f', '#4f7a9a', '#8c8c84']

interface FormValues {
  name: string
  estimated: number | null
  color: string
}

export function CategoryFormModal({
  category,
  nextOrder,
  onClose,
}: {
  category?: BudgetCategory
  nextOrder: number
  onClose: () => void
}) {
  const create = categoriesApi.useCreate()
  const update = categoriesApi.useUpdate()
  const remove = categoriesApi.useRemove()
  const confirm = useConfirm()
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      name: category?.name ?? '',
      estimated: category?.estimated ?? null,
      color: category?.color ?? SWATCHES[nextOrder % SWATCHES.length],
    },
  })

  const onSubmit = async (v: FormValues) => {
    const values = { name: v.name.trim(), estimated: v.estimated ?? 0, color: v.color }
    const ok = await attempt(
      category
        ? update.mutateAsync({ id: category.id, values })
        : create.mutateAsync({ ...values, sort_order: nextOrder }),
    )
    if (!ok) return
    toast.success('Categoría guardada')
    onClose()
  }

  const onDelete = async () => {
    if (!category) return
    const ok = await confirm({
      title: `¿Borrar "${category.name}"?`,
      message: 'Los proveedores de esta categoría quedarán sin categoría. Si tiene pagos, primero hay que moverlos o borrarlos.',
      confirmLabel: 'Borrar',
      danger: true,
    })
    if (!ok) return
    if (await attempt(remove.mutateAsync(category.id))) onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={category ? 'Editar categoría' : 'Nueva categoría'}
      footer={
        <>
          {category && (
            <Button variant="ghost" className="mr-auto text-red-700" icon={<Trash2 className="size-4" />} onClick={onDelete}>
              Borrar
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="category-form" disabled={isSubmitting}>
            Guardar
          </Button>
        </>
      }
    >
      <form id="category-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <Field label="Nombre" error={errors.name?.message}>
          {(id) => <Input id={id} data-autofocus {...register('name', { required: 'Escribe un nombre', validate: (v) => !!v.trim() || 'Escribe un nombre' })} />}
        </Field>
        <Field label="Monto estimado" hint="Cuánto piensan gastar en esta categoría">
          {(id) => (
            <Controller
              control={control}
              name="estimated"
              render={({ field }) => <MoneyInput id={id} value={field.value} onChange={field.onChange} onBlur={field.onBlur} />}
            />
          )}
        </Field>
        <Controller
          control={control}
          name="color"
          render={({ field }) => (
            <fieldset>
              <legend className="mb-1.5 text-sm font-medium">Color</legend>
              <div className="flex flex-wrap gap-2">
                {SWATCHES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Color ${c}`}
                    aria-pressed={field.value === c}
                    onClick={() => field.onChange(c)}
                    className={cn('size-8 rounded-full ring-offset-2 transition', field.value === c && 'ring-2 ring-ink')}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </fieldset>
          )}
        />
      </form>
    </Modal>
  )
}
