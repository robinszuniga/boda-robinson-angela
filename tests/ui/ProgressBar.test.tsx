/** @vitest-environment jsdom */
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ProgressBar } from '../../src/components/ui/Display'

afterEach(cleanup)

const anchos = (barra: HTMLElement) => [...barra.children].map((c) => (c as HTMLElement).style.width)

describe('ProgressBar', () => {
  it('sin segunda capa se ve igual que siempre: una sola barra', () => {
    render(<ProgressBar value={3} max={4} label="Tareas listas" />)
    const barra = screen.getByRole('progressbar', { name: 'Tareas listas' })
    expect(anchos(barra)).toEqual(['75%'])
  })

  it('con segunda capa: clara lo contratado y fuerte lo pagado', () => {
    // El planner: 5M contratados de 5M estimados y la mitad pagada
    render(
      <ProgressBar
        value={2_500_000}
        secondary={5_000_000}
        max={5_000_000}
        label="Planner: pagado y contratado"
        valueText="Pagado 2.500.000 de 5.000.000 contratado"
      />,
    )
    const barra = screen.getByRole('progressbar', { name: 'Planner: pagado y contratado' })
    expect(anchos(barra)).toEqual(['100%', '50%'])
    expect(barra.getAttribute('aria-valuenow')).toBe('2500000')
    expect(barra.getAttribute('aria-valuetext')).toBe('Pagado 2.500.000 de 5.000.000 contratado')
  })

  it('ninguna capa pasa del 100% aunque se exceda', () => {
    render(<ProgressBar value={9} secondary={12} max={10} label="Excedido" />)
    expect(anchos(screen.getByRole('progressbar', { name: 'Excedido' }))).toEqual(['100%', '90%'])
  })
})
