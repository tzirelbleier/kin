import { createServiceClient } from '@/lib/supabase'
import { StaffTicketsClient } from './client'

export const dynamic = 'force-dynamic'

const FACILITY_ID = 'a1b2c3d4-0001-0001-0001-000000000001'

export default async function StaffTicketsPage() {
  const supabase = createServiceClient()

  const { data: tickets } = await supabase
    .from('tickets')
    .select(`
      *,
      resident:residents(full_name, room_number),
      creator:profiles!tickets_created_by_fkey(full_name, role),
      assignee:profiles!tickets_assigned_to_fkey(full_name, role),
      messages:ticket_messages(*, author:profiles(full_name, role))
    `)
    .eq('facility_id', FACILITY_ID)
    .order('created_at', { ascending: false })

  return <StaffTicketsClient tickets={tickets ?? []} />
}
