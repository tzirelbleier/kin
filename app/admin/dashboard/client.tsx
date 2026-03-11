'use client'

import { useState, useEffect } from 'react'
import { PRIORITY_ROUTING, STATUS_LABELS } from '@/types'
import type { Ticket, TicketCategory, TicketPriority, TicketStatus, UserRole, Profile, RoutingRule, ScheduleItem, Appointment, FacilityMenu } from '@/types'
import { ExcelImportTab } from '@/components/admin/ExcelImportTab'

type Tab = 'reports' | 'tickets' | 'routing' | 'users' | 'planning' | 'audit' | 'import' | 'integrations'

const TABS: { id: Tab; label: string }[] = [
  { id: 'reports', label: 'Reports' },
  { id: 'tickets', label: 'Tickets' },
  { id: 'routing', label: 'Routing' },
  { id: 'users', label: 'Users' },
  { id: 'planning', label: '📅 Planning' },
  { id: 'audit', label: 'Audit Log' },
  { id: 'import', label: '📊 Import' },
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

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="kin-card" style={{ textAlign: 'center', padding: 16 }}>
      <div style={{ fontSize: 26, fontWeight: 800, color: color ?? 'var(--color-primary)', marginBottom: 2 }}>{value}</div>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)' }}>{label}</div>
      {sub && <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

// ----------------------------------------------------------------
// Integration sub-components
// ----------------------------------------------------------------

function IntegrationCard({ icon, name, status, description, statusLabel, action }: {
  icon: string; name: string; status: 'active' | 'inactive'; description: string; statusLabel: string; action: React.ReactNode
}) {
  return (
    <div className="kin-card" style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
      <div style={{ fontSize: 28, flexShrink: 0, marginTop: 2 }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>{name}</span>
          <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: status === 'active' ? '#dcfce7' : '#f3f4f6', color: status === 'active' ? '#15803d' : '#6b7280' }}>
            {status === 'active' ? '● ' : '○ '}{statusLabel}
          </span>
        </div>
        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 14, lineHeight: 1.6 }}>{description}</p>
        {action}
      </div>
    </div>
  )
}

