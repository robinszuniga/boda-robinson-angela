import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { tableKey } from '../../lib/crud'
import { BUCKET, removeFile, signedUrl, uploadFile } from '../../lib/storage'
import type { DocumentCategory, DocumentRow } from '../../types/database'

interface UploadInput {
  files: File[]
  category: DocumentCategory
  vendorId?: string | null
}

export function useUploadDocuments() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ files, category, vendorId }: UploadInput) => {
      for (const file of files) {
        const folder = vendorId ? `proveedores/${vendorId}` : category
        const path = await uploadFile(file, folder)
        const { error } = await supabase.from('documents').insert({
          name: file.name,
          category,
          vendor_id: vendorId ?? null,
          storage_path: path,
          mime_type: file.type || null,
          size_bytes: file.size,
        })
        if (error) {
          await removeFile(path).catch(() => undefined)
          throw error
        }
      }
      return files.length
    },
    onSettled: () => qc.invalidateQueries({ queryKey: tableKey('documents') }),
  })
}

export function useDeleteDocument() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (doc: DocumentRow) => {
      await removeFile(doc.storage_path)
      const { error } = await supabase.from('documents').delete().eq('id', doc.id)
      if (error) throw error
    },
    onSettled: () => qc.invalidateQueries({ queryKey: tableKey('documents') }),
  })
}

export async function openDocument(doc: DocumentRow, download = false) {
  // Se abre la pestaña antes del await para que el navegador no la bloquee como popup
  const tab = download ? null : window.open('', '_blank')
  try {
    const url = await signedUrl(doc.storage_path, download ? doc.name : undefined)
    if (tab) tab.location.href = url
    else window.location.href = url
  } catch (error) {
    tab?.close()
    throw error
  }
}

/** URLs firmadas (1 h) para miniaturas de imágenes */
export function useSignedUrls(paths: string[]) {
  return useQuery({
    queryKey: ['signed-urls', ...paths],
    enabled: paths.length > 0,
    staleTime: 50 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 60 * 60)
      if (error) throw error
      return new Map(data.map((d) => [d.path ?? '', d.signedUrl]))
    },
  })
}
