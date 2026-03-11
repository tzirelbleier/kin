import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getCurrentProfile } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

// GET /api/menus?facility_id=X&resident_id=Y&from=YYYY-MM-DD&to=YYYY-MM-DD
export async function GET(req: Request) {
  const profile = await getCurrentProfile()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const facility_id = searchParams.get('facility_id') ?? profile.facility_id
  const resident_id = searchParams.get('resident_id')
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  const supabase = createServiceClient()
  let query = supabase
    .from('menus')
    .select('*')
    .eq('facility_id', facility_id)
    .order('date')
    .order('meal_type')

  if (resident_id) {
    query = query.or(`resident_id.is.null,resident_id.eq.${resident_id}`)
  }
  if (from) query = query.gte('date', from)
  if (to) query = query.lte('date', to)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST /api/menus
export async function POST(req: Request) {
  const profile = await getCurrentProfile()
  if (!profile || profile.role === 'family') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { resident_id, date, meal_type, title, description } = body
  if (!date || !meal_type || !title) {
    return NextResponse.json({ error: 'date, meal_type, and title are required' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('menus')
    .insert({
      facility_id: profile.facility_id,
      resident_id: resident_id || null,
      date,
      meal_type,
      title,
      description: description || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ menu: data }, { status: 201 })
}

// PATCH /api/menus?id=X
export async function PATCH(req: Request) {
  const profile = await getCurrentProfile()
  if (!profile || profile.role === 'family') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const body = await req.json()
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('menus')
    .update(body)
    .eq('id', id)
    .eq('facility_id', profile.facility_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ menu: data })
}

// DELETE /api/menus?id=X
export async function DELETE(req: Request) {
  const profile = await getCurrentProfile()
  if (!profile || profile.role === 'family') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const supabase = createServiceClient()
  const { error } = await supabase
    .from('menus')
    .delete()
    .eq('id', id)
    .eq('facility_id', profile.facility_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
