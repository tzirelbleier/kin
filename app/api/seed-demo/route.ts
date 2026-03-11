// ================================================================
// Idene — Seed demo users + profiles + family_residents
// POST /api/seed-demo
// Requires header: x-webhook-secret: <WEBHOOK_SECRET>
// Run once before the demo.
// ================================================================

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const FACILITY_ID = 'a1b2c3d4-0001-0001-0001-000000000001'

const DEMO_USERS = [
  {
    email: 'admin@sunrisegardens.com',
    password: 'Demo1234!',
    full_name: 'Alex Rivera',
    role: 'director' as const,
    resident_links: [] as string[],
  },
  {
    email: 'nurse@sunrisegardens.com',
    password: 'Demo1234!',
    full_name: 'Jordan Reyes',
    role: 'nurse' as const,
    resident_links: [] as string[],
  },
  {
    email: 'sarah.whitmore@demo-idene',
    password: 'Demo1234!',
    full_name: 'Sarah Whitmore',
    role: 'family' as const,
    // Eleanor Whitmore — will be resolved by name below
    resident_name: 'Eleanor Whitmore',
    relationship: 'Daughter',
  },
  {
    email: 'tom.jennings@demo-idene',
    password: 'Demo1234!',
    full_name: 'Tom Jennings',
    role: 'family' as const,
    // Harold Jennings — will be resolved by name below
    resident_name: 'Harold Jennings',
    relationship: 'Son',
  },
]

export async function POST(request: Request) {
  // Verify shared secret
  const secret = request.headers.get('x-webhook-secret')
  if (!secret || secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const results: { email: string; status: string; detail?: string }[] = []

  // Resolve resident IDs by name
  const { data: residents } = await supabase
    .from('residents')
    .select('id, full_name')
    .eq('facility_id', FACILITY_ID)

  const residentByName = Object.fromEntries(
    (residents ?? []).map((r) => [r.full_name, r.id])
  )

  for (const user of DEMO_USERS) {
    try {
      // Create auth user (service role bypasses email confirmation)
      const { data: authData, error: createError } = await supabase.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
      })

      if (createError) {
        // User may already exist — try to look them up
        if (createError.message.includes('already') || createError.message.includes('exists')) {
          results.push({ email: user.email, status: 'skipped', detail: 'User already exists' })
          continue
        }
        throw createError
      }

      const userId = authData.user.id

      // Upsert profile
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: userId,
          facility_id: FACILITY_ID,
          email: user.email,
          full_name: user.full_name,
          role: user.role,
        })

      if (profileError) throw profileError

      // Create family_residents link if needed
      if ('resident_name' in user && user.resident_name) {
        const residentId = residentByName[user.resident_name]
        if (residentId) {
          const { error: linkError } = await supabase
            .from('family_residents')
            .upsert({
              profile_id: userId,
              resident_id: residentId,
              relationship: user.relationship ?? null,
              is_primary_contact: true,
            })
          if (linkError) throw linkError
        } else {
          results.push({
            email: user.email,
            status: 'warning',
            detail: `Resident "${user.resident_name}" not found in facility`,
          })
          continue
        }
      }

      results.push({ email: user.email, status: 'created' })
    } catch (err: unknown) {
      results.push({
        email: user.email,
        status: 'error',
        detail: err instanceof Error ? err.message : String(err),
      })
    }
  }

  const errors = results.filter((r) => r.status === 'error')
  return NextResponse.json({ results }, { status: errors.length > 0 ? 207 : 200 })
}
