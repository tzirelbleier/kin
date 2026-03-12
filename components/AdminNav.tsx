'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase'

export function AdminNav() {
  const pathname = usePathname()
  const router = useRouter()

  const signOut = async () => {
    const supabase = createBrowserClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const links = [
    { href: '/family/dashboard?returnTo=/admin/dashboard', label: 'Family View', icon: '♥' },
    { href: '/staff/tickets', label: 'Staff Tickets', icon: '#' },
    { href: '/admin/dashboard', label: 'Admin Dashboard', icon: '◈' },
  ]

  return (
    <nav style={{
      position: 'sticky',
      top: 0,
      zIndex: 50,
      minHeight: 44,
      background: '#0f172a',
      borderBottom: '1px solid #1e293b',
      display: 'flex',
      alignItems: 'center',
      padding: '0 16px',
      gap: 4,
      fontSize: 13,
      flexWrap: 'wrap',
    }}>
      <span style={{ color: '#94a3b8', fontWeight: 700, marginRight: 4, letterSpacing: '-0.3px', whiteSpace: 'nowrap' }}>
        Idene Admin
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
                background: active ? '#1e40af' : 'transparent',
                color: active ? '#fff' : '#94a3b8',
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
          border: '1px solid #334155',
          borderRadius: 6,
          padding: '6px 12px',
          color: '#94a3b8',
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
