import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getCurrentProfile } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

// GET /api/schedule?facility_id=X&resident_id=Y
// Returns facility-wide items PLUS resident-specific items
export async function GET(req: Request) {
  const profile = await getCurrentProfile()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const facility_id = searchParams.get('facility_id') ?? profile.facility_id
  const resident_id = searchParams.get('resident_id')

  const supabase = createServiceClient()
  let query = supabase
    .from('schedule_items')
    .select('*')
    .eq('facility_id', facility_id)
    .order('day_of_week')
    .order('start_time')

  if (resident_id) {
    query = query.or(`resident_id.is.null,resident_id.eq.${resident_id}`)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST /api/schedule
export async function POST(req: Request) {
  const profile = await getCurrentProfile()
  if (!profile || profile.role === 'family') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { resident_id, day_of_week, start_time, end_time, title, description, category } = body
  if (day_of_week === undefined || !start_time || !title) {
    return NextResponse.json({ error: 'day_of_week, start_time, and title are required' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('schedule_items')
    .insert({ facility_id: profile.facility_id, resident_id: resident_id || null, day_of_week, start_time, end_time: end_time || null, title, description: description || null, category: category || 'activity' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ item: data }, { status: 201 })
}

// PATCH /api/schedule?id=X
export async function PATCH(req: Request) {
  const profile = await getCurrentProfile()
  if (!profile || profile.role === 'family') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const body = await req.json()
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('schedule_items')
    .update(body)
    .eq('id', id)
    .eq('facility_id', profile.facility_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ item: data })
}

// DELETE /api/schedule?id=X
export async function DELETE(req: Request) {
  const profile = await getCurrentProfile()
  if (!profile || profile.role === 'family') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const supabase = createServiceClient()
  const { error } = await supabase
    .from('schedule_items')
    .delete()
    .eq('id', id)
    .eq('facility_id', profile.facility_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