function WebhookConfig({ name, webhookPath, sourceSlug }: { name: string; webhookPath: string; sourceSlug: string }) {
  const [open, setOpen] = useState(false)
  const appUrl = typeof window !== 'undefined' ? window.location.origin : ''
  return (
    <div>
      <button className="btn btn--secondary btn--sm" onClick={() => setOpen(v => !v)}>{open ? 'Hide setup' : 'Show setup'}</button>
      {open && (
        <div style={{ marginTop: 12, padding: 16, background: 'var(--color-bg)', borderRadius: 8, border: '1px solid var(--color-border)', fontSize: 13 }}>
          <div style={{ fontWeight: 600, marginBottom: 10 }}>Configure {name} webhook</div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', marginBottom: 4 }}>Webhook URL</div>
            <code style={{ display: 'block', background: '#1e293b', color: '#e2e8f0', padding: '8px 12px', borderRadius: 6, fontSize: 12, wordBreak: 'break-all' }}>{appUrl}{webhookPath}</code>
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', marginBottom: 4 }}>Required header</div>
            <code style={{ display: 'block', background: '#1e293b', color: '#e2e8f0', padding: '8px 12px', borderRadius: 6, fontSize: 12 }}>x-kin-webhook-secret: {'<WEBHOOK_SECRET>'}</code>
          </div>
          <div style={{ padding: '10px 12px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, color: '#92400e', fontSize: 12 }}>
            💡 Once events are received, this integration shows as Active automatically.
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

function RoutingTab() {
  const categories = Object.keys(PRIORITY_ROUTING) as TicketCategory[]
  const [editMode, setEditMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle')
  const [loaded, setLoaded] = useState(false)

  const defaultDraft = (): RoutingDraft =>
    Object.fromEntries(categories.map(cat => [cat, {
      priority: PRIORITY_ROUTING[cat].priority,
      routes_to: PRIORITY_ROUTING[cat].routes_to,
      sla_hours: PRIORITY_ROUTING[cat].sla_hours,
    }])) as RoutingDraft

  const [draft, setDraft] = useState<RoutingDraft>(defaultDraft)

  useEffect(() => {
    fetch('/api/admin/routing').then(r => r.json()).then(({ routing_config }) => {
      if (routing_config) {
        setDraft(prev => {
          const next = { ...prev }
          for (const cat of categories) {
            if (routing_config[cat]) next[cat] = { ...prev[cat], ...routing_config[cat] }
          }
          return next
        })
      }
      setLoaded(true)
    }).catch(() => setLoaded(true))
  }, [])

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/routing', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ routing_config: draft }) })
      if (res.ok) { setSaveStatus('saved'); setEditMode(false) }
      else setSaveStatus('error')
    } catch { setSaveStatus('error') } finally {
      setSaving(false)
      setTimeout(() => setSaveStatus('idle'), 3000)
    }
  }

  const update = (cat: TicketCategory, field: keyof RoutingDraft[TicketCategory], value: string | number) => {
    setDraft(prev => ({ ...prev, [cat]: { ...prev[cat], [field]: value } }))
  }

  return (
    <div className="kin-card" style={{ maxWidth: 760 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}>Escalation routing rules</div>
          <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Configure priority, routing destination, and SLA hours per category. Changes are saved per facility.</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0, marginLeft: 16, alignItems: 'center' }}>
          {!editMode && <button className="btn btn--secondary btn--sm" onClick={() => setEditMode(true)}>Edit</button>}
          {editMode && <><button className="btn btn--secondary btn--sm" onClick={() => { setDraft(defaultDraft()); setEditMode(false) }}>Cancel</button><button className="btn btn--primary btn--sm" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save'}</button></>}
          {saveStatus === 'saved' && <span style={{ fontSize: 12, color: '#16a34a' }}>✓ Saved</span>}
          {saveStatus === 'error' && <span style={{ fontSize: 12, color: '#dc2626' }}>Failed</span>}
        </div>
      </div>
      {!loaded ? <div style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Loading…</div> : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
              {['Category', 'Priority', 'Routes to', 'SLA (hours)'].map(h => (
                <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {categories.map(cat => {
              const rule = PRIORITY_ROUTING[cat]; const d = draft[cat]
              return (
                <tr key={cat} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                  <td style={{ padding: '12px' }}><span style={{ fontWeight: 600 }}>{rule.icon} {rule.label}</span><div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>{rule.description}</div></td>
                  <td style={{ padding: '12px' }}>{editMode ? <select className="form-input" style={{ fontSize: 12, padding: '4px 8px' }} value={d.priority} onChange={e => update(cat, 'priority', e.target.value)}>{PRIORITY_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}</select> : <span className={`chip chip--${d.priority}`}>{d.priority}</span>}</td>
                  <td style={{ padding: '12px' }}>{editMode ? <select className="form-input" style={{ fontSize: 12, padding: '4px 8px' }} value={d.routes_to} onChange={e => update(cat, 'routes_to', e.target.value)}>{ROLE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}</select> : <span style={{ fontWeight: 500, textTransform: 'capitalize' }}>→ {d.routes_to}</span>}</td>
                  <td style={{ padding: '12px' }}>{editMode ? <input type="number" className="form-input" style={{ fontSize: 12, padding: '4px 8px', width: 70 }} value={d.sla_hours} min={1} max={168} onChange={e => update(cat, 'sla_hours', Number(e.target.value))} /> : <span style={{ fontWeight: 600 }}>{d.sla_hours}h</span>}</td>
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

type UserModal = { kind: 'create' } | { kind: 'edit'; profile: Profile } | null

function UsersTab({ initialProfiles }: { initialProfiles: Profile[] }) {
  const [profiles, setProfiles] = useState<Profile[]>(initialProfiles)
  const [modal, setModal] = useState<UserModal>(null)
  const [form, setForm] = useState({ email: '', full_name: '', role: 'staff' as UserRole })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const refresh = async () => { const res = await fetch('/api/admin/users'); if (res.ok) setProfiles(await res.json()) }

  const submit = async () => {
    setSubmitting(true); setError('')
    try {
      const isCreate = modal?.kind === 'create'
      const res = await fetch('/api/admin/users', {
        method: isCreate ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isCreate ? form : { id: (modal as any).profile.id, full_name: form.full_name, role: form.role }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Failed'); return }
      if (isCreate) setSuccessMsg(`Created ${form.full_name}. Temporary password: Demo1234!`)
      setModal(null); await refresh()
    } finally {
      setSubmitting(false)
      setTimeout(() => setSuccessMsg(''), 5000)
    }
  }

  const toggleActive = async (p: Profile) => {
    await fetch('/api/admin/users', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: p.id, is_active: !(p.is_active ?? true) }) })
    await refresh()
  }

  return (
    <div style={{ maxWidth: 800 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>User Management</h2>
          <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: 0 }}>
            {profiles.filter(p => p.is_active !== false).length} active · {profiles.filter(p => p.is_active === false).length} inactive
          </p>
        </div>
        <button className="btn btn--primary btn--sm" onClick={() => { setForm({ email: '', full_name: '', role: 'staff' }); setError(''); setModal({ kind: 'create' }) }}>+ Add user</button>
      </div>

      {successMsg && <div style={{ padding: '10px 14px', background: '#dcfce7', border: '1px solid #86efac', borderRadius: 8, fontSize: 13, color: '#15803d', marginBottom: 16 }}>✓ {successMsg}</div>}

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
                  <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: p.is_active !== false ? '#dcfce7' : '#f3f4f6', color: p.is_active !== false ? '#15803d' : '#6b7280' }}>
                    {p.is_active !== false ? '● Active' : '○ Inactive'}
                  </span>
                </td>
                <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--color-text-muted)' }}>{new Date(p.created_at).toLocaleDateString()}</td>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn--secondary btn--sm" onClick={() => { setForm({ email: p.email, full_name: p.full_name, role: p.role }); setError(''); setModal({ kind: 'edit', profile: p }) }}>Edit</button>
                    <button className="btn btn--sm" style={{ background: p.is_active !== false ? '#fff7ed' : '#f0fdf4', color: p.is_active !== false ? '#c2410c' : '#15803d', border: `1px solid ${p.is_active !== false ? '#fed7aa' : '#86efac'}` }} onClick={() => toggleActive(p)}>
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
              {error && <div style={{ padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, color: '#dc2626', fontSize: 13, marginBottom: 12 }}>{error}</div>}
              <div className="form-group"><label className="form-label">Full name *</label><input className="form-input" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Jane Smith" /></div>
              {modal.kind === 'create' && <div className="form-group"><label className="form-label">Email *</label><input className="form-input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="jane@example.com" /></div>}
              <div className="form-group"><label className="form-label">Role *</label><select className="form-input" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as UserRole }))}>{ALL_ROLE_OPTIONS.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}</select></div>
              {modal.kind === 'create' && <div style={{ padding: '8px 12px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, fontSize: 12, color: '#92400e' }}>Temporary password: <strong>Demo1234!</strong></div>}
            </div>
            <div className="modal__footer">
              <button className="btn btn--secondary" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btn--primary" disabled={submitting || !form.full_name || (modal.kind === 'create' && !form.email)} onClick={submit}>{submitting ? 'Saving…' : modal.kind === 'create' ? 'Create user' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ----------------------------------------------------------------
// Planning tab — schedule / appointments / menus management
// ----------------------------------------------------------------

type PlanningSubTab = 'appointments' | 'schedule' | 'menus'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack']

function PlanningTab({ residents }: { residents: { id: string; full_name: string; room_number: string | null }[] }) {
  const [subTab, setSubTab] = useState<PlanningSubTab>('appointments')
  const [residentId, setResidentId] = useState<string>(residents[0]?.id ?? '')

  // Appointments state
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [apptLoading, setApptLoading] = useState(false)
  const [apptModal, setApptModal] = useState<null | Partial<Appointment>>(null)
  const [apptSaving, setApptSaving] = useState(false)

  // Schedule state
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>([])
  const [schedLoading, setSchedLoading] = useState(false)
  const [schedModal, setSchedModal] = useState<null | Partial<ScheduleItem>>(null)
  const [schedSaving, setSchedSaving] = useState(false)

  // Menus state
  const [menus, setMenus] = useState<FacilityMenu[]>([])
  const [menuLoading, setMenuLoading] = useState(false)
  const [menuModal, setMenuModal] = useState<null | Partial<FacilityMenu>>(null)
  const [menuSaving, setMenuSaving] = useState(false)
  const [menuWeekOffset, setMenuWeekOffset] = useState(0)

  useEffect(() => {
    if (!residentId) return
    if (subTab === 'appointments') loadAppointments()
    if (subTab === 'schedule') loadSchedule()
    if (subTab === 'menus') loadMenus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [residentId, subTab, menuWeekOffset])

  async function loadAppointments() {
    setApptLoading(true)
    const r = await fetch(`/api/appointments?resident_id=${residentId}`)
    const d = await r.json()
    setAppointments(Array.isArray(d) ? d : [])
    setApptLoading(false)
  }

  async function loadSchedule() {
    setSchedLoading(true)
    const r = await fetch(`/api/schedule?resident_id=${residentId}`)
    const d = await r.json()
    setScheduleItems(Array.isArray(d) ? d : [])
    setSchedLoading(false)
  }

  async function loadMenus() {
    setMenuLoading(true)
    const monday = getMondayOfWeek(menuWeekOffset)
    const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6)
    const from = monday.toISOString().slice(0, 10)
    const to = sunday.toISOString().slice(0, 10)
    const r = await fetch(`/api/menus?resident_id=${residentId}&from=${from}&to=${to}`)
    const d = await r.json()
    setMenus(Array.isArray(d) ? d : [])
    setMenuLoading(false)
  }

  function getMondayOfWeek(offset: number): Date {
    const now = new Date()
    const day = now.getDay()
    const diff = (day === 0 ? -6 : 1 - day)
    const mon = new Date(now)
    mon.setHours(0, 0, 0, 0)
    mon.setDate(now.getDate() + diff + offset * 7)
    return mon
  }

  async function saveAppointment() {
    if (!apptModal) return
    setApptSaving(true)
    const isNew = !apptModal.id
    const method = isNew ? 'POST' : 'PATCH'
    const url = isNew ? '/api/appointments' : `/api/appointments?id=${apptModal.id}`
    const body = isNew
      ? { resident_id: residentId, scheduled_at: apptModal.scheduled_at, title: apptModal.title, description: apptModal.description, location: apptModal.location, appointment_type: apptModal.appointment_type || 'appointment' }
      : { scheduled_at: apptModal.scheduled_at, title: apptModal.title, description: apptModal.description, location: apptModal.location, appointment_type: apptModal.appointment_type, status: apptModal.status }
    const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (r.ok) { setApptModal(null); loadAppointments() }
    setApptSaving(false)
  }

  async function deleteAppointment(id: string) {
    if (!confirm('Delete this appointment?')) return
    await fetch(`/api/appointments?id=${id}`, { method: 'DELETE' })
    loadAppointments()
  }

  async function saveScheduleItem() {
    if (!schedModal) return
    setSchedSaving(true)
    const isNew = !schedModal.id
    const method = isNew ? 'POST' : 'PATCH'
    const url = isNew ? '/api/schedule' : `/api/schedule?id=${schedModal.id}`
    const body = isNew
      ? { resident_id: residentId || null, day_of_week: schedModal.day_of_week, start_time: schedModal.start_time, end_time: schedModal.end_time || null, title: schedModal.title, description: schedModal.description || null, category: schedModal.category || 'activity' }
      : { day_of_week: schedModal.day_of_week, start_time: schedModal.start_time, end_time: schedModal.end_time || null, title: schedModal.title, description: schedModal.description || null, category: schedModal.category }
    const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (r.ok) { setSchedModal(null); loadSchedule() }
    setSchedSaving(false)
  }

  async function deleteScheduleItem(id: string) {
    if (!confirm('Delete this schedule item?')) return
    await fetch(`/api/schedule?id=${id}`, { method: 'DELETE' })
    loadSchedule()
  }

  async function saveMenu() {
    if (!menuModal) return
    setMenuSaving(true)
    const isNew = !menuModal.id
    const method = isNew ? 'POST' : 'PATCH'
    const url = isNew ? '/api/menus' : `/api/menus?id=${menuModal.id}`
    const body = isNew
      ? { resident_id: residentId || null, date: menuModal.date, meal_type: menuModal.meal_type, title: menuModal.title, description: menuModal.description || null }
      : { date: menuModal.date, meal_type: menuModal.meal_type, title: menuModal.title, description: menuModal.description || null }
    const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (r.ok) { setMenuModal(null); loadMenus() }
    setMenuSaving(false)
  }

  async function deleteMenu(id: string) {
    if (!confirm('Delete this menu item?')) return
    await fetch(`/api/menus?id=${id}`, { method: 'DELETE' })
    loadMenus()
  }

  const monday = getMondayOfWeek(menuWeekOffset)
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday); d.setDate(monday.getDate() + i); return d
  })

  const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid var(--color-border)', borderRadius: 6, fontSize: 13 }
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 4 }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Resident selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <label style={{ fontSize: 13, fontWeight: 600 }}>Resident:</label>
        <select value={residentId} onChange={e => setResidentId(e.target.value)} style={{ padding: '6px 10px', border: '1px solid var(--color-border)', borderRadius: 6, fontSize: 13 }}>
          {residents.map(r => <option key={r.id} value={r.id}>{r.full_name}{r.room_number ? ` (Rm ${r.room_number})` : ''}</option>)}
        </select>
      </div>

      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: 4 }}>
        {(['appointments', 'schedule', 'menus'] as PlanningSubTab[]).map(st => (
          <button key={st} onClick={() => setSubTab(st)} style={{ padding: '6px 16px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, background: subTab === st ? 'var(--color-primary)' : 'var(--color-bg-secondary)', color: subTab === st ? '#fff' : 'var(--color-text)' }}>
            {st.charAt(0).toUpperCase() + st.slice(1)}
          </button>
        ))}
      </div>

      {/* APPOINTMENTS */}
      {subTab === 'appointments' && (
        <div className="kin-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--color-border-light)' }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Appointments</div>
            <button className="btn btn--primary btn--sm" onClick={() => setApptModal({ appointment_type: 'appointment', status: 'scheduled' })}>+ Add appointment</button>
          </div>
          {apptLoading ? <div style={{ padding: 20, color: 'var(--color-text-muted)', fontSize: 13 }}>Loading…</div> : (
            appointments.length === 0 ? <div style={{ padding: 20, color: 'var(--color-text-muted)', fontSize: 13 }}>No appointments.</div> : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--color-bg-secondary)' }}>
                    {['Date & Time', 'Title', 'Type', 'Location', 'Status', ''].map(h => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, fontSize: 12, color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {appointments.map(a => (
                    <tr key={a.id} style={{ borderTop: '1px solid var(--color-border-light)' }}>
                      <td style={{ padding: '10px 16px', whiteSpace: 'nowrap' }}>{new Date(a.scheduled_at).toLocaleString('en', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</td>
                      <td style={{ padding: '10px 16px' }}>{a.title}</td>
                      <td style={{ padding: '10px 16px', color: 'var(--color-text-secondary)' }}>{a.appointment_type}</td>
                      <td style={{ padding: '10px 16px', color: 'var(--color-text-secondary)' }}>{a.location ?? '—'}</td>
                      <td style={{ padding: '10px 16px' }}><span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600, background: a.status === 'scheduled' ? '#dbeafe' : '#f3f4f6', color: a.status === 'scheduled' ? '#1d4ed8' : '#6b7280' }}>{a.status}</span></td>
                      <td style={{ padding: '10px 16px', whiteSpace: 'nowrap' }}>
                        <button className="btn btn--secondary btn--sm" onClick={() => setApptModal(a)} style={{ marginRight: 6 }}>Edit</button>
                        <button className="btn btn--secondary btn--sm" style={{ color: '#ef4444' }} onClick={() => deleteAppointment(a.id)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}
        </div>
      )}

      {/* SCHEDULE */}
      {subTab === 'schedule' && (
        <div className="kin-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--color-border-light)' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>Weekly Schedule</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>Recurring weekly activities (leave resident blank for facility-wide)</div>
            </div>
            <button className="btn btn--primary btn--sm" onClick={() => setSchedModal({ day_of_week: 1, category: 'activity' })}>+ Add item</button>
          </div>
          {schedLoading ? <div style={{ padding: 20, color: 'var(--color-text-muted)', fontSize: 13 }}>Loading…</div> : (
            scheduleItems.length === 0 ? <div style={{ padding: 20, color: 'var(--color-text-muted)', fontSize: 13 }}>No schedule items.</div> : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--color-bg-secondary)' }}>
                    {['Day', 'Time', 'Title', 'Category', 'Scope', ''].map(h => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, fontSize: 12, color: 'var(--color-text-secondary)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {scheduleItems.sort((a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time)).map(s => (
                    <tr key={s.id} style={{ borderTop: '1px solid var(--color-border-light)' }}>
                      <td style={{ padding: '10px 16px', fontWeight: 600 }}>{DAY_NAMES[s.day_of_week]}</td>
                      <td style={{ padding: '10px 16px', whiteSpace: 'nowrap' }}>{s.start_time.slice(0, 5)}{s.end_time ? ` – ${s.end_time.slice(0, 5)}` : ''}</td>
                      <td style={{ padding: '10px 16px' }}>{s.title}</td>
                      <td style={{ padding: '10px 16px', color: 'var(--color-text-secondary)' }}>{s.category}</td>
                      <td style={{ padding: '10px 16px' }}><span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600, background: s.resident_id ? '#ede9fe' : '#f0fdf4', color: s.resident_id ? '#6d28d9' : '#15803d' }}>{s.resident_id ? 'Resident' : 'Facility'}</span></td>
                      <td style={{ padding: '10px 16px', whiteSpace: 'nowrap' }}>
                        <button className="btn btn--secondary btn--sm" onClick={() => setSchedModal(s)} style={{ marginRight: 6 }}>Edit</button>
                        <button className="btn btn--secondary btn--sm" style={{ color: '#ef4444' }} onClick={() => deleteScheduleItem(s.id)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}
        </div>
      )}

      {/* MENUS */}
      {subTab === 'menus' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <button className="btn btn--secondary btn--sm" onClick={() => setMenuWeekOffset(o => o - 1)}>← Prev week</button>
            <span style={{ fontWeight: 600, fontSize: 14 }}>
              {monday.toLocaleDateString('en', { month: 'short', day: 'numeric' })} – {weekDates[6].toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
            <button className="btn btn--secondary btn--sm" onClick={() => setMenuWeekOffset(o => o + 1)}>Next week →</button>
            <button className="btn btn--primary btn--sm" style={{ marginLeft: 'auto' }} onClick={() => setMenuModal({ date: new Date().toISOString().slice(0, 10), meal_type: 'lunch' })}>+ Add meal</button>
          </div>
          {menuLoading ? <div style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Loading…</div> : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
              {weekDates.map((date, di) => {
                const dateStr = date.toISOString().slice(0, 10)
                const dayMenus = menus.filter(m => m.date === dateStr)
                const isToday = dateStr === new Date().toISOString().slice(0, 10)
                return (
                  <div key={dateStr} className="kin-card" style={{ padding: 12, minHeight: 120, background: isToday ? '#eff6ff' : undefined, borderColor: isToday ? '#93c5fd' : undefined }}>
                    <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 8 }}>{DAY_NAMES[(di + 1) % 7]}<br /><span style={{ fontWeight: 400, color: 'var(--color-text-secondary)' }}>{date.toLocaleDateString('en', { month: 'short', day: 'numeric' })}</span></div>
                    {MEAL_TYPES.map(mt => {
                      const item = dayMenus.find(m => m.meal_type === mt)
                      return (
                        <div key={mt} style={{ marginBottom: 6 }}>
                          <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 2 }}>{mt}</div>
                          {item ? (
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4 }}>
                              <span style={{ fontSize: 12, flex: 1 }}>{item.title}</span>
                              <button onClick={() => setMenuModal(item)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--color-text-muted)', padding: 0, flexShrink: 0 }}>✏️</button>
                              <button onClick={() => deleteMenu(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#ef4444', padding: 0, flexShrink: 0 }}>×</button>
                            </div>
                          ) : (
                            <button onClick={() => setMenuModal({ date: dateStr, meal_type: mt })} style={{ background: 'none', border: '1px dashed var(--color-border)', borderRadius: 4, cursor: 'pointer', fontSize: 11, color: 'var(--color-text-muted)', padding: '2px 6px', width: '100%', textAlign: 'left' }}>+ add</button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* APPOINTMENT MODAL */}
      {apptModal !== null && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="kin-card" style={{ width: 460, maxWidth: '90vw', padding: 28 }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 17, fontWeight: 700 }}>{apptModal.id ? 'Edit Appointment' : 'New Appointment'}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelStyle}>Title *</label>
                <input style={inputStyle} value={apptModal.title ?? ''} onChange={e => setApptModal(m => m ? { ...m, title: e.target.value } : m)} placeholder="e.g. Doctor visit" />
              </div>
              <div>
                <label style={labelStyle}>Date & Time *</label>
                <input type="datetime-local" style={inputStyle} value={apptModal.scheduled_at ? apptModal.scheduled_at.slice(0, 16) : ''} onChange={e => setApptModal(m => m ? { ...m, scheduled_at: e.target.value + ':00' } : m)} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Type</label>
                  <select style={inputStyle} value={apptModal.appointment_type ?? 'appointment'} onChange={e => setApptModal(m => m ? { ...m, appointment_type: e.target.value } : m)}>
                    {['appointment', 'checkup', 'therapy', 'specialist', 'other'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Status</label>
                  <select style={inputStyle} value={apptModal.status ?? 'scheduled'} onChange={e => setApptModal(m => m ? { ...m, status: e.target.value } : m)}>
                    {['scheduled', 'completed', 'cancelled', 'no_show'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={labelStyle}>Location</label>
                <input style={inputStyle} value={apptModal.location ?? ''} onChange={e => setApptModal(m => m ? { ...m, location: e.target.value } : m)} placeholder="e.g. Cardiology clinic, 3rd floor" />
              </div>
              <div>
                <label style={labelStyle}>Notes</label>
                <textarea style={{ ...inputStyle, minHeight: 72, resize: 'vertical' }} value={apptModal.description ?? ''} onChange={e => setApptModal(m => m ? { ...m, description: e.target.value } : m)} placeholder="Additional notes…" />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 22, justifyContent: 'flex-end' }}>
              <button className="btn btn--secondary" onClick={() => setApptModal(null)}>Cancel</button>
              <button className="btn btn--primary" onClick={saveAppointment} disabled={apptSaving || !apptModal.title || !apptModal.scheduled_at}>{apptSaving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {/* SCHEDULE MODAL */}
      {schedModal !== null && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="kin-card" style={{ width: 460, maxWidth: '90vw', padding: 28 }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 17, fontWeight: 700 }}>{schedModal.id ? 'Edit Schedule Item' : 'New Schedule Item'}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelStyle}>Title *</label>
                <input style={inputStyle} value={schedModal.title ?? ''} onChange={e => setSchedModal(m => m ? { ...m, title: e.target.value } : m)} placeholder="e.g. Morning exercise" />
              </div>
              <div>
                <label style={labelStyle}>Day of Week *</label>
                <select style={inputStyle} value={schedModal.day_of_week ?? 1} onChange={e => setSchedModal(m => m ? { ...m, day_of_week: Number(e.target.value) } : m)}>
                  {DAY_NAMES.map((d, i) => <option key={i} value={i}>{d}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Start Time *</label>
                  <input type="time" style={inputStyle} value={schedModal.start_time ?? ''} onChange={e => setSchedModal(m => m ? { ...m, start_time: e.target.value } : m)} />
                </div>
                <div>
                  <label style={labelStyle}>End Time</label>
                  <input type="time" style={inputStyle} value={schedModal.end_time ?? ''} onChange={e => setSchedModal(m => m ? { ...m, end_time: e.target.value || null } : m)} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Category</label>
                <select style={inputStyle} value={schedModal.category ?? 'activity'} onChange={e => setSchedModal(m => m ? { ...m, category: e.target.value } : m)}>
                  {['activity', 'therapy', 'medical', 'social', 'meal', 'exercise', 'other'].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Description</label>
                <textarea style={{ ...inputStyle, minHeight: 64, resize: 'vertical' }} value={schedModal.description ?? ''} onChange={e => setSchedModal(m => m ? { ...m, description: e.target.value } : m)} placeholder="Optional details…" />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 22, justifyContent: 'flex-end' }}>
              <button className="btn btn--secondary" onClick={() => setSchedModal(null)}>Cancel</button>
              <button className="btn btn--primary" onClick={saveScheduleItem} disabled={schedSaving || !schedModal.title || !schedModal.start_time}>{schedSaving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {/* MENU MODAL */}
      {menuModal !== null && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="kin-card" style={{ width: 400, maxWidth: '90vw', padding: 28 }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 17, fontWeight: 700 }}>{menuModal.id ? 'Edit Meal' : 'Add Meal'}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Date *</label>
                  <input type="date" style={inputStyle} value={menuModal.date ?? ''} onChange={e => setMenuModal(m => m ? { ...m, date: e.target.value } : m)} />
                </div>
                <div>
                  <label style={labelStyle}>Meal *</label>
                  <select style={inputStyle} value={menuModal.meal_type ?? 'lunch'} onChange={e => setMenuModal(m => m ? { ...m, meal_type: e.target.value } : m)}>
                    {MEAL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={labelStyle}>Item / Dish *</label>
                <input style={inputStyle} value={menuModal.title ?? ''} onChange={e => setMenuModal(m => m ? { ...m, title: e.target.value } : m)} placeholder="e.g. Grilled salmon with vegetables" />
              </div>
              <div>
                <label style={labelStyle}>Description / Notes</label>
                <textarea style={{ ...inputStyle, minHeight: 64, resize: 'vertical' }} value={menuModal.description ?? ''} onChange={e => setMenuModal(m => m ? { ...m, description: e.target.value } : m)} placeholder="Allergen info, preparation notes…" />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 22, justifyContent: 'flex-end' }}>
              <button className="btn btn--secondary" onClick={() => setMenuModal(null)}>Cancel</button>
              <button className="btn btn--primary" onClick={saveMenu} disabled={menuSaving || !menuModal.title || !menuModal.date || !menuModal.meal_type}>{menuSaving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ----------------------------------------------------------------
// Main component
// ----------------------------------------------------------------

interface Props {
  tickets: (Ticket & { resident?: { id: string; full_name: string; room_number: string | null }; assignee?: { id: string; full_name: string; role: string } | null })[]
  events: { id: string; resident_id: string; occurred_at: string; severity: string; source: string }[]
  auditLog: { id: string; action: string; actor_id: string | null; entity_type: string; entity_id: string | null; created_at: string; after_state: Record<string, unknown> | null }[]
  facilityId: string
  profiles: Profile[]
  residents: { id: string; full_name: string; room_number: string | null }[]
}

export function AdminDashboardClient({ tickets, events, auditLog, facilityId, profiles, residents }: Props) {
  const [tab, setTab] = useState<Tab>('reports')
  const [ticketSubTab, setTicketSubTab] = useState<'category' | 'resident' | 'staff' | 'all'>('category')

  // ---- Core metrics ----
  const now = Date.now()
  const weekAgo = now - 7 * 86400000
  const monthAgo = now - 30 * 86400000

  const total = tickets.length
  const open = tickets.filter(t => !['resolved', 'closed'].includes(t.status))
  const resolved = tickets.filter(t => ['resolved', 'closed'].includes(t.status))
  const resolvedThisWeek = tickets.filter(t => t.resolved_at && new Date(t.resolved_at).getTime() > weekAgo)
  const overdue = tickets.filter(t => t.due_by && !['resolved', 'closed'].includes(t.status) && new Date(t.due_by) < new Date())
  const responded = tickets.filter(t => t.first_response_at)
  const avgResponseH = responded.length > 0
    ? (responded.reduce((s, t) => s + (new Date(t.first_response_at!).getTime() - new Date(t.created_at).getTime()), 0) / responded.length / 3600000).toFixed(1)
    : '—'
  const slaCompliant = tickets.filter(t => !t.due_by || new Date(t.resolved_at ?? new Date()).getTime() <= new Date(t.due_by).getTime())
  const slaPercent = total > 0 ? Math.round((slaCompliant.length / total) * 100) : 100

  const todayEvents = events.filter(e => new Date(e.occurred_at) >= new Date(new Date().setHours(0, 0, 0, 0))).length

  // 7-day chart
  const sevenDayData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (6 - i))
    const next = new Date(d); next.setDate(next.getDate() + 1)
    return { day: d.toLocaleDateString('en', { weekday: 'short' }), count: tickets.filter(t => { const cd = new Date(t.created_at); return cd >= d && cd < next }).length }
  })
  const maxDayCount = Math.max(...sevenDayData.map(d => d.count), 1)

  // Category stats
  const categories = Object.keys(PRIORITY_ROUTING) as TicketCategory[]
  const categoryStats = categories.map(cat => {
    const ct = tickets.filter(t => t.category === cat)
    const rsp = ct.filter(t => t.first_response_at)
    const avgH = rsp.length > 0 ? (rsp.reduce((s, t) => s + (new Date(t.first_response_at!).getTime() - new Date(t.created_at).getTime()), 0) / rsp.length / 3600000).toFixed(1) : '—'
    const sla = ct.length > 0 ? Math.round(ct.filter(t => !t.due_by || new Date(t.resolved_at ?? new Date()).getTime() <= new Date(t.due_by).getTime()).length / ct.length * 100) : 100
    return { category: cat, count: ct.length, open: open.filter(t => t.category === cat).length, avg_hours: avgH, sla_pct: sla }
  }).filter(s => s.count > 0)
  const maxCatCount = Math.max(...categoryStats.map(s => s.count), 1)

  // Resident stats
  const residentStats = residents.map(r => {
    const rt = tickets.filter(t => t.resident_id === r.id)
    const re = events.filter(e => e.resident_id === r.id)
    const incidents30 = re.filter(e => e.severity === 'incident' && new Date(e.occurred_at).getTime() > monthAgo).length
    return {
      ...r,
      total: rt.length,
      open: rt.filter(t => !['resolved', 'closed'].includes(t.status)).length,
      incidents30,
      events30: re.filter(e => new Date(e.occurred_at).getTime() > monthAgo).length,
      lastEvent: re[0]?.occurred_at ?? null,
    }
  }).sort((a, b) => b.total - a.total)

  // Staff stats (staff/nurse/admin/director profiles)
  const staffProfiles = profiles.filter(p => p.role !== 'family' && p.is_active !== false)
  const staffStats = staffProfiles.map(p => {
    const assigned = tickets.filter(t => t.assigned_to === p.id)
    const rsp = assigned.filter(t => t.first_response_at)
    const res = assigned.filter(t => ['resolved', 'closed'].includes(t.status))
    const ov = assigned.filter(t => t.due_by && !['resolved', 'closed'].includes(t.status) && new Date(t.due_by) < new Date())
    const avgH = rsp.length > 0
      ? (rsp.reduce((s, t) => s + (new Date(t.first_response_at!).getTime() - new Date(t.created_at).getTime()), 0) / rsp.length / 3600000).toFixed(1)
      : '—'
    const sla = assigned.length > 0
      ? Math.round(assigned.filter(t => !t.due_by || new Date(t.resolved_at ?? new Date()).getTime() <= new Date(t.due_by).getTime()).length / assigned.length * 100)
      : 100
    return { profile: p, assigned: assigned.length, responded: rsp.length, resolved: res.length, overdue: ov.length, avgResponseH: avgH, sla }
  }).filter(s => s.assigned > 0).sort((a, b) => b.assigned - a.assigned)

  // By-resident ticket table
  const residentTicketStats = residents.map(r => {
    const rt = tickets.filter(t => t.resident_id === r.id)
    if (rt.length === 0) return null
    return {
      ...r,
      count: rt.length,
      open: rt.filter(t => !['resolved', 'closed'].includes(t.status)).length,
      urgent: rt.filter(t => t.priority === 'urgent' || t.priority === 'high').length,
      lastTicket: rt[0]?.created_at ?? null,
    }
  }).filter(Boolean).sort((a, b) => b!.count - a!.count) as { id: string; full_name: string; room_number: string | null; count: number; open: number; urgent: number; lastTicket: string | null }[]

  // By-staff ticket table
  const staffTicketStats = profiles.filter(p => p.role !== 'family').map(p => {
    const assigned = tickets.filter(t => t.assigned_to === p.id)
    if (assigned.length === 0) return null
    const rsp = assigned.filter(t => t.first_response_at)
    const avgH = rsp.length > 0 ? (rsp.reduce((s, t) => s + (new Date(t.first_response_at!).getTime() - new Date(t.created_at).getTime()), 0) / rsp.length / 3600000).toFixed(1) : '—'
    return {
      profile: p,
      total: assigned.length,
      open: assigned.filter(t => !['resolved', 'closed'].includes(t.status)).length,
      resolved: assigned.filter(t => ['resolved', 'closed'].includes(t.status)).length,
      avgResponseH: avgH,
    }
  }).filter(Boolean).sort((a, b) => b!.total - a!.total) as { profile: Profile; total: number; open: number; resolved: number; avgResponseH: string }[]

  // Event sources
  const eventSources = [
    { name: 'Excel Upload', source: 'staff', icon: '📊' },
    { name: 'PointClickCare', source: 'pointclickcare', icon: '🏥' },
    { name: 'Tabula Pro', source: 'tabulapro', icon: '📋' },
    { name: 'MatrixCare', source: 'matrixcare', icon: '🔗' },
  ] as { name: string; source: string; icon: string }[]

  const severityCounts = ['incident', 'critical', 'warning', 'info'].map(sev => ({
    sev, count: events.filter(e => e.severity === sev).length,
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

      <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)', padding: '0 24px', overflowX: 'auto' }}>
        {TABS.map(t => (
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

        {/* ====== REPORTS ====== */}
        {tab === 'reports' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

            {/* Section: KPIs */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--color-text-muted)', marginBottom: 12 }}>Facility Overview</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12 }}>
                <StatCard label="Total tickets" value={total} color="#2563eb" />
                <StatCard label="Open" value={open.length} color="#d97706" />
                <StatCard label="Resolved" value={resolved.length} color="#16a34a" />
                <StatCard label="Resolved this week" value={resolvedThisWeek.length} color="#059669" />
                <StatCard label="Overdue" value={overdue.length} color="#dc2626" />
                <StatCard label="SLA compliance" value={`${slaPercent}%`} color={slaPercent >= 95 ? '#16a34a' : slaPercent >= 85 ? '#d97706' : '#dc2626'} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              <StatCard label="Avg first response" value={`${avgResponseH}h`} color="#7c3aed" />
              <StatCard label="Tickets with response" value={`${responded.length}/${total}`} color="#2563eb" />
              <StatCard label="Auto-updates today" value={todayEvents} color="#d97706" />
              <StatCard label="Active users" value={profiles.filter(p => p.is_active !== false).length} color="#0891b2" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {/* 7-day chart */}
              <div className="kin-card">
                <div style={{ fontWeight: 600, marginBottom: 16 }}>Tickets this week</div>
                {sevenDayData.every(d => d.count === 0) ? (
                  <div style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>No tickets this week yet.</div>
                ) : (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: 100 }}>
                    {sevenDayData.map(d => (
                      <div key={d.day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)' }}>{d.count}</div>
                        <div style={{ width: '100%', height: `${Math.max((d.count / maxDayCount) * 70, 4)}px`, background: 'var(--color-primary)', borderRadius: '4px 4px 0 0', opacity: 0.8 }} />
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
                {eventSources.map(int => {
                  const count = events.filter(e => e.source === int.source).length
                  return (
                    <div key={int.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--color-border-light)' }}>
                      <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: count > 0 ? '#16a34a' : '#9ca3af', flexShrink: 0 }} />
                      <span style={{ fontSize: 16, flexShrink: 0 }}>{int.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 500, fontSize: 13 }}>{int.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{count > 0 ? `${count} events` : 'Not connected'}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="kin-card">
                <div style={{ fontWeight: 600, marginBottom: 16 }}>SLA by category</div>
                {categoryStats.length === 0 ? <div style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>No tickets yet.</div> : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {categoryStats.map(row => {
                      const rule = PRIORITY_ROUTING[row.category]
                      return (
                        <div key={row.category} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 13, width: 110, flexShrink: 0 }}>{rule.icon} {rule.label}</span>
                          <div style={{ flex: 1, height: 8, background: 'var(--color-border)', borderRadius: 4, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${(row.count / maxCatCount) * 100}%`, background: 'var(--color-primary)', borderRadius: 4, opacity: 0.7 }} />
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 600, width: 24, textAlign: 'right', flexShrink: 0 }}>{row.count}</span>
                          <span style={{ fontSize: 12, fontWeight: 700, width: 36, textAlign: 'right', flexShrink: 0, color: row.sla_pct >= 95 ? '#16a34a' : row.sla_pct >= 85 ? '#d97706' : '#dc2626' }}>{row.sla_pct}%</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
              <div className="kin-card">
                <div style={{ fontWeight: 600, marginBottom: 16 }}>Care events by severity</div>
                {severityCounts.length === 0 ? <div style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>No events yet.</div> : (
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
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>{events.length} total events</div>
                  </div>
                )}
              </div>
            </div>

            {/* Section: Staff Activity */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--color-text-muted)', marginBottom: 12 }}>Staff Activity</div>
              {staffStats.length === 0 ? (
                <div className="kin-card" style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>No staff ticket assignments yet.</div>
              ) : (
                <div className="kin-card" style={{ padding: 0, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid var(--color-border)', background: 'var(--color-bg)' }}>
                        {['Staff member', 'Role', 'Assigned', 'Responded', 'Resolved', 'Overdue', 'Avg response', 'SLA'].map(h => (
                          <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {staffStats.map(row => (
                        <tr key={row.profile.id} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                          <td style={{ padding: '12px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#1d4ed8', flexShrink: 0 }}>
                                {row.profile.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                              </div>
                              <span style={{ fontWeight: 600, fontSize: 13 }}>{row.profile.full_name}</span>
                            </div>
                          </td>
                          <td style={{ padding: '12px 14px' }}><RoleBadge role={row.profile.role} /></td>
                          <td style={{ padding: '12px 14px', fontWeight: 600 }}>{row.assigned}</td>
                          <td style={{ padding: '12px 14px', color: 'var(--color-text-secondary)' }}>{row.responded}</td>
                          <td style={{ padding: '12px 14px', color: '#16a34a', fontWeight: 600 }}>{row.resolved}</td>
                          <td style={{ padding: '12px 14px', color: row.overdue > 0 ? '#dc2626' : 'var(--color-text-secondary)', fontWeight: row.overdue > 0 ? 700 : 400 }}>{row.overdue}</td>
                          <td style={{ padding: '12px 14px', color: 'var(--color-text-secondary)' }}>{row.avgResponseH}h</td>
                          <td style={{ padding: '12px 14px' }}>
                            <span style={{ fontWeight: 700, color: row.sla >= 95 ? '#16a34a' : row.sla >= 85 ? '#d97706' : '#dc2626' }}>{row.sla}%</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Section: Resident Stats */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--color-text-muted)', marginBottom: 12 }}>Resident Statistics</div>
              {residentStats.length === 0 ? (
                <div className="kin-card" style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>No resident data yet.</div>
              ) : (
                <div className="kin-card" style={{ padding: 0, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid var(--color-border)', background: 'var(--color-bg)' }}>
                        {['Resident', 'Room', 'Total tickets', 'Open tickets', 'Incidents (30d)', 'Events (30d)', 'Last event'].map(h => (
                          <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {residentStats.map(r => (
                        <tr key={r.id} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                          <td style={{ padding: '12px 14px', fontWeight: 600, fontSize: 13 }}>{r.full_name}</td>
                          <td style={{ padding: '12px 14px', color: 'var(--color-text-secondary)', fontSize: 13 }}>{r.room_number ?? '—'}</td>
                          <td style={{ padding: '12px 14px', fontWeight: 600 }}>{r.total}</td>
                          <td style={{ padding: '12px 14px', color: r.open > 0 ? '#d97706' : 'var(--color-text-secondary)', fontWeight: r.open > 0 ? 700 : 400 }}>{r.open}</td>
                          <td style={{ padding: '12px 14px', color: r.incidents30 > 0 ? '#dc2626' : 'var(--color-text-secondary)', fontWeight: r.incidents30 > 0 ? 700 : 400 }}>{r.incidents30}</td>
                          <td style={{ padding: '12px 14px', color: 'var(--color-text-secondary)' }}>{r.events30}</td>
                          <td style={{ padding: '12px 14px', color: 'var(--color-text-muted)', fontSize: 12 }}>{r.lastEvent ? new Date(r.lastEvent).toLocaleDateString() : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* User breakdown */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--color-text-muted)', marginBottom: 12 }}>Users by role</div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {ALL_ROLE_OPTIONS.map(role => {
                  const count = profiles.filter(p => p.role === role && p.is_active !== false).length
                  if (count === 0) return null
                  const c = ROLE_BADGE_COLORS[role]
                  return (
                    <div key={role} style={{ padding: '12px 20px', borderRadius: 8, background: c.bg, textAlign: 'center', minWidth: 80 }}>
                      <div style={{ fontSize: 24, fontWeight: 800, color: c.color }}>{count}</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: c.color, textTransform: 'capitalize' }}>{role}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* ====== TICKETS ====== */}
        {tab === 'tickets' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Sub-tab strip */}
            <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--color-border)', paddingBottom: 0 }}>
              {([['category', 'By Category'], ['resident', 'By Resident'], ['staff', 'By Staff'], ['all', 'All Tickets']] as const).map(([id, label]) => (
                <button key={id} onClick={() => setTicketSubTab(id)} style={{
                  padding: '8px 16px', border: 'none', cursor: 'pointer', fontSize: 13,
                  borderBottom: ticketSubTab === id ? '2px solid var(--color-primary)' : '2px solid transparent',
                  background: 'transparent', marginBottom: -1,
                  fontWeight: ticketSubTab === id ? 600 : 400,
                  color: ticketSubTab === id ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                }}>{label}</button>
              ))}
            </div>

            {/* By Category */}
            {ticketSubTab === 'category' && (
              <div className="kin-card" style={{ maxWidth: 800 }}>
                <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 16 }}>Tickets by category</div>
                {categoryStats.length === 0 ? <div style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>No tickets yet.</div> : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                        {['Category', 'Total', 'Open', 'Avg response', 'SLA', 'SLA target'].map(h => (
                          <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {categoryStats.map(row => {
                        const rule = PRIORITY_ROUTING[row.category]
                        return (
                          <tr key={row.category} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                            <td style={{ padding: '12px' }}><span style={{ fontWeight: 600 }}>{rule.icon} {rule.label}</span></td>
                            <td style={{ padding: '12px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ width: `${(row.count / maxCatCount) * 70}px`, height: 6, background: 'var(--color-primary)', borderRadius: 3, opacity: 0.7, minWidth: 4 }} />
                                <span style={{ fontWeight: 600 }}>{row.count}</span>
                              </div>
                            </td>
                            <td style={{ padding: '12px', color: row.open > 0 ? '#d97706' : 'var(--color-text-secondary)' }}>{row.open}</td>
                            <td style={{ padding: '12px', color: 'var(--color-text-secondary)' }}>{row.avg_hours}h</td>
                            <td style={{ padding: '12px' }}><span style={{ fontWeight: 700, color: row.sla_pct >= 95 ? '#16a34a' : row.sla_pct >= 85 ? '#d97706' : '#dc2626' }}>{row.sla_pct}%</span></td>
                            <td style={{ padding: '12px', color: 'var(--color-text-secondary)' }}>{rule.sla_hours}h</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* By Resident */}
            {ticketSubTab === 'resident' && (
              <div className="kin-card" style={{ maxWidth: 800 }}>
                <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 16 }}>Tickets by resident</div>
                {residentTicketStats.length === 0 ? <div style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>No tickets yet.</div> : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                        {['Resident', 'Room', 'Total', 'Open', 'High priority', 'Last ticket'].map(h => (
                          <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {residentTicketStats.map(r => (
                        <tr key={r.id} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                          <td style={{ padding: '12px', fontWeight: 600 }}>{r.full_name}</td>
                          <td style={{ padding: '12px', color: 'var(--color-text-secondary)' }}>{r.room_number ?? '—'}</td>
                          <td style={{ padding: '12px', fontWeight: 600 }}>{r.count}</td>
                          <td style={{ padding: '12px', color: r.open > 0 ? '#d97706' : 'var(--color-text-secondary)', fontWeight: r.open > 0 ? 700 : 400 }}>{r.open}</td>
                          <td style={{ padding: '12px', color: r.urgent > 0 ? '#dc2626' : 'var(--color-text-secondary)' }}>{r.urgent}</td>
                          <td style={{ padding: '12px', color: 'var(--color-text-muted)', fontSize: 12 }}>{r.lastTicket ? new Date(r.lastTicket).toLocaleDateString() : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* By Staff */}
            {ticketSubTab === 'staff' && (
              <div className="kin-card" style={{ maxWidth: 800 }}>
                <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 16 }}>Tickets by staff member</div>
                {staffTicketStats.length === 0 ? <div style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>No assigned tickets yet.</div> : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                        {['Staff', 'Role', 'Total', 'Open', 'Resolved', 'Avg response'].map(h => (
                          <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {staffTicketStats.map(row => (
                        <tr key={row.profile.id} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                          <td style={{ padding: '12px', fontWeight: 600 }}>{row.profile.full_name}</td>
                          <td style={{ padding: '12px' }}><RoleBadge role={row.profile.role} /></td>
                          <td style={{ padding: '12px', fontWeight: 600 }}>{row.total}</td>
                          <td style={{ padding: '12px', color: row.open > 0 ? '#d97706' : 'var(--color-text-secondary)' }}>{row.open}</td>
                          <td style={{ padding: '12px', color: '#16a34a' }}>{row.resolved}</td>
                          <td style={{ padding: '12px', color: 'var(--color-text-secondary)' }}>{row.avgResponseH}h</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* All Tickets */}
            {ticketSubTab === 'all' && (
              <div className="kin-card" style={{ padding: 0, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--color-border)', background: 'var(--color-bg)' }}>
                      {['Title', 'Resident', 'Category', 'Priority', 'Status', 'Assigned to', 'Created', 'SLA'].map(h => (
                        <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tickets.map(t => (
                      <tr key={t.id} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                        <td style={{ padding: '10px 12px', fontWeight: 600, fontSize: 13, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</td>
                        <td style={{ padding: '10px 12px', fontSize: 13, color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>{(t as any).resident?.full_name ?? '—'}</td>
                        <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}><span>{PRIORITY_ROUTING[t.category].icon} {PRIORITY_ROUTING[t.category].label}</span></td>
                        <td style={{ padding: '10px 12px' }}><span className={`chip chip--${t.priority}`}>{t.priority}</span></td>
                        <td style={{ padding: '10px 12px' }}><span className={`chip chip--${t.status}`}>{STATUS_LABELS[t.status]}</span></td>
                        <td style={{ padding: '10px 12px', fontSize: 13, color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>{(t as any).assignee?.full_name ?? '—'}</td>
                        <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>{new Date(t.created_at).toLocaleDateString()}</td>
                        <td style={{ padding: '10px 12px', fontSize: 12, whiteSpace: 'nowrap' }}>
                          {t.due_by ? (
                            <span style={{ color: new Date(t.due_by) < new Date() && !['resolved', 'closed'].includes(t.status) ? '#dc2626' : '#16a34a', fontWeight: 600 }}>
                              {new Date(t.due_by) < new Date() && !['resolved', 'closed'].includes(t.status) ? 'Overdue' : new Date(t.due_by).toLocaleDateString()}
                            </span>
                          ) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ROUTING */}
        {tab === 'routing' && <RoutingTab />}

        {/* USERS */}
        {tab === 'users' && <UsersTab initialProfiles={profiles} />}

        {/* PLANNING */}
        {tab === 'planning' && <PlanningTab residents={residents} />}

        {/* AUDIT */}
        {tab === 'audit' && (
          <div className="kin-card" style={{ maxWidth: 760 }}>
            <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}>Audit log</div>
            <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 16 }}>Append-only. Every action timestamped.</div>
            {auditLog.length === 0 ? <div style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>No audit entries yet.</div> : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {auditLog.map(entry => (
                  <div key={entry.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--color-border-light)' }}>
                    <span style={{ fontSize: 18, flexShrink: 0 }}>{ACTION_ICONS[entry.action] ?? '📋'}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{entry.action}</div>
                      <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{entry.entity_type}{entry.entity_id ? ` · ${entry.entity_id.slice(0, 8)}…` : ''}</div>
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--color-text-muted)', flexShrink: 0 }}>{new Date(entry.created_at).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* IMPORT */}
        {tab === 'import' && <ExcelImportTab facilityId={facilityId} />}

        {/* INTEGRATIONS */}
        {tab === 'integrations' && (
          <div style={{ maxWidth: 680, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Integrations</h2>
              <p style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Configure data sources for care events.</p>
            </div>
            <IntegrationCard icon="📊" name="Excel / CSV Upload" status="active" description="Manually upload care event data from a spreadsheet." statusLabel="Active" action={<button className="btn btn--primary btn--sm" onClick={() => setTab('import')}>Open import tool →</button>} />
            <IntegrationCard icon="🏥" name="PointClickCare" status="inactive" description="Connect via webhook. Care events are pushed to Idene in real time." statusLabel="Not connected" action={<WebhookConfig name="PointClickCare" webhookPath="/api/webhooks/events" sourceSlug="pointclickcare" />} />
            <IntegrationCard icon="📋" name="Tabula Pro" status="inactive" description="Receive care events from Tabula Pro via webhook." statusLabel="Not connected" action={<WebhookConfig name="Tabula Pro" webhookPath="/api/webhooks/events" sourceSlug="tabulapro" />} />
            <IntegrationCard icon="🔗" name="MatrixCare" status="inactive" description="Receive care events from MatrixCare via webhook." statusLabel="Not connected" action={<WebhookConfig name="MatrixCare" webhookPath="/api/webhooks/events" sourceSlug="matrixcare" />} />
          </div>
        )}
      </div>
    </div>
  )
}
