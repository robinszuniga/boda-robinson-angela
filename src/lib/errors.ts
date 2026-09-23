interface ErrorLike {
  code?: string
  message?: string
  details?: string
}

const RSVP_MESSAGES: Record<string, string> = {
  invalid_token: 'Este enlace de invitación no es válido.',
  invalid_status: 'Elige si asistes o no.',
  invalid_plus_ones: 'El número de acompañantes supera el permitido en tu invitación.',
  deadline_passed: 'La fecha límite para confirmar ya pasó. Escríbeles directamente a los novios.',
  text_too_long: 'El texto es demasiado largo.',
  invalid_gift: 'Ese regalo ya no está en la lista.',
  gift_unavailable: 'Alguien más ya apartó ese regalo.',
}

/** Traduce errores de Supabase/Postgres a un mensaje en español */
export function describeError(error: unknown): string {
  if (!error) return 'Ocurrió un error inesperado.'
  const e = error as ErrorLike
  const message = e.message ?? String(error)

  for (const [code, text] of Object.entries(RSVP_MESSAGES)) {
    if (message.includes(code)) return text
  }

  switch (e.code) {
    case '23505':
      return 'Ya existe un registro con ese valor (por ejemplo, un número de mesa repetido).'
    case '23503':
      return 'No se puede borrar porque tiene registros asociados (por ejemplo, pagos). Muévelos o bórralos primero.'
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
