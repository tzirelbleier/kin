// ================================================================
// Kin — Excel import API route
// POST /api/import-events
// Authenticated: admin or director only
// ================================================================

import { NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { getCurrentProfile } from '@/lib/supabase-server'
import { createServiceClient, writeAuditLog } from '@/lib/supabase'
import type { ImportPreviewRow } from '@/lib/excel-import'

interface ImportRequestBody {
  rows: ImportPreviewRow[]
}

export async function POST(request: Request) {
  const profile = await getCurrentProfile()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['admin', 'director'].includes(profile.role)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  let body: ImportRequestBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const validRows = (body.rows ?? []).filter((r) => r.status === 'valid')
  if (validRows.length === 0) {
    return NextResponse.json({ imported: 0, skipped: 0, errors: [] })
  }

  const supabase = createServiceClient()

  // Resolve all residents for this facility once
  const { data: residents } = await supabase
    .from('residents')
    .select('id, full_name')
    .eq('facility_id', profile.facility_id)
    .eq('is_active', true)

  const residentMap = new Map<string, string>(
    (residents ?? []).map((r) => [r.full_name.toLowerCase().trim(), r.id])
  )

  let imported = 0
  let skipped = 0
  const errors: { row_index: number; resident_name: string; error: string }[] = []

  for (const row of validRows) {
    const residentId = residentMap.get(row.resident_name.toLowerCase().trim())
    if (!residentId) {
      errors.push({ row_index: row.row_index, resident_name: row.resident_name, error: 'Resident not found in facility' })
      skipped++
      continue
    }

    // Deterministic ID for deduplication — changing any core field creates a new event
    const source_record_id = createHash('sha256')
      .update(`${row.resident_name}|${row.event_type}|${row.occurred_at_iso}|${row.title}`)
      .digest('hex')
      .slice(0, 32)

    const { error: upsertError } = await supabase
      .from('care_events')
      .upsert({
        facility_id:      profile.facility_id,
        resident_id:      residentId,
        source:           'staff',
        source_record_id: source_record_id,
        event_type:       row.event_type.toLowerCase().trim(),
        title:            row.title.trim(),
        detail:           row.detail?.trim() || null,
        occurred_at:      row.occurred_at_iso,
        severity:         row.severity_coerced,
        metadata:         row.metadata ? (() => { try { return JSON.parse(row.metadata) } catch { return null } })() : null,
      }, { onConflict: 'source,source_record_id' })

    if (upsertError) {
      errors.push({ row_index: row.row_index, resident_name: row.resident_name, error: upsertError.message })
      skipped++
    } else {
      imported++
    }
  }

  // Audit log
  await writeAuditLog(supabase, {
    facility_id: profile.facility_id,
    actor_id:    profile.id,
    action:      'excel_import.completed',
    entity_type: 'care_events',
    after_state: { imported, skipped, row_count: validRows.length },
  })

  return NextResponse.json({ imported, skipped, errors })
}
