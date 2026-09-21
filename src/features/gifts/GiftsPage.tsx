import { useState } from 'react'
import { toast } from 'sonner'
import { Banknote, CheckCircle2, ExternalLink, Gift as GiftIcon, PackageCheck, Pencil, Plus } from 'lucide-react'
import { giftClaimsApi, giftsApi, giftsReceivedApi, guestsApi } from '../../lib/api'
import { attempt } from '../../lib/attempt'
import { safeUrl } from '../../lib/contact'
import { formatCOP } from '../../lib/format'
import { Button, IconButton } from '../../components/ui/Button'
import { Badge, EmptyState, ErrorState, LoadingState, PageHeader } from '../../components/ui/Display'
import type { Gift, GiftClaim } from '../../types/database'
import { GiftFormModal } from './GiftFormModal'

export default function GiftsPage() {
  const gifts = giftsApi.useList()
  const claims = giftClaimsApi.useList()
  const received = giftsReceivedApi.useList()
  const guests = guestsApi.useList()
  const createReceived = giftsReceivedApi.useCreate()
  const [form, setForm] = useState<{ gift?: Gift } | null>(null)

  const queries = [gifts, claims, received, guests]
  const failed = queries.find((q) => q.isError)
  if (failed) return <ErrorState error={failed.error} onRetry={() => queries.forEach((q) => q.refetch())} />
  if (queries.some((q) => q.isPending)) return <LoadingState />

  const guestName = new Map((guests.data ?? []).map((g) => [g.id, g.name]))
  const isReceived = (claim: GiftClaim) =>
    (received.data ?? []).some((r) => r.gift_id === claim.gift_id && r.guest_id === claim.guest_id)

  const markReceived = async (gift: Gift, claim: GiftClaim) => {
    const ok = await attempt(
      createReceived.mutateAsync({ guest_id: claim.guest_id, gift_id: gift.id, description: gift.name }),
    )
    if (ok) toast.success('Marcado como recibido. Aparece en Agradecimientos.')
  }

  const all = gifts.data ?? []
  const sections = [
    { title: 'Artículos', icon: <GiftIcon className="size-5 text-brand-500" />, items: all.filter((g) => g.kind === 'articulo') },
    { title: 'Aportes en efectivo', icon: <Banknote className="size-5 text-brand-500" />, items: all.filter((g) => g.kind === 'efectivo') },
  ].filter((s) => s.items.length > 0)

  return (
    <>
      <PageHeader
        title="Mesa de regalos"
        description="Los invitados ven esta lista en su página de confirmación y pueden apartar un regalo"
        actions={
          <Button icon={<Plus className="size-4" />} onClick={() => setForm({})}>
            Regalo
          </Button>
        }
      />

      {all.length === 0 ? (
        <EmptyState
          icon={<GiftIcon className="size-8" />}
          title="La lista de regalos está vacía"
          action={<Button onClick={() => setForm({})}>Agregar el primero</Button>}
        >
          Agrega artículos con el link de la tienda, o un fondo en efectivo (por ejemplo, para la luna de miel) con los datos de la cuenta.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-8">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="mb-3 flex items-center gap-2 text-xl font-semibold">
                {section.icon} {section.title}
              </h2>
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {section.items.map((gift) => {
                  const giftClaims = (claims.data ?? []).filter((c) => c.gift_id === gift.id)
                  const store = safeUrl(gift.store_url)
                  const full = gift.kind === 'articulo' && giftClaims.length >= gift.quantity
                  return (
                    <li key={gift.id} className="flex flex-col rounded-2xl border border-line bg-white p-4 shadow-xs">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="font-sans text-base font-semibold">{gift.name}</h3>
                          {gift.price != null && <p className="text-sm text-muted tabular-nums">{formatCOP(gift.price)}</p>}
                        </div>
                        <IconButton label={`Editar ${gift.name}`} onClick={() => setForm({ gift })}>
                          <Pencil className="size-4" />
                        </IconButton>
                      </div>
                      {gift.description && <p className="mt-2 text-sm text-muted">{gift.description}</p>}
                      {store && (
                        <a href={store} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm text-brand-700 hover:underline">
                          Ver en la tienda <ExternalLink className="size-3.5" />
                        </a>
                      )}
                      {gift.bank_details && (
                        <p className="mt-2 rounded-lg bg-ivory px-3 py-2 text-xs whitespace-pre-line">{gift.bank_details}</p>
                      )}

                      <div className="mt-auto pt-3">
                        {gift.kind === 'articulo' && (
                          <Badge tone={full ? 'green' : 'neutral'} className="mb-2">
                            {full ? 'Apartado' : `${giftClaims.length} de ${gift.quantity} apartados`}
                          </Badge>
                        )}
                        {giftClaims.length > 0 && (
                          <ul className="flex flex-col gap-1 border-t border-line pt-2 text-sm">
                            {giftClaims.map((c) => (
                              <li key={c.id} className="flex items-center justify-between gap-2">
                                <span className="truncate">{guestName.get(c.guest_id) ?? 'Invitado'}</span>
                                {isReceived(c) ? (
                                  <span className="inline-flex items-center gap-1 text-xs text-brand-700">
                                    <CheckCircle2 className="size-3.5" /> Recibido
                                  </span>
                                ) : (
                                  <Button size="sm" variant="ghost" icon={<PackageCheck className="size-3.5" />} onClick={() => markReceived(gift, c)}>
                                    Recibido
                                  </Button>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      {form && <GiftFormModal {...form} nextOrder={all.length + 1} onClose={() => setForm(null)} />}
    </>
  )
}
