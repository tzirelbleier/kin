// Returns the current user's profile using service role (bypasses RLS)
import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'

export async function GET() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json(null, { status: 401 })

  const service = createServiceClient()
  const { data: profile } = await service
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return NextResponse.json(profile)
}
