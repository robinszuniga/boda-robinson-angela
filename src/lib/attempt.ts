import { toast } from 'sonner'
import { describeError } from './errors'

/**
 * Espera una mutación y dice si salió bien. El error ya lo muestra un toast
 * (MutationCache en queryClient.ts), así que aquí no se vuelve a lanzar.
 */
export async function attempt(promise: Promise<unknown>): Promise<boolean> {
  try {
    await promise
    return true
  } catch {
    return false
  }
}

/**
 * Para llamadas directas a Supabase (sin useMutation), que no pasan por el
 * MutationCache: aquí sí hay que mostrar el error, o el usuario creería que guardó.
 */
export async function attemptLoud(promise: Promise<unknown>): Promise<boolean> {
  try {
    await promise
    return true
  } catch (error) {
    console.error(error)
    toast.error(describeError(error))
    return false
  }
}
