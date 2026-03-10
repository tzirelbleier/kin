import { NextRequest, NextResponse } from 'next/server'
import {
  createServiceClient,
  getTickets,
  createTicket,
  updateTicket,
  autoAssign,
  writeAuditLog,
} from '@/lib/supabase'
import { PRIORITY_ROUTING } from '@/types'
import type { CreateTicketBody, PatchTicketBody, TicketStatus, TicketPriority, TicketCategory } from '@/types'

// GET /api/tickets?facility_id=&status=&priority=&assigned_to=&category=
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const facility_id = searchParams.get('facility_id')

  if (!facility_id) {
    return NextResponse.json({ error: 'facility_id required' }, { status: 400 })
  }

  try {
    const supabase = createServiceClient()
    const tickets = await getTickets(supabase, {
      facility_id,
      status:      (searchParams.get('status')      ?? undefined) as TicketStatus | undefined,
      priority:    (searchParams.get('priority')    ?? undefined) as TicketPriority | undefined,
      assigned_to: searchParams.get('assigned_to') ?? undefined,
      category:    (searchParams.get('category')    ?? undefined) as TicketCategory | undefined,
    })
    return NextResponse.json({ tickets })
  } catch (err) {
    console.error('[GET /api/tickets]', err)
    return NextResponse.json({ error: 'Failed to fetch tickets' }, { status: 500 })
  }
}

// POST /api/tickets
export async function POST(req: NextRequest) {
  try {
    const body: CreateTicketBody & { facility_id: string; created_by: string } = await req.json()

    const { facility_id, resident_id, created_by, title, body: msgBody, category, linked_event_id } = body

    if (!facility_id || !resident_id || !created_by || !title || !msgBody || !category) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const validCategories: TicketCategory[] = ['question','concern','complaint','care_plan','administrative','compliment','incident']
    if (!validCategories.includes(category)) {
      return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // Create ticket (priority is auto-set from PRIORITY_ROUTING)
    const ticket = await createTicket(supabase, body)

    // Auto-assign to least-loaded staff with correct role
    const rule = PRIORITY_ROUTING[category]
    const assigneeId = await autoAssign(supabase, {
      facility_id,
      role: rule.routes_to,
    })

    if (assigneeId) {
      await updateTicket(supabase, ticket.id, {
        assigned_to: assigneeId,
        status: 'assigned',
      })
      ticket.assigned_to = assigneeId
      ticket.status = 'assigned'
    }

    await writeAuditLog(supabase, {
      facility_id,
      actor_id:    created_by,
      action:      'ticket.created',
      entity_type: 'ticket',
      entity_id:   ticket.id,
      after_state: { category, priority: rule.priority, assigned_to: assigneeId },
    })

    return NextResponse.json({ ticket }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/tickets]', err)
    return NextResponse.json({ error: 'Failed to create ticket' }, { status: 500 })
  }
}

// PATCH /api/tickets?id=
export async function PATCH(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 })
  }

  try {
    const supabase = createServiceClient()
    const patch: PatchTicketBody & { actor_id?: string; facility_id?: string } = await req.json()
    const { actor_id, facility_id, ...ticketPatch } = patch

    const ticket = await updateTicket(supabase, id, ticketPatch)

    if (facility_id) {
      await writeAuditLog(supabase, {
        facility_id,
        actor_id: actor_id ?? null,
        action: 'ticket.updated',
        entity_type: 'ticket',
        entity_id: id,
        after_state: ticketPatch as object,
      })
    }

    return NextResponse.json({ ticket })
  } catch (err) {
    console.error('[PATCH /api/tickets]', err)
    return NextResponse.json({ error: 'Failed to update ticket' }, { status: 500 })
  }
}
