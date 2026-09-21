import { toast } from 'sonner'
import { Copy, Download } from 'lucide-react'
import { describeError } from '../../lib/errors'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { QrCode } from '../../components/ui/QrCode'
import { downloadQrPng } from '../../lib/qr'
import type { Guest } from '../../types/database'
import { copyRsvpLink, rsvpUrl } from './rsvpLinks'

function fileSafe(name: string) {
  return name
    .normalize('NFD')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
}

export function GuestQrModal({ guest, onClose }: { guest: Guest; onClose: () => void }) {
  const url = rsvpUrl(guest.rsvp_token)
  return (
    <Modal
      open
      onClose={onClose}
      title={`QR de ${guest.name}`}
      description="Para imprimir en su invitación: al escanearlo abre su página de confirmación."
      footer={
        <>
          <Button variant="secondary" icon={<Copy className="size-4" />} onClick={() => copyRsvpLink(guest.rsvp_token)}>
            Copiar link
          </Button>
          <Button
            icon={<Download className="size-4" />}
            onClick={() =>
              downloadQrPng(url, `qr-${fileSafe(guest.name)}.png`).catch((e) => toast.error(describeError(e)))
            }
          >
            Descargar PNG
          </Button>
        </>
      }
    >
      <div className="flex flex-col items-center gap-3">
        <QrCode value={url} label={`Código QR de confirmación de ${guest.name}`} className="w-56 rounded-xl border border-line p-2" />
        <code className="max-w-full truncate text-xs text-muted">{url}</code>
      </div>
    </Modal>
  )
}
