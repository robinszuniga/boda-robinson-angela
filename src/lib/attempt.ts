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
