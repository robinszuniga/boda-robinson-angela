// Tipos del esquema de Supabase (supabase/migrations). Escritos a mano; si cambias
// el esquema puedes regenerarlos con: npx supabase gen types typescript --project-id <id>

export type VendorStatus = 'cotizando' | 'reservado' | 'pagado' | 'descartado'
export type GuestGroup = 'familia_novio' | 'familia_novia' | 'amigos' | 'trabajo' | 'otros'
export type RsvpStatus = 'pendiente' | 'confirmado' | 'rechazado'
export type LinkKind = 'juntos' | 'separados'
export type TaskAssignee = 'novio' | 'novia' | 'ambos'
export type TaskStatus = 'por_hacer' | 'en_proceso' | 'listo'
export type TaskPriority = 'alta' | 'media' | 'baja'
export type DocumentCategory = 'contrato' | 'cotizacion' | 'factura' | 'inspiracion' | 'otro'
export type GiftKind = 'articulo' | 'efectivo'

export type WeddingSettings = {
  id: number
  partner_1_name: string
  partner_2_name: string
  wedding_date: string
  venue_name: string | null
  venue_address: string | null
  venue_capacity: number
  total_budget: number
  rsvp_deadline: string | null
  guest_message: string | null
  dress_code: string | null
  logistics_info: string | null
  lodging_info: string | null
  faq: string | null
  livestream_url: string | null
  photo_album_url: string | null
  show_table_to_guests: boolean
  envelope_rain: boolean
  ask_song: boolean
  offer_transport: boolean
  updated_at: string
}

export type AppUser = {
  email: string
  display_name: string
}

export type BudgetCategory = {
  id: string
  name: string
  estimated: number
  color: string
  sort_order: number
  created_at: string
}

