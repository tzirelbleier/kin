'use client'

import { useState, useEffect } from 'react'
import { PRIORITY_ROUTING } from '@/types'
import type { Ticket, TicketCategory, TicketPriority, UserRole, Profile, RoutingRule } from '@/types'
import { ExcelImportTab } from '@/components/admin/ExcelImportTab'

type Tab = 'reports' | 'tickets' | 'routing' | 'users' | 'audit' | 'import' | 'integrations'

const TABS: { id: Tab; label: string }[] = [
  { id: 'reports', label: 'Reports' },
  { id: 'tickets', label: 'Tickets' },
  { id: 'routing', label: 'Routing' },
  { id: 'users', label: 'Users' },
  { id: 'audit', label: 'Audit Log' },
  { id: 'import', label: '📊 Import Events' },
  { id: 'integrations', label: '🔌 Integrations' },
]

const ACTION_ICONS: Record<string, string> = {
  'ticket.created': '🎫',
  'ticket.updated': '✏️',
  'ticket.auto_created': '🚨',
  'message.created': '📨',
  'care_event.ingested': '📡',
}

const PRIORITY_OPTIONS: TicketPriority[] = ['low', 'normal', 'high', 'urgent']
const ROLE_OPTIONS: UserRole[] = ['staff', 'nurse', 'admin', 'director']
const ALL_ROLE_OPTIONS: UserRole[] = ['family', 'staff', 'nurse', 'admin', 'director']

// ----------------------------------------------------------------
// Integration sub-components
// ----------------------------------------------------------------

function IntegrationCard({ icon, name, status, description, statusLabel, action }: {
  icon: string
  name: string
  status: 'active' | 'inactive'
  description: string
  statusLabel: string
  action: React.ReactNode
}) {
  return (
    <div className="kin-card" style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
      <div style={{ fontSize: 28, flexShrink: 0, marginTop: 2 }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>{name}</span>
          <span style={{
            fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99,
            background: status === 'active' ? '#dcfce7' : '#f3f4f6',
            color: status === 'active' ? '#15803d' : '#6b7280',
          }}>
            {status === 'active' ? '● ' : '○ '}{statusLabel}
          </span>
        </div>
        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 14, lineHeight: 1.6 }}>
          {description}
        </p>
        {action}
      </div>
    </div>
  )
}

