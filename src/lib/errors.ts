interface ErrorLike {
  code?: string
  message?: string
  details?: string
  /** El mensaje ya viene escrito para el usuario */
  friendly?: boolean
}

/** Un error cuyo mensaje ya está listo para mostrarse tal cual */
export function friendlyError(message: string): Error {
  return Object.assign(new Error(message), { friendly: true })
}

const RSVP_MESSAGES: Record<string, string> = {
  invalid_token: 'Este enlace de invitación no es válido.',
  invalid_status: 'Elige si asistes o no.',
  invalid_plus_ones: 'El número de acompañantes supera el permitido en tu invitación.',
  deadline_passed: 'La fecha límite para confirmar ya pasó. Escríbeles directamente a los novios.',
  text_too_long: 'El texto es demasiado largo.',
  invalid_member_name: 'Revisa los nombres de tus acompañantes.',
  invalid_gift: 'Ese regalo ya no está en la lista.',
  gift_unavailable: 'Alguien más ya apartó ese regalo.',
}

/** Traduce errores de Supabase/Postgres a un mensaje en español */
export function describeError(error: unknown): string {
  if (!error) return 'Ocurrió un error inesperado.'
  const e = error as ErrorLike
  const message = e.message ?? String(error)
  if (e.friendly) return message

  for (const [code, text] of Object.entries(RSVP_MESSAGES)) {
    if (message.includes(code)) return text
  }

  switch (e.code) {
    case '23505':
      return 'Ya existe un registro con ese valor (por ejemplo, un número de mesa repetido).'
    case '23503':
      return 'No se puede borrar porque tiene registros asociados (por ejemplo, pagos). Muévelos o bórralos primero.'
    case '23502':
      return 'Falta un dato obligatorio. Revisa los campos del formulario.'
    case '22001':
      return 'Un texto es más largo de lo permitido.'
    case '22P02':
      return 'Algún valor tiene un formato que no se entiende, por ejemplo un número mal escrito.'
    case '23514':
      return 'Algún valor no es válido. Revisa los campos del formulario.'
    case '42501':
      return 'No tienes permiso para hacer esto. ¿Tu correo está en app_users?'
    case 'PGRST301':
    case 'PGRST303':
      return 'Tu sesión expiró. Vuelve a iniciar sesión.'
  }

  if (/Invalid login credentials/i.test(message)) return 'Correo o contraseña incorrectos.'
  if (/Email not confirmed/i.test(message)) return 'Ese correo aún no está confirmado en Supabase.'
  const minimo = /Password should be at least (\d+)/i.exec(message)
  if (minimo) return `La contraseña debe tener al menos ${minimo[1]} caracteres.`
  if (/User already registered/i.test(message)) return 'Ese correo ya tiene una cuenta.'
  if (/rate limit|too many requests/i.test(message)) return 'Demasiados intentos. Espera unos minutos y vuelve a probar.'
  if (/Auth session missing|JWT expired|invalid claim/i.test(message)) return 'Tu sesión expiró. Vuelve a iniciar sesión.'
  if (/resource already exists|Duplicate/i.test(message)) return 'Ya hay un archivo con ese nombre. Cámbiaselo y súbelo otra vez.'
  if (/mime type|not allowed/i.test(message)) return 'Ese tipo de archivo no se permite.'
  if (/Failed to fetch|NetworkError|Load failed/i.test(message)) {
    return 'No hay conexión con el servidor. Revisa tu internet.'
  }
  if (/Payload too large|exceeded the maximum allowed size/i.test(message)) {
    return 'El archivo es demasiado grande (máximo 20 MB).'
  }
  // Un mensaje técnico de Postgres no le dice nada al usuario
  console.error(error)
  return 'Ocurrió un error. Vuelve a intentarlo.'
}
