import { redirect } from 'next/navigation'
import { createServerClient, getCurrentProfile } from '@/lib/supabase-server'
import { StaffTicketsClient } from './client'

export const dynamic = 'force-dynamic'

export default async function StaffTicketsPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')

  const supabase = await createServerClient()

  const { data: tickets } = await supabase
    .from('tickets')
    .select(`
      *,
      resident:residents(full_name, room_number),
      creator:profiles!tickets_created_by_fkey(full_name, role),
      assignee:profiles!tickets_assigned_to_fkey(full_name, role),
      messages:ticket_messages(*, author:profiles(full_name, role))
    `)
    .eq('facility_id', profile.facility_id)
    .order('created_at', { ascending: false })

  return <StaffTicketsClient tickets={tickets ?? []} profileId={profile.id} />
}
