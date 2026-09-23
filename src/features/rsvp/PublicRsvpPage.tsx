import { useState } from 'react'
import { useParams } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Armchair,
  Banknote,
  BedDouble,
  CalendarDays,
  Camera,
  Car,
  Check,
  CircleHelp,
  Copy,
  ExternalLink,
  Gift,
  HandCoins,
  Heart,
  MapPin,
  PartyPopper,
  Shirt,
  Video,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { safeUrl } from '../../lib/contact'
import { formatCOP, formatDate, formatWeddingDate, todayISO } from '../../lib/format'
import { describeError } from '../../lib/errors'
import { getCountdown } from '../../lib/countdown'
import { Button } from '../../components/ui/Button'
import { ErrorState, LoadingState } from '../../components/ui/Display'
import { Field, Input, Select, Textarea } from '../../components/ui/Field'
import { cn } from '../../components/ui/cn'
import type { RsvpGiftView, RsvpView } from '../../types/database'

function useRsvp(token: string) {
  return useQuery({
    queryKey: ['rsvp', token],
    retry: 1,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('rsvp_get', { p_token: token })
      if (error) throw error
      return data
    },
  })
}

export default function PublicRsvpPage() {
  const { token = '' } = useParams()
  const rsvp = useRsvp(token)

  if (rsvp.isPending) {
    return (
      <Shell>
        <LoadingState label="Abriendo tu invitación…" />
      </Shell>
    )
  }
  if (rsvp.isError) {
    return (
      <Shell>
        <ErrorState error={rsvp.error} onRetry={() => rsvp.refetch()} />
      </Shell>
    )
  }
  if (!rsvp.data) {
    return (
      <Shell>
        <div className="rounded-3xl bg-white p-8 text-center shadow-sm">
          <Heart className="mx-auto size-8 text-accent-300" />
          <h1 className="mt-3 text-2xl font-semibold">No encontramos esta invitación</h1>
          <p className="mt-2 text-sm text-muted">Revisa que el enlace esté completo o pídeselo de nuevo a los novios.</p>
        </div>
      </Shell>
    )
  }

  return (
    <Shell>
      <Invitation data={rsvp.data} token={token} />
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-[radial-gradient(ellipse_at_top,var(--color-brand-100),transparent_55%),radial-gradient(ellipse_at_bottom,var(--color-accent-50),transparent_50%)] px-4 py-10">
      <main className="mx-auto flex max-w-xl flex-col gap-6">{children}</main>
    </div>
  )
}

function Invitation({ data, token }: { data: RsvpView; token: string }) {
  const { wedding, guest, gifts } = data
  const days = getCountdown(new Date(wedding.wedding_date)).days
  const deadlinePassed = !!wedding.rsvp_deadline && todayISO() > wedding.rsvp_deadline
  const mapUrl = wedding.venue_address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${wedding.venue_name ?? ''} ${wedding.venue_address}`)}`
    : null

  return (
    <>
      <header className="rounded-3xl border border-white bg-white/80 px-6 py-10 text-center shadow-sm backdrop-blur">
        <p className="text-xs tracking-[0.3em] text-brand-600 uppercase">Nos casamos</p>
        <h1 className="mt-3 text-4xl leading-tight font-semibold sm:text-5xl">
          {wedding.partner_1_name}
          <span className="block text-3xl text-accent-400 italic sm:text-4xl">&amp;</span>
          {wedding.partner_2_name}
        </h1>
        <div className="mx-auto mt-6 flex max-w-sm flex-col items-center gap-2 text-sm">
          <p>
            <CalendarDays className="mr-1.5 inline size-4 -translate-y-px text-brand-500" />
            {formatWeddingDate(wedding.wedding_date)}
          </p>
          {wedding.venue_name && (
            <p>
              <MapPin className="mr-1.5 inline size-4 -translate-y-px text-brand-500" />
              {mapUrl ? (
                <a href={mapUrl} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">
                  {wedding.venue_name}
                  {wedding.venue_address && `, ${wedding.venue_address}`}
                </a>
              ) : (
                wedding.venue_name
              )}
            </p>
          )}
          {days > 0 && <p className="text-xs text-muted">Faltan {days} días</p>}
        </div>
        {wedding.guest_message && (
          <p className="mx-auto mt-6 max-w-md font-display text-lg leading-relaxed text-ink/80 italic">“{wedding.guest_message}”</p>
        )}
      </header>

      {guest.rsvp_status === 'confirmado' && guest.table && (
        <section className="rounded-3xl border-2 border-brand-200 bg-brand-50 p-6 text-center shadow-sm">
          <Armchair className="mx-auto size-7 text-brand-600" />
          <p className="mt-2 text-sm text-brand-800">Tu mesa</p>
          <p className="font-display text-5xl font-semibold text-brand-800">{guest.table.number}</p>
          {guest.table.name && <p className="mt-1 text-sm text-brand-700">{guest.table.name}</p>}
        </section>
      )}

      <RsvpForm guest={guest} wedding={wedding} token={token} deadlinePassed={deadlinePassed} />

      <GuestInfo wedding={wedding} declined={guest.rsvp_status === 'rechazado'} />

      {(gifts.length > 0 || wedding.envelope_rain) && (
        <GiftList gifts={gifts} token={token} envelopeRain={wedding.envelope_rain} />
      )}

      <footer className="pb-6 text-center text-xs text-muted">
        Con cariño, {wedding.partner_1_name} y {wedding.partner_2_name}
      </footer>
    </>
  )
}

