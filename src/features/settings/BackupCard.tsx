import { useState } from 'react'
import { toast } from 'sonner'
import { DatabaseBackup, Sheet } from 'lucide-react'
import { guestMembersApi, guestsApi, seatingTablesApi } from '../../lib/api'
import { downloadBackup, downloadGuestsCsv } from '../../lib/backup'
import { describeError } from '../../lib/errors'
import { Button } from '../../components/ui/Button'
import { Card, CardHeader } from '../../components/ui/Display'

/** El plan gratis de Supabase no guarda copias automáticas: esta descarga es el respaldo */
export function BackupCard() {
  const guests = guestsApi.useList()
  const tables = seatingTablesApi.useList()
  const members = guestMembersApi.useList()
  const [busy, setBusy] = useState(false)

  const backup = async () => {
    setBusy(true)
    try {
      const n = await downloadBackup()
      toast.success(`Respaldo descargado (${n} registros)`)
    } catch (error) {
      toast.error(describeError(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader title="Respaldo" subtitle="El plan gratis de Supabase no guarda copias automáticas" />
      <div className="flex flex-col gap-3 px-5 pb-5 text-sm">
        <p className="text-muted">
          Descarguen un respaldo de vez en cuando (por ejemplo cada mes) y guárdenlo en su Drive. No incluye los archivos de
          Documentos.
        </p>
        <Button size="sm" icon={<DatabaseBackup className="size-4" />} onClick={backup} disabled={busy}>
          {busy ? 'Descargando…' : 'Descargar respaldo completo'}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          icon={<Sheet className="size-4" />}
          disabled={!guests.data || !tables.data || !members.data}
          onClick={() => downloadGuestsCsv(guests.data ?? [], tables.data ?? [], members.data ?? [])}
        >
          Lista de invitados para Excel
        </Button>
      </div>
    </Card>
  )
}
