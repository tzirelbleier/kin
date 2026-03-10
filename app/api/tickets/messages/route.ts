import { NextRequest, NextResponse } from 'next/server'
import {
  createServiceClient,
  createMessage,
  updateTicket,
  writeAuditLog,
} from '@/lib/supabase'
import type { CreateMessageBody } from '@/types'

// POST /api/tickets/messages
export async function POST(req: NextRequest) {
  try {
    const body: CreateMessageBody & { author_id: string; author_role?: string; facility_id?: string } = await req.json()
    const { ticket_id, body: msgBody, is_internal, author_id, author_role, facility_id } = body

    if (!ticket_id || !msgBody || !author_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // Create the message
    const message = await createMessage(supabase, {
      ticket_id,
      body: msgBody,
      is_internal: is_internal ?? false,
      author_id,
    })

    // If this is a staff reply (non-internal), track first response time and move status
    if (author_role && ['staff','nurse','admin','director'].includes(author_role) && !is_internal) {
      // Get current ticket state
      const { data: ticket } = await supabase
        .from('tickets')
        .select('first_response_at, status, created_by')
        .eq('id', ticket_id)
        .single()

      if (ticket) {
        const updates: Record<string, unknown> = {}

        // Track first response time
        if (!ticket.first_response_at) {
          updates.first_response_at = new Date().toISOString()
        }

        // Move to pending_family (waiting on family response)
        if (['assigned','in_progress','open'].includes(ticket.status)) {
          updates.status = 'pending_family'
        }

        if (Object.keys(updates).length > 0) {
          await updateTicket(supabase, ticket_id, updates as Parameters<typeof updateTicket>[2])
        }
      }
    }

    // If this is a family reply and ticket was pending_family, move back to in_progress
    if (author_role === 'family') {
      const { data: ticket } = await supabase
        .from('tickets')
        .select('status')
        .eq('id', ticket_id)
        .single()

      if (ticket?.status === 'pending_family') {
        await updateTicket(supabase, ticket_id, { status: 'in_progress' })
      }
    }

    if (facility_id) {
      await writeAuditLog(supabase, {
        facility_id,
        actor_id: author_id,
        action: 'message.created',
        entity_type: 'ticket_message',
        entity_id: message.id,
        after_state: { ticket_id, is_internal: is_internal ?? false },
      })
    }

    return NextResponse.json({ message }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/tickets/messages]', err)
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
  }
}
