import type { DayScheduleItem } from '../types/database'

type ExampleItem = Pick<DayScheduleItem, 'start_time' | 'end_time' | 'title' | 'location' | 'responsible'>

/** Ejemplo basado en el spec; se puede cargar desde Cronograma y luego ajustar */
export const DAY_SCHEDULE_EXAMPLE: ExampleItem[] = [
  { start_time: '12:00', end_time: '13:00', title: 'Almuerzo liviano y alistamiento', location: null, responsible: null },
  { start_time: '14:00', end_time: '15:30', title: 'Maquillaje y peinado', location: null, responsible: 'Maquillador(a)' },
  { start_time: '15:00', end_time: '15:40', title: 'Fotos de preparativos', location: null, responsible: 'Fotógrafo' },
  { start_time: '15:40', end_time: '16:00', title: 'Traslado a la ceremonia', location: null, responsible: 'Transporte' },
  { start_time: '16:00', end_time: '17:00', title: 'Ceremonia', location: null, responsible: null },
  { start_time: '17:00', end_time: '17:30', title: 'Fotos familiares y de pareja', location: null, responsible: 'Fotógrafo' },
  { start_time: '17:30', end_time: '19:00', title: 'Cóctel', location: null, responsible: 'Catering' },
  { start_time: '19:00', end_time: '19:30', title: 'Entrada de los novios y brindis', location: null, responsible: 'DJ' },
  { start_time: '19:30', end_time: '21:00', title: 'Cena', location: null, responsible: 'Catering' },
  { start_time: '21:00', end_time: '21:15', title: 'Vals', location: null, responsible: 'DJ' },
  { start_time: '21:15', end_time: '23:30', title: 'Fiesta', location: null, responsible: 'DJ' },
  { start_time: '23:30', end_time: '00:30', title: 'Hora loca', location: null, responsible: 'DJ' },
  { start_time: '01:30', end_time: null, title: 'Cierre y despedida', location: null, responsible: null },
]
