import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'
import { getCurrentProfile } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function GET() {
  const profile = await getCurrentProfile()
  if (!profile || !['admin', 'director'].includes(profile.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('facility_id', profile.facility_id)
    .order('full_name')
  return NextResponse.json(data ?? [])
}

export async function POST(req: Request) {
  const profile = await getCurrentProfile()
  if (!profile || !['admin', 'director'].includes(profile.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { email, full_name, role } = await req.json()
  if (!email || !full_name || !role) {
    return NextResponse.json({ error: 'email, full_name, and role are required' }, { status: 400 })
  }
  const admin = adminClient()
  const { data: authUser, error: authError } = await admin.auth.admin.createUser({
    email,
    password: 'Demo1234!',
    email_confirm: true,
  })
  if (authError) return NextResponse.json({ error: authError.message }, { status: 400 })

  const supabase = createServiceClient()
  const { data: newProfile, error: profileError } = await supabase
    .from('profiles')
    .insert({ id: authUser.user.id, facility_id: profile.facility_id, email, full_name, role })
    .select()
    .single()
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 400 })
  return NextResponse.json({ profile: newProfile })
}

export async function PATCH(req: Request) {
  const profile = await getCurrentProfile()
  if (!profile || !['admin', 'director'].includes(profile.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id, full_name, role, is_active } = await req.json()
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const supabase = createServiceClient()
  const updates: Record<string, unknown> = {}
  if (full_name !== undefined) updates.full_name = full_name
  if (role !== undefined) updates.role = role
  if (is_active !== undefined) updates.is_active = is_active

  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', id)
    .eq('facility_id', profile.facility_id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ profile: data })
}
