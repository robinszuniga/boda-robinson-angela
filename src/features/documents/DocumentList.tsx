import { toast } from 'sonner'
import { Download, ExternalLink, FileText, Image as ImageIcon, Trash2 } from 'lucide-react'
import { attempt } from '../../lib/attempt'
import { describeError } from '../../lib/errors'
import { formatBytes, formatDate } from '../../lib/format'
import { documentCategory } from '../../lib/labels'
import { isImage } from '../../lib/storage'
import { IconButton } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Display'
import { useConfirm } from '../../components/ui/Confirm'
import type { DocumentRow } from '../../types/database'
import { openDocument, useDeleteDocument } from './documentActions'

export function DocumentList({
  documents,
  vendorName,
  empty = 'No hay archivos todavía.',
}: {
  documents: DocumentRow[]
  vendorName?: (id: string) => string | undefined
  empty?: string
}) {
  const remove = useDeleteDocument()
  const confirm = useConfirm()

  if (documents.length === 0) return <p className="text-sm text-muted">{empty}</p>

  const open = (doc: DocumentRow, download = false) =>
    openDocument(doc, download).catch((e) => toast.error(describeError(e)))

  return (
    <ul className="divide-y divide-line rounded-xl border border-line bg-white">
      {documents.map((doc) => {
        const Icon = isImage(doc.mime_type) ? ImageIcon : FileText
        return (
          <li key={doc.id} className="flex items-center gap-3 px-3 py-2.5">
            <Icon className="size-5 shrink-0 text-brand-500" />
            <button type="button" onClick={() => open(doc)} className="min-w-0 flex-1 text-left">
              <p className="truncate text-sm font-medium hover:underline">{doc.name}</p>
              <p className="truncate text-xs text-muted">
                {formatDate(doc.uploaded_at)} · {formatBytes(doc.size_bytes)}
                {doc.vendor_id && vendorName?.(doc.vendor_id) ? ` · ${vendorName(doc.vendor_id)}` : ''}
              </p>
            </button>
            <Badge className="hidden sm:inline-flex">{documentCategory[doc.category]}</Badge>
            <IconButton label="Abrir" onClick={() => open(doc)}>
              <ExternalLink className="size-4" />
            </IconButton>
            <IconButton label="Descargar" onClick={() => open(doc, true)}>
              <Download className="size-4" />
            </IconButton>
            <IconButton
              label="Borrar"
              onClick={async () => {
                const ok = await confirm({ title: `¿Borrar "${doc.name}"?`, confirmLabel: 'Borrar', danger: true })
                if (ok && (await attempt(remove.mutateAsync(doc)))) toast.success('Archivo borrado')
              }}
            >
              <Trash2 className="size-4" />
            </IconButton>
          </li>
        )
      })}
    </ul>
  )
}
