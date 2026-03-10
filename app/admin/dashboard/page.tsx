import { createServiceClient } from '@/lib/supabase'
import { AdminDashboardClient } from './client'

export const dynamic = 'force-dynamic'

const FACILITY_ID = 'a1b2c3d4-0001-0001-0001-000000000001'

export default async function AdminDashboardPage() {
  const supabase = createServiceClient()

  const [ticketsRes, eventsRes, auditRes] = await Promise.all([
    supabase.from('tickets').select('*').eq('facility_id', FACILITY_ID).order('created_at', { ascending: false }),
    supabase.from('care_events').select('id, occurred_at, severity').eq('facility_id', FACILITY_ID).order('occurred_at', { ascending: false }).limit(200),
    supabase.from('audit_log').select('*').eq('facility_id', FACILITY_ID).order('created_at', { ascending: false }).limit(50),
  ])

  return (
    <AdminDashboardClient
      tickets={ticketsRes.data ?? []}
      events={eventsRes.data ?? []}
      auditLog={auditRes.data ?? []}
    />
  )
}
