import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getCurrentProfile } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

const SELECT = `
  *,
  creator:profiles!tickets_created_by_fkey(full_name, role),
  assignee:profiles!tickets_assigned_to_fkey(full_name, role),
  messages:ticket_messages(*, author:profiles(full_name, role))
`

export async function GET(req: Request) {
  const profile = await getCurrentProfile()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const resident_id = searchParams.get('resident_id')
  if (!resident_id) return NextResponse.json({ error: 'resident_id required' }, { status: 400 })

  const supabase = createServiceClient()

  // Family users must have this resident linked to their profile
  if (profile.role === 'family') {
    const { data: link } = await supabase
      .from('family_residents')
      .select('id')
      .eq('profile_id', profile.id)
      .eq('resident_id', resident_id)
      .single()
    if (!link) return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('tickets')
    .select(SELECT)
    .eq('resident_id', resident_id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