export type Vendor = {
  id: string
  category_id: string | null
  name: string
  contact_name: string | null
  phone: string | null
  email: string | null
  instagram: string | null
  website: string | null
  portfolio_url: string | null
  quoted_cost: number | null
  final_cost: number | null
  status: VendorStatus
  includes: string | null
  availability: string | null
  pros: string | null
  cons: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type Payment = {
  id: string
  category_id: string
  vendor_id: string | null
  amount: number
  date: string
  is_paid: boolean
  note: string | null
  created_at: string
}

export type SeatingTable = {
  id: string
  number: number
  name: string | null
  capacity: number
  created_at: string
}

export type Guest = {
  id: string
  name: string
  guest_group: GuestGroup
  phone: string | null
  email: string | null
  plus_ones_allowed: number
  plus_ones_confirmed: number
  rsvp_status: RsvpStatus
  dietary: string | null
  table_id: string | null
  rsvp_token: string
  rsvp_responded_at: string | null
  guest_message: string | null
  thank_you_sent_at: string | null
  thank_you_method: string | null
  notes: string | null
  song_request: string | null
  needs_transport: boolean
  rsvp_reminded_at: string | null
  created_at: string
  updated_at: string
}

export type GuestMember = {
  id: string
  guest_id: string
  name: string
  attending: boolean | null
  dietary: string | null
  sort_order: number
  created_at: string
}

export type GuestLink = {
  id: string
  guest_a: string
  guest_b: string
  kind: LinkKind
  note: string | null
  created_at: string
}

export type Task = {
  id: string
  title: string
  description: string | null
  due_date: string | null
  assignee: TaskAssignee
  status: TaskStatus
  priority: TaskPriority
  stage: string | null
  template_key: string | null
  template_offset_days: number | null
  sort_order: number
  completed_at: string | null
  created_at: string
  updated_at: string
}

export type DayScheduleItem = {
  id: string
  start_time: string
  end_time: string | null
  title: string
  description: string | null
  location: string | null
  vendor_id: string | null
  responsible: string | null
  created_at: string
}

export type DocumentRow = {
  id: string
  name: string
  category: DocumentCategory
  vendor_id: string | null
  storage_path: string
  mime_type: string | null
  size_bytes: number | null
  notes: string | null
  uploaded_at: string
}

export type Gift = {
  id: string
  name: string
  description: string | null
  kind: GiftKind
  store_url: string | null
  price: number | null
  bank_details: string | null
  quantity: number
  sort_order: number
  created_at: string
}

export type GiftClaim = {
  id: string
  gift_id: string
  guest_id: string
  created_at: string
}

export type GiftReceived = {
  id: string
  guest_id: string | null
  from_name: string | null
  description: string
  gift_id: string | null
  received_on: string
  notes: string | null
  amount: number | null
  thank_you_sent_at: string | null
  created_at: string
}

// Campos que la base de datos rellena sola al insertar
type Generated = 'id' | 'created_at' | 'updated_at' | 'uploaded_at' | 'rsvp_token'
type InsertShape<Row, Required extends keyof Row> = Pick<Row, Required> &
  Partial<Omit<Row, Required | Extract<keyof Row, Generated>>> &
  Partial<Pick<Row, Extract<keyof Row, Generated>>>

type TableDef<Row, Required extends keyof Row> = {
  Row: Row
  Insert: InsertShape<Row, Required>
  Update: Partial<Row>
  Relationships: []
}

export type RsvpGuestView = {
  name: string
  plus_ones_allowed: number
  plus_ones_confirmed: number
  rsvp_status: RsvpStatus
  dietary: string | null
  guest_message: string | null
  song_request: string | null
  needs_transport: boolean
  responded_at: string | null
  table: { number: number; name: string | null } | null
  members: RsvpMemberView[]
}

export type RsvpMemberView = {
  id: string
  name: string
  attending: boolean | null
  dietary: string | null
}

export type RsvpGiftView = {
  id: string
  name: string
  description: string | null
  kind: GiftKind
  store_url: string | null
  price: number | null
  bank_details: string | null
  remaining: number | null
  claimed_by_me: boolean
}

export type RsvpView = {
  guest: RsvpGuestView
  wedding: {
    partner_1_name: string
    partner_2_name: string
    wedding_date: string
    venue_name: string | null
    venue_address: string | null
    rsvp_deadline: string | null
    guest_message: string | null
    dress_code: string | null
    logistics_info: string | null
    lodging_info: string | null
    faq: string | null
    livestream_url: string | null
    photo_album_url: string | null
    envelope_rain: boolean
    ask_song: boolean
    offer_transport: boolean
  }
  gifts: RsvpGiftView[]
}

export type Database = {
  public: {
    Tables: {
      app_users: TableDef<AppUser, 'email' | 'display_name'>
      wedding_settings: TableDef<WeddingSettings, 'id'>
      budget_categories: TableDef<BudgetCategory, 'name'>
      vendors: TableDef<Vendor, 'name'>
      payments: TableDef<Payment, 'category_id' | 'amount'>
      seating_tables: TableDef<SeatingTable, 'number'>
      guests: TableDef<Guest, 'name'>
      guest_members: TableDef<GuestMember, 'guest_id' | 'name'>
      guest_links: TableDef<GuestLink, 'guest_a' | 'guest_b'>
      tasks: TableDef<Task, 'title'>
      day_schedule_items: TableDef<DayScheduleItem, 'start_time' | 'title'>
      documents: TableDef<DocumentRow, 'name' | 'storage_path'>
      gifts: TableDef<Gift, 'name'>
      gift_claims: TableDef<GiftClaim, 'gift_id' | 'guest_id'>
      gifts_received: TableDef<GiftReceived, 'description'>
    }
    Views: { [_ in never]: never }
    Functions: {
      is_couple: { Args: Record<string, never>; Returns: boolean }
      keep_alive: { Args: Record<string, never>; Returns: number }
      rsvp_get: { Args: { p_token: string }; Returns: RsvpView | null }
      rsvp_submit: {
        Args: {
          p_token: string
          p_status: 'confirmado' | 'rechazado'
          p_plus_ones: number
          p_dietary: string | null
          p_message: string | null
          p_song?: string | null
          p_needs_transport?: boolean
          p_members?: { id: string; attending: boolean; dietary: string | null }[] | null
        }
        Returns: RsvpView
      }
      rsvp_claim_gift: {
        Args: { p_token: string; p_gift_id: string; p_claim: boolean }
        Returns: RsvpView
      }
    }
    Enums: {
      vendor_status: VendorStatus
      guest_group_kind: GuestGroup
      rsvp_status: RsvpStatus
      link_kind: LinkKind
      task_assignee: TaskAssignee
      task_status: TaskStatus
      task_priority: TaskPriority
      document_category: DocumentCategory
      gift_kind: GiftKind
    }
    CompositeTypes: { [_ in never]: never }
  }
}

export type Tables = Database['public']['Tables']
export type TableName = keyof Tables
export type RowOf<T extends TableName> = Tables[T]['Row']
export type InsertOf<T extends TableName> = Tables[T]['Insert']
export type UpdateOf<T extends TableName> = Tables[T]['Update']
