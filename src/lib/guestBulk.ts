import { updateEach } from './bulkUpdate'
import type { UpdateOf } from '../types/database'

/** El mismo cambio para varios invitados */
export function updateGuests(ids: string[], values: UpdateOf<'guests'>) {
  return updateEach('guests', ids.map((id) => ({ id, values })))
}

/** Un cambio distinto para cada invitado (su mesa, su teléfono…) */
export function updateGuestsEach(rows: { id: string; values: UpdateOf<'guests'> }[]) {
  return updateEach('guests', rows)
}
