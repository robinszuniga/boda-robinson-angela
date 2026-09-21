import { useState } from 'react'
import { toast } from 'sonner'
import { guestsApi } from '../../lib/api'
import { attempt } from '../../lib/attempt'
import { guestGroup, options } from '../../lib/labels'
import { Button } from '../../components/ui/Button'
import { Field, FormGrid, Input, Select, Textarea } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import type { GuestGroup } from '../../types/database'

/** Agregar muchos invitados de una vez: un nombre por línea */
export function BulkGuestsModal({ onClose }: { onClose: () => void }) {
  const create = guestsApi.useCreate()
  const [text, setText] = useState('')
  const [group, setGroup] = useState<GuestGroup>('amigos')
  const [plusOnes, setPlusOnes] = useState(0)

  const names = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const save = async () => {
    const rows = names.map((name) => ({ name, guest_group: group, plus_ones_allowed: plusOnes }))
    if (await attempt(create.mutateAsync(rows))) {
      toast.success(`${rows.length} invitados agregados`)
      onClose()
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Agregar varios invitados"
      description="Escribe o pega un nombre por línea"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={names.length === 0 || create.isPending}>
            Agregar {names.length || ''}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Nombres">
          {(id) => (
            <Textarea
              id={id}
              rows={8}
              data-autofocus
              placeholder={'Tía Marta\nFamilia Pérez Gómez\nJuan Camilo Rojas'}
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
          <Field label="Acompañantes permitidos a cada uno">
            {(id) => (
              <Input
                id={id}
                type="number"
                min={0}
                max={10}
                value={plusOnes}
                onChange={(e) => setPlusOnes(Math.max(0, Math.min(10, Number(e.target.value) || 0)))}
              />
            )}
          </Field>
        </FormGrid>
      </div>
    </Modal>
  )
}
