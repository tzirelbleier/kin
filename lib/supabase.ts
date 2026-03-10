// ================================================================
// Kin — Supabase clients + typed query helpers
// ================================================================

import { createBrowserClient as _createBrowserClient } from '@supabase/ssr'
import { createServerClient as _createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import type {
  Ticket,
  TicketMessage,
  CareEvent,
  Profile,
  Resident,
  CreateTicketBody,
  PatchTicketBody,
  CreateMessageBody,
  TicketStatus,
  TicketPriority,
  TicketCategory,
  PRIORITY_ROUTING,
} from '@/types'
import { PRIORITY_ROUTING as ROUTING } from '@/types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// ----------------------------------------------------------------
// 1. Browser client — for client components
// ----------------------------------------------------------------
export function createBrowserClient() {
  return _createBrowserClient(supabaseUrl, supabaseAnonKey)
}

// ----------------------------------------------------------------
// 2. Server client — for server components / route handlers
//    Uses cookies() for session management
// ----------------------------------------------------------------
export async function createServerClient() {
  const cookieStore = await cookies()
  return _createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {
          // setAll called from a Server Component — safe to ignore
        }
      },
    },
  })
}

// ----------------------------------------------------------------
// 3. Service client — bypasses RLS, for webhook/admin routes
// ----------------------------------------------------------------
export function createServiceClient() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

// ----------------------------------------------------------------
// Query helpers
// ----------------------------------------------------------------

const TICKET_SELECT = `
  *,
  resident:residents(*),
  creator:profiles!tickets_created_by_fkey(*),
  assignee:profiles!tickets_assigned_to_fkey(*)
`

const MESSAGE_SELECT = `
  *,
  author:profiles(*)
`

export async function getTickets(
  supabase: ReturnType<typeof createServiceClient>,
  opts: {
    facility_id: string
    status?: TicketStatus
    priority?: TicketPriority
    assigned_to?: string
    category?: TicketCategory
  }
) {
  let query = supabase
    .from('tickets')
    .select(TICKET_SELECT)
    .eq('facility_id', opts.facility_id)
    .order('created_at', { ascending: false })

  if (opts.status)      query = query.eq('status', opts.status)
  if (opts.priority)    query = query.eq('priority', opts.priority)
  if (opts.assigned_to) query = query.eq('assigned_to', opts.assigned_to)
  if (opts.category)    query = query.eq('category', opts.category)

  const { data, error } = await query
  if (error) throw error
  return data as Ticket[]
}

export async function getTicket(
  supabase: ReturnType<typeof createServiceClient>,
  ticket_id: string
) {
  const { data, error } = await supabase
    .from('tickets')
    .select(`${TICKET_SELECT}, messages:ticket_messages(${MESSAGE_SELECT})`)
    .eq('id', ticket_id)
    .single()
  if (error) throw error
  return data as Ticket
}

export async function createTicket(
  supabase: ReturnType<typeof createServiceClient>,
  body: CreateTicketBody & { facility_id: string; created_by: string }
) {
  const rule = ROUTING[body.category]
  const { data, error } = await supabase
    .from('tickets')
    .insert({
      facility_id:     body.facility_id,
      resident_id:     body.resident_id,
      created_by:      body.created_by,
      linked_event_id: body.linked_event_id ?? null,
      title:           body.title,
      body:            body.body,
      category:        body.category,
      priority:        rule.priority,
      status:          'open',
    })
    .select(TICKET_SELECT)
    .single()
  if (error) throw error
  return data as Ticket
}

export async function updateTicket(
  supabase: ReturnType<typeof createServiceClient>,
  ticket_id: string,
  patch: PatchTicketBody
) {
  const { data, error } = await supabase
    .from('tickets')
    .update({ ...patch })
    .eq('id', ticket_id)
    .select(TICKET_SELECT)
    .single()
  if (error) throw error
  return data as Ticket
}

