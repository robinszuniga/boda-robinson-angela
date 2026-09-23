import { useState } from 'react'
import { toast } from 'sonner'
import {
  BellRing,
  Bus,
  Copy,
  ListPlus,
  MessageCircle,
  Music,
  Pencil,
  QrCode as QrIcon,
  Search,
  Send,
  Sparkles,
  SquareCheck,
  UserPlus,
  Users,
  UtensilsCrossed,
} from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { guestMembersApi, guestsApi, seatingTablesApi, useSettings } from '../../lib/api'
import { tableKey } from '../../lib/crud'
import { attemptLoud } from '../../lib/attempt'
import { headcount } from '../../lib/seating'
import { daysFromToday, plural } from '../../lib/format'
import { ageSummary, confirmedByAge, partyAges } from '../../lib/ages'
import { guestGroup, options, rsvpStatus } from '../../lib/labels'
import { Button, ButtonLink, IconButton } from '../../components/ui/Button'
import { EmptyState, ErrorState, LoadingState, PageHeader, ProgressBar, Stat } from '../../components/ui/Display'
import { Input, Select } from '../../components/ui/Field'
import { cn } from '../../components/ui/cn'
import type { Guest, GuestGroup, RsvpStatus } from '../../types/database'
import { GuestFormModal } from './GuestFormModal'
import { BulkGuestsModal } from './BulkGuestsModal'
import { copyRsvpLink, invitationWhatsapp } from './rsvpLinks'
import { RemindersModal } from './RemindersModal'
import { GuestQrModal } from './GuestQrModal'
import { CirclesModal } from './CirclesModal'
import { updateGuests } from '../../lib/guestBulk'

type AgeFilter = '' | 'nino' | 'mayor'
type SentFilter = '' | 'sin_enviar' | 'sin_responder'

const rsvpSelectTone: Record<RsvpStatus, string> = {
  pendiente: 'border-amber-200 bg-amber-50 text-amber-900',
  confirmado: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  rechazado: 'border-red-200 bg-red-50 text-red-900',
}

