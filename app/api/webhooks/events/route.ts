import { NextRequest, NextResponse } from 'next/server'
import {
  createServiceClient,
  getFacilityBySlug,
  getResidentByExternalId,
  autoAssign,
  writeAuditLog,
} from '@/lib/supabase'
import type { WebhookEventPayload, EventSeverity } from '@/types'

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET

export async function POST(req: NextRequest) {
  // 1. Verify webhook secret
  const secret = req.headers.get('x-kin-webhook-secret')
  if (!WEBHOOK_SECRET || secret !== WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let payload: WebhookEventPayload
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { source, facility_slug, events } = payload

  if (!source || !facility_slug || !Array.isArray(events)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // 2. Look up facility by slug
  const facility = await getFacilityBySlug(supabase, facility_slug)
  if (!facility) {
    return NextResponse.json({ error: `Facility not found: ${facility_slug}` }, { status: 404 })
  }

  const results = []

  for (const event of events) {
    try {
      // 3. Match resident by external ID
      const resident = await getResidentByExternalId(supabase, {
        facility_id: facility.id,
        pcc_id:    source === 'pointclickcare' ? event.resident_external_id : undefined,
        tabula_id: source === 'tabulapro'      ? event.resident_external_id : undefined,
      })

      if (!resident) {
        results.push({ external_id: event.external_id, status: 'resident_not_found' })
        continue
      }

      // 4. Upsert care event — UNIQUE(source, source_record_id) handles idempotency
      const { data: careEvent, error: upsertError } = await supabase
        .from('care_events')
        .upsert(
          {
            facility_id:     facility.id,
            resident_id:     resident.id,
            source,
            source_record_id: event.external_id,
            event_type:      event.event_type,
            title:           event.title,
            detail:          event.detail ?? null,
            occurred_at:     event.occurred_at,
            severity:        event.severity,
            metadata:        event.metadata ?? null,
          },
          { onConflict: 'source,source_record_id', ignoreDuplicates: true }
        )
        .select()
        .maybeSingle()

      if (upsertError) {
        console.error('[webhook] upsert error:', upsertError)
        results.push({ external_id: event.external_id, status: 'error', error: upsertError.message })
        continue
      }

      // 5. Auto-create urgent ticket for incidents or critical severity
      const isIncident = event.severity === 'incident' || event.event_type === 'incident'
      const isCritical = event.severity === 'critical'

      if ((isIncident || isCritical) && careEvent) {
        // Find a nurse to assign
        const assigneeId = await autoAssign(supabase, {
          facility_id: facility.id,
          role: 'nurse',
        })

        const { data: ticket } = await supabase
          .from('tickets')
          .insert({
            facility_id:     facility.id,
            resident_id:     resident.id,
            created_by:      assigneeId ?? undefined, // system-created; use assignee as placeholder
            assigned_to:     assigneeId,
            linked_event_id: careEvent.id,
            title:           `[Incident] ${event.title}`,
            body:            event.detail ?? event.title,
            category:        'incident',
            priority:        'urgent',
            status:          assigneeId ? 'assigned' : 'open',
          })
          .select()
          .maybeSingle()

        if (ticket) {
          await writeAuditLog(supabase, {
            facility_id: facility.id,
            actor_id: null,
            action: 'ticket.auto_created',
            entity_type: 'ticket',
            entity_id: ticket.id,
            after_state: { trigger: 'webhook', source, event_id: careEvent.id },
          })
        }
      }

      await writeAuditLog(supabase, {
        facility_id: facility.id,
        actor_id: null,
        action: 'care_event.ingested',
        entity_type: 'care_event',
        entity_id: careEvent?.id ?? null,
        after_state: { source, external_id: event.external_id, severity: event.severity },
      })

      results.push({ external_id: event.external_id, status: 'ok' })
    } catch (err) {
      console.error('[webhook] event processing error:', err)
      results.push({ external_id: event.external_id, status: 'error' })
    }
  }

  return NextResponse.json({ received: events.length, results })
}
