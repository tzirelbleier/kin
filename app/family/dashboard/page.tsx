import { createServiceClient } from '@/lib/supabase'
import { FamilyDashboardClient } from './client'

export const dynamic = 'force-dynamic'

export default async function FamilyDashboardPage() {
  const supabase = createServiceClient()

  // Fetch first active resident (pre-auth: Eleanor Whitmore from seed)
  const { data: residents } = await supabase
    .from('residents')
    .select('*')
    .eq('facility_id', 'a1b2c3d4-0001-0001-0001-000000000001')
    .eq('is_active', true)
    .order('full_name')

  const resident = residents?.[0] ?? null

  // Fetch care events for that resident
  const { data: events } = resident
    ? await supabase
        .from('care_events')
        .select('*')
        .eq('resident_id', resident.id)
        .order('occurred_at', { ascending: false })
        .limit(30)
    : { data: [] }

  return (
    <FamilyDashboardClient
      resident={resident}
      events={events ?? []}
      facilityId="a1b2c3d4-0001-0001-0001-000000000001"
      profileId="demo-family-user"
    />
  )
}
