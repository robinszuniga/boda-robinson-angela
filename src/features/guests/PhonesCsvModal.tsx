import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { AlertCircle, Download, Upload } from 'lucide-react'
import { attemptLoud } from '../../lib/attempt'
import { updateGuestsEach } from '../../lib/guestBulk'
import { downloadCsv } from '../../lib/download'
import { todayISO } from '../../lib/format'
import {
  applyManual,
  contactLabel,
  emptyCounts,
  nameKey,
  phonesCsv,
  type PhoneImport,
  type PhoneRow,
  type PhoneRowStatus,
} from '../../lib/phoneCsv'
import { readPhonesFile } from '../../lib/googleContacts'
import { formatPhone } from '../../lib/phones'
import { Button } from '../../components/ui/Button'
import { Field, Input, Textarea } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { tableKey } from '../../lib/crud'
import { useQueryClient } from '@tanstack/react-query'
import type { Guest } from '../../types/database'

const problem = (r: PhoneRow) =>
  r.status === 'invalido' || r.status === 'desconocido' || r.status === 'repetido' || !!r.note

/** Primero lo que hay que revisar y de último los que simplemente no aparecieron */
const ORDER: Record<PhoneRowStatus, number> = {
  invalido: 0,
  repetido: 1,
  desconocido: 2,
  nuevo: 3,
  cambio: 3,
  igual: 4,
  sin_telefono: 5,
}

/** Una agenda de Google es larga: no se pega entera en el cuadro de texto */
const BIG = 20_000
/** Cuántos invitados se muestran a la vez en el buscador */
const SHOWN = 8
const SIN_ARCHIVO: PhoneImport = { kind: 'planilla', rows: [], contacts: [], updates: [], counts: emptyCounts() }

