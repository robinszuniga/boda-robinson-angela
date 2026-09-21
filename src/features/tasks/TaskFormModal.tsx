import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
import { tasksApi, useSettings } from '../../lib/api'
import { attempt } from '../../lib/attempt'
import { assigneeLabel, options, taskPriority, taskStatus } from '../../lib/labels'
import { Button } from '../../components/ui/Button'
import { Field, FormGrid, Input, Select, Textarea } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { useConfirm } from '../../components/ui/Confirm'
import type { Task, TaskAssignee, TaskPriority, TaskStatus } from '../../types/database'
import { TASK_STAGES } from '../../data/taskTemplate'

interface FormValues {
  title: string
  description: string
  due_date: string
  assignee: TaskAssignee
  priority: TaskPriority
  status: TaskStatus
  stage: string
}

export function TaskFormModal({ task, defaults, onClose }: { task?: Task; defaults?: Partial<Task>; onClose: () => void }) {
  const { data: settings } = useSettings()
  const create = tasksApi.useCreate()
  const update = tasksApi.useUpdate()
  const remove = tasksApi.useRemove()
  const confirm = useConfirm()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      title: task?.title ?? '',
      description: task?.description ?? '',
      due_date: task?.due_date ?? '',
      assignee: task?.assignee ?? defaults?.assignee ?? 'ambos',
      priority: task?.priority ?? 'media',
      status: task?.status ?? defaults?.status ?? 'por_hacer',
      stage: task?.stage ?? '',
    },
  })

  const stages: string[] = [...TASK_STAGES]
  if (task?.stage && !stages.includes(task.stage)) stages.push(task.stage)

  const onSubmit = async (v: FormValues) => {
    const values = {
      title: v.title.trim(),
      description: v.description.trim() || null,
      due_date: v.due_date || null,
      assignee: v.assignee,
      priority: v.priority,
      status: v.status,
      stage: v.stage || null,
      completed_at: v.status === 'listo' ? (task?.completed_at ?? new Date().toISOString()) : null,
    }
    const ok = await attempt(task ? update.mutateAsync({ id: task.id, values }) : create.mutateAsync(values))
    if (!ok) return
    toast.success(task ? 'Tarea actualizada' : 'Tarea creada')
    onClose()
  }

  const onDelete = async () => {
    if (!task) return
    const ok = await confirm({ title: '¿Borrar esta tarea?', message: task.title, confirmLabel: 'Borrar', danger: true })
    if (ok && (await attempt(remove.mutateAsync(task.id)))) onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={task ? 'Editar tarea' : 'Nueva tarea'}
      footer={
        <>
          {task && (
            <Button variant="ghost" className="mr-auto text-red-700" icon={<Trash2 className="size-4" />} onClick={onDelete}>
              Borrar
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="task-form" disabled={isSubmitting}>
            Guardar
          </Button>
        </>
      }
    >
      <form id="task-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <Field label="Tarea" error={errors.title?.message}>
          {(id) => (
            <Input
              id={id}
              data-autofocus={!task || undefined}
              aria-invalid={!!errors.title}
              {...register('title', { validate: (v) => !!v.trim() || 'Escribe la tarea' })}
            />
          )}
        </Field>
        <FormGrid>
          <Field label="Fecha límite">{(id) => <Input id={id} type="date" {...register('due_date')} />}</Field>
          <Field label="Responsable">
            {(id) => (
              <Select id={id} {...register('assignee')}>
                {(['novio', 'novia', 'ambos'] as const).map((a) => (
                  <option key={a} value={a}>
                    {assigneeLabel(a, settings)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Estado">
            {(id) => (
              <Select id={id} {...register('status')}>
                {options(taskStatus).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Prioridad">
            {(id) => (
              <Select id={id} {...register('priority')}>
                {options(taskPriority).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Etapa" className="sm:col-span-2">
            {(id) => (
              <Select id={id} {...register('stage')}>
                <option value="">— Sin etapa —</option>
                {stages.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </FormGrid>
        <Field label="Detalles">{(id) => <Textarea id={id} {...register('description')} />}</Field>
      </form>
    </Modal>
  )
}
