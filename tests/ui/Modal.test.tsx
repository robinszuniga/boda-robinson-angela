/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { Modal } from '../../src/components/ui/Modal'

// jsdom todavía no trae <dialog>.showModal(), así que se imita lo mínimo
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open')
  }
})

afterEach(cleanup)

const abierto = (onClose: () => void) =>
  render(
    <Modal open onClose={onClose} title="Tía Marta">
      <input aria-label="Teléfono" />
    </Modal>,
  )

describe('Modal', () => {
  it('no se cierra al tocar por fuera: se perdía lo que se estaba llenando', () => {
    const onClose = vi.fn()
    abierto(onClose)
    fireEvent.click(screen.getByRole('dialog'))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('sigue cerrándose con la X', () => {
    const onClose = vi.fn()
    abierto(onClose)
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('un clic dentro del cuadro no lo cierra', () => {
    const onClose = vi.fn()
    abierto(onClose)
    fireEvent.click(screen.getByLabelText('Teléfono'))
    expect(onClose).not.toHaveBeenCalled()
  })
})
