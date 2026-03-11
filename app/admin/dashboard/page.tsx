import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'
import { AdminDashboardClient } from './client'
import type { Profile } from '@/types'

export const dynamic = 'force-dynamic'

export default async function AdminDashboardPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')

  const supabase = createServiceClient()
  const facilityId = profile.facility_id

  const [ticketsRes, eventsRes, auditRes, profilesRes] = await Promise.all([
    supabase.from('tickets').select('*').eq('facility_id', facilityId).order('created_at', { ascending: false }),
    supabase.from('care_events').select('id, occurred_at, severity, source').eq('facility_id', facilityId).order('occurred_at', { ascending: false }).limit(200),
    supabase.from('audit_log').select('*').eq('facility_id', facilityId).order('created_at', { ascending: false }).limit(50),
    supabase.from('profiles').select('*').eq('facility_id', facilityId).order('full_name'),
  ])

  return (
    <AdminDashboardClient
      tickets={ticketsRes.data ?? []}
      events={eventsRes.data ?? []}
      auditLog={auditRes.data ?? []}
      facilityId={facilityId}
      profiles={(profilesRes.data ?? []) as Profile[]}
    />
  )
}
