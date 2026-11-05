/**
 * Colores de la barra de progreso de dos capas (fuerte encima, clara detrás).
 * Aparte del componente para que la leyenda que la explica use exactamente los mismos.
 */
export const PROGRESS_LAYER_COLORS = {
  solid: { brand: 'bg-brand-600', red: 'bg-red-700', amber: 'bg-amber-600', accent: 'bg-accent-500' },
  light: { brand: 'bg-brand-200', red: 'bg-red-200', amber: 'bg-amber-200', accent: 'bg-accent-200' },
} as const