function InfoBlock({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 shrink-0 text-brand-500">{icon}</div>
      <div className="min-w-0">
        <h3 className="font-sans text-sm font-semibold">{title}</h3>
        <div className="mt-0.5 text-sm whitespace-pre-line text-ink/80">{children}</div>
      </div>
    </div>
  )
}

/** Código de vestimenta, cómo llegar, hospedaje, preguntas frecuentes, transmisión y álbum de fotos */
function GuestInfo({ wedding, declined }: { wedding: RsvpView['wedding']; declined: boolean }) {
  const livestream = safeUrl(wedding.livestream_url)
  const album = safeUrl(wedding.photo_album_url)
  const hasInfo = wedding.dress_code || wedding.logistics_info || wedding.lodging_info || wedding.faq
  if (!hasInfo && !livestream && !album) return null

  return (
    <section className="flex flex-col gap-5 rounded-3xl bg-white p-6 shadow-sm">
      {declined && livestream && (
        <a
          href={livestream}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-3 rounded-2xl bg-accent-50 px-4 py-3 text-sm text-accent-700 hover:bg-accent-100"
        >
          <Video className="size-5 shrink-0" /> Aunque no puedas venir, puedes vernos en vivo aquí.
        </a>
      )}
      {hasInfo && <h2 className="text-2xl font-semibold">Información para ti</h2>}
      {wedding.dress_code && (
        <InfoBlock icon={<Shirt className="size-5" />} title="Código de vestimenta">
          {wedding.dress_code}
        </InfoBlock>
      )}
      {wedding.logistics_info && (
        <InfoBlock icon={<Car className="size-5" />} title="Cómo llegar">
          {wedding.logistics_info}
        </InfoBlock>
      )}
      {wedding.lodging_info && (
        <InfoBlock icon={<BedDouble className="size-5" />} title="Hospedaje">
          {wedding.lodging_info}
        </InfoBlock>
      )}
      {wedding.faq && (
        <InfoBlock icon={<CircleHelp className="size-5" />} title="Preguntas frecuentes">
          {wedding.faq}
        </InfoBlock>
      )}
      {!declined && livestream && (
        <InfoBlock icon={<Video className="size-5" />} title="Transmisión en vivo">
          <a href={livestream} target="_blank" rel="noreferrer" className="text-brand-700 underline-offset-2 hover:underline">
            Compártela con quien no pueda venir
          </a>
        </InfoBlock>
      )}
      {album && (
        <a
          href={album}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-3 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-800 hover:bg-brand-100"
        >
          <Camera className="size-5 shrink-0" />
          <span>
            <strong className="block">Comparte tus fotos</strong>
            Sube aquí las fotos y videos que tomes en la boda.
          </span>
        </a>
      )}
    </section>
  )
}

type MemberState = Record<string, { attending: boolean; dietary: string }>

