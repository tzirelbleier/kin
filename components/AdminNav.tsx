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
    { href: '/family/dashboard?returnTo=/admin/dashboard', label: 'Family View', icon: '👨‍👩‍👧' },
    { href: '/staff/tickets', label: 'Staff Tickets', icon: '🎫' },
    { href: '/admin/dashboard', label: 'Admin Dashboard', icon: '📊' },
  ]

  return (
    <nav style={{
      position: 'sticky',
      top: 0,
      zIndex: 50,
      height: 44,
      background: '#0f172a',
      borderBottom: '1px solid #1e293b',
      display: 'flex',
      alignItems: 'center',
      padding: '0 16px',
      gap: 4,
      fontSize: 13,
    }}>
      <span style={{ color: '#94a3b8', fontWeight: 700, marginRight: 8, letterSpacing: '-0.3px' }}>
        Idene Admin
      </span>

      <div style={{ display: 'flex', gap: 2, flex: 1 }}>
        {links.map(({ href, label, icon }) => {
          const active = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '5px 12px',
                borderRadius: 6,
                textDecoration: 'none',
                fontWeight: active ? 600 : 400,
                background: active ? '#1e40af' : 'transparent',
                color: active ? '#fff' : '#94a3b8',
                transition: 'background 0.1s, color 0.1s',
              }}
            >
              <span>{icon}</span>
              {label}
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
          padding: '4px 12px',
          color: '#94a3b8',
          fontSize: 12,
          cursor: 'pointer',
        }}
      >
        Sign out
      </button>
    </nav>
  )
}
