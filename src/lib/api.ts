import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createTableApi } from './crud'
import { supabase } from './supabase'
import type { WeddingSettings } from '../types/database'

export const categoriesApi = createTableApi('budget_categories', {
  order: [{ column: 'sort_order' }, { column: 'created_at' }],
  invalidates: ['vendors'],
})

export const vendorsApi = createTableApi('vendors', {
  order: [{ column: 'name' }],
  invalidates: ['payments', 'documents', 'day_schedule_items'],
})

export const paymentsApi = createTableApi('payments', {
  order: [{ column: 'date' }, { column: 'created_at' }],
})

export const seatingTablesApi = createTableApi('seating_tables', {
  order: [{ column: 'number' }],
  invalidates: ['guests'],
})

export const guestsApi = createTableApi('guests', {
  order: [{ column: 'name' }],
  invalidates: ['guest_links', 'gift_claims', 'gifts_received', 'guest_members'],
})

export const guestMembersApi = createTableApi('guest_members', {
  order: [{ column: 'sort_order' }, { column: 'created_at' }],
})

export const guestLinksApi = createTableApi('guest_links', {
  order: [{ column: 'created_at' }],
})

export const tasksApi = createTableApi('tasks', {
  order: [
    { column: 'due_date', nullsFirst: false },
    { column: 'sort_order' },
    { column: 'created_at' },
  ],
})

export const scheduleApi = createTableApi('day_schedule_items', {
  order: [{ column: 'start_time' }],
})

export const documentsApi = createTableApi('documents', {
  order: [{ column: 'uploaded_at', ascending: false }],
})

export const giftsApi = createTableApi('gifts', {
  order: [{ column: 'sort_order' }, { column: 'created_at' }],
  invalidates: ['gift_claims', 'gifts_received'],
})

export const giftClaimsApi = createTableApi('gift_claims', {
  order: [{ column: 'created_at' }],
})

export const giftsReceivedApi = createTableApi('gifts_received', {
  order: [{ column: 'received_on', ascending: false }],
})

const SETTINGS_KEY = ['settings'] as const

export function useSettings() {
  return useQuery({
    queryKey: SETTINGS_KEY,
    queryFn: async (): Promise<WeddingSettings> => {
      const { data, error } = await supabase.from('wedding_settings').select('*').eq('id', 1).single()
      if (error) throw error
      return data
    },
  })
}

export function useUpdateSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (values: Partial<Omit<WeddingSettings, 'id' | 'updated_at'>>) => {
      const { data, error } = await supabase
        .from('wedding_settings')
        .update(values)
        .eq('id', 1)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (data) => qc.setQueryData(SETTINGS_KEY, data),
  })
}