function RsvpForm({
  guest,
  wedding,
  token,
  deadlinePassed,
}: {
  guest: RsvpView['guest']
  wedding: RsvpView['wedding']
  token: string
  deadlinePassed: boolean
}) {
  const qc = useQueryClient()
  const deadline = wedding.rsvp_deadline
  const answered = guest.rsvp_status !== 'pendiente'
  // Los que cargaron los novios se marcan con casillas; los que escribió el
  // invitado los puede volver a escribir
  const ownMembers = guest.members.filter((m) => m.from_guest)
  const hasMembers = guest.members.length > ownMembers.length
  const [editing, setEditing] = useState(!answered)
  const [attending, setAttending] = useState<boolean | null>(answered ? guest.rsvp_status === 'confirmado' : null)
  const [plusOnes, setPlusOnes] = useState(
    answered ? Math.max(guest.plus_ones_confirmed, ownMembers.length) : guest.plus_ones_allowed,
  )
  // Nombres de los acompañantes cuando la invitación no los traía
  const [names, setNames] = useState<string[]>(() =>
    Array.from({ length: guest.plus_ones_allowed }, (_, i) => ownMembers[i]?.name ?? ''),
  )
  const [members, setMembers] = useState<MemberState>(() =>
    Object.fromEntries(
      guest.members.map((m) => [m.id, { attending: m.attending ?? !answered, dietary: m.dietary ?? '' }]),
    ),
  )
  const [dietary, setDietary] = useState(guest.dietary ?? '')
  const [song, setSong] = useState(guest.song_request ?? '')
  const [needsTransport, setNeedsTransport] = useState(guest.needs_transport)
  const [message, setMessage] = useState(guest.guest_message ?? '')

  const setMember = (id: string, patch: Partial<MemberState[string]>) =>
    setMembers((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }))

  const askNames = !hasMembers && guest.plus_ones_allowed > 0
  const companionNames = names.slice(0, plusOnes).map((n) => n.trim())

  const submit = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('rsvp_submit', {
        p_token: token,
        p_status: attending ? 'confirmado' : 'rechazado',
        p_plus_ones: attending ? (hasMembers ? Object.values(members).filter((m) => m.attending).length : plusOnes) : 0,
        p_dietary: dietary.trim() || null,
        p_message: message.trim() || null,
        p_song: attending ? song.trim() || null : null,
        p_needs_transport: !!attending && needsTransport,
        p_members: hasMembers
          ? guest.members.map((m) => ({
              id: m.id,
              attending: !!attending && members[m.id].attending,
              dietary: members[m.id].dietary.trim() || null,
            }))
          : null,
        p_new_members: attending && askNames ? companionNames : null,
      })
      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      qc.setQueryData(['rsvp', token], data)
      setEditing(false)
    },
    onError: (error) => toast.error(describeError(error)),
  })

  if (!editing) {
    const yes = guest.rsvp_status === 'confirmado'
    const coming = guest.members.filter((m) => m.attending).map((m) => m.name)
    return (
      <section className="rounded-3xl bg-white p-6 text-center shadow-sm">
        <div className={cn('mx-auto flex size-12 items-center justify-center rounded-full', yes ? 'bg-brand-50 text-brand-600' : 'bg-stone-100 text-muted')}>
          {yes ? <PartyPopper className="size-6" /> : <Heart className="size-6" />}
        </div>
        <h2 className="mt-3 text-2xl font-semibold">{yes ? `¡Qué alegría, ${guest.name}!` : `Gracias por avisarnos, ${guest.name}`}</h2>
        <p className="mt-2 text-sm text-muted">
          {yes
            ? coming.length > 0
              ? `Confirmaste tu asistencia con ${joinNames(coming)}.`
              : guest.plus_ones_confirmed > 0
                ? `Confirmaste tu asistencia con ${guest.plus_ones_confirmed} ${guest.plus_ones_confirmed === 1 ? 'acompañante' : 'acompañantes'}.`
                : 'Confirmaste tu asistencia.'
            : 'Te vamos a extrañar.'}
        </p>
        {!deadlinePassed && (
          <Button className="mt-4" variant="secondary" size="sm" onClick={() => setEditing(true)}>
            Cambiar mi respuesta
          </Button>
        )}
      </section>
    )
  }

  return (
    <section className="rounded-3xl bg-white p-6 shadow-sm">
      <h2 className="text-2xl font-semibold">Hola, {guest.name}</h2>
      <p className="mt-1 text-sm text-muted">
        {deadline ? `Por favor confírmanos antes del ${formatDate(deadline, "d 'de' MMMM")}.` : 'Por favor confírmanos si nos acompañas.'}
      </p>

      {deadlinePassed ? (
        <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          La fecha para confirmar ya pasó. Escríbeles directamente a los novios.
        </p>
      ) : (
        <form
          className="mt-5 flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (attending === null) {
              toast.error('Cuéntanos si asistirás')
              return
            }
            if (attending && askNames && companionNames.some((n) => !n)) {
              toast.error('Escribe el nombre de cada acompañante')
              return
            }
            submit.mutate()
          }}
        >
          <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="¿Asistirás?">
            {[
              { value: true, label: '¡Sí, ahí estaré!' },
              { value: false, label: 'No podré ir' },
            ].map((o) => (
              <button
                key={String(o.value)}
                type="button"
                role="radio"
                aria-checked={attending === o.value}
                onClick={() => setAttending(o.value)}
                className={cn(
                  'flex items-center justify-center gap-2 rounded-2xl border-2 px-3 py-4 text-sm font-medium transition',
                  attending === o.value
                    ? o.value
                      ? 'border-brand-600 bg-brand-50 text-brand-800'
                      : 'border-stone-500 bg-stone-50'
                    : 'border-line hover:border-brand-300',
                )}
              >
                {attending === o.value && <Check className="size-4" />}
                {o.label}
              </button>
            ))}
          </div>

          {attending && hasMembers && (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1.5 text-sm font-medium">¿Quiénes vienen contigo?</legend>
              {guest.members.map((m) => (
                <div key={m.id} className="rounded-xl border border-line p-3">
                  <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                    <input
                      type="checkbox"
                      className="size-5 accent-brand-600"
                      checked={members[m.id].attending}
                      onChange={(e) => setMember(m.id, { attending: e.target.checked })}
                    />
                    {m.name}
                  </label>
                  {members[m.id].attending && (
                    <Input
                      aria-label={`Restricción alimentaria de ${m.name}`}
                      placeholder="Restricción alimentaria (opcional)"
                      maxLength={200}
                      className="mt-2 h-9"
                      value={members[m.id].dietary}
                      onChange={(e) => setMember(m.id, { dietary: e.target.value })}
                    />
                  )}
                </div>
              ))}
            </fieldset>
          )}

          {attending && askNames && (
            <>
              <Field
                label="¿Cuántos acompañantes vienen contigo?"
                hint={`Tu invitación incluye hasta ${guest.plus_ones_allowed}.`}
              >
                {(id) => (
                  <Select id={id} value={plusOnes} onChange={(e) => setPlusOnes(Number(e.target.value))}>
                    {Array.from({ length: guest.plus_ones_allowed + 1 }, (_, n) => (
                      <option key={n} value={n}>
                        {n === 0 ? 'Solo yo' : `${n} ${n === 1 ? 'acompañante' : 'acompañantes'}`}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              {plusOnes > 0 && (
                <fieldset className="flex flex-col gap-2">
                  <legend className="mb-1.5 text-sm font-medium">¿Cómo se llaman?</legend>
                  {Array.from({ length: plusOnes }, (_, i) => (
                    <Input
                      key={i}
                      aria-label={`Nombre del acompañante ${i + 1}`}
                      placeholder={`Nombre del acompañante ${i + 1}`}
                      maxLength={120}
                      value={names[i] ?? ''}
                      onChange={(e) =>
                        setNames((prev) => {
                          const next = [...prev]
                          next[i] = e.target.value
                          return next
                        })
                      }
                    />
                  ))}
                  <p className="text-xs text-muted">Así sabemos a quién sentar contigo y cómo hacer su tarjeta.</p>
                </fieldset>
              )}
            </>
          )}

          {attending && (
            <Field
              label={hasMembers ? '¿Tienes alguna restricción alimentaria?' : '¿Alguna restricción alimentaria?'}
              hint="Vegetariano, alergias, sin gluten…"
            >
              {(id) => <Input id={id} maxLength={500} value={dietary} onChange={(e) => setDietary(e.target.value)} />}
            </Field>
          )}

          {attending && wedding.ask_song && (
            <Field label="¿Qué canción no puede faltar en la fiesta?" hint="Opcional. Se la pasamos al DJ.">
              {(id) => (
                <Input id={id} maxLength={200} placeholder="Canción y artista" value={song} onChange={(e) => setSong(e.target.value)} />
              )}
            </Field>
          )}

          {attending && wedding.offer_transport && (
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-5 accent-brand-600"
                checked={needsTransport}
                onChange={(e) => setNeedsTransport(e.target.checked)}
              />
              Necesito transporte
            </label>
          )}

          <Field label="Un mensaje para los novios (opcional)">
            {(id) => <Textarea id={id} maxLength={1000} value={message} onChange={(e) => setMessage(e.target.value)} />}
          </Field>

          <Button type="submit" disabled={submit.isPending} className="h-12 text-base">
            {submit.isPending ? 'Enviando…' : 'Enviar respuesta'}
          </Button>
        </form>
      )}
    </section>
  )
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join('')
  return `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`
}

function GiftList({ gifts, token, envelopeRain }: { gifts: RsvpGiftView[]; token: string; envelopeRain: boolean }) {
  const qc = useQueryClient()
  const claim = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: boolean }) => {
      const { data, error } = await supabase.rpc('rsvp_claim_gift', { p_token: token, p_gift_id: id, p_claim: value })
      if (error) throw error
      return data
    },
    onSuccess: (data, vars) => {
      qc.setQueryData(['rsvp', token], data)
      toast.success(vars.value ? '¡Gracias! Quedó apartado a tu nombre' : 'Listo, lo liberamos')
    },
    onError: (error) => {
      toast.error(describeError(error))
      qc.invalidateQueries({ queryKey: ['rsvp', token] })
    },
  })

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Datos copiados')
    } catch {
      toast.error('No se pudo copiar')
    }
  }

  return (
    <section className="rounded-3xl bg-white p-6 shadow-sm">
      <h2 className="flex items-center gap-2 text-2xl font-semibold">
        <Gift className="size-6 text-accent-400" /> Mesa de regalos
      </h2>
      <p className="mt-1 text-sm text-muted">
        Tu presencia es el mejor regalo.{gifts.length > 0 && ' Si quieres darnos algo, aquí hay algunas ideas.'}
      </p>
      {envelopeRain && (
        <div className="mt-4 flex gap-3 rounded-2xl bg-accent-50 px-4 py-3 text-sm text-accent-700">
          <HandCoins className="size-5 shrink-0" />
          <p>
            <strong className="block">Lluvia de sobres</strong>
            Si quieres hacernos un regalo, el día de la boda habrá un buzón para sobres.
          </p>
        </div>
      )}
      {gifts.length > 0 && (
      <ul className="mt-5 flex flex-col gap-3">
        {gifts.map((g) => {
          const store = safeUrl(g.store_url)
          const taken = g.kind === 'articulo' && g.remaining === 0 && !g.claimed_by_me
          return (
            <li key={g.id} className={cn('rounded-2xl border p-4', g.claimed_by_me ? 'border-brand-300 bg-brand-50/60' : 'border-line', taken && 'opacity-60')}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-medium">
                    {g.kind === 'efectivo' && <Banknote className="size-4 text-brand-500" />}
                    {g.name}
                  </p>
                  {g.price != null && <p className="text-sm text-muted tabular-nums">{g.kind === 'efectivo' ? 'Meta: ' : ''}{formatCOP(g.price)}</p>}
                  {g.description && <p className="mt-1 text-sm text-muted">{g.description}</p>}
                </div>
                {taken ? (
                  <span className="shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-xs text-muted">Ya lo apartaron</span>
                ) : g.claimed_by_me ? (
                  <Button size="sm" variant="ghost" disabled={claim.isPending} onClick={() => claim.mutate({ id: g.id, value: false })}>
                    Soltar
                  </Button>
                ) : (
                  <Button size="sm" variant="secondary" disabled={claim.isPending} onClick={() => claim.mutate({ id: g.id, value: true })}>
                    {g.kind === 'efectivo' ? 'Voy a aportar' : 'Lo regalo yo'}
                  </Button>
                )}
              </div>
              {g.claimed_by_me && (
                <p className="mt-2 flex items-center gap-1 text-xs font-medium text-brand-700">
                  <Check className="size-3.5" /> {g.kind === 'efectivo' ? 'Nos avisaste que vas a aportar' : 'Apartado por ti'}
                </p>
              )}
              {store && (
                <a href={store} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm text-brand-700 hover:underline">
                  Ver en la tienda <ExternalLink className="size-3.5" />
                </a>
              )}
              {g.bank_details && (
                <div className="mt-3 flex items-start gap-2 rounded-xl bg-ivory px-3 py-2">
                  <p className="flex-1 text-sm whitespace-pre-line">{g.bank_details}</p>
                  <button
                    type="button"
                    onClick={() => copy(g.bank_details!)}
                    className="rounded-md p-1.5 text-muted hover:bg-white hover:text-ink"
                    aria-label="Copiar datos"
                  >
                    <Copy className="size-4" />
                  </button>
                </div>
              )}
            </li>
          )
        })}
      </ul>
      )}
    </section>
  )
}
