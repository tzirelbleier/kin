import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'
import { AdminDashboardClient } from './client'
import type { Profile } from '@/types'

export const dynamic = 'force-dynamic'

const TICKET_SELECT = `
  *,
  resident:residents(id, full_name, room_number),
  assignee:profiles!tickets_assigned_to_fkey(id, full_name, role)
`

export default async function AdminDashboardPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')

  const supabase = createServiceClient()
  const facilityId = profile.facility_id

  const [ticketsRes, eventsRes, auditRes, profilesRes, residentsRes] = await Promise.all([
    supabase.from('tickets').select(TICKET_SELECT).eq('facility_id', facilityId).order('created_at', { ascending: false }),
    supabase.from('care_events').select('id, resident_id, occurred_at, severity, source').eq('facility_id', facilityId).order('occurred_at', { ascending: false }).limit(500),
    supabase.from('audit_log').select('*').eq('facility_id', facilityId).order('created_at', { ascending: false }).limit(50),
    supabase.from('profiles').select('*').eq('facility_id', facilityId).order('full_name'),
    supabase.from('residents').select('id, full_name, room_number').eq('facility_id', facilityId).eq('is_active', true).order('full_name'),
  ])

  return (
    <AdminDashboardClient
      tickets={ticketsRes.data ?? []}
      events={eventsRes.data ?? []}
      auditLog={auditRes.data ?? []}
      facilityId={facilityId}
      profiles={(profilesRes.data ?? []) as Profile[]}
      residents={residentsRes.data ?? []}
    />
  )
}
