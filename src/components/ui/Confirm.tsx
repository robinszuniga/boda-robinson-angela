import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { Button } from './Button'
import { Modal } from './Modal'

interface ConfirmOptions {
  title: string
  message?: ReactNode
  confirmLabel?: string
  danger?: boolean
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn | null>(null)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const resolver = useRef<(value: boolean) => void>(undefined)

  const confirm = useCallback<ConfirmFn>((opts) => {
    setOptions(opts)
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve
    })
  }, [])

  const close = (value: boolean) => {
    resolver.current?.(value)
    resolver.current = undefined
    setOptions(null)
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        open={!!options}
        onClose={() => close(false)}
        title={options?.title ?? ''}
        footer={
          <>
            {/* En acciones destructivas el foco inicial queda en Cancelar para que Enter no borre por error */}
            <Button variant="secondary" onClick={() => close(false)} data-autofocus={options?.danger || undefined}>
              Cancelar
            </Button>
            <Button
              variant={options?.danger ? 'danger' : 'primary'}
              onClick={() => close(true)}
              data-autofocus={!options?.danger || undefined}
            >
              {options?.confirmLabel ?? 'Confirmar'}
            </Button>
          </>
        }
      >
        <div className="text-sm leading-relaxed text-muted">{options?.message}</div>
      </Modal>
    </ConfirmContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm debe usarse dentro de ConfirmProvider')
  return ctx
}
