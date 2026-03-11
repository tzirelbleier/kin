import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'
import { FamilyDashboardClient } from './client'
import type { Resident, CareEvent } from '@/types'

export const dynamic = 'force-dynamic'

export default async function FamilyDashboardPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')

  const supabase = createServiceClient()
  const isAdmin = profile.role === 'admin' || profile.role === 'director'

  let residents: Resident[] = []

  if (isAdmin) {
    // Admin/director: see all active residents in the facility
    const { data } = await supabase
      .from('residents')
      .select('*')
      .eq('facility_id', profile.facility_id)
      .eq('is_active', true)
      .order('full_name')
    residents = (data ?? []) as Resident[]
  } else {
    // Family: see only linked residents via family_residents join
    const { data: links } = await supabase
      .from('family_residents')
      .select('resident:residents(*)')
      .eq('profile_id', profile.id)
    residents = ((links ?? []) as unknown as { resident: Resident }[])
      .map((l) => l.resident)
      .filter(Boolean)
  }

  const firstResident = residents[0] ?? null

  // Fetch care events for the first resident
  const { data: events } = firstResident
    ? await supabase
        .from('care_events')
        .select('*')
        .eq('resident_id', firstResident.id)
        .order('occurred_at', { ascending: false })
        .limit(30)
    : { data: [] }

  return (
    <FamilyDashboardClient
      residents={residents}
      initialEvents={(events ?? []) as CareEvent[]}
      facilityId={profile.facility_id}
      profileId={profile.id}
      isAdmin={isAdmin}
    />
  )
}
