'use client'

import { useState, useRef, useEffect } from 'react'

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < breakpoint)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [breakpoint])
  return isMobile
}
import { PRIORITY_ROUTING, STATUS_LABELS, isOverdue, getRemainingHours } from '@/types'
import type { Ticket, TicketMessage, TicketStatus, TicketCategory } from '@/types'
import { createBrowserClient } from '@/lib/supabase'

function signOut() {
  createBrowserClient().auth.signOut().then(() => { window.location.href = '/login' })
}

const STATUS_TABS: (TicketStatus | 'all')[] = ['all', 'open', 'assigned', 'in_progress', 'pending_family', 'resolved']

function SlaChip({ due_by }: { due_by: string | null }) {
  if (!due_by) return null
  const hours = getRemainingHours(due_by)
  const overdue = isOverdue(due_by)
  if (hours === null) return null
  let cls = 'sla-chip'
  let label = ''
  if (overdue) { cls += ' sla-chip--overdue'; label = `${Math.abs(hours)}h overdue` }
  else if (hours <= 4) { cls += ' sla-chip--warning'; label = `${hours}h left` }
  else { label = `${hours}h left` }
  return <span className={cls}>{label}</span>
}

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="kin-card" style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 28, fontWeight: 800, color: color ?? 'var(--color-primary)', marginBottom: 4 }}>{value}</div>
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{sub}</div>}
    </div>
  )
}