/** Recibe la planilla, los contactos de Google, o lo que se asigne a mano */
export function PhonesCsvModal({ guests, onClose }: { guests: Guest[]; onClose: () => void }) {
  const qc = useQueryClient()
  const [text, setText] = useState('')
  const [manual, setManual] = useState<Record<string, string>>({})
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)

  const parsed = useMemo(() => (text.trim() ? readPhonesFile(text, guests) : SIN_ARCHIVO), [text, guests])
  const result = useMemo(() => applyManual(parsed, guests, manual), [parsed, guests, manual])
  const issues = result.rows.filter(problem).sort((a, b) => ORDER[a.status] - ORDER[b.status])
  const google = result.kind === 'google'
  const big = text.length > BIG
  const shownResult = !!text.trim() || result.rows.length > 0

  const rowOf = new Map(result.rows.flatMap((r) => (r.guestId ? [[r.guestId, r] as const] : [])))
  const pendiente = (g: Guest) => {
    const row = rowOf.get(g.id)
    return !g.phone && (!row || !row.phone)
  }
  // Al que se le acaba de escribir el número se queda en la lista, para poder revisarlo
  const buscados = search.trim()
    ? guests.filter((g) => nameKey(g.name).includes(nameKey(search)))
    : guests.filter((g) => pendiente(g) || manual[g.id]?.trim())

  const save = async () => {
    if (result.updates.length === 0) return
    setSaving(true)
    const ok = await attemptLoud(
      updateGuestsEach(result.updates.map((u) => ({ id: u.id, values: { phone: u.phone } }))),
    )
    setSaving(false)
    await qc.invalidateQueries({ queryKey: tableKey('guests') })
    if (!ok) return
    toast.success(result.updates.length === 1 ? 'Teléfono guardado' : `${result.updates.length} teléfonos guardados`)
    onClose()
  }

  return (
    <Modal
      open
      size="lg"
      onClose={onClose}
      title="Teléfonos por archivo"
      description="Súbelos desde tus contactos de Google, llena la planilla o asígnalos a mano."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={result.updates.length === 0 || saving}>
            {saving
              ? 'Guardando…'
              : result.updates.length === 1
                ? 'Guardar 1 teléfono'
                : `Guardar ${result.updates.length || ''} teléfonos`}
          </Button>
        </>
      }
    >
      <datalist id="agenda-contactos">
        {result.contacts.slice(0, 1000).map((c, i) => (
          <option key={i} value={contactLabel(c)} />
        ))}
      </datalist>

      <div className="flex flex-col gap-4">
        <div className="rounded-xl border border-line bg-ivory px-4 py-3">
          <p className="text-sm font-medium">Desde tus contactos de Google</p>
          <p className="mt-1 text-sm text-muted">
            En <strong>contacts.google.com</strong> elige <strong>Exportar</strong>, formato{' '}
            <strong>Google CSV</strong>, y sube aquí ese archivo. Busco a cada invitado por su nombre y te muestro qué
            encontré antes de guardar nada. Los demás contactos se ignoran.
          </p>
        </div>

        <div className="rounded-xl border border-line bg-ivory px-4 py-3">
          <p className="text-sm font-medium">O a mano, en Excel</p>
          <p className="mt-1 text-sm text-muted">
            Descarga la planilla con los {guests.length} invitados, escribe el teléfono de cada uno con indicativo
            (por ejemplo <strong>573001234567</strong>), guárdala como CSV y súbela.
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
              onChange={async (e) => {
                const file = e.target.files?.[0]
                if (file) setText(await file.text())
              }}
            />
          </label>
          <span className="text-xs text-muted">{big ? 'Archivo cargado' : 'o pega el contenido abajo'}</span>
        </div>

        {big ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-line px-4 py-2 text-sm">
            <span className="text-muted">
              Archivo de {Math.round(text.length / 1024)} KB
              {google ? ` · ${result.contacts.length} contactos leídos` : ''}
            </span>
            <Button size="sm" variant="secondary" onClick={() => setText('')}>
              Quitar
            </Button>
          </div>
        ) : (
          <Field label="Contenido del archivo" hint="La planilla de la app o el CSV de Google Contactos">
            {(id) => (
              <Textarea
                id={id}
                rows={4}
                className="font-mono text-xs"
                placeholder={'Código;Invitado;Grupo;Teléfono\n…;Tía Marta;Familia de la novia;573001234567'}
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            )}
          </Field>
        )}

        <div className="rounded-xl border border-line px-4 py-3">
          <p className="text-sm font-medium">Asignar a mano</p>
          <p className="mt-1 text-sm text-muted">
            Para los que tienes con apodo o no aparecieron: busca al invitado y
            {google ? ' elige su contacto de la lista o ' : ' '}
            escribe el número.
          </p>
          <Input
            className="mt-2"
            placeholder="Buscar invitado por su nombre"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <ul className="mt-2 flex flex-col gap-1.5">
            {buscados.slice(0, SHOWN).map((g) => {
              const row = manual[g.id]?.trim() ? rowOf.get(g.id) : undefined
              return (
                <li key={g.id} className="flex flex-wrap items-center gap-2">
                  <span className="w-40 shrink-0 truncate text-sm">{g.name}</span>
                  <input
                    list="agenda-contactos"
                    className="min-w-0 flex-1 rounded-lg border border-line bg-white px-3 py-1.5 text-sm outline-none focus:border-brand-300"
                    placeholder={google ? 'Contacto o número' : 'Número, por ejemplo 3001234567'}
                    aria-label={`Teléfono de ${g.name}`}
                    value={manual[g.id] ?? ''}
                    onChange={(e) => setManual((m) => ({ ...m, [g.id]: e.target.value }))}
                  />
                  {row && (
                    <span
                      className={`shrink-0 text-xs ${row.status === 'invalido' ? 'text-red-700' : 'text-muted'}`}
                    >
                      {row.phone ? formatPhone(row.phone) : row.note}
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
          {buscados.length === 0 && (
            <p className="mt-2 text-sm text-muted">
              {search.trim() ? 'Ningún invitado con ese nombre' : 'Todos tienen teléfono'}
            </p>
          )}
          {buscados.length > SHOWN && (
            <p className="mt-2 text-xs text-muted">
              y {buscados.length - SHOWN} más · escribe un nombre arriba para encontrarlo
            </p>
          )}
        </div>

        {shownResult && (
          <div className="rounded-xl border border-line">
            <div className="flex flex-wrap gap-x-5 gap-y-1 border-b border-line px-4 py-3 text-sm">
              <span>
                <strong className="tabular-nums">{result.counts.nuevo + result.counts.cambio}</strong> por guardar
              </span>
              {result.counts.igual > 0 && <span className="text-muted">{result.counts.igual} ya lo tenían</span>}
              {result.counts.sin_telefono > 0 && (
                <span className="text-muted">
                  {result.counts.sin_telefono} {google ? 'sin encontrar' : 'sin teléfono'}
                </span>
              )}
              {result.counts.invalido > 0 && <span className="text-red-700">{result.counts.invalido} con error</span>}
              {result.counts.desconocido > 0 && (
                <span className="text-red-700">{result.counts.desconocido} no están en la lista</span>
              )}
              {result.counts.repetido > 0 && (
                <span className="text-amber-700">{result.counts.repetido} con varios parecidos</span>
              )}
            </div>
            {issues.length > 0 && (
              <ul className="max-h-48 divide-y divide-line overflow-y-auto text-sm">
                {issues.slice(0, 60).map((r, i) => (
                  <li key={i} className="flex items-baseline justify-between gap-3 px-4 py-1.5">
                    <span className="min-w-0 truncate">{r.name}</span>
                    <span
                      className={
                        r.status === 'invalido' || r.status === 'desconocido'
                          ? 'inline-flex shrink-0 items-center gap-1 text-xs text-red-700'
                          : r.status === 'repetido'
                            ? 'inline-flex shrink-0 items-center gap-1 text-xs text-amber-700'
                            : 'max-w-[60%] shrink-0 truncate text-xs text-muted'
                      }
                    >
                      {(r.status === 'invalido' || r.status === 'desconocido' || r.status === 'repetido') && (
                        <AlertCircle className="size-3.5 translate-y-0.5" />
                      )}
                      {r.status === 'desconocido'
                        ? 'No está en la lista'
                        : `${r.note ?? ''}${r.phone ? ` · ${formatPhone(r.phone)}` : r.raw && r.status !== 'repetido' ? ` · ${r.raw}` : ''}`}
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
