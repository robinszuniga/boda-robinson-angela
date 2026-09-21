import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { tableKey } from '../../lib/crud'
import { toBogotaInput, todayISO } from '../../lib/format'
import { scheduleTemplate } from '../../lib/taskSchedule'
import { TASK_TEMPLATE } from '../../data/taskTemplate'
import type { Task } from '../../types/database'

const weddingDay = (weddingDate: string) => toBogotaInput(weddingDate).slice(0, 10)

/** Inserta la plantilla; las tareas que ya existan (misma template_key) no se duplican */
export function useLoadTaskTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (weddingDate: string) => {
      const dates = scheduleTemplate(TASK_TEMPLATE, weddingDay(weddingDate), todayISO())
      const rows = TASK_TEMPLATE.map((task, i) => ({
        title: task.title,
        description: task.description ?? null,
        stage: task.stage,
        priority: task.priority,
        assignee: task.assignee,
        template_key: task.key,
        template_offset_days: task.offsetDays,
        due_date: dates.get(task.key) ?? null,
        sort_order: i,
      }))
      const { error } = await supabase
        .from('tasks')
        .upsert(rows, { onConflict: 'template_key', ignoreDuplicates: true })
      if (error) throw error
      return rows.length
    },
    onSettled: () => qc.invalidateQueries({ queryKey: tableKey('tasks') }),
  })
}

/** Recalcula las fechas de las tareas de plantilla que no estén listas (p. ej. si cambió la fecha de la boda) */
export function useRecalcTemplateDates() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ weddingDate, tasks }: { weddingDate: string; tasks: Task[] }) => {
      const pending = tasks.filter(
        (t) => t.template_key && t.template_offset_days != null && t.status !== 'listo',
      )
      const dates = scheduleTemplate(
        pending.map((t) => ({ key: t.id, offsetDays: t.template_offset_days! })),
        weddingDay(weddingDate),
        todayISO(),
      )
      const results = await Promise.all(
        pending.map((t) => supabase.from('tasks').update({ due_date: dates.get(t.id) }).eq('id', t.id)),
      )
      const failed = results.find((r) => r.error)
      if (failed?.error) throw failed.error
      return pending.length
    },
    onSettled: () => qc.invalidateQueries({ queryKey: tableKey('tasks') }),
  })
}
