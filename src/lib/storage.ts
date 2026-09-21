import { supabase } from './supabase'

export const BUCKET = 'documentos'
export const MAX_FILE_BYTES = 20 * 1024 * 1024

function safeName(name: string): string {
  const normalized = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  return normalized.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').slice(-80) || 'archivo'
}

export async function uploadFile(file: File, folder: string): Promise<string> {
  if (file.size > MAX_FILE_BYTES) throw new Error('Payload too large')
  const path = `${folder}/${crypto.randomUUID()}-${safeName(file.name)}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || undefined,
    upsert: false,
  })
  if (error) throw error
  return path
}

export async function signedUrl(path: string, download?: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 60 * 60, download ? { download } : undefined)
  if (error) throw error
  return data.signedUrl
}

export async function removeFile(path: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([path])
  if (error) throw error
}

export function isImage(mime: string | null | undefined): boolean {
  return !!mime && mime.startsWith('image/')
}
