'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase'

export function AdminNav({ role }: { role: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const isAdmin = role === 'admin' || role === 'director'

  const signOut = async () => {
    const supabase = createBrowserClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const links = isAdmin
    ? [
        { href: '/family/dashboard', label: 'Family View', icon: '♥' },
        { href: '/staff/tickets', label: 'Staff Tickets', icon: '#' },
        { href: '/admin/dashboard', label: 'Admin Dashboard', icon: '◈' },
      ]
    : [
        { href: '/family/dashboard', label: 'Family View', icon: '♥' },
        { href: '/staff/tickets', label: 'Staff Tickets', icon: '#' },
      ]

  return (
    <nav className="kin-nav kin-nav--dark" style={{ gap: 4, fontSize: 13, flexWrap: 'wrap', zIndex: 50 }}>
      <span style={{ color: 'var(--color-nav-dark-muted)', fontWeight: 700, marginRight: 4, letterSpacing: '-0.3px', whiteSpace: 'nowrap' }}>
        {isAdmin ? 'Idene Admin' : 'Idene Staff'}
      </span>

      <div style={{ display: 'flex', gap: 2, flex: 1, overflowX: 'auto', scrollbarWidth: 'none' }}>
        {links.map(({ href, label, icon }) => {
          const active = pathname.startsWith(href.split('?')[0])
          return (
            <Link
              key={href}
              href={href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '6px 10px',
                borderRadius: 6,
                textDecoration: 'none',
                fontWeight: active ? 600 : 400,
                background: active ? 'var(--color-nav-dark-active)' : 'transparent',
                color: active ? '#fff' : 'var(--color-nav-dark-muted)',
                transition: 'background 0.1s, color 0.1s',
                whiteSpace: 'nowrap',
                minHeight: 36,
              }}
            >
              <span>{icon}</span>
              <span>{label}</span>
            </Link>
          )
        })}
      </div>

      <button
        onClick={signOut}
        style={{
          background: 'transparent',
          border: '1px solid var(--color-nav-dark-border)',
          borderRadius: 6,
          padding: '6px 12px',
          color: 'var(--color-nav-dark-muted)',
          fontSize: 13,
          cursor: 'pointer',
          minHeight: 36,
          whiteSpace: 'nowrap',
        }}
      >
        Sign out
      </button>
    </nav>
  )
}
