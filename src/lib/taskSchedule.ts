import { addDays, differenceInCalendarDays, format, parseISO, subDays } from 'date-fns'

export interface TemplateTaskLike {
  key: string
  offsetDays: number
}

const iso = (d: Date) => format(d, 'yyyy-MM-dd')

/** Fecha ideal de una tarea: fecha de boda − offset */
export function idealDueDate(weddingDay: string, offsetDays: number): string {
  return iso(subDays(parseISO(weddingDay), offsetDays))
}

/**
 * Calcula la fecha límite de cada tarea de plantilla. Las que ya quedaron en el pasado
 * (porque faltan menos meses de los que asume la plantilla) se reparten en orden
 * entre hoy y los próximos `catchUpDays` días, sin pasarse del día antes de la boda.
 *
 * @param weddingDay 'yyyy-MM-dd'
 * @param today 'yyyy-MM-dd'
 * @returns mapa key → 'yyyy-MM-dd'
 */
export function scheduleTemplate(
  tasks: TemplateTaskLike[],
  weddingDay: string,
  today: string,
  catchUpDays = 28,
): Map<string, string> {
  const result = new Map<string, string>()
  const ordered = [...tasks].sort((a, b) => b.offsetDays - a.offsetDays)
  const overdue: TemplateTaskLike[] = []

  for (const task of ordered) {
    const due = idealDueDate(weddingDay, task.offsetDays)
    if (due < today) overdue.push(task)
    else result.set(task.key, due)
  }

  const daysLeft = differenceInCalendarDays(parseISO(weddingDay), parseISO(today))
  const window = Math.max(0, Math.min(catchUpDays, daysLeft - 1))
  overdue.forEach((task, i) => {
    const offset = Math.floor((i * window) / overdue.length)
    result.set(task.key, iso(addDays(parseISO(today), offset)))
  })

  return result
}
