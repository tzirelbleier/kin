import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'
import { AdminDashboardClient } from './client'

export const dynamic = 'force-dynamic'

export default async function AdminDashboardPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')

  const supabase = createServiceClient()
  const facilityId = profile.facility_id

  const [ticketsRes, eventsRes, auditRes] = await Promise.all([
    supabase.from('tickets').select('*').eq('facility_id', facilityId).order('created_at', { ascending: false }),
    supabase.from('care_events').select('id, occurred_at, severity').eq('facility_id', facilityId).order('occurred_at', { ascending: false }).limit(200),
    supabase.from('audit_log').select('*').eq('facility_id', facilityId).order('created_at', { ascending: false }).limit(50),
  ])

  return (
    <AdminDashboardClient
      tickets={ticketsRes.data ?? []}
      events={eventsRes.data ?? []}
      auditLog={auditRes.data ?? []}
      facilityId={facilityId}
    />
  )
}
