import { describe, expect, it } from 'vitest'
import { TASK_STAGES, TASK_TEMPLATE } from '../../src/data/taskTemplate'

describe('plantilla de tareas', () => {
  it('no repite claves (se usan para no duplicar tareas al agregar las nuevas)', () => {
    const keys = TASK_TEMPLATE.map((t) => t.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('las etapas existen y solo "Después de la boda" tiene fechas posteriores a la boda', () => {
    for (const task of TASK_TEMPLATE) {
      expect(TASK_STAGES).toContain(task.stage)
      expect(task.offsetDays < 0, task.key).toBe(task.stage === 'Después de la boda')
    }
  })
})
