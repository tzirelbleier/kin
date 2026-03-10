// ================================================================
// Kin — Auth middleware + role-based route protection
// ================================================================

import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Use service role for profile lookups to avoid RLS recursion
async function getProfileByUserId(userId: string) {
  const service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  const { data } = await service.from('profiles').select('role').eq('id', userId).single()
  return data
}

function roleToPath(role?: string | null): string {
  if (role === 'family') return '/family/dashboard'
  if (role === 'staff' || role === 'nurse') return '/staff/tickets'
  if (role === 'admin' || role === 'director') return '/admin/dashboard'
  return '/login'
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session — required for SSR cookie rotation
  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Static assets, API routes, and auth callback are always public
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/auth/')
  ) {
    return response
  }

  // /login is public — but redirect already-authenticated users to their home
  if (pathname === '/login') {
    if (user) {
      const profile = await getProfileByUserId(user.id)
      if (!profile) return response
      return NextResponse.redirect(new URL(roleToPath(profile.role), request.url))
    }
    return response
  }

  // All other routes require an authenticated session
  if (!user) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Fetch role via service role (bypasses RLS to avoid recursive policy issue)
  const profile = await getProfileByUserId(user.id)
  const role = profile?.role

  // Root — redirect to role home
  if (pathname === '/') {
    return NextResponse.redirect(new URL(roleToPath(role), request.url))
  }

  // /family/* — family, admin, director
  if (
    pathname.startsWith('/family/') &&
    !['family', 'admin', 'director'].includes(role ?? '')
  ) {
    return NextResponse.redirect(new URL(roleToPath(role), request.url))
  }

  // /staff/* — staff, nurse, admin, director
  if (
    pathname.startsWith('/staff/') &&
    !['staff', 'nurse', 'admin', 'director'].includes(role ?? '')
  ) {
    return NextResponse.redirect(new URL(roleToPath(role), request.url))
  }

  // /admin/* — admin, director only
  if (
    pathname.startsWith('/admin/') &&
    !['admin', 'director'].includes(role ?? '')
  ) {
    return NextResponse.redirect(new URL(roleToPath(role), request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico).*)'],
}