function StaffReports({ tickets }: { tickets: Ticket[] }) {
  const isMobile = useIsMobile()
  const now = Date.now()
  const weekAgo = now - 7 * 86400000

  const open = tickets.filter(t => !['resolved', 'closed'].includes(t.status))
  const resolvedThisWeek = tickets.filter(t => t.resolved_at && new Date(t.resolved_at).getTime() > weekAgo)
  const overdue = tickets.filter(t => isOverdue(t.due_by) && !['resolved', 'closed'].includes(t.status))
  const responded = tickets.filter(t => t.first_response_at)
  const avgResponseH = responded.length > 0
    ? (responded.reduce((s, t) => s + (new Date(t.first_response_at!).getTime() - new Date(t.created_at).getTime()), 0) / responded.length / 3600000).toFixed(1)
    : '—'

  const slaCompliant = tickets.filter(t =>
    !t.due_by || new Date(t.resolved_at ?? new Date()).getTime() <= new Date(t.due_by).getTime()
  )
  const slaPercent = tickets.length > 0 ? Math.round((slaCompliant.length / tickets.length) * 100) : 100

  // By priority
  const byPriority = (['urgent', 'high', 'normal', 'low'] as const).map(p => ({
    label: p.charAt(0).toUpperCase() + p.slice(1),
    priority: p,
    count: tickets.filter(t => t.priority === p).length,
  })).filter(p => p.count > 0)
  const maxPriority = Math.max(...byPriority.map(p => p.count), 1)

  const priorityColors: Record<string, string> = { urgent: '#ef4444', high: '#f97316', normal: '#3b82f6', low: '#9ca3af' }

  // By category
  const categories = Object.keys(PRIORITY_ROUTING) as TicketCategory[]
  const byCategory = categories.map(cat => ({
    cat,
    rule: PRIORITY_ROUTING[cat],
    count: tickets.filter(t => t.category === cat).length,
    openCount: open.filter(t => t.category === cat).length,
  })).filter(c => c.count > 0)
  const maxCategory = Math.max(...byCategory.map(c => c.count), 1)

  // By status
  const byStatus = (['open', 'assigned', 'in_progress', 'pending_family', 'resolved', 'closed'] as TicketStatus[]).map(s => ({
    status: s,
    label: STATUS_LABELS[s],
    count: tickets.filter(t => t.status === s).length,
  })).filter(s => s.count > 0)

  // Per-category SLA compliance
  const categorySlaTbl = byCategory.map(c => {
    const catTickets = tickets.filter(t => t.category === c.cat)
    const compliant = catTickets.filter(t =>
      !t.due_by || new Date(t.resolved_at ?? new Date()).getTime() <= new Date(t.due_by).getTime()
    )
    const pct = catTickets.length > 0 ? Math.round((compliant.length / catTickets.length) * 100) : 100
    const responded2 = catTickets.filter(t => t.first_response_at)
    const avgH = responded2.length > 0
      ? (responded2.reduce((s, t) => s + (new Date(t.first_response_at!).getTime() - new Date(t.created_at).getTime()), 0) / responded2.length / 3600000).toFixed(1)
      : '—'
    return { ...c, sla_pct: pct, avg_hours: avgH }
  })

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Staff Reports</h2>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(5, 1fr)', gap: 12 }}>
        <StatCard label="Total tickets" value={tickets.length} color="#2563eb" />
        <StatCard label="Open" value={open.length} sub="awaiting action" color="#d97706" />
        <StatCard label="Resolved this week" value={resolvedThisWeek.length} color="#16a34a" />
        <StatCard label="Overdue" value={overdue.length} sub="past SLA" color="#dc2626" />
        <StatCard label="SLA compliance" value={`${slaPercent}%`} color={slaPercent >= 95 ? '#16a34a' : slaPercent >= 85 ? '#d97706' : '#dc2626'} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
        {/* By priority */}
        <div className="kin-card">
          <div style={{ fontWeight: 600, marginBottom: 16 }}>Tickets by priority</div>
          {byPriority.length === 0 ? (
            <div style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>No tickets yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {byPriority.map(p => (
                <div key={p.priority} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className={`priority-dot priority-dot--${p.priority}`} />
                  <span style={{ fontSize: 13, width: 60, flexShrink: 0 }}>{p.label}</span>
                  <div style={{ flex: 1, height: 10, background: 'var(--color-border)', borderRadius: 5, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(p.count / maxPriority) * 100}%`, background: priorityColors[p.priority], borderRadius: 5, opacity: 0.8 }} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, width: 24, textAlign: 'right', flexShrink: 0 }}>{p.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* By status */}
        <div className="kin-card">
          <div style={{ fontWeight: 600, marginBottom: 16 }}>Tickets by status</div>
          {byStatus.length === 0 ? (
            <div style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>No tickets yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {byStatus.map(s => (
                <div key={s.status} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className={`chip chip--${s.status}`} style={{ fontSize: 11, flexShrink: 0, minWidth: 100 }}>{s.label}</span>
                  <div style={{ flex: 1, height: 10, background: 'var(--color-border)', borderRadius: 5, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(s.count / tickets.length) * 100}%`, background: 'var(--color-primary)', borderRadius: 5, opacity: 0.6 }} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, width: 24, textAlign: 'right', flexShrink: 0 }}>{s.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Category SLA table */}
      <div className="kin-card">
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 16 }}>SLA compliance by category</div>
        {categorySlaTbl.length === 0 ? (
          <div style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>No tickets yet.</div>
        ) : (
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                {['Category', 'Total', 'Open', 'Avg response', 'SLA compliance', 'SLA target'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {categorySlaTbl.map(row => (
                <tr key={row.cat} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ fontWeight: 600 }}>{row.rule.icon} {row.rule.label}</span>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: `${(row.count / maxCategory) * 60}px`, height: 6, background: 'var(--color-primary)', borderRadius: 3, opacity: 0.6, minWidth: 4 }} />
                      <span style={{ fontWeight: 600 }}>{row.count}</span>
                    </div>
                  </td>
                  <td style={{ padding: '10px 12px', color: row.openCount > 0 ? '#d97706' : 'var(--color-text-secondary)' }}>
                    {row.openCount}
                  </td>
                  <td style={{ padding: '10px 12px', color: 'var(--color-text-secondary)' }}>{row.avg_hours}h</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ fontWeight: 700, color: row.sla_pct >= 95 ? '#16a34a' : row.sla_pct >= 85 ? '#d97706' : '#dc2626' }}>
                      {row.sla_pct}%
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', color: 'var(--color-text-secondary)' }}>{row.rule.sla_hours}h</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
        <div className="kin-card" style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Avg first response</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#7c3aed' }}>{avgResponseH}h</div>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Tickets with response</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#2563eb' }}>{responded.length} / {tickets.length}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Resolution rate</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#16a34a' }}>
              {tickets.length > 0 ? Math.round(((tickets.length - open.length) / tickets.length) * 100) : 0}%
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

interface Props {
  tickets: (Ticket & {
    resident?: { full_name: string; room_number: string | null }
    creator?: { full_name: string; role: string }
    assignee?: { full_name: string; role: string } | null
    messages?: (TicketMessage & { author?: { full_name: string; role: string } })[]
  })[]
  profileId: string
}

export function StaffTicketsClient({ tickets, profileId }: Props) {
  const isMobile = useIsMobile()
  const [mobileView, setMobileView] = useState<'queue' | 'thread'>('queue')
  const [mode, setMode] = useState<'queue' | 'reports'>('queue')
  const [statusFilter, setStatusFilter] = useState<TicketStatus | 'all'>('all')
  const [mineOnly, setMineOnly] = useState(false)
  const [urgentOnly, setUrgentOnly] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(tickets[0]?.id ?? null)
  const [replyBody, setReplyBody] = useState('')
  const [replyMode, setReplyMode] = useState<'family' | 'internal'>('family')
  const [sending, setSending] = useState(false)
  const [resolveModal, setResolveModal] = useState(false)
  const [resolveNote, setResolveNote] = useState('')
  const [localMessages, setLocalMessages] = useState<Record<string, TicketMessage[]>>({})
  const threadRef = useRef<HTMLDivElement>(null)

  const filtered = tickets.filter((t) => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false
    if (mineOnly && t.assigned_to !== profileId) return false
    if (urgentOnly && t.priority !== 'urgent' && t.priority !== 'high') return false
    return true
  })

  // Auto-select first visible ticket when filters change
  useEffect(() => {
    if (!filtered.find((t) => t.id === selectedId)) {
      setSelectedId(filtered[0]?.id ?? null)
    }
  }, [statusFilter, mineOnly, urgentOnly])

  const overdueCount = tickets.filter((t) => isOverdue(t.due_by)).length
  const selected = filtered.find((t) => t.id === selectedId) ?? null
  const threadMessages = selected
    ? [...(selected.messages ?? []), ...(localMessages[selected.id] ?? [])]
    : []

  useEffect(() => {
    if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight
  }, [selectedId, threadMessages.length])

  const sendReply = async () => {
    if (!selected || !replyBody.trim()) return
    setSending(true)
    try {
      const res = await fetch('/api/tickets/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticket_id: selected.id,
          body: replyBody.trim(),
          is_internal: replyMode === 'internal',
          author_id: profileId,
          author_role: 'nurse',
          facility_id: selected.facility_id,
        }),
      })
      const json = await res.json()
      if (json.message) {
        setLocalMessages((prev) => ({
          ...prev,
          [selected.id]: [...(prev[selected.id] ?? []), json.message],
        }))
      }
      setReplyBody('')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="kin-page">
      <nav className="kin-nav kin-nav--dark">
        <span className="kin-nav__brand">Idene</span>
        <span style={{ fontSize: 13, color: '#9ca3af' }}>Staff Portal</span>
        <span className="kin-nav__spacer" />
        {overdueCount > 0 && <span className="chip chip--urgent">{overdueCount} overdue</span>}
        <button
          className={`btn btn--sm ${mode === 'queue' ? 'btn--primary' : 'btn--secondary'}`}
          style={{ background: mode === 'queue' ? undefined : 'transparent', border: '1px solid #374151', color: mode === 'queue' ? undefined : '#9ca3af' }}
          onClick={() => setMode('queue')}
        >
          Queue
        </button>
        <button
          className={`btn btn--sm ${mode === 'reports' ? 'btn--primary' : 'btn--secondary'}`}
          style={{ background: mode === 'reports' ? undefined : 'transparent', border: '1px solid #374151', color: mode === 'reports' ? undefined : '#9ca3af' }}
          onClick={() => setMode('reports')}
        >
          Reports
        </button>
        <a href="/family/dashboard?returnTo=/staff/tickets" className="btn btn--sm" style={{ background: 'transparent', border: '1px solid #374151', color: '#9ca3af', textDecoration: 'none' }}>
          Family view
        </a>
        <button className="btn btn--sm" style={{ background: 'transparent', border: '1px solid #374151', color: '#9ca3af' }} onClick={signOut}>Sign out</button>
      </nav>

      {mode === 'reports' && (
        <StaffReports tickets={tickets} />
      )}

      {mode === 'queue' && tickets.length === 0 && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 32 }}>✅</div>
          <div>No tickets yet. Family escalations will appear here.</div>
        </div>
      )}

      {mode === 'queue' && tickets.length > 0 && (
        <div className="kin-content" style={{ height: isMobile ? 'calc(100vh - 100px)' : 'calc(100vh - 56px)', flexDirection: isMobile ? 'column' : 'row' }}>
          {/* Mobile: toggle queue/thread */}
          {isMobile && (
            <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)', flexShrink: 0 }}>
              <button onClick={() => setMobileView('queue')} style={{ flex: 1, padding: '10px', border: 'none', cursor: 'pointer', fontWeight: mobileView === 'queue' ? 700 : 400, background: mobileView === 'queue' ? 'var(--color-primary-light)' : 'transparent', borderBottom: mobileView === 'queue' ? '2px solid var(--color-primary)' : '2px solid transparent', fontSize: 13 }}>Queue ({filtered.length})</button>
              <button onClick={() => setMobileView('thread')} style={{ flex: 1, padding: '10px', border: 'none', cursor: 'pointer', fontWeight: mobileView === 'thread' ? 700 : 400, background: mobileView === 'thread' ? 'var(--color-primary-light)' : 'transparent', borderBottom: mobileView === 'thread' ? '2px solid var(--color-primary)' : '2px solid transparent', fontSize: 13 }}>Thread</button>
            </div>
          )}
          {/* Queue */}
          <aside style={{ width: isMobile ? '100%' : 340, flexShrink: 0, borderRight: isMobile ? 'none' : '1px solid var(--color-border)', display: isMobile && mobileView === 'thread' ? 'none' : 'flex', flexDirection: 'column', background: 'var(--color-surface)' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)' }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
                  <input type="checkbox" checked={mineOnly} onChange={(e) => setMineOnly(e.target.checked)} /> Mine only
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
                  <input type="checkbox" checked={urgentOnly} onChange={(e) => setUrgentOnly(e.target.checked)} /> Urgent only
                </label>
              </div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {STATUS_TABS.map((s) => (
                  <button key={s} onClick={() => setStatusFilter(s)} style={{
                    padding: '3px 10px', borderRadius: 99, border: 'none', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    background: statusFilter === s ? 'var(--color-primary)' : 'var(--color-bg)',
                    color: statusFilter === s ? '#fff' : 'var(--color-text-secondary)',
                  }}>
                    {s === 'all' ? 'All' : STATUS_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              {filtered.length === 0 && (
                <div style={{ padding: 24, color: 'var(--color-text-muted)', textAlign: 'center', fontSize: 13 }}>No tickets match this filter</div>
              )}
              {filtered.map((ticket) => (
                <div key={ticket.id} onClick={() => { setSelectedId(ticket.id); if (isMobile) setMobileView('thread') }} style={{
                  padding: '12px 16px', borderBottom: '1px solid var(--color-border-light)', cursor: 'pointer',
                  background: selectedId === ticket.id ? 'var(--color-primary-light)' : 'transparent',
                  borderLeft: selectedId === ticket.id ? '3px solid var(--color-primary)' : '3px solid transparent',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span className={`priority-dot priority-dot--${ticket.priority}`} />
                    <span style={{ fontWeight: 600, fontSize: 13, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ticket.title}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 6 }}>
                    {ticket.resident?.full_name ?? 'Unknown'} · {PRIORITY_ROUTING[ticket.category].icon} {PRIORITY_ROUTING[ticket.category].label}
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span className={`chip chip--${ticket.status}`}>{STATUS_LABELS[ticket.status]}</span>
                    <SlaChip due_by={ticket.due_by} />
                  </div>
                </div>
              ))}
            </div>
          </aside>

          {/* Thread */}
          <main style={{ flex: 1, display: isMobile && mobileView === 'queue' ? 'none' : 'flex', flexDirection: 'column', minWidth: 0 }}>
            {!selected ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)' }}>
                Select a ticket to view the thread
              </div>
            ) : (
              <>
                <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                    <div style={{ flex: 1 }}>
                      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{selected.title}</h2>
                      <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        <span>📍 {selected.resident?.full_name ?? 'Unknown'} {selected.resident?.room_number ? `· Room ${selected.resident.room_number}` : ''}</span>
                        <span>{PRIORITY_ROUTING[selected.category].icon} {PRIORITY_ROUTING[selected.category].label}</span>
                        <span>From {selected.creator?.full_name ?? 'Family'}</span>
                        {selected.assignee && <span>→ {selected.assignee.full_name}</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span className={`chip chip--${selected.status}`}>{STATUS_LABELS[selected.status]}</span>
                      <SlaChip due_by={selected.due_by} />
                      {!['resolved', 'closed'].includes(selected.status) && (
                        <button className="btn btn--success btn--sm" onClick={() => setResolveModal(true)}>✓ Resolve</button>
                      )}
                    </div>
                  </div>
                </div>

                <div ref={threadRef} style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ alignSelf: 'flex-start', maxWidth: '70%' }}>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 4 }}>
                      {selected.creator?.full_name ?? 'Family'} · {new Date(selected.created_at).toLocaleString()}
                    </div>
                    <div style={{ padding: '10px 14px', borderRadius: '4px 12px 12px 12px', background: '#f3f4f6', fontSize: 13, lineHeight: 1.6 }}>
                      {selected.body}
                    </div>
                  </div>

                  {threadMessages.map((msg) => {
                    const isStaff = (msg as any).author?.role !== 'family'
                    const authorName = (msg as any).author?.full_name ?? (isStaff ? 'Staff' : 'Family')
                    return (
                      <div key={msg.id} style={{ alignSelf: isStaff ? 'flex-end' : 'flex-start', maxWidth: '70%' }}>
                        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 4, textAlign: isStaff ? 'right' : 'left' }}>
                          {authorName} · {new Date(msg.created_at).toLocaleString()}
                          {msg.is_internal && <span style={{ marginLeft: 6, color: '#6b21a8', fontWeight: 600 }}>🔒 Internal</span>}
                        </div>
                        <div style={{
                          padding: '10px 14px',
                          borderRadius: isStaff ? '12px 4px 12px 12px' : '4px 12px 12px 12px',
                          background: msg.is_internal ? 'transparent' : (isStaff ? '#2563eb' : '#f3f4f6'),
                          border: msg.is_internal ? '1px dashed #a78bfa' : 'none',
                          color: (!msg.is_internal && isStaff) ? '#fff' : 'inherit',
                          fontSize: 13, lineHeight: 1.6,
                          fontStyle: msg.is_internal ? 'italic' : 'normal',
                        }}>
                          {msg.body}
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div style={{ padding: '12px 24px', borderTop: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                    <button className={`btn btn--sm ${replyMode === 'family' ? 'btn--success' : 'btn--secondary'}`} onClick={() => setReplyMode('family')}>
                      Reply to family
                    </button>
                    <button
                      className={`btn btn--sm ${replyMode === 'internal' ? '' : 'btn--secondary'}`}
                      style={replyMode === 'internal' ? { background: '#1f2937', color: '#f9fafb', border: '1px solid #374151' } : {}}
                      onClick={() => setReplyMode('internal')}
                    >
                      🔒 Internal note
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                    <textarea
                      className="form-textarea"
                      style={{ minHeight: 60, flex: 1, borderStyle: replyMode === 'internal' ? 'dashed' : 'solid', borderColor: replyMode === 'internal' ? '#a78bfa' : undefined }}
                      placeholder={replyMode === 'family' ? 'Write a reply to the family…' : 'Internal note — not visible to family…'}
                      value={replyBody}
                      onChange={(e) => setReplyBody(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) sendReply() }}
                    />
                    <button className="btn btn--primary" disabled={sending || !replyBody.trim()} onClick={sendReply} style={{ flexShrink: 0 }}>
                      {sending ? <span className="spinner" /> : 'Send'}
                    </button>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 6 }}>
                    {replyMode === 'family' ? 'Family will be notified' : '🔒 Only visible to staff'} · ⌘↵ to send
                  </div>
                </div>
              </>
            )}
          </main>
        </div>
      )}

      {resolveModal && selected && (
        <div className="modal-overlay" onClick={() => setResolveModal(false)}>
          <div className="modal" style={{ width: 440 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <h2 className="modal__title">Resolve ticket</h2>
              <button className="btn btn--ghost btn--sm" onClick={() => setResolveModal(false)}>×</button>
            </div>
            <div className="modal__body">
              <div className="form-group">
                <label className="form-label">Resolution note (optional — shown to family)</label>
                <textarea className="form-textarea" placeholder="Describe what was done…" value={resolveNote} onChange={(e) => setResolveNote(e.target.value)} />
              </div>
            </div>
            <div className="modal__footer">
              <button className="btn btn--secondary" onClick={() => setResolveModal(false)}>Cancel</button>
              <button className="btn btn--success" onClick={async () => {
                await fetch(`/api/tickets?id=${selected.id}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ status: 'resolved', resolution_note: resolveNote, facility_id: selected.facility_id, actor_id: profileId }),
                })
                setResolveModal(false)
                window.location.reload()
              }}>✓ Mark resolved</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
