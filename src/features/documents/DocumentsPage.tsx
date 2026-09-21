import { useState } from 'react'
import { toast } from 'sonner'
import { FolderOpen, Trash2 } from 'lucide-react'
import { documentsApi, vendorsApi } from '../../lib/api'
import { attempt } from '../../lib/attempt'
import { describeError } from '../../lib/errors'
import { documentCategory, options } from '../../lib/labels'
import { isImage } from '../../lib/storage'
import { IconButton } from '../../components/ui/Button'
import { Card, EmptyState, ErrorState, LoadingState, PageHeader } from '../../components/ui/Display'
import { Field, FormGrid, Select } from '../../components/ui/Field'
import { cn } from '../../components/ui/cn'
import { useConfirm } from '../../components/ui/Confirm'
import type { DocumentCategory, DocumentRow } from '../../types/database'
import { DocumentList } from './DocumentList'
import { DocumentUploader } from './DocumentUploader'
import { openDocument, useDeleteDocument, useSignedUrls } from './documentActions'

type Tab = DocumentCategory | 'todos'

export default function DocumentsPage() {
  const documents = documentsApi.useList()
  const vendors = vendorsApi.useList()
  const [tab, setTab] = useState<Tab>('todos')
  const [uploadCategory, setUploadCategory] = useState<DocumentCategory>('contrato')
  const [uploadVendor, setUploadVendor] = useState('')

  if (documents.isError || vendors.isError) {
    return <ErrorState error={documents.error ?? vendors.error} onRetry={() => { documents.refetch(); vendors.refetch() }} />
  }
  if (documents.isPending || vendors.isPending) return <LoadingState />

  const vendorName = (id: string) => vendors.data.find((v) => v.id === id)?.name
  const counts = new Map<Tab, number>([['todos', documents.data.length]])
  for (const d of documents.data) counts.set(d.category, (counts.get(d.category) ?? 0) + 1)
  const shown = tab === 'todos' ? documents.data : documents.data.filter((d) => d.category === tab)
  const images = shown.filter((d) => d.category === 'inspiracion' && isImage(d.mime_type))
  const others = shown.filter((d) => !images.includes(d))

  const tabs: { value: Tab; label: string }[] = [{ value: 'todos', label: 'Todos' }, ...options(documentCategory)]

  return (
    <>
      <PageHeader title="Documentos" description="Contratos, cotizaciones, facturas e inspiración, guardados de forma privada" />

      <Card className="mb-6 p-5">
        <FormGrid className="mb-4">
          <Field label="Tipo de archivo">
            {(id) => (
              <Select id={id} value={uploadCategory} onChange={(e) => setUploadCategory(e.target.value as DocumentCategory)}>
                {options(documentCategory).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Proveedor" hint="Opcional: aparece también en la ficha del proveedor">
            {(id) => (
              <Select id={id} value={uploadVendor} onChange={(e) => setUploadVendor(e.target.value)}>
                <option value="">— Ninguno —</option>
                {vendors.data
                  .filter((v) => v.status !== 'descartado')
                  .map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
              </Select>
            )}
          </Field>
        </FormGrid>
        <DocumentUploader category={uploadCategory} vendorId={uploadVendor || null} />
      </Card>

      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0" role="tablist" aria-label="Tipo de documento">
        {tabs.map((t) => (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={tab === t.value}
            onClick={() => setTab(t.value)}
            className={cn(
              'shrink-0 rounded-full border px-3 py-1.5 text-sm transition-colors',
              tab === t.value ? 'border-brand-600 bg-brand-600 text-white' : 'border-line bg-white hover:border-brand-300',
            )}
          >
            {t.label}
            <span className={cn('ml-1.5 text-xs', tab === t.value ? 'text-white/80' : 'text-muted')}>{counts.get(t.value) ?? 0}</span>
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <EmptyState icon={<FolderOpen className="size-8" />} title="No hay archivos aquí">
          Sube contratos y cotizaciones para tenerlos a la mano, o fotos de inspiración para decoración, vestido y flores.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-6">
          {images.length > 0 && <InspirationGallery docs={images} />}
          {others.length > 0 && <DocumentList documents={others} vendorName={vendorName} />}
        </div>
      )}
    </>
  )
}

function InspirationGallery({ docs }: { docs: DocumentRow[] }) {
  const urls = useSignedUrls(docs.map((d) => d.storage_path))
  const remove = useDeleteDocument()
  const confirm = useConfirm()

  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {docs.map((doc) => {
        const src = urls.data?.get(doc.storage_path)
        return (
          <li key={doc.id} className="group relative aspect-square overflow-hidden rounded-xl border border-line bg-stone-100">
            <button
              type="button"
              className="size-full"
              onClick={() => openDocument(doc).catch((e) => toast.error(describeError(e)))}
              aria-label={`Abrir ${doc.name}`}
            >
              {src ? (
                <img src={src} alt={doc.name} loading="lazy" className="size-full object-cover transition group-hover:scale-105" />
              ) : (
                <span className="flex size-full items-center justify-center text-xs text-muted">Cargando…</span>
              )}
            </button>
            <IconButton
              label={`Borrar ${doc.name}`}
              className="absolute top-2 right-2 bg-white/90 opacity-100 shadow sm:opacity-0 sm:group-hover:opacity-100"
              onClick={async () => {
                const ok = await confirm({ title: '¿Borrar esta imagen?', confirmLabel: 'Borrar', danger: true })
                if (ok) await attempt(remove.mutateAsync(doc))
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
