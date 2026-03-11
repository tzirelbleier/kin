import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getCurrentProfile } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

// GET /api/appointments?resident_id=X&from=YYYY-MM-DD&to=YYYY-MM-DD
export async function GET(req: Request) {
  const profile = await getCurrentProfile()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const resident_id = searchParams.get('resident_id')
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  if (!resident_id) return NextResponse.json({ error: 'resident_id required' }, { status: 400 })

  const supabase = createServiceClient()
  let query = supabase
    .from('appointments')
    .select('*')
    .eq('resident_id', resident_id)
    .order('scheduled_at')

  if (from) query = query.gte('scheduled_at', from)
  if (to) query = query.lte('scheduled_at', to)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST /api/appointments
export async function POST(req: Request) {
  const profile = await getCurrentProfile()
  if (!profile || profile.role === 'family') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { resident_id, scheduled_at, title, description, location, appointment_type } = body
  if (!resident_id || !scheduled_at || !title) {
    return NextResponse.json({ error: 'resident_id, scheduled_at, and title are required' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('appointments')
    .insert({
      facility_id: profile.facility_id,
      resident_id,
      scheduled_at,
      title,
      description: description || null,
      location: location || null,
      appointment_type: appointment_type || 'appointment',
      status: 'scheduled',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ appointment: data }, { status: 201 })
}

// PATCH /api/appointments?id=X
export async function PATCH(req: Request) {
  const profile = await getCurrentProfile()
  if (!profile || profile.role === 'family') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const body = await req.json()
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('appointments')
    .update(body)
    .eq('id', id)
    .eq('facility_id', profile.facility_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ appointment: data })
}

// DELETE /api/appointments?id=X
export async function DELETE(req: Request) {
  const profile = await getCurrentProfile()
  if (!profile || profile.role === 'family') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const supabase = createServiceClient()
  const { error } = await supabase
    .from('appointments')
    .delete()
    .eq('id', id)
    .eq('facility_id', profile.facility_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
