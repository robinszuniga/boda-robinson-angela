/** Campos que la app reemplaza dentro de los mensajes */
export const MESSAGE_FIELDS = ['nombre', 'novios', 'fecha', 'lugar', 'link', 'limite'] as const

export type MessageField = (typeof MESSAGE_FIELDS)[number]
export type MessageValues = Record<MessageField, string>

export const FIELD_HELP: Record<MessageField, string> = {
  nombre: 'el nombre del invitado',
  novios: 'los nombres de ustedes',
  fecha: 'la fecha y la hora de la boda',
  lugar: 'el lugar',
  link: 'el link de confirmación de ese invitado',
  limite: 'la fecha límite para confirmar',
}

// La fecha ya termina en "p. m.", por eso no lleva punto después
export const DEFAULT_INVITATION =
  '¡Hola, {nombre}!\n{novios} queremos invitarte a nuestra boda el {fecha}\nConfirma tu asistencia aquí: {link}'

export const DEFAULT_REMINDER =
  '¡Hola, {nombre}! Te escribimos para recordarte que nos cuentes si nos acompañas en nuestra boda. Es solo un clic aquí: {link}'

/** Reemplaza {campo} por su valor. Lo que no reconoce lo deja tal cual, para que se note. */
export function renderMessage(template: string, values: MessageValues): string {
  const filled = template.replace(/\{(\w+)\}/g, (match, field: string) =>
    field in values ? values[field as MessageField] : match,
  )
  return filled
    .split('\n')
    .map((line) => line.replace(/[ \t]{2,}/g, ' ').trimEnd())
    .join('\n')
    .trim()
}

/** Campos escritos en el mensaje que la app no conoce */
export function unknownFields(template: string): string[] {
  const found = [...template.matchAll(/\{(\w+)\}/g)].map((m) => m[1])
  return [...new Set(found.filter((f) => !MESSAGE_FIELDS.includes(f as MessageField)))]
}
