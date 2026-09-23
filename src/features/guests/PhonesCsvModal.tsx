import { useState } from 'react'
import { toast } from 'sonner'
import { AlertCircle, Download, Upload } from 'lucide-react'
import { attemptLoud } from '../../lib/attempt'
import { updateGuestsEach } from '../../lib/guestBulk'
import { downloadCsv } from '../../lib/download'
import { todayISO } from '../../lib/format'
import { phonesCsv, readPhonesCsv, type PhoneRow } from '../../lib/phoneCsv'
import { formatPhone } from '../../lib/phones'
import { Button } from '../../components/ui/Button'
import { Field, Textarea } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { tableKey } from '../../lib/crud'
import { useQueryClient } from '@tanstack/react-query'
import type { Guest } from '../../types/database'

const problem = (r: PhoneRow) =>
  r.status === 'invalido' || r.status === 'desconocido' || r.status === 'repetido' || !!r.note

/** Descarga la planilla y recibe el archivo lleno para guardar los teléfonos */
export function PhonesCsvModal({ guests, onClose }: { guests: Guest[]; onClose: () => void }) {
  const qc = useQueryClient()
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const result = text.trim() ? readPhonesCsv(text, guests) : null
  const issues = result?.rows.filter(problem) ?? []

  const readFile = async (file: File | undefined) => {
    if (!file) return
    setText(await file.text())
  }

  const save = async () => {
    if (!result || result.updates.length === 0) return
    setSaving(true)
    const ok = await attemptLoud(
      updateGuestsEach(result.updates.map((u) => ({ id: u.id, values: { phone: u.phone } }))),
    )
    setSaving(false)
    await qc.invalidateQueries({ queryKey: tableKey('guests') })
    if (!ok) return
    toast.success(`${result.updates.length} teléfonos guardados`)
    onClose()
  }

  return (
    <Modal
      open
      size="lg"
      onClose={onClose}
      title="Teléfonos por archivo"
      description="Descarga la planilla, llénala en Excel y vuelve a subirla."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={!result || result.updates.length === 0 || saving}>
            {saving ? 'Guardando…' : `Guardar ${result?.updates.length || ''} teléfonos`}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="rounded-xl border border-line bg-ivory px-4 py-3">
          <p className="text-sm">
            1. Descarga la planilla con los {guests.length} invitados. 2. Escribe el teléfono de cada uno con
            indicativo, por ejemplo <strong>573001234567</strong>. 3. Guárdala como CSV y súbela aquí.
          </p>
          <Button
            className="mt-2"
            size="sm"
            variant="secondary"
            icon={<Download className="size-4" />}
            onClick={() => downloadCsv(phonesCsv(guests), `telefonos-invitados-${todayISO()}.csv`)}
          >
            Descargar planilla
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-sm font-medium hover:border-brand-300">
            <Upload className="size-4" />
            Elegir archivo
            <input
              type="file"
              accept=".csv,text/csv,text/plain"
              className="sr-only"
              onChange={(e) => readFile(e.target.files?.[0])}
            />
          </label>
          <span className="text-xs text-muted">o pega el contenido abajo</span>
        </div>

        <Field label="Contenido del archivo" hint="Una línea por invitado: código, nombre, grupo y teléfono">
          {(id) => (
            <Textarea
              id={id}
              rows={5}
              className="font-mono text-xs"
              placeholder={'Código;Invitado;Grupo;Teléfono\n…;Tía Marta;Familia de la novia;573001234567'}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          )}
        </Field>

        {result && (
          <div className="rounded-xl border border-line">
            <div className="flex flex-wrap gap-x-5 gap-y-1 border-b border-line px-4 py-3 text-sm">
              <span>
                <strong className="tabular-nums">{result.counts.nuevo + result.counts.cambio}</strong> por guardar
              </span>
              {result.counts.igual > 0 && <span className="text-muted">{result.counts.igual} sin cambio</span>}
              {result.counts.sin_telefono > 0 && (
                <span className="text-muted">{result.counts.sin_telefono} sin teléfono</span>
              )}
              {result.counts.invalido > 0 && <span className="text-red-700">{result.counts.invalido} con error</span>}
              {result.counts.desconocido > 0 && (
                <span className="text-red-700">{result.counts.desconocido} no están en la lista</span>
              )}
              {result.counts.repetido > 0 && (
                <span className="text-red-700">{result.counts.repetido} con nombre repetido</span>
              )}
            </div>
            {issues.length > 0 && (
              <ul className="max-h-48 divide-y divide-line overflow-y-auto text-sm">
                {issues.slice(0, 60).map((r, i) => (
                  <li key={i} className="flex items-baseline justify-between gap-3 px-4 py-1.5">
                    <span className="min-w-0 truncate">{r.name}</span>
                    <span
                      className={
                        r.status === 'invalido' || r.status === 'desconocido' || r.status === 'repetido'
                          ? 'inline-flex shrink-0 items-center gap-1 text-xs text-red-700'
                          : 'shrink-0 text-xs text-amber-700'
                      }
                    >
                      {(r.status === 'invalido' || r.status === 'desconocido' || r.status === 'repetido') && (
                        <AlertCircle className="size-3.5 translate-y-0.5" />
                      )}
                      {r.status === 'desconocido'
                        ? 'No está en la lista'
                        : `${r.note ?? ''}${r.phone ? ` · ${formatPhone(r.phone)}` : r.raw ? ` · ${r.raw}` : ''}`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
