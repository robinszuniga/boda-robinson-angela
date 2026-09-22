import type { BudgetCategory, Guest, GuestLink, GuestMember, Payment, SeatingTable, Vendor } from '../../src/types/database'

let n = 0
const id = (prefix: string) => `${prefix}-${++n}`
const now = '2026-09-20T12:00:00Z'

export function category(overrides: Partial<BudgetCategory> = {}): BudgetCategory {
  return { id: id('cat'), name: 'Catering', estimated: 0, color: '#000', sort_order: 0, created_at: now, ...overrides }
}

export function vendor(overrides: Partial<Vendor> = {}): Vendor {
  return {
    id: id('ven'),
    category_id: null,
    name: 'Proveedor',
    contact_name: null,
    phone: null,
    email: null,
    instagram: null,
    website: null,
    portfolio_url: null,
    quoted_cost: null,
    final_cost: null,
    status: 'cotizando',
    includes: null,
    availability: null,
    pros: null,
    cons: null,
    notes: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  }
}

export function payment(overrides: Partial<Payment> & Pick<Payment, 'category_id' | 'amount'>): Payment {
  return { id: id('pay'), vendor_id: null, date: '2026-10-01', is_paid: true, note: null, created_at: now, ...overrides }
}

export function guest(overrides: Partial<Guest> = {}): Guest {
  return {
    id: id('gue'),
    name: 'Invitado',
    guest_group: 'amigos',
    phone: null,
    email: null,
    plus_ones_allowed: 0,
    plus_ones_confirmed: 0,
    rsvp_status: 'pendiente',
    dietary: null,
    table_id: null,
    rsvp_token: id('tok'),
    rsvp_responded_at: null,
    guest_message: null,
    thank_you_sent_at: null,
    thank_you_method: null,
    notes: null,
    song_request: null,
    needs_transport: false,
    rsvp_reminded_at: null,
    age_group: 'adulto',
    created_at: now,
    updated_at: now,
    ...overrides,
  }
}

export function table(overrides: Partial<SeatingTable> = {}): SeatingTable {
  return { id: id('tab'), number: ++n, name: null, capacity: 10, created_at: now, ...overrides }
}

export function link(overrides: Partial<GuestLink> & Pick<GuestLink, 'guest_a' | 'guest_b'>): GuestLink {
  return { id: id('lnk'), kind: 'juntos', note: null, created_at: now, ...overrides }
}

export function member(overrides: Partial<GuestMember> & Pick<GuestMember, 'guest_id' | 'name'>): GuestMember {
  return { id: id('mem'), attending: null, dietary: null, age_group: 'adulto', sort_order: 0, created_at: now, ...overrides }
}
