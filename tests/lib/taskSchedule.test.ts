import { describe, expect, it } from 'vitest'
import { idealDueDate, scheduleTemplate } from '../../src/lib/taskSchedule'

describe('idealDueDate', () => {
  it('resta el offset a la fecha de la boda', () => {
    expect(idealDueDate('2027-05-15', 30)).toBe('2027-04-15')
    expect(idealDueDate('2027-05-15', 0)).toBe('2027-05-15')
  })
})

describe('scheduleTemplate', () => {
  const tasks = [
    { key: 'venue', offsetDays: 365 },
    { key: 'foto', offsetDays: 270 },
    { key: 'catering', offsetDays: 240 },
    { key: 'invitaciones', offsetDays: 90 },
    { key: 'confirmar', offsetDays: 7 },
  ]

  it('con tiempo de sobra usa la fecha ideal', () => {
    const result = scheduleTemplate(tasks, '2027-05-15', '2026-01-01')
    expect(result.get('venue')).toBe('2026-05-15')
    expect(result.get('confirmar')).toBe('2027-05-08')
  })

  it('reparte las atrasadas en las próximas 4 semanas manteniendo el orden', () => {
    // Hoy 20-sep-2026: venue (15-may-26), foto (18-ago-26) y catering (17-sep-26) ya pasaron
    const result = scheduleTemplate(tasks, '2027-05-15', '2026-09-20')
    const venue = result.get('venue')!
    const foto = result.get('foto')!
    const catering = result.get('catering')!
    expect(venue).toBe('2026-09-20')
    expect(venue <= foto && foto <= catering).toBe(true)
    expect(catering < '2026-10-18').toBe(true)
    expect(result.get('invitaciones')).toBe('2027-02-14')
    expect(result.size).toBe(tasks.length)
  })

  it('si la boda está muy cerca, no pasa del día anterior', () => {
    const result = scheduleTemplate(tasks, '2026-09-25', '2026-09-20')
    for (const date of result.values()) {
      expect(date >= '2026-09-20' && date <= '2026-09-24').toBe(true)
    }
  })
})
