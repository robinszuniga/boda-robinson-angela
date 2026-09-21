import type {
  DocumentCategory,
  GiftKind,
  GuestGroup,
  LinkKind,
  RsvpStatus,
  TaskAssignee,
  TaskPriority,
  TaskStatus,
  VendorStatus,
  WeddingSettings,
} from '../types/database'

export type Tone = 'neutral' | 'green' | 'amber' | 'red' | 'blue' | 'brand' | 'accent'

interface Label {
  label: string
  tone: Tone
}

export const vendorStatus: Record<VendorStatus, Label> = {
  cotizando: { label: 'Cotizando', tone: 'amber' },
  reservado: { label: 'Reservado', tone: 'blue' },
  pagado: { label: 'Pagado', tone: 'green' },
  descartado: { label: 'Descartado', tone: 'neutral' },
}

export const guestGroup: Record<GuestGroup, string> = {
  familia_novio: 'Familia del novio',
  familia_novia: 'Familia de la novia',
  amigos: 'Amigos',
  trabajo: 'Trabajo',
  otros: 'Otros',
}

export const rsvpStatus: Record<RsvpStatus, Label> = {
  pendiente: { label: 'Pendiente', tone: 'amber' },
  confirmado: { label: 'Confirmado', tone: 'green' },
  rechazado: { label: 'No asiste', tone: 'red' },
}

export const linkKind: Record<LinkKind, string> = {
  juntos: 'Sentar juntos',
  separados: 'Sentar separados',
}

export const taskStatus: Record<TaskStatus, Label> = {
  por_hacer: { label: 'Por hacer', tone: 'neutral' },
  en_proceso: { label: 'En proceso', tone: 'blue' },
  listo: { label: 'Listo', tone: 'green' },
}

export const taskPriority: Record<TaskPriority, Label> = {
  alta: { label: 'Alta', tone: 'red' },
  media: { label: 'Media', tone: 'amber' },
  baja: { label: 'Baja', tone: 'neutral' },
}

export function assigneeLabel(
  assignee: TaskAssignee,
  settings: Pick<WeddingSettings, 'partner_1_name' | 'partner_2_name'> | undefined,
): string {
  if (assignee === 'novio') return settings?.partner_1_name ?? 'Novio'
  if (assignee === 'novia') return settings?.partner_2_name ?? 'Novia'
  return 'Ambos'
}

export const documentCategory: Record<DocumentCategory, string> = {
  contrato: 'Contrato',
  cotizacion: 'Cotización',
  factura: 'Factura / recibo',
  inspiracion: 'Inspiración',
  otro: 'Otro',
}

export const giftKind: Record<GiftKind, string> = {
  articulo: 'Artículo',
  efectivo: 'Aporte en efectivo',
}

export function options<K extends string>(map: Record<K, string | Label>) {
  return (Object.keys(map) as K[]).map((value) => {
    const entry = map[value]
    return { value, label: typeof entry === 'string' ? entry : entry.label }
  })
}
