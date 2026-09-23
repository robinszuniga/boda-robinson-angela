import { useState } from 'react'
import { toast } from 'sonner'
import { AlertCircle } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { guestsApi } from '../../lib/api'
import { supabase } from '../../lib/supabase'
import { tableKey } from '../../lib/crud'
import { friendlyError } from '../../lib/errors'
import { attempt, attemptLoud } from '../../lib/attempt'
import { guestGroup, options } from '../../lib/labels'
import { MAX_PLUS_ONES, parseGuestLines } from '../../lib/guestLines'
import { plural } from '../../lib/format'
import { Button } from '../../components/ui/Button'
import { Field, FormGrid, Input, Select, Textarea } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import type { GuestGroup } from '../../types/database'

/** Agregar muchos invitados de una vez: uno por línea, cada uno con sus acompañantes */
export function BulkGuestsModal({ onClose }: { onClose: () => void }) {
  const create = guestsApi.useCreate()
  const qc = useQueryClient()
  const [savingMembers, setSavingMembers] = useState(false)
  const [text, setText] = useState('')
  const [group, setGroup] = useState<GuestGroup>('amigos')
  const [plusOnes, setPlusOnes] = useState(0)

  const lines = parseGuestLines(text, plusOnes)
  const invalid = lines.filter((l) => l.error).length
  const saving = create.isPending || savingMembers

  const save = async () => {
    let created: { id: string }[] = []
    const ok = await attempt(
      create
        .mutateAsync(lines.map((l) => ({ name: l.name, guest_group: group, plus_ones_allowed: l.plusOnes })))
        .then((rows) => {
          created = rows
        }),
    )
    if (!ok) return
    // Ya quedaron guardados: se limpia el texto para que un reintento no los duplique
    setText('')
    // Los invitados vuelven en el mismo orden en que se insertaron
    const members = lines.flatMap((l, i) =>
      l.members.map((name, j) => ({ guest_id: created[i].id, name, sort_order: j })),
    )
    if (members.length > 0) {
      setSavingMembers(true)
      const saved = await attemptLoud(
        (async () => {
          const { error } = await supabase.from('guest_members').insert(members)
          if (error) {
            throw friendlyError('Se agregaron los invitados, pero no sus acompañantes. Agrégalos entrando a cada uno.')
          }
        })(),
      )
      setSavingMembers(false)
      await qc.invalidateQueries({ queryKey: tableKey('guest_members') })
      if (!saved) {
        onClose()
        return
      }
    }
    toast.success(`${plural(lines.length, 'invitado agregado', 'invitados agregados')}`)
    onClose()
  }

  return (
    <Modal
      open
      size="lg"
      onClose={onClose}
      title="Agregar varios invitados"
      description="Uno por línea. Puedes hacer varias tandas, cada una con su grupo."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={lines.length === 0 || invalid > 0 || saving}>
            Agregar {lines.length || ''}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field
          label="Invitados"
          hint={
            <>
              Para darle acompañantes a alguien escribe <strong>Tía Marta +2</strong>, o con sus nombres:{' '}
              <strong>Familia Pérez: Ana, Tomás y Sara</strong>. La edad de cada uno se ajusta después al editarlo.
            </>
          }
        >
          {(id) => (
            <Textarea
              id={id}
              rows={7}
              data-autofocus
              placeholder={'Tía Marta +2\nFamilia Pérez: Ana, Tomás y Sara\nJuan Camilo Rojas'}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          )}
        </Field>
        <FormGrid>
          <Field label="Grupo">
            {(id) => (
              <Select id={id} value={group} onChange={(e) => setGroup(e.target.value as GuestGroup)}>
                {options(guestGroup).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Acompañantes por defecto" hint="Para las líneas sin +N ni nombres">
            {(id) => (
              <Input
                id={id}
                type="number"
                min={0}
                max={MAX_PLUS_ONES}
                value={plusOnes}
                onChange={(e) => setPlusOnes(Math.max(0, Math.min(MAX_PLUS_ONES, Number(e.target.value) || 0)))}
              />
            )}
          </Field>
        </FormGrid>

        {lines.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted">Así quedarían</p>
            <ul className="max-h-48 divide-y divide-line overflow-y-auto rounded-xl border border-line text-sm">
              {lines.map((l, i) => (
                <li key={i} className="flex items-baseline justify-between gap-3 px-3 py-1.5">
                  <span className="min-w-0 truncate">{l.name || '—'}</span>
                  {l.error ? (
                    <span className="inline-flex shrink-0 items-center gap-1 text-xs text-red-700">
                      <AlertCircle className="size-3.5 translate-y-0.5" /> {l.error}
                    </span>
                  ) : (
                    <span className="min-w-0 truncate text-right text-xs text-muted">
                      {l.members.length > 0
                        ? `con ${l.members.join(', ')}`
                        : l.plusOnes > 0
                          ? plural(l.plusOnes, 'acompañante', 'acompañantes')
                          : 'solo'}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  )
}
