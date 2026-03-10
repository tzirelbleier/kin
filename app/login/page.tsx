'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase'

const DEMO_ACCOUNTS = [
  { label: 'Admin / Director', email: 'admin@sunrisegardens.com', password: 'Demo1234!' },
  { label: 'Nurse', email: 'nurse@sunrisegardens.com', password: 'Demo1234!' },
  { label: "Sarah (Eleanor's family)", email: 'sarah.whitmore@demo.kin', password: 'Demo1234!' },
  { label: "Tom (Harold's family)", email: 'tom.jennings@demo.kin', password: 'Demo1234!' },
]

function roleToPath(role?: string | null): string {
  if (role === 'family') return '/family/dashboard'
  if (role === 'staff' || role === 'nurse') return '/staff/tickets'
  if (role === 'admin' || role === 'director') return '/admin/dashboard'
  return '/'
}

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextPath = searchParams.get('next')

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const supabase = createBrowserClient()

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Login failed. Please try again.'); setLoading(false); return }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const dest = nextPath ?? roleToPath(profile?.role)
    router.push(dest)
    router.refresh()
  }

  const fillDemo = (acc: typeof DEMO_ACCOUNTS[number]) => {
    setEmail(acc.email)
    setPassword(acc.password)
    setError('')
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--color-bg)',
      padding: 24,
    }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: 'var(--color-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, margin: '0 auto 12px',
          }}>
            🤝
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Kin</h1>
          <p style={{ fontSize: 14, color: 'var(--color-text-secondary)' }}>
            Family Transparency Platform
          </p>
        </div>

        {/* Login card */}
        <div className="kin-card" style={{ padding: 28 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 20 }}>Sign in to your account</h2>

          <form onSubmit={signIn} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-group">
              <label className="form-label" htmlFor="email">Email</label>
              <input
                id="email"
                className="form-input"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="password">Password</label>
              <input
                id="password"
                className="form-input"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div style={{
                padding: '10px 12px',
                borderRadius: 6,
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#dc2626',
                fontSize: 13,
              }}>
                {error}
              </div>
            )}

            <button
              className="btn btn--primary"
              type="submit"
              disabled={loading}
              style={{ marginTop: 4, height: 40 }}
            >
              {loading ? <span className="spinner" /> : 'Sign in'}
            </button>
          </form>
        </div>

        {/* Demo accounts */}
        <div className="kin-card" style={{ padding: 20, marginTop: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Demo accounts
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {DEMO_ACCOUNTS.map((acc) => (
              <button
                key={acc.email}
                className="btn btn--secondary btn--sm"
                style={{ justifyContent: 'flex-start', textAlign: 'left', gap: 8 }}
                onClick={() => fillDemo(acc)}
              >
                <span style={{ flex: 1 }}>{acc.label}</span>
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)', fontFamily: 'var(--font-geist-mono)' }}>
                  {acc.email}
                </span>
              </button>
            ))}
          </div>
          <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 10 }}>
            Click an account to fill in credentials, then sign in.
          </p>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
