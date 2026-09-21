import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Upload } from 'lucide-react'
import { attempt } from '../../lib/attempt'
import { MAX_FILE_BYTES } from '../../lib/storage'
import { cn } from '../../components/ui/cn'
import type { DocumentCategory } from '../../types/database'
import { useUploadDocuments } from './documentActions'

export function DocumentUploader({
  category,
  vendorId,
  compact = false,
}: {
  category: DocumentCategory
  vendorId?: string | null
  compact?: boolean
}) {
  const input = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const upload = useUploadDocuments()

  const handleFiles = async (list: FileList | null) => {
    const files = Array.from(list ?? [])
    if (files.length === 0) return
    const tooBig = files.filter((f) => f.size > MAX_FILE_BYTES)
    if (tooBig.length) {
      toast.error(`Máximo 20 MB por archivo: ${tooBig.map((f) => f.name).join(', ')}`)
      return
    }
    if (await attempt(upload.mutateAsync({ files, category, vendorId }))) {
      toast.success(files.length === 1 ? 'Archivo subido' : `${files.length} archivos subidos`)
    }
    if (input.current) input.current.value = ''
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        handleFiles(e.dataTransfer.files)
      }}
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed text-center transition-colors',
        compact ? 'px-4 py-4' : 'px-6 py-8',
        dragging ? 'border-brand-400 bg-brand-50' : 'border-line bg-white/60',
      )}
    >
      {upload.isPending ? (
        <Loader2 className="size-5 animate-spin text-brand-500" />
      ) : (
        <Upload className="size-5 text-brand-500" />
      )}
      <p className="text-sm text-muted">
        {upload.isPending ? 'Subiendo…' : 'Arrastra archivos aquí o '}
        {!upload.isPending && (
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="font-medium text-brand-700 underline-offset-2 hover:underline"
          >
            elígelos
          </button>
        )}
      </p>
      {!compact && <p className="text-xs text-muted">PDF, imágenes, Word… hasta 20 MB</p>}
      <input ref={input} type="file" multiple className="sr-only" onChange={(e) => handleFiles(e.target.files)} />
    </div>
  )
}
