import { invitationStage, openedNote } from '../../lib/invitationStatus'
import { cn } from '../../components/ui/cn'
import type { Guest } from '../../types/database'

/**
 * "aún no la abre" (resaltado) o "la abrió ayer"; nada si ya respondió o no se ha enviado.
 * `block` la pone en su propia línea, en letra pequeña.
 */
export function OpenedNote({
  guest,
  prefix = '',
  block = false,
}: {
  guest: Pick<Guest, 'rsvp_status' | 'invitation_sent_at' | 'rsvp_opened_at'>
  prefix?: string
  block?: boolean
}) {
  const note = openedNote(guest)
  if (!note) return null
  const unopened = invitationStage(guest) === 'sin_abrir'
  return (
    <span className={cn(block && 'block text-xs', unopened ? 'text-amber-800' : block && 'text-muted')}>
      {prefix}
      {note}
    </span>
  )
}