export async function createMessage(
  supabase: ReturnType<typeof createServiceClient>,
  body: CreateMessageBody & { author_id: string }
) {
  const { data, error } = await supabase
    .from('ticket_messages')
    .insert({
      ticket_id:   body.ticket_id,
      author_id:   body.author_id,
      body:        body.body,
      is_internal: body.is_internal ?? false,
    })
    .select(MESSAGE_SELECT)
    .single()
  if (error) throw error
  return data as TicketMessage
}

export async function getCareEvents(
  supabase: ReturnType<typeof createServiceClient>,
  opts: { resident_id: string; limit?: number }
) {
  const { data, error } = await supabase
    .from('care_events')
    .select('*')
    .eq('resident_id', opts.resident_id)
    .order('occurred_at', { ascending: false })
    .limit(opts.limit ?? 50)
  if (error) throw error
  return data as CareEvent[]
}

export async function getFacilityBySlug(
  supabase: ReturnType<typeof createServiceClient>,
  slug: string
) {
  const { data, error } = await supabase
    .from('facilities')
    .select('*')
    .eq('slug', slug)
    .single()
  if (error) return null
  return data
}

export async function getResidentByExternalId(
  supabase: ReturnType<typeof createServiceClient>,
  opts: { facility_id: string; pcc_id?: string; tabula_id?: string }
) {
  let query = supabase
    .from('residents')
    .select('*')
    .eq('facility_id', opts.facility_id)

  if (opts.pcc_id) {
    const { data } = await query.eq('pcc_resident_id', opts.pcc_id).maybeSingle()
    if (data) return data as Resident
  }
  if (opts.tabula_id) {
    const { data } = await query.eq('tabula_resident_id', opts.tabula_id).maybeSingle()
    if (data) return data as Resident
  }
  return null
}

export async function writeAuditLog(
  supabase: ReturnType<typeof createServiceClient>,
  entry: {
    facility_id: string
    actor_id?: string | null
    action: string
    entity_type: string
    entity_id?: string | null
    before_state?: object | null
    after_state?: object | null
    ip_address?: string | null
  }
) {
  await supabase.from('audit_log').insert(entry)
}

// ----------------------------------------------------------------
// Auto-assign: find staff with correct role, least open tickets
// ----------------------------------------------------------------
export async function autoAssign(
  supabase: ReturnType<typeof createServiceClient>,
  opts: { facility_id: string; role: string }
): Promise<string | null> {
  // Get all profiles with the target role
  const { data: candidates } = await supabase
    .from('profiles')
    .select('id')
    .eq('facility_id', opts.facility_id)
    .eq('role', opts.role)

  if (!candidates || candidates.length === 0) return null

  // Count open tickets per candidate
  const counts = await Promise.all(
    candidates.map(async (p) => {
      const { count } = await supabase
        .from('tickets')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_to', p.id)
        .in('status', ['open', 'assigned', 'in_progress'])
      return { id: p.id, count: count ?? 0 }
    })
  )

  // Return the profile with the lowest ticket count
  counts.sort((a, b) => a.count - b.count)
  return counts[0]?.id ?? null
}

// ----------------------------------------------------------------
// Real-time subscription helpers (client-side)
// ----------------------------------------------------------------
export function subscribeToTicket(
  supabase: ReturnType<typeof createBrowserClient>,
  ticketId: string,
  onMessage: (msg: TicketMessage) => void,
  onTicketChange: (ticket: Partial<Ticket>) => void
) {
  const channel = supabase
    .channel(`ticket:${ticketId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'ticket_messages', filter: `ticket_id=eq.${ticketId}` },
      (payload) => onMessage(payload.new as TicketMessage)
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'tickets', filter: `id=eq.${ticketId}` },
      (payload) => onTicketChange(payload.new as Partial<Ticket>)
    )
    .subscribe()

  return () => supabase.removeChannel(channel)
}

export function subscribeToTicketList(
  supabase: ReturnType<typeof createBrowserClient>,
  facilityId: string,
  onChange: () => void
) {
  const channel = supabase
    .channel(`tickets:${facilityId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'tickets', filter: `facility_id=eq.${facilityId}` },
      onChange
    )
    .subscribe()

  return () => supabase.removeChannel(channel)
}