function WebhookConfig({ name, webhookPath, sourceSlug }: {
  name: string
  webhookPath: string
  sourceSlug: string
}) {
  const [open, setOpen] = useState(false)
  const appUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const webhookUrl = `${appUrl}${webhookPath}`

  return (
    <div>
      <button className="btn btn--secondary btn--sm" onClick={() => setOpen(v => !v)}>
        {open ? 'Hide setup' : 'Show setup instructions'}
      </button>
      {open && (
        <div style={{ marginTop: 12, padding: 16, background: 'var(--color-bg)', borderRadius: 8, border: '1px solid var(--color-border)', fontSize: 13 }}>
          <div style={{ fontWeight: 600, marginBottom: 10 }}>Configure {name} webhook</div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', marginBottom: 4 }}>1. Webhook endpoint URL</div>
            <code style={{ display: 'block', background: '#1e293b', color: '#e2e8f0', padding: '8px 12px', borderRadius: 6, fontSize: 12, wordBreak: 'break-all' }}>{webhookUrl}</code>
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', marginBottom: 4 }}>2. Required header</div>
            <code style={{ display: 'block', background: '#1e293b', color: '#e2e8f0', padding: '8px 12px', borderRadius: 6, fontSize: 12 }}>
              x-kin-webhook-secret: {'<your WEBHOOK_SECRET env var>'}
            </code>
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', marginBottom: 4 }}>3. Payload source field</div>
            <code style={{ display: 'block', background: '#1e293b', color: '#e2e8f0', padding: '8px 12px', borderRadius: 6, fontSize: 12 }}>
              {`{ "source": "${sourceSlug}", "facility_slug": "sunrise-gardens", "events": [...] }`}
            </code>
          </div>
          <div style={{ padding: '10px 12px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, color: '#92400e', fontSize: 12 }}>
            💡 Once events are received, this integration will show as <strong>Active</strong> automatically.
          </div>
        </div>
      )}
    </div>
  )
}

// ----------------------------------------------------------------
// Routing tab (editable)
// ----------------------------------------------------------------

type RoutingDraft = Record<TicketCategory, { priority: TicketPriority; routes_to: UserRole; sla_hours: number }>

function RoutingTab({ facilityId }: { facilityId: string }) {
  const categories = Object.keys(PRIORITY_ROUTING) as TicketCategory[]
  const [editMode, setEditMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle')

  const defaultDraft = (): RoutingDraft =>
    Object.fromEntries(categories.map(cat => [cat, {
      priority: PRIORITY_ROUTING[cat].priority,
      routes_to: PRIORITY_ROUTING[cat].routes_to,
      sla_hours: PRIORITY_ROUTING[cat].sla_hours,
    }])) as RoutingDraft

  const [draft, setDraft] = useState<RoutingDraft>(defaultDraft)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetch('/api/admin/routing')
      .then(r => r.json())
      .then(({ routing_config }) => {
        if (routing_config) {
          setDraft(prev => {
            const next = { ...prev }
            for (const cat of categories) {
              if (routing_config[cat]) {
                next[cat] = { ...prev[cat], ...routing_config[cat] }
              }
            }
            return next
          })
        }
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  }, [])

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/routing', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ routing_config: draft }),
      })
      if (res.ok) { setSaveStatus('saved'); setEditMode(false) }
      else setSaveStatus('error')
    } catch {
      setSaveStatus('error')
    } finally {
      setSaving(false)
      setTimeout(() => setSaveStatus('idle'), 3000)
    }
  }

  const reset = () => { setDraft(defaultDraft()); setEditMode(false) }

  const update = (cat: TicketCategory, field: keyof RoutingDraft[TicketCategory], value: string | number) => {
    setDraft(prev => ({ ...prev, [cat]: { ...prev[cat], [field]: value } }))
  }

  return (
    <div className="kin-card" style={{ maxWidth: 760 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}>Escalation routing rules</div>
          <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
            Configure priority, routing destination, and SLA hours per ticket category.
            Changes are saved per facility.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0, marginLeft: 16 }}>
          {!editMode && (
            <button className="btn btn--secondary btn--sm" onClick={() => setEditMode(true)}>Edit</button>
          )}
          {editMode && (
            <>
              <button className="btn btn--secondary btn--sm" onClick={reset}>Cancel</button>
              <button className="btn btn--primary btn--sm" disabled={saving} onClick={save}>
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </>
          )}
          {saveStatus === 'saved' && <span style={{ fontSize: 12, color: '#16a34a', alignSelf: 'center' }}>✓ Saved</span>}
          {saveStatus === 'error' && <span style={{ fontSize: 12, color: '#dc2626', alignSelf: 'center' }}>Save failed</span>}
        </div>
      </div>
      {!loaded ? (
        <div style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Loading…</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
              {['Category', 'Priority', 'Routes to', 'SLA (hours)'].map((h) => (
                <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {categories.map((cat) => {
              const rule = PRIORITY_ROUTING[cat]
              const d = draft[cat]
              return (
                <tr key={cat} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                  <td style={{ padding: '12px' }}>
                    <span style={{ fontWeight: 600 }}>{rule.icon} {rule.label}</span>
                    <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>{rule.description}</div>
                  </td>
                  <td style={{ padding: '12px' }}>
                    {editMode ? (
                      <select className="form-input" style={{ fontSize: 12, padding: '4px 8px' }} value={d.priority} onChange={e => update(cat, 'priority', e.target.value)}>
                        {PRIORITY_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    ) : (
                      <span className={`chip chip--${d.priority}`}>{d.priority}</span>
                    )}
                  </td>
                  <td style={{ padding: '12px' }}>
                    {editMode ? (
                      <select className="form-input" style={{ fontSize: 12, padding: '4px 8px' }} value={d.routes_to} onChange={e => update(cat, 'routes_to', e.target.value)}>
                        {ROLE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    ) : (
                      <span style={{ fontWeight: 500, textTransform: 'capitalize' }}>→ {d.routes_to}</span>
                    )}
                  </td>
                  <td style={{ padding: '12px' }}>
                    {editMode ? (
                      <input type="number" className="form-input" style={{ fontSize: 12, padding: '4px 8px', width: 70 }} value={d.sla_hours} min={1} max={168} onChange={e => update(cat, 'sla_hours', Number(e.target.value))} />
                    ) : (
                      <span style={{ fontWeight: 600 }}>{d.sla_hours}h</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}

// ----------------------------------------------------------------
// Users tab
// ----------------------------------------------------------------

const ROLE_BADGE_COLORS: Record<UserRole, { bg: string; color: string }> = {
  director: { bg: '#dbeafe', color: '#1d4ed8' },
  admin: { bg: '#ede9fe', color: '#6d28d9' },
  nurse: { bg: '#dcfce7', color: '#15803d' },
  staff: { bg: '#f3f4f6', color: '#374151' },
  family: { bg: '#fff7ed', color: '#c2410c' },
}

function RoleBadge({ role }: { role: UserRole }) {
  const c = ROLE_BADGE_COLORS[role] ?? { bg: '#f3f4f6', color: '#374151' }
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: c.bg, color: c.color, textTransform: 'capitalize' }}>
      {role}
    </span>
  )
}

type UserModal =
  | { kind: 'create' }
  | { kind: 'edit'; profile: Profile }
  | null

function UsersTab({ initialProfiles, facilityId }: { initialProfiles: Profile[]; facilityId: string }) {
  const [profiles, setProfiles] = useState<Profile[]>(initialProfiles)
  const [modal, setModal] = useState<UserModal>(null)
  const [form, setForm] = useState({ email: '', full_name: '', role: 'staff' as UserRole })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const refresh = async () => {
    const res = await fetch('/api/admin/users')
    if (res.ok) setProfiles(await res.json())
  }

  const openCreate = () => {
    setForm({ email: '', full_name: '', role: 'staff' })
    setError('')
    setModal({ kind: 'create' })
  }

  const openEdit = (p: Profile) => {
    setForm({ email: p.email, full_name: p.full_name, role: p.role })
    setError('')
    setModal({ kind: 'edit', profile: p })
  }

  const submit = async () => {
    setSubmitting(true)
    setError('')
    try {
      if (modal?.kind === 'create') {
        const res = await fetch('/api/admin/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        const json = await res.json()
        if (!res.ok) { setError(json.error ?? 'Failed to create user'); return }
        setSuccessMsg(`Created ${form.full_name}. Temporary password: Demo1234!`)
      } else if (modal?.kind === 'edit') {
        const res = await fetch('/api/admin/users', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: modal.profile.id, full_name: form.full_name, role: form.role }),
        })
        const json = await res.json()
        if (!res.ok) { setError(json.error ?? 'Failed to update user'); return }
      }
      setModal(null)
      await refresh()
    } finally {
      setSubmitting(false)
      setTimeout(() => setSuccessMsg(''), 5000)
    }
  }

  const toggleActive = async (p: Profile) => {
    await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: p.id, is_active: !(p.is_active ?? true) }),
    })
    await refresh()
  }

  const activeProfiles = profiles.filter(p => p.is_active !== false)
  const inactiveProfiles = profiles.filter(p => p.is_active === false)

  return (
    <div style={{ maxWidth: 800 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>User Management</h2>
          <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: 0 }}>
            {activeProfiles.length} active users · {inactiveProfiles.length} inactive
          </p>
        </div>
        <button className="btn btn--primary btn--sm" onClick={openCreate}>+ Add user</button>
      </div>

      {successMsg && (
        <div style={{ padding: '10px 14px', background: '#dcfce7', border: '1px solid #86efac', borderRadius: 8, fontSize: 13, color: '#15803d', marginBottom: 16 }}>
          ✓ {successMsg}
        </div>
      )}

      <div className="kin-card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--color-border)', background: 'var(--color-bg)' }}>
              {['Name', 'Email', 'Role', 'Status', 'Joined', ''].map(h => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {profiles.map(p => (
              <tr key={p.id} style={{ borderBottom: '1px solid var(--color-border-light)', opacity: p.is_active === false ? 0.5 : 1 }}>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#1d4ed8', flexShrink: 0 }}>
                      {p.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{p.full_name}</span>
                  </div>
                </td>
                <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--color-text-secondary)' }}>{p.email}</td>
                <td style={{ padding: '12px 16px' }}><RoleBadge role={p.role} /></td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99,
                    background: p.is_active !== false ? '#dcfce7' : '#f3f4f6',
                    color: p.is_active !== false ? '#15803d' : '#6b7280',
                  }}>
                    {p.is_active !== false ? '● Active' : '○ Inactive'}
                  </span>
                </td>
                <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--color-text-muted)' }}>
                  {new Date(p.created_at).toLocaleDateString()}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn--secondary btn--sm" onClick={() => openEdit(p)}>Edit</button>
                    <button
                      className="btn btn--sm"
                      style={{ background: p.is_active !== false ? '#fff7ed' : '#f0fdf4', color: p.is_active !== false ? '#c2410c' : '#15803d', border: `1px solid ${p.is_active !== false ? '#fed7aa' : '#86efac'}` }}
                      onClick={() => toggleActive(p)}
                    >
                      {p.is_active !== false ? 'Deactivate' : 'Reactivate'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" style={{ width: 440 }} onClick={e => e.stopPropagation()}>
            <div className="modal__header">
              <h2 className="modal__title">{modal.kind === 'create' ? 'Add user' : `Edit ${(modal as any).profile.full_name}`}</h2>
              <button className="btn btn--ghost btn--sm" onClick={() => setModal(null)}>×</button>
            </div>
            <div className="modal__body">
              {error && (
                <div style={{ padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, color: '#dc2626', fontSize: 13, marginBottom: 12 }}>
                  {error}
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Full name *</label>
                <input className="form-input" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Jane Smith" />
              </div>
              {modal.kind === 'create' && (
                <div className="form-group">
                  <label className="form-label">Email *</label>
                  <input className="form-input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="jane@example.com" />
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Role *</label>
                <select className="form-input" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as UserRole }))}>
                  {ALL_ROLE_OPTIONS.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                </select>
              </div>
              {modal.kind === 'create' && (
                <div style={{ padding: '8px 12px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, fontSize: 12, color: '#92400e' }}>
                  Temporary password: <strong>Demo1234!</strong> — user should change it after first login.
                </div>
              )}
            </div>
            <div className="modal__footer">
              <button className="btn btn--secondary" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btn--primary" disabled={submitting || !form.full_name || (modal.kind === 'create' && !form.email)} onClick={submit}>
                {submitting ? 'Saving…' : modal.kind === 'create' ? 'Create user' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ----------------------------------------------------------------
// Props + main component
// ----------------------------------------------------------------

interface Props {
  tickets: Ticket[]
  events: { id: string; occurred_at: string; severity: string; source: string }[]
  auditLog: { id: string; action: string; actor_id: string | null; entity_type: string; entity_id: string | null; created_at: string; after_state: Record<string, unknown> | null }[]
  facilityId: string
  profiles: Profile[]
}

export function AdminDashboardClient({ tickets, events, auditLog, facilityId, profiles }: Props) {
  const [tab, setTab] = useState<Tab>('reports')

  // ----- Reports metrics -----
  const total = tickets.length
  const open = tickets.filter(t => !['resolved', 'closed'].includes(t.status))
  const resolved = tickets.filter(t => ['resolved', 'closed'].includes(t.status))
  const overdue = tickets.filter(t => {
    if (!t.due_by || ['resolved', 'closed'].includes(t.status)) return false
    return new Date(t.due_by) < new Date()
  })
  const responded = tickets.filter(t => t.first_response_at)
  const avgResponseH = responded.length > 0
    ? (responded.reduce((sum, t) => sum + (new Date(t.first_response_at!).getTime() - new Date(t.created_at).getTime()), 0) / responded.length / 3600000).toFixed(1)
    : '—'

  const now = Date.now()
  const weekAgo = now - 7 * 86400000
  const resolvedThisWeek = tickets.filter(t => t.resolved_at && new Date(t.resolved_at).getTime() > weekAgo)
  const todayEvents = events.filter(e => {
    const d = new Date(e.occurred_at)
    const today = new Date(); today.setHours(0,0,0,0)
    return d >= today
  }).length

  const slaCompliant = tickets.filter(t =>
    !t.due_by || new Date(t.resolved_at ?? new Date()).getTime() <= new Date(t.due_by).getTime()
  )
  const slaPercent = total > 0 ? Math.round((slaCompliant.length / total) * 100) : 100

  // 7-day chart
  const sevenDayData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() - (6 - i))
    const next = new Date(d); next.setDate(next.getDate() + 1)
    const count = tickets.filter(t => { const cd = new Date(t.created_at); return cd >= d && cd < next }).length
    return { day: d.toLocaleDateString('en', { weekday: 'short' }), count }
  })
  const maxCount = Math.max(...sevenDayData.map(d => d.count), 1)

  // Category breakdown
  const categories = Object.keys(PRIORITY_ROUTING) as TicketCategory[]
  const categoryStats = categories.map(cat => {
    const catTickets = tickets.filter(t => t.category === cat)
    const responded2 = catTickets.filter(t => t.first_response_at)
    const avgH = responded2.length > 0
      ? (responded2.reduce((s, t) => s + (new Date(t.first_response_at!).getTime() - new Date(t.created_at).getTime()), 0) / responded2.length / 3600000).toFixed(1)
      : '—'
    const sla = catTickets.length > 0
      ? Math.round(catTickets.filter(t => !t.due_by || new Date(t.resolved_at ?? new Date()).getTime() <= new Date(t.due_by).getTime()).length / catTickets.length * 100)
      : 100
    return { category: cat, count: catTickets.length, avg_hours: avgH, sla_pct: sla }
  }).filter(s => s.count > 0)
  const maxCatCount = Math.max(...categoryStats.map(s => s.count), 1)

  // Events by source
  const eventSources = [
    { name: 'Excel Upload', source: 'staff', icon: '📊' },
    { name: 'PointClickCare', source: 'pointclickcare', icon: '🏥' },
    { name: 'Tabula Pro', source: 'tabulapro', icon: '📋' },
    { name: 'MatrixCare', source: 'matrixcare', icon: '🔗' },
  ] as { name: string; source: string; icon: string }[]

  // Events by severity
  const severityCounts = ['incident', 'critical', 'warning', 'info'].map(sev => ({
    sev,
    count: events.filter(e => e.severity === sev).length,
    color: sev === 'incident' ? '#ef4444' : sev === 'critical' ? '#f97316' : sev === 'warning' ? '#eab308' : '#22c55e',
  })).filter(s => s.count > 0)
  const maxSev = Math.max(...severityCounts.map(s => s.count), 1)

  return (
    <div className="kin-page">
      <nav className="kin-nav kin-nav--dark">
        <span className="kin-nav__brand">Idene</span>
        <span style={{ fontSize: 13, color: '#9ca3af' }}>Admin · Sunrise Gardens</span>
        <span className="kin-nav__spacer" />
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>AD</div>
      </nav>

      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)', padding: '0 24px', overflowX: 'auto' }}>
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '14px 18px', border: 'none', cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap',
            borderBottom: tab === t.id ? '2px solid var(--color-primary)' : '2px solid transparent',
            background: 'transparent', marginBottom: -1,
            fontWeight: tab === t.id ? 600 : 400,
            color: tab === t.id ? 'var(--color-primary)' : 'var(--color-text-secondary)',
          }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>

        {/* REPORTS */}
        {tab === 'reports' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* KPI row 1 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12 }}>
              {[
                { label: 'Total tickets', value: String(total), color: '#2563eb' },
                { label: 'Open', value: String(open.length), color: '#d97706' },
                { label: 'Resolved', value: String(resolved.length), color: '#16a34a' },
                { label: 'Resolved this week', value: String(resolvedThisWeek.length), color: '#059669' },
                { label: 'Overdue', value: String(overdue.length), color: '#dc2626' },
                { label: 'SLA compliance', value: `${slaPercent}%`, color: slaPercent >= 95 ? '#16a34a' : slaPercent >= 85 ? '#d97706' : '#dc2626' },
              ].map((m) => (
                <div key={m.label} className="kin-card" style={{ textAlign: 'center', padding: 16 }}>
                  <div style={{ fontSize: 26, fontWeight: 800, color: m.color, marginBottom: 2 }}>{m.value}</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)' }}>{m.label}</div>
                </div>
              ))}
            </div>

            {/* KPI row 2 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              {[
                { label: 'Avg first response', value: `${avgResponseH}h`, color: '#7c3aed' },
                { label: 'Tickets with response', value: `${responded.length}/${total}`, color: '#2563eb' },
                { label: 'Auto-updates today', value: String(todayEvents), color: '#d97706' },
                { label: 'Active users', value: String(profiles.filter(p => p.is_active !== false).length), color: '#0891b2' },
              ].map((m) => (
                <div key={m.label} className="kin-card" style={{ textAlign: 'center', padding: 16 }}>
                  <div style={{ fontSize: 26, fontWeight: 800, color: m.color, marginBottom: 2 }}>{m.value}</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)' }}>{m.label}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {/* 7-day chart */}
              <div className="kin-card">
                <div style={{ fontWeight: 600, marginBottom: 16 }}>Tickets this week</div>
                {sevenDayData.every(d => d.count === 0) ? (
                  <div style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>No tickets this week yet.</div>
                ) : (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: 100 }}>
                    {sevenDayData.map((d) => (
                      <div key={d.day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)' }}>{d.count}</div>
                        <div style={{ width: '100%', height: `${Math.max((d.count / maxCount) * 70, 4)}px`, background: 'var(--color-primary)', borderRadius: '4px 4px 0 0', opacity: 0.8 }} />
                        <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{d.day}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Data sources */}
              <div className="kin-card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ fontWeight: 600 }}>Data sources</div>
                  <button className="btn btn--secondary btn--sm" onClick={() => setTab('integrations')}>Configure</button>
                </div>
                {eventSources.map((int) => {
                  const count = events.filter(e => e.source === int.source).length
                  const active = count > 0
                  return (
                    <div key={int.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--color-border-light)' }}>
                      <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: active ? '#16a34a' : '#9ca3af', flexShrink: 0 }} />
                      <span style={{ fontSize: 16, flexShrink: 0 }}>{int.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 500, fontSize: 13 }}>{int.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                          {active ? `${count} events ingested` : 'Not connected'}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {/* Category SLA table */}
              <div className="kin-card">
                <div style={{ fontWeight: 600, marginBottom: 16 }}>SLA by category</div>
                {categoryStats.length === 0 ? (
                  <div style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>No tickets yet.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {categoryStats.map(row => {
                      const rule = PRIORITY_ROUTING[row.category]
                      return (
                        <div key={row.category} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 13, width: 100, flexShrink: 0 }}>{rule.icon} {rule.label}</span>
                          <div style={{ flex: 1, height: 8, background: 'var(--color-border)', borderRadius: 4, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${(row.count / maxCatCount) * 100}%`, background: 'var(--color-primary)', borderRadius: 4, opacity: 0.7 }} />
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 600, width: 24, textAlign: 'right', flexShrink: 0 }}>{row.count}</span>
                          <span style={{ fontSize: 12, fontWeight: 700, width: 36, textAlign: 'right', flexShrink: 0, color: row.sla_pct >= 95 ? '#16a34a' : row.sla_pct >= 85 ? '#d97706' : '#dc2626' }}>
                            {row.sla_pct}%
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Events by severity */}
              <div className="kin-card">
                <div style={{ fontWeight: 600, marginBottom: 16 }}>Care events by severity</div>
                {severityCounts.length === 0 ? (
                  <div style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>No events yet.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {severityCounts.map(s => (
                      <div key={s.sev} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 13, width: 70, flexShrink: 0, textTransform: 'capitalize' }}>{s.sev}</span>
                        <div style={{ flex: 1, height: 8, background: 'var(--color-border)', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${(s.count / maxSev) * 100}%`, background: s.color, borderRadius: 4, opacity: 0.8 }} />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 600, width: 32, textAlign: 'right', flexShrink: 0 }}>{s.count}</span>
                      </div>
                    ))}
                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4 }}>
                      {events.length} total events (last 200)
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* User breakdown */}
            <div className="kin-card" style={{ maxWidth: 600 }}>
              <div style={{ fontWeight: 600, marginBottom: 16 }}>Users by role</div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {ALL_ROLE_OPTIONS.map(role => {
                  const count = profiles.filter(p => p.role === role && p.is_active !== false).length
                  if (count === 0) return null
                  const c = ROLE_BADGE_COLORS[role]
                  return (
                    <div key={role} style={{ padding: '12px 16px', borderRadius: 8, background: c.bg, textAlign: 'center', minWidth: 80 }}>
                      <div style={{ fontSize: 22, fontWeight: 800, color: c.color }}>{count}</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: c.color, textTransform: 'capitalize' }}>{role}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* TICKETS */}
        {tab === 'tickets' && (
          <div className="kin-card" style={{ maxWidth: 760 }}>
            <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 16 }}>Ticket breakdown by category</div>
            {categoryStats.length === 0 ? (
              <div style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>No tickets yet.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                    {['Category', 'Tickets', 'Open', 'Avg response', 'SLA compliance'].map((h) => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {categoryStats.map((row) => {
                    const rule = PRIORITY_ROUTING[row.category]
                    const openCount = open.filter(t => t.category === row.category).length
                    return (
                      <tr key={row.category} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                        <td style={{ padding: '12px' }}><span style={{ fontWeight: 600 }}>{rule.icon} {rule.label}</span></td>
                        <td style={{ padding: '12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: `${(row.count / maxCatCount) * 80}px`, height: 6, background: 'var(--color-primary)', borderRadius: 3, opacity: 0.7, minWidth: 4 }} />
                            <span style={{ fontWeight: 600 }}>{row.count}</span>
                          </div>
                        </td>
                        <td style={{ padding: '12px', color: openCount > 0 ? '#d97706' : 'var(--color-text-secondary)' }}>{openCount}</td>
                        <td style={{ padding: '12px', color: 'var(--color-text-secondary)' }}>{row.avg_hours}h</td>
                        <td style={{ padding: '12px' }}>
                          <span style={{ fontWeight: 700, color: row.sla_pct >= 95 ? '#16a34a' : row.sla_pct >= 85 ? '#d97706' : '#dc2626' }}>{row.sla_pct}%</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ROUTING */}
        {tab === 'routing' && (
          <RoutingTab facilityId={facilityId} />
        )}

        {/* USERS */}
        {tab === 'users' && (
          <UsersTab initialProfiles={profiles} facilityId={facilityId} />
        )}

        {/* AUDIT */}
        {tab === 'audit' && (
          <div className="kin-card" style={{ maxWidth: 760 }}>
            <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}>Audit log</div>
            <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 16 }}>
              Append-only. Every action timestamped, cannot be modified or deleted.
            </div>
            {auditLog.length === 0 ? (
              <div style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>No audit entries yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {auditLog.map((entry) => (
                  <div key={entry.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--color-border-light)' }}>
                    <span style={{ fontSize: 18, flexShrink: 0 }}>{ACTION_ICONS[entry.action] ?? '📋'}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{entry.action}</div>
                      <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                        {entry.entity_type}{entry.entity_id ? ` · ${entry.entity_id.slice(0, 8)}…` : ''}
                      </div>
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--color-text-muted)', flexShrink: 0 }}>
                      {new Date(entry.created_at).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* IMPORT */}
        {tab === 'import' && (
          <ExcelImportTab facilityId={facilityId} />
        )}

        {/* INTEGRATIONS */}
        {tab === 'integrations' && (
          <div style={{ maxWidth: 680, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Integrations</h2>
              <p style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                Configure data sources for care events. Active integrations feed the family dashboard automatically.
              </p>
            </div>

            <IntegrationCard
              icon="📊"
              name="Excel / CSV Upload"
              status="active"
              description="Manually upload care event data from a spreadsheet. Ideal for demos and facilities without an EHR API."
              statusLabel="Active"
              action={<button className="btn btn--primary btn--sm" onClick={() => setTab('import')}>Open import tool →</button>}
            />

            <IntegrationCard
              icon="🏥"
              name="PointClickCare"
              status="inactive"
              description="Connect to PointClickCare via webhook. Care events are pushed to Idene in real time when charted."
              statusLabel="Not connected"
              action={<WebhookConfig name="PointClickCare" webhookPath="/api/webhooks/events" sourceSlug="pointclickcare" />}
            />

            <IntegrationCard
              icon="📋"
              name="Tabula Pro"
              status="inactive"
              description="Receive care events from Tabula Pro via webhook integration."
              statusLabel="Not connected"
              action={<WebhookConfig name="Tabula Pro" webhookPath="/api/webhooks/events" sourceSlug="tabulapro" />}
            />

            <IntegrationCard
              icon="🔗"
              name="MatrixCare"
              status="inactive"
              description="Receive care events from MatrixCare via webhook integration."
              statusLabel="Not connected"
              action={<WebhookConfig name="MatrixCare" webhookPath="/api/webhooks/events" sourceSlug="matrixcare" />}
            />
          </div>
        )}
      </div>
    </div>
  )
}
