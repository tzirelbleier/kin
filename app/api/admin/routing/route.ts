import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getCurrentProfile } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const profile = await getCurrentProfile()
  if (!profile || !['admin', 'director'].includes(profile.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('facilities')
    .select('routing_config')
    .eq('id', profile.facility_id)
    .single()
  return NextResponse.json({ routing_config: data?.routing_config ?? null })
}

export async function PATCH(req: Request) {
  const profile = await getCurrentProfile()
  if (!profile || !['admin', 'director'].includes(profile.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { routing_config } = await req.json()
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('facilities')
    .update({ routing_config })
    .eq('id', profile.facility_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
