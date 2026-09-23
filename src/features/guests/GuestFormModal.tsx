import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { Bus, Copy, MessageSquareQuote, Music, Plus, Trash2, X } from 'lucide-react'
import { guestMembersApi, guestsApi, seatingTablesApi } from '../../lib/api'
import { attempt } from '../../lib/attempt'
import { formatDate } from '../../lib/format'
import { ageGroup, guestGroup, options, rsvpStatus } from '../../lib/labels'
import { Button, IconButton } from '../../components/ui/Button'
import { Field, FormGrid, Input, Select, Textarea } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { cn } from '../../components/ui/cn'
import { useConfirm } from '../../components/ui/Confirm'
import type { AgeGroup, Guest, GuestGroup, GuestMember, RsvpStatus } from '../../types/database'
import { copyRsvpLink, rsvpUrl } from './rsvpLinks'

interface FormValues {
  name: string
  guest_group: GuestGroup
  age_group: AgeGroup
  circle: string
  phone: string
  email: string
  plus_ones_allowed: number
  plus_ones_confirmed: number
  rsvp_status: RsvpStatus
  dietary: string
  table_id: string
  notes: string
}

interface DraftMember {
  key: string
  id?: string
  name: string
  attending: boolean | null
  dietary: string
  age_group: AgeGroup
  /** Mesa propia; vacío = se sienta con su invitación */
  table_id: string
}

let draftSeq = 0
const draftKey = () => `nuevo-${++draftSeq}`

