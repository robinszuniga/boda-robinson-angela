/**
 * Ruta base donde vive la app: '/' en local o Vercel, '/boda-robinson-angela/' en GitHub Pages.
 * La define Vite con la opción `base` (variable BASE_PATH al compilar).
 */
export const BASE_PATH = import.meta.env.BASE_URL

/** basename para React Router (sin la barra final) */
export const ROUTER_BASENAME = BASE_PATH.replace(/\/$/, '') || '/'

/** URL absoluta a una ruta de la app, p. ej. appUrl('rsvp/abc') */
export function appUrl(path: string): string {
  return `${window.location.origin}${BASE_PATH}${path.replace(/^\//, '')}`
}
