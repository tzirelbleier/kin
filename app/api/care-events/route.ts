// GET /api/care-events?resident_id=X
// Uses service role — no RLS issues for admin switching residents
import { NextResponse } from 'next/server'
import { getCurrentProfile } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'

export async function GET(request: Request) {
  const profile = await getCurrentProfile()
  if (!profile) return NextResponse.json([], { status: 401 })

  const { searchParams } = new URL(request.url)
  const residentId = searchParams.get('resident_id')
  if (!residentId) return NextResponse.json([], { status: 400 })

  const supabase = createServiceClient()

  // Verify resident belongs to same facility
  const { data: resident } = await supabase
    .from('residents')
    .select('id')
    .eq('id', residentId)
    .eq('facility_id', profile.facility_id)
    .single()

  if (!resident) return NextResponse.json([], { status: 403 })

  const { data } = await supabase
    .from('care_events')
    .select('*')
    .eq('resident_id', residentId)
    .order('occurred_at', { ascending: false })
    .limit(50)

  return NextResponse.json(data ?? [])
}
