import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { categoriesApi, vendorsApi } from '../../lib/api'
import { attempt } from '../../lib/attempt'
import { options, vendorStatus } from '../../lib/labels'
import { Button } from '../../components/ui/Button'
import { Field, FormGrid, Input, Select, Textarea } from '../../components/ui/Field'
import { MoneyInput } from '../../components/ui/MoneyInput'
import { Modal } from '../../components/ui/Modal'
import type { Vendor, VendorStatus } from '../../types/database'

type TextKey =
  | 'name'
  | 'contact_name'
  | 'phone'
  | 'email'
  | 'instagram'
  | 'website'
  | 'portfolio_url'
  | 'includes'
  | 'availability'
  | 'pros'
  | 'cons'
  | 'notes'

type FormValues = Record<TextKey, string> & {
  category_id: string
  status: VendorStatus
  quoted_cost: number | null
  final_cost: number | null
}

const TEXT_KEYS: TextKey[] = [
  'name',
  'contact_name',
  'phone',
  'email',
  'instagram',
  'website',
  'portfolio_url',
  'includes',
  'availability',
  'pros',
  'cons',
  'notes',
]

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="mb-3 font-sans text-xs font-semibold tracking-wider text-muted uppercase">{title}</legend>
      {children}
    </fieldset>
  )
}

export function VendorFormModal({
  vendor,
  defaults,
  onClose,
  onSaved,
}: {
  vendor?: Vendor
  defaults?: Partial<Pick<Vendor, 'category_id' | 'status'>>
  onClose: () => void
  onSaved?: (vendor: Vendor) => void
}) {
  const categories = categoriesApi.useList()
  const create = vendorsApi.useCreate()
  const update = vendorsApi.useUpdate()

  const initial = Object.fromEntries(TEXT_KEYS.map((k) => [k, vendor?.[k] ?? ''])) as Record<TextKey, string>
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      ...initial,
      category_id: vendor?.category_id ?? defaults?.category_id ?? '',
      status: vendor?.status ?? defaults?.status ?? 'cotizando',
      quoted_cost: vendor?.quoted_cost ?? null,
      final_cost: vendor?.final_cost ?? null,
    },
  })

  const onSubmit = async (v: FormValues) => {
    const text = Object.fromEntries(TEXT_KEYS.map((k) => [k, v[k].trim() || null])) as Record<TextKey, string | null>
    const values = {
      ...text,
      name: v.name.trim(),
      category_id: v.category_id || null,
      status: v.status,
      quoted_cost: v.quoted_cost,
      final_cost: v.final_cost,
    }
    let saved: Vendor | undefined
    const ok = await attempt(
      vendor
        ? update.mutateAsync({ id: vendor.id, values })
        : create.mutateAsync(values).then((rows) => {
            saved = rows[0]
          }),
    )
    if (!ok) return
    toast.success(vendor ? 'Proveedor actualizado' : 'Proveedor agregado')
    onSaved?.(saved ?? { ...vendor!, ...values })
    onClose()
  }

  const money = (name: 'quoted_cost' | 'final_cost', id: string) => (
    <Controller
      control={control}
      name={name}
      render={({ field }) => <MoneyInput id={id} value={field.value} onChange={field.onChange} onBlur={field.onBlur} />}
    />
  )

  return (
    <Modal
      open
      size="lg"
      onClose={onClose}
      title={vendor ? `Editar ${vendor.name}` : 'Nuevo proveedor'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="vendor-form" disabled={isSubmitting}>
            Guardar
          </Button>
        </>
      }
    >
      <form id="vendor-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6" noValidate>
        <Section title="Básico">
          <Field label="Nombre" error={errors.name?.message}>
            {(id) => (
              <Input
                id={id}
                data-autofocus
                aria-invalid={!!errors.name}
                placeholder="Ej: Estudio Luz Fotografía"
                {...register('name', { validate: (v) => !!v.trim() || 'Escribe el nombre' })}
              />
            )}
          </Field>
          <FormGrid>
            <Field label="Categoría">
              {(id) => (
                <Select id={id} {...register('category_id')}>
                  <option value="">— Sin categoría —</option>
                  {(categories.data ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Estado">
              {(id) => (
                <Select id={id} {...register('status')}>
                  {options(vendorStatus).map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </FormGrid>
        </Section>

        <Section title="Costos">
          <FormGrid>
            <Field label="Costo cotizado">{(id) => money('quoted_cost', id)}</Field>
            <Field label="Costo final" hint="El valor del contrato. Si está vacío se usa el cotizado.">
              {(id) => money('final_cost', id)}
            </Field>
          </FormGrid>
        </Section>

        <Section title="Contacto">
          <FormGrid>
            <Field label="Persona de contacto">{(id) => <Input id={id} {...register('contact_name')} />}</Field>
            <Field label="Teléfono / WhatsApp">
              {(id) => <Input id={id} type="tel" inputMode="tel" placeholder="300 123 4567" {...register('phone')} />}
            </Field>
            <Field label="Correo">{(id) => <Input id={id} type="email" {...register('email')} />}</Field>
            <Field label="Instagram">{(id) => <Input id={id} placeholder="@usuario" {...register('instagram')} />}</Field>
            <Field label="Sitio web">{(id) => <Input id={id} {...register('website')} />}</Field>
            <Field label="Portafolio">{(id) => <Input id={id} placeholder="Link a fotos, videos…" {...register('portfolio_url')} />}</Field>
          </FormGrid>
        </Section>

        <Section title="Para comparar">
          <Field label="Qué incluye">{(id) => <Textarea id={id} placeholder="Horas de cobertura, álbum, drone…" {...register('includes')} />}</Field>
          <Field label="Disponibilidad">{(id) => <Input id={id} placeholder="Ej: tiene libre el 15 de mayo" {...register('availability')} />}</Field>
          <FormGrid>
            <Field label="Pros">{(id) => <Textarea id={id} {...register('pros')} />}</Field>
            <Field label="Contras">{(id) => <Textarea id={id} {...register('cons')} />}</Field>
          </FormGrid>
        </Section>

        <Field label="Notas">{(id) => <Textarea id={id} {...register('notes')} />}</Field>
      </form>
    </Modal>
  )
}
