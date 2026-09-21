import { useState } from 'react'
import { toast } from 'sonner'
import { Check, Copy, MessageCircle, RefreshCw } from 'lucide-react'
import { whatsappLink } from '../../lib/contact'
import { thankYouMessage, type ThanksRow } from '../../lib/thanks'
import { Button } from '../../components/ui/Button'
import { Textarea } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import type { WeddingSettings } from '../../types/database'

/** Mensaje de agradecimiento a partir de una plantilla; se puede editar antes de enviarlo */
export function ThankYouMessageModal({
  row,
  settings,
  onSent,
  onClose,
}: {
  row: ThanksRow
  settings: WeddingSettings
  onSent: () => void
  onClose: () => void
}) {
  const [variant, setVariant] = useState(0)
  const [text, setText] = useState(() => thankYouMessage(row, settings, 0))

  const regenerate = () => {
    const next = variant + 1
    setVariant(next)
    setText(thankYouMessage(row, settings, next))
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Mensaje copiado')
    } catch {
      toast.error('No se pudo copiar')
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Agradecimiento para ${row.name}`}
      description="Plantilla lista para personalizar: agrega un recuerdo o detalle propio."
      footer={
        <>
          <Button variant="ghost" className="mr-auto" icon={<RefreshCw className="size-4" />} onClick={regenerate}>
            Otra versión
          </Button>
          <Button variant="secondary" icon={<Copy className="size-4" />} onClick={copy}>
            Copiar
          </Button>
          <Button
            icon={<Check className="size-4" />}
            onClick={() => {
              onSent()
              onClose()
            }}
          >
            Marcar enviado
          </Button>
        </>
      }
    >
      <Textarea aria-label="Mensaje de agradecimiento" rows={7} value={text} onChange={(e) => setText(e.target.value)} />
      <a
        href={whatsappLink(row.guest?.phone, text)}
        target="_blank"
        rel="noreferrer"
        className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 hover:underline"
      >
        <MessageCircle className="size-4" /> Abrir en WhatsApp{row.guest?.phone ? '' : ' (elige el chat)'}
      </a>
    </Modal>
  )
}
