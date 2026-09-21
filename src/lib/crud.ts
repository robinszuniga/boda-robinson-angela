import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { InsertOf, RowOf, TableName, UpdateOf } from '../types/database'

// En esta capa genérica se usa el cliente sin tipar para no pelear con los genéricos
// de supabase-js; los tipos de fila se aplican en las firmas públicas.
const db = supabase as unknown as SupabaseClient

interface OrderBy {
  column: string
  ascending?: boolean
  nullsFirst?: boolean
}

interface TableApiOptions {
  order?: OrderBy[]
  /** Otras tablas que cambian por cascadas o "set null" al modificar esta */
  invalidates?: TableName[]
}

export const tableKey = (table: TableName) => ['table', table] as const

type WithId = { id: string }

export function createTableApi<T extends TableName>(table: T, options: TableApiOptions = {}) {
  type Row = RowOf<T>
  const key = tableKey(table)
  const related = [key, ...(options.invalidates ?? []).map(tableKey)]

  async function fetchAll(): Promise<Row[]> {
    let query = db.from(table).select('*')
    for (const o of options.order ?? []) {
      query = query.order(o.column, { ascending: o.ascending ?? true, nullsFirst: o.nullsFirst })
    }
    const { data, error } = await query
    if (error) throw error
    return data as Row[]
  }

  function useInvalidate() {
    const qc = useQueryClient()
    return () => Promise.all(related.map((queryKey) => qc.invalidateQueries({ queryKey })))
  }

  function useList() {
    return useQuery({ queryKey: key, queryFn: fetchAll })
  }

  function useCreate() {
    const invalidate = useInvalidate()
    return useMutation({
      mutationFn: async (values: InsertOf<T> | InsertOf<T>[]) => {
        const { data, error } = await db.from(table).insert(values as never).select()
        if (error) throw error
        return data as Row[]
      },
      onSettled: invalidate,
    })
  }

  /** Actualiza con respuesta optimista (útil para arrastrar y soltar) */
  function useUpdate() {
    const qc = useQueryClient()
    const invalidate = useInvalidate()
    return useMutation({
      mutationFn: async ({ id, values }: { id: string; values: UpdateOf<T> }) => {
        const { error } = await db.from(table).update(values as never).eq('id', id)
        if (error) throw error
      },
      onMutate: async ({ id, values }) => {
        await qc.cancelQueries({ queryKey: key })
        const previous = qc.getQueryData<Row[]>(key)
        if (previous) {
          qc.setQueryData<Row[]>(
            key,
            previous.map((row) => ((row as WithId).id === id ? { ...row, ...values } : row)),
          )
        }
        return { previous }
      },
      onError: (_error, _vars, context) => {
        if (context?.previous) qc.setQueryData(key, context.previous)
      },
      onSettled: invalidate,
    })
  }

  function useRemove() {
    const qc = useQueryClient()
    const invalidate = useInvalidate()
    return useMutation({
      mutationFn: async (id: string) => {
        const { error } = await db.from(table).delete().eq('id', id)
        if (error) throw error
      },
      onMutate: async (id) => {
        await qc.cancelQueries({ queryKey: key })
        const previous = qc.getQueryData<Row[]>(key)
        if (previous) {
          qc.setQueryData<Row[]>(
            key,
            previous.filter((row) => (row as WithId).id !== id),
          )
        }
        return { previous }
      },
      onError: (_error, _id, context) => {
        if (context?.previous) qc.setQueryData(key, context.previous)
      },
      onSettled: invalidate,
    })
  }

  return { key, fetchAll, useList, useCreate, useUpdate, useRemove }
}