export default function GuestsPage() {
  const settings = useSettings()
  const guests = guestsApi.useList()
  const tables = seatingTablesApi.useList()
  const members = guestMembersApi.useList()
  const update = guestsApi.useUpdate()
  const [form, setForm] = useState<{ guest?: Guest } | null>(null)
  const [bulk, setBulk] = useState(false)
  const [reminders, setReminders] = useState(false)
  const [qrGuest, setQrGuest] = useState<Guest | null>(null)
  const [search, setSearch] = useState('')
  const [group, setGroup] = useState<GuestGroup | ''>('')
  const [status, setStatus] = useState<RsvpStatus | ''>('')
  const [age, setAge] = useState<AgeFilter>('')
  const [sent, setSent] = useState<SentFilter>('')
  const [circlesOpen, setCirclesOpen] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [circleInput, setCircleInput] = useState('')
  const [assigning, setAssigning] = useState(false)
  const qc = useQueryClient()

  const queries = [settings, guests, tables, members]
  const failed = queries.find((q) => q.isError)
  if (failed) return <ErrorState error={failed.error} onRetry={() => queries.forEach((q) => q.refetch())} />
  if (queries.some((q) => q.isPending)) return <LoadingState />

  const all = guests.data ?? []
  const people = headcount(all)
  const capacity = settings.data?.venue_capacity ?? 0
  const tableNumber = new Map((tables.data ?? []).map((t) => [t.id, t.number]))
  const attendingIds = new Set(all.filter((g) => g.rsvp_status !== 'rechazado').map((g) => g.id))
  const membersOf = (id: string) => (members.data ?? []).filter((m) => m.guest_id === id)
  const agesOf = new Map(all.map((g) => [g.id, partyAges(g, members.data ?? [])]))
  const confirmedAges = ageSummary(confirmedByAge(all, members.data ?? []))
  // Personas con restricción: invitados + acompañantes con nombre que no dijeron que no van
  const dietaryCount =
    all.filter((g) => g.dietary && attendingIds.has(g.id)).length +
    (members.data ?? []).filter((m) => m.dietary && m.attending !== false && attendingIds.has(m.guest_id)).length
  const pending = all.filter((g) => g.rsvp_status === 'pendiente')
  const term = search.trim().toLowerCase()
  const filtered = all.filter(
    (g) =>
      (!group || g.guest_group === group) &&
      (!status || g.rsvp_status === status) &&
      (!age || (agesOf.get(g.id)?.[age] ?? 0) > 0) &&
      (!sent ||
        (sent === 'sin_enviar' ? !g.invitation_sent_at : g.invitation_sent_at && g.rsvp_status === 'pendiente')) &&
      (!term || `${g.name} ${g.phone ?? ''} ${g.notes ?? ''} ${g.circle ?? ''}`.toLowerCase().includes(term)),
  )

  const circles = [...new Set(all.map((g) => g.circle?.trim()).filter(Boolean) as string[])].sort((a, b) =>
    a.localeCompare(b, 'es'),
  )
  const toggleSelected = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const assignCircle = async (value: string | null) => {
    setAssigning(true)
    const ok = await attemptLoud(updateGuests([...selected], { circle: value }))
    setAssigning(false)
    await qc.invalidateQueries({ queryKey: tableKey('guests') })
    if (!ok) return
    toast.success(
      value
        ? `${plural(selected.size, 'invitado quedó', 'invitados quedaron')} en "${value}"`
        : `${plural(selected.size, 'invitado se quedó', 'invitados se quedaron')} sin círculo`,
    )
    setSelected(new Set())
    setCircleInput('')
  }

  const changeStatus = (g: Guest, next: RsvpStatus) =>
    update.mutate({
      id: g.id,
      values: {
        rsvp_status: next,
        plus_ones_confirmed: next === 'confirmado' ? g.plus_ones_allowed : 0,
        rsvp_responded_at: next === 'pendiente' ? null : new Date().toISOString(),
      },
    })

  return (
    <>
      <PageHeader
        title="Invitados y RSVP"
        description="Cada invitado tiene su link para confirmar sin iniciar sesión"
        actions={
          <>
            {pending.length > 0 && (
              <Button variant="secondary" icon={<BellRing className="size-4" />} onClick={() => setReminders(true)}>
                Recordar ({pending.length})
              </Button>
            )}
            <ButtonLink to="/invitados/enviar" variant="secondary" icon={<Send className="size-4" />}>
              Enviar invitaciones
            </ButtonLink>
            <ButtonLink to="/invitados/qr" variant="secondary" icon={<QrIcon className="size-4" />}>
              Códigos QR
            </ButtonLink>
            <Button variant="secondary" icon={<Sparkles className="size-4" />} onClick={() => setCirclesOpen(true)}>
              Círculos
            </Button>
            <Button variant="secondary" icon={<ListPlus className="size-4" />} onClick={() => setBulk(true)}>
              Agregar varios
            </Button>
            <Button icon={<UserPlus className="size-4" />} onClick={() => setForm({})}>
              Invitado
            </Button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          icon={<Users className="size-4" />}
          label="Personas invitadas"
          value={people.invitedPeople}
          sub={`${plural(people.invitations, 'invitación', 'invitaciones')} + ${plural(people.invitedCompanions, 'acompañante', 'acompañantes')}`}
        />
        {/* En celular va debajo, a lo ancho; en pantalla grande, en el medio */}
        <div className="order-last col-span-2 rounded-2xl border border-line bg-white p-4 shadow-xs lg:order-none">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted">Personas confirmadas</span>
            <span className="text-2xl font-semibold tabular-nums">
              {people.confirmedPeople}
              {capacity > 0 && <span className="text-base font-normal text-muted"> / {capacity}</span>}
            </span>
          </div>
          <ProgressBar
            className="mt-2"
            value={people.confirmedPeople}
            max={capacity || people.expectedPeople || 1}
            tone={capacity > 0 && people.confirmedPeople > capacity ? 'red' : 'brand'}
            label="Confirmados vs capacidad"
          />
          <p className="mt-2 text-xs text-muted">
            Invitaciones: {people.confirmedGuests} sí · {plural(people.pendingGuests, 'pendiente', 'pendientes')} ·{' '}
            {people.declinedGuests} no
          </p>
          <p className="mt-0.5 text-xs text-muted">
            {confirmedAges && <>Entre los confirmados: {confirmedAges}. </>}
            Si todos los pendientes vienen: {people.expectedPeople} personas
            {capacity > 0 && people.expectedPeople > capacity && (
              <span className="font-medium text-red-700"> · supera la capacidad del lugar</span>
            )}
          </p>
        </div>
        <Stat icon={<UtensilsCrossed className="size-4" />} label="Con restricción alimentaria" value={dietaryCount} />
      </div>

      <div className="mb-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-[1fr_10.5rem_10.5rem_11rem_12rem]">
        <div className="relative sm:col-span-2 xl:col-span-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          <Input aria-label="Buscar invitado" placeholder="Buscar…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select aria-label="Filtrar por grupo" value={group} onChange={(e) => setGroup(e.target.value as GuestGroup | '')}>
          <option value="">Todos los grupos</option>
          {options(guestGroup).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <Select aria-label="Filtrar por confirmación" value={status} onChange={(e) => setStatus(e.target.value as RsvpStatus | '')}>
          <option value="">Toda confirmación</option>
          {options(rsvpStatus).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <Select aria-label="Filtrar por edad" value={age} onChange={(e) => setAge(e.target.value as AgeFilter)}>
          <option value="">Todas las edades</option>
          <option value="nino">Con niños</option>
          <option value="mayor">Con adultos mayores</option>
        </Select>
        <Select aria-label="Filtrar por invitación" value={sent} onChange={(e) => setSent(e.target.value as SentFilter)}>
          <option value="">Toda invitación</option>
          <option value="sin_enviar">Sin enviar</option>
          <option value="sin_responder">Enviada, sin responder</option>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Users className="size-8" />}
          title={all.length === 0 ? 'La lista está vacía' : 'Nadie coincide con el filtro'}
          action={all.length === 0 && <Button onClick={() => setBulk(true)}>Agregar varios de una vez</Button>}
        >
          {all.length === 0 && 'Puedes pegar una lista de nombres, uno por línea.'}
        </EmptyState>
      ) : (
        <>
          <p className="mb-2 text-xs text-muted">
            {filtered.length} de {all.length} invitaciones
          </p>
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white shadow-xs">
            {filtered.map((g) => {
              const companions =
                g.rsvp_status === 'confirmado' ? g.plus_ones_confirmed : g.plus_ones_allowed
              const ages = ageSummary(agesOf.get(g.id)!)
              const waiting =
                g.invitation_sent_at && g.rsvp_status === 'pendiente' ? -daysFromToday(g.invitation_sent_at) : null
              return (
                <li key={g.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                  <input
                    type="checkbox"
                    aria-label={`Seleccionar a ${g.name}`}
                    className="size-4 accent-brand-600"
                    checked={selected.has(g.id)}
                    onChange={() => toggleSelected(g.id)}
                  />
                  <button type="button" onClick={() => setForm({ guest: g })} className="min-w-[10rem] flex-1 text-left">
                    <p className="font-medium hover:underline">
                      {g.name}
                      {companions > 0 && <span className="ml-1.5 text-sm font-normal text-muted">+{companions}</span>}
                    </p>
                    <p className="text-xs text-muted">
                      {guestGroup[g.guest_group]}
                      {membersOf(g.id).length > 0 &&
                        ` · con ${membersOf(g.id)
                          .map((m) => (m.attending === false ? `${m.name} (no va)` : m.name))
                          .join(', ')}`}
                      {g.circle && ` · ${g.circle}`}
                      {ages && ` · ${ages}`}
                      {waiting != null &&
                        ` · invitada ${waiting === 0 ? 'hoy' : waiting === 1 ? 'ayer' : `hace ${waiting} días`}`}
                      {g.table_id && tableNumber.has(g.table_id) && ` · Mesa ${tableNumber.get(g.table_id)}`}
                      {g.dietary && ` · ${g.dietary}`}
                      {g.song_request && <Music className="ml-1.5 inline size-3 -translate-y-px" aria-label={`Pidió: ${g.song_request}`} />}
                      {g.needs_transport && <Bus className="ml-1.5 inline size-3 -translate-y-px" aria-label="Necesita transporte" />}
                    </p>
                  </button>
                  <select
                    aria-label={`Confirmación de ${g.name}`}
                    value={g.rsvp_status}
                    onChange={(e) => changeStatus(g, e.target.value as RsvpStatus)}
                    className={cn('h-8 rounded-full border px-3 text-xs font-medium', rsvpSelectTone[g.rsvp_status])}
                  >
                    {options(rsvpStatus).map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <div className="flex items-center">
                    <IconButton label={`Copiar link de ${g.name}`} onClick={() => copyRsvpLink(g.rsvp_token)}>
                      <Copy className="size-4" />
                    </IconButton>
                    <a
                      href={invitationWhatsapp(g, settings.data)}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Enviar invitación a ${g.name} por WhatsApp`}
                      title={g.phone ? 'Enviar por WhatsApp' : 'Enviar por WhatsApp (elige el contacto)'}
                      className="inline-flex size-8 items-center justify-center rounded-lg text-muted hover:bg-black/5 hover:text-emerald-700"
                    >
                      <MessageCircle className="size-4" />
                    </a>
                    <IconButton label={`QR de ${g.name}`} onClick={() => setQrGuest(g)}>
                      <QrIcon className="size-4" />
                    </IconButton>
                    <IconButton label={`Editar ${g.name}`} onClick={() => setForm({ guest: g })}>
                      <Pencil className="size-4" />
                    </IconButton>
                  </div>
                </li>
              )
            })}
          </ul>
          {selected.size > 0 && (
            <div className="sticky bottom-3 z-10 mt-3 flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-white p-3 shadow-lg">
              <span className="text-sm font-medium">
                <SquareCheck className="-mt-0.5 mr-1 inline size-4 text-brand-600" />
                {plural(selected.size, 'seleccionado', 'seleccionados')}
              </span>
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set(filtered.map((g) => g.id)))}>
                Marcar los {filtered.length} de la lista
              </Button>
              <Input
                aria-label="Círculo para los seleccionados"
                list="circulos-existentes"
                className="h-9 w-52"
                placeholder="Círculo: primos, universidad…"
                maxLength={60}
                value={circleInput}
                onChange={(e) => setCircleInput(e.target.value)}
              />
              <datalist id="circulos-existentes">
                {circles.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
              <Button size="sm" disabled={!circleInput.trim() || assigning} onClick={() => assignCircle(circleInput.trim())}>
                Asignar círculo
              </Button>
              <Button size="sm" variant="ghost" disabled={assigning} onClick={() => assignCircle(null)}>
                Quitar círculo
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                Cancelar
              </Button>
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="secondary" icon={<ListPlus className="size-4" />} onClick={() => setBulk(true)}>
              Agregar varios
            </Button>
            <Button variant="secondary" icon={<UserPlus className="size-4" />} onClick={() => setForm({})}>
              Invitado
            </Button>
          </div>
        </>
      )}

      {form && <GuestFormModal {...form} onClose={() => setForm(null)} />}
      {bulk && <BulkGuestsModal onClose={() => setBulk(false)} />}
      {reminders && <RemindersModal pending={pending} settings={settings.data} onClose={() => setReminders(false)} />}
      {qrGuest && <GuestQrModal guest={qrGuest} onClose={() => setQrGuest(null)} />}
      {circlesOpen && <CirclesModal guests={all} onClose={() => setCirclesOpen(false)} />}
    </>
  )
}
