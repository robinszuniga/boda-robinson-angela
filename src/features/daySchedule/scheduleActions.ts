import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { tableKey } from '../../lib/crud'
import { DAY_SCHEDULE_EXAMPLE } from '../../data/dayScheduleExample'
import type { DayScheduleItem } from '../../types/database'

export function useLoadScheduleExample() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('day_schedule_items').insert(DAY_SCHEDULE_EXAMPLE)
      if (error) throw error
    },
    onSettled: () => qc.invalidateQueries({ queryKey: tableKey('day_schedule_items') }),
  })
}

/** Las horas de madrugada (antes de las 6 a. m.) van al final: son del cierre de la fiesta */
export function sortSchedule<T extends Pick<DayScheduleItem, 'start_time'>>(items: T[]): T[] {
  const key = (time: string) => (time < '06:00' ? `1${time}` : `0${time}`)
  return [...items].sort((a, b) => key(a.start_time).localeCompare(key(b.start_time)))
}