export function GuestFormModal({ guest, onClose }: { guest?: Guest; onClose: () => void }) {
  const tables = seatingTablesApi.useList()
  const allGuests = guestsApi.useList()
  const allMembers = guestMembersApi.useList()
  const create = guestsApi.useCreate()
  const update = guestsApi.useUpdate()
  const remove = guestsApi.useRemove()
  const createMember = guestMembersApi.useCreate()
  const updateMember = guestMembersApi.useUpdate()
  const removeMember = guestMembersApi.useRemove()
  const confirm = useConfirm()
  const circles = [
    ...new Set((allGuests.data ?? []).map((g) => g.circle?.trim()).filter(Boolean) as string[]),
  ].sort((a, b) => a.localeCompare(b, 'es'))

  const existing: GuestMember[] = guest ? (allMembers.data ?? []).filter((m) => m.guest_id === guest.id) : []
  // Los acompañantes se editan en borrador y se guardan junto con el invitado
  const [drafts, setDrafts] = useState<DraftMember[] | null>(null)
  const members: DraftMember[] =
    drafts ??
    existing.map((m) => ({
      key: m.id,
      id: m.id,
      name: m.name,
      attending: m.attending,
      dietary: m.dietary ?? '',
      age_group: m.age_group,
      table_id: m.table_id ?? '',
    }))
  const [newMember, setNewMember] = useState('')

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      name: guest?.name ?? '',
      guest_group: guest?.guest_group ?? 'amigos',
      age_group: guest?.age_group ?? 'adulto',
      circle: guest?.circle ?? '',
      phone: guest?.phone ?? '',
      email: guest?.email ?? '',
      plus_ones_allowed: guest?.plus_ones_allowed ?? 0,
      plus_ones_confirmed: guest?.plus_ones_confirmed ?? 0,
      rsvp_status: guest?.rsvp_status ?? 'pendiente',
      dietary: guest?.dietary ?? '',
      table_id: guest?.table_id ?? '',
      notes: guest?.notes ?? '',
    },
  })

  const status = useWatch({ control, name: 'rsvp_status' })
  const allowed = useWatch({ control, name: 'plus_ones_allowed' })
  const hasMembers = members.length > 0

  const editMembers = (next: DraftMember[]) => setDrafts(next)
  const addMember = () => {
    const name = newMember.trim()
    if (!name) return
    editMembers([
      ...members,
      { key: draftKey(), name, attending: status === 'confirmado' ? true : null, dietary: '', age_group: 'adulto', table_id: '' },
    ])
    setNewMember('')
  }

  const onSubmit = async (v: FormValues) => {
    const clean = members.map((m) => ({ ...m, name: m.name.trim() })).filter((m) => m.name)
    const allowedN = clean.length > 0 ? clean.length : Number.isFinite(v.plus_ones_allowed) ? v.plus_ones_allowed : 0
    const attendingOf = (m: DraftMember) =>
      v.rsvp_status === 'confirmado' ? m.attending !== false : v.rsvp_status === 'rechazado' ? false : m.attending
    const confirmedN =
      v.rsvp_status !== 'confirmado'
        ? 0
        : clean.length > 0
          ? clean.filter((m) => attendingOf(m)).length
          : Math.min(Number.isFinite(v.plus_ones_confirmed) ? v.plus_ones_confirmed : 0, allowedN)

    const values = {
      name: v.name.trim(),
      guest_group: v.guest_group,
      age_group: v.age_group,
      circle: v.circle.trim() || null,
      phone: v.phone.trim() || null,
      email: v.email.trim() || null,
      plus_ones_allowed: allowedN,
      plus_ones_confirmed: confirmedN,
      rsvp_status: v.rsvp_status,
      rsvp_responded_at:
        v.rsvp_status !== guest?.rsvp_status && v.rsvp_status !== 'pendiente'
          ? new Date().toISOString()
          : (guest?.rsvp_responded_at ?? null),
      dietary: v.dietary.trim() || null,
      table_id: v.table_id || null,
      notes: v.notes.trim() || null,
    }

    let guestId = guest?.id
    const saved = await attempt(
      guest
        ? update.mutateAsync({ id: guest.id, values })
        : create.mutateAsync(values).then((rows) => {
            guestId = rows[0]?.id
          }),
    )
    if (!saved || !guestId) return

    if (drafts) {
      const keep = new Set(clean.filter((m) => m.id).map((m) => m.id))
      const ops: Promise<unknown>[] = []
      for (const m of existing) if (!keep.has(m.id)) ops.push(removeMember.mutateAsync(m.id))
      clean.forEach((m, i) => {
        const row = {
          name: m.name,
          attending: attendingOf(m),
          dietary: m.dietary.trim() || null,
          age_group: m.age_group,
          table_id: m.table_id || null,
          sort_order: i,
        }
        ops.push(m.id ? updateMember.mutateAsync({ id: m.id, values: row }) : createMember.mutateAsync({ ...row, guest_id: guestId! }))
      })
      if (!(await attempt(Promise.all(ops)))) return
    }

    toast.success(guest ? 'Invitado actualizado' : 'Invitado agregado')
    onClose()
  }

  const onDelete = async () => {
    if (!guest) return
    const ok = await confirm({
      title: `¿Borrar a ${guest.name}?`,
      message: 'Se borran también sus acompañantes, vínculos de mesa y los regalos que haya apartado.',
      confirmLabel: 'Borrar',
      danger: true,
    })
    if (ok && (await attempt(remove.mutateAsync(guest.id)))) onClose()
  }

  const numberRules = (max: number) => ({
    valueAsNumber: true,
    validate: (n: number) => (Number.isInteger(n) && n >= 0 && n <= max) || `Entre 0 y ${max}`,
  })

  return (
    <Modal
      open
      size="lg"
      onClose={onClose}
      title={guest ? guest.name : 'Nuevo invitado'}
      footer={
        <>
          {guest && (
            <Button variant="ghost" className="mr-auto text-red-700" icon={<Trash2 className="size-4" />} onClick={onDelete}>
              Borrar
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="guest-form" disabled={isSubmitting}>
            Guardar
          </Button>
        </>
      }
    >
      {guest?.guest_message && (
        <blockquote className="mb-4 flex gap-2 rounded-xl bg-accent-50 px-4 py-3 text-sm text-accent-700">
          <MessageSquareQuote className="size-4 shrink-0" />
          <span>
            “{guest.guest_message}”
            {guest.rsvp_responded_at && <span className="block text-xs opacity-75">Respondió el {formatDate(guest.rsvp_responded_at)}</span>}
          </span>
        </blockquote>
      )}
      {(guest?.song_request || guest?.needs_transport) && (
        <div className="mb-4 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted">
          {guest.song_request && (
            <span className="inline-flex items-center gap-1.5">
              <Music className="size-4" /> {guest.song_request}
            </span>
          )}
          {guest.needs_transport && (
            <span className="inline-flex items-center gap-1.5">
              <Bus className="size-4" /> Necesita transporte
            </span>
          )}
        </div>
      )}
      <form id="guest-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <FormGrid>
          <Field label="Nombre" error={errors.name?.message} className="sm:col-span-2">
            {(id) => (
              <Input
                id={id}
                data-autofocus={!guest || undefined}
                placeholder="Ej: Tía Marta o Carlos Pérez"
                aria-invalid={!!errors.name}
                {...register('name', { validate: (v) => !!v.trim() || 'Escribe el nombre' })}
              />
            )}
          </Field>
          <Field label="Grupo">
            {(id) => (
              <Select id={id} {...register('guest_group')}>
                {options(guestGroup).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Edad" hint="Para el catering y las mesas">
            {(id) => (
              <Select id={id} {...register('age_group')}>
                {options(ageGroup).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Círculo" hint="Para sentarlos juntos: primos, universidad, trabajo…">
            {(id) => (
              <>
                <Input id={id} list="circulos-ficha" maxLength={60} placeholder="Sin círculo" {...register('circle')} />
                <datalist id="circulos-ficha">
                  {circles.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </>
            )}
          </Field>
          <Field label="Confirmación (RSVP)">
            {(id) => (
              <Select id={id} {...register('rsvp_status')}>
                {options(rsvpStatus).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          {!hasMembers && (
            <Field
              label="Acompañantes permitidos"
              hint="Sin nombre. Para ponerles nombre, agrégalos abajo."
              error={errors.plus_ones_allowed?.message}
            >
              {(id) => <Input id={id} type="number" min={0} max={10} inputMode="numeric" {...register('plus_ones_allowed', numberRules(10))} />}
            </Field>
          )}
          {!hasMembers && status === 'confirmado' && (
            <Field label="Acompañantes confirmados" error={errors.plus_ones_confirmed?.message}>
              {(id) => (
                <Input
                  id={id}
                  type="number"
                  min={0}
                  max={allowed || 0}
                  inputMode="numeric"
                  {...register('plus_ones_confirmed', numberRules(Number.isFinite(allowed) ? allowed : 0))}
                />
              )}
            </Field>
          )}
        </FormGrid>

        <fieldset className="rounded-xl border border-line p-4">
          <legend className="px-1 text-sm font-medium">Acompañantes con nombre</legend>
          <p className="mb-3 text-xs text-muted">
            Opcional. Útil para familias: cada persona tiene su edad y su restricción alimentaria, y el invitado marca
            quiénes vienen. Si vienen niños, agrégalos aquí para que cuenten como niños. Cada uno puede sentarse en otra
            mesa si quieres.
          </p>
          {members.length > 0 && (
            <ul className="mb-3 flex flex-col gap-2">
              {members.map((m, i) => {
                const edit = (patch: Partial<DraftMember>) =>
                  editMembers(members.map((x, j) => (j === i ? { ...x, ...patch } : x)))
                return (
                  <li
                    key={m.key}
                    className={cn(
                      'grid items-center gap-2',
                      status === 'confirmado'
                        ? 'grid-cols-[auto_1fr_auto] sm:grid-cols-[auto_1fr_10rem_8rem_auto]'
                        : 'grid-cols-[1fr_auto] sm:grid-cols-[1fr_10rem_8rem_auto]',
                    )}
                  >
                    {status === 'confirmado' && (
                      <input
                        type="checkbox"
                        className="size-4 accent-brand-600"
                        aria-label={`${m.name} asiste`}
                        title="Asiste"
                        checked={m.attending !== false}
                        onChange={(e) => edit({ attending: e.target.checked })}
                      />
                    )}
                    <Input
                      aria-label={`Nombre del acompañante ${i + 1}`}
                      className="h-9"
                      value={m.name}
                      onChange={(e) => edit({ name: e.target.value })}
                    />
                    <IconButton
                      label={`Quitar a ${m.name}`}
                      className="sm:order-last"
                      onClick={() => editMembers(members.filter((_, j) => j !== i))}
                    >
                      <X className="size-4" />
                    </IconButton>
                    {/* En celular la edad y la dieta van en una segunda línea */}
                    <div className={cn('col-span-2 flex gap-2 sm:contents', status === 'confirmado' ? 'col-start-2' : 'col-start-1')}>
                      <Select
                        aria-label={`Edad de ${m.name}`}
                        className="h-9 flex-none basis-40"
                        value={m.age_group}
                        onChange={(e) => edit({ age_group: e.target.value as AgeGroup })}
                      >
                        {options(ageGroup).map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </Select>
                      <Input
                        aria-label={`Restricción alimentaria de ${m.name}`}
                        placeholder="Dieta"
                        className="h-9 min-w-0 flex-1"
                        value={m.dietary}
                        onChange={(e) => edit({ dietary: e.target.value })}
                      />
                      <Select
                        aria-label={`Mesa de ${m.name}`}
                        title="Puede sentarse en otra mesa"
                        className="h-9 flex-none basis-36"
                        value={m.table_id}
                        onChange={(e) => edit({ table_id: e.target.value })}
                      >
                        <option value="">Su misma mesa</option>
                        {(tables.data ?? []).map((t) => (
                          <option key={t.id} value={t.id}>
                            Mesa {t.number}
                            {t.name ? ` · ${t.name}` : ''}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
          <div className="flex gap-2">
            <Input
              aria-label="Nombre del nuevo acompañante"
              placeholder="Nombre del acompañante"
              className="h-9"
              value={newMember}
              onChange={(e) => setNewMember(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addMember()
                }
              }}
            />
            <Button size="sm" variant="secondary" icon={<Plus className="size-3.5" />} onClick={addMember} disabled={!newMember.trim()}>
              Agregar
            </Button>
          </div>
        </fieldset>

        <FormGrid>
          <Field label="Teléfono / WhatsApp">
            {(id) => <Input id={id} type="tel" inputMode="tel" placeholder="300 123 4567" {...register('phone')} />}
          </Field>
          <Field label="Correo">{(id) => <Input id={id} type="email" {...register('email')} />}</Field>
          <Field label="Mesa">
            {(id) => (
              <Select id={id} {...register('table_id')}>
                <option value="">— Sin mesa —</option>
                {(tables.data ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    Mesa {t.number}
                    {t.name ? ` · ${t.name}` : ''}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={hasMembers ? 'Restricción alimentaria (del invitado)' : 'Restricciones alimentarias'}>
            {(id) => <Input id={id} placeholder="Vegetariano, sin gluten, alergia…" {...register('dietary')} />}
          </Field>
        </FormGrid>
        <Field label="Notas">{(id) => <Textarea id={id} rows={2} {...register('notes')} />}</Field>
        {guest && (
          <div className="rounded-xl border border-line bg-ivory px-4 py-3">
            <p className="text-xs font-medium text-muted">Link de confirmación</p>
            <div className="mt-1 flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate text-xs">{rsvpUrl(guest.rsvp_token)}</code>
              <Button size="sm" variant="secondary" icon={<Copy className="size-3.5" />} onClick={() => copyRsvpLink(guest.rsvp_token)}>
                Copiar
              </Button>
            </div>
          </div>
        )}
      </form>
    </Modal>
  )
}
