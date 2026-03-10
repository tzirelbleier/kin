// ================================================================
// Kin — Server-only Supabase helpers
// Import only from Server Components, Route Handlers, and middleware.
// Never import from 'use client' files.
// ================================================================

import { createServerClient as _createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Profile } from '@/types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Server client — uses cookies() for session management
export async function createServerClient() {
  const cookieStore = await cookies()
  return _createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {
          // setAll called from a Server Component — safe to ignore
        }
      },
    },
  })
}

// getCurrentProfile — reads session + joins profiles table
export async function getCurrentProfile(): Promise<Profile | null> {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
    return profile as Profile | null
  } catch {
    return null
  }
}
