'use client'

import { useState, useMemo } from 'react'
import { EscalateModal } from '@/components/family/EscalateModal'
import { createBrowserClient } from '@/lib/supabase'
import { PRIORITY_ROUTING, STATUS_LABELS } from '@/types'
import type { CareEvent, Resident, Ticket, TicketMessage } from '@/types'

function signOut() {
  createBrowserClient().auth.signOut().then(() => { window.location.href = '/login' })
}

const EVENT_ICONS: Record<string, string> = {
  meal: '🍽️',
  medication: '💊',
  activity: '🎯',
  incident: '🚨',
  vitals: '❤️',
  hygiene: '🛁',
  default: '📋',
}

type ResidentTicket = Ticket & {
  creator?: { full_name: string; role: string }
  assignee?: { full_name: string; role: string } | null
  messages?: (TicketMessage & { author?: { full_name: string; role: string } })[]
}

// ----------------------------------------------------------------
// Wellbeing
// ----------------------------------------------------------------
function computeWellbeing(events: CareEvent[]): number {
  const cutoff = Date.now() - 30 * 86400000
  const recent = events.filter(e => new Date(e.occurred_at).getTime() > cutoff)
  let score = 100
  for (const e of recent) {
    if (e.severity === 'incident') score -= 20
    else if (e.severity === 'critical') score -= 10
    else if (e.severity === 'warning') score -= 5
  }
  return Math.max(0, Math.round(score))
}

function wellbeingColor(score: number): string {
  if (score >= 80) return '#16a34a'
  if (score >= 60) return '#d97706'
  if (score >= 40) return '#f97316'
  return '#dc2626'
}

// ----------------------------------------------------------------
// Time helpers
// ----------------------------------------------------------------
function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const h = Math.floor(diff / 3600000)
  const m = Math.floor(diff / 60000)
  if (h >= 24) return `${Math.floor(h / 24)}d ago`
  if (h >= 1) return `${h}h ago`
  return `${m}m ago`
}

function groupByTime(events: CareEvent[]) {
  const groups: { label: string; events: CareEvent[] }[] = [
    { label: 'This Evening', events: [] },
    { label: 'This Afternoon', events: [] },
    { label: 'This Morning', events: [] },
    { label: 'Yesterday', events: [] },
    { label: 'Earlier', events: [] },
  ]
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1)

  events.forEach((e) => {
    const d = new Date(e.occurred_at)
    const h = d.getHours()
    if (d >= today) {
      if (h >= 17) groups[0].events.push(e)
      else if (h >= 12) groups[1].events.push(e)
      else groups[2].events.push(e)
    } else if (d >= yesterday) {
      groups[3].events.push(e)
    } else {
      groups[4].events.push(e)
    }
  })
  return groups.filter((g) => g.events.length > 0)
}

// ----------------------------------------------------------------
// Reports view
// ----------------------------------------------------------------
function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="kin-card" style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 28, fontWeight: 800, color: color ?? 'var(--color-primary)', marginBottom: 4 }}>{value}</div>
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{sub}</div>}
    </div>
  )
}

function ReportsView({ events }: { events: CareEvent[] }) {
  const now = Date.now()
  const last7 = events.filter(e => now - new Date(e.occurred_at).getTime() < 7 * 86400000)
  const last30 = events.filter(e => now - new Date(e.occurred_at).getTime() < 30 * 86400000)

  const byType = ['meal', 'medication', 'activity', 'vitals', 'hygiene', 'incident'].map(type => ({
    type,
    icon: EVENT_ICONS[type] ?? EVENT_ICONS.default,
    count: last30.filter(e => e.event_type === type).length,
  })).filter(t => t.count > 0)
  const maxByType = Math.max(...byType.map(t => t.count), 1)

  const bySeverity = [
    { label: 'Incident', key: 'incident', color: '#ef4444' },
    { label: 'Critical', key: 'critical', color: '#f97316' },
    { label: 'Warning', key: 'warning', color: '#eab308' },
    { label: 'Info', key: 'info', color: '#22c55e' },
  ].map(s => ({ ...s, count: last30.filter(e => e.severity === s.key).length })).filter(s => s.count > 0)

  const timeline = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (13 - i))
    const next = new Date(d); next.setDate(next.getDate() + 1)
    return {
      day: d.toLocaleDateString('en', { weekday: 'short', month: 'numeric', day: 'numeric' }),
      count: events.filter(e => { const ed = new Date(e.occurred_at); return ed >= d && ed < next }).length,
    }
  })
  const maxTimeline = Math.max(...timeline.map(d => d.count), 1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <StatCard label="Events (last 7 days)" value={last7.length} color="#2563eb" />
        <StatCard label="Events (last 30 days)" value={last30.length} color="#7c3aed" />
        <StatCard label="Incidents (30 days)" value={last30.filter(e => e.severity === 'incident').length} color="#dc2626" />
        <StatCard label="Medication events" value={last30.filter(e => e.event_type === 'medication').length} sub="last 30 days" color="#16a34a" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="kin-card">
          <div style={{ fontWeight: 600, marginBottom: 16 }}>Events by type — last 30 days</div>
          {byType.length === 0 ? (
            <div style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>No events yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {byType.map(t => (
                <div key={t.type} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 24, textAlign: 'center' }}>{t.icon}</span>
                  <span style={{ fontSize: 13, width: 90, flexShrink: 0, textTransform: 'capitalize' }}>{t.type}</span>
                  <div style={{ flex: 1, height: 10, background: 'var(--color-border)', borderRadius: 5, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(t.count / maxByType) * 100}%`, background: 'var(--color-primary)', borderRadius: 5, opacity: 0.8 }} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, width: 28, textAlign: 'right', flexShrink: 0 }}>{t.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="kin-card">
          <div style={{ fontWeight: 600, marginBottom: 16 }}>Events by severity — last 30 days</div>
          {bySeverity.length === 0 ? (
            <div style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>No events yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {bySeverity.map(s => (
                <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 13, width: 70, flexShrink: 0 }}>{s.label}</span>
                  <div style={{ flex: 1, height: 10, background: 'var(--color-border)', borderRadius: 5, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(s.count / last30.length) * 100}%`, background: s.color, borderRadius: 5, opacity: 0.8 }} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, width: 28, textAlign: 'right', flexShrink: 0 }}>{s.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="kin-card">
        <div style={{ fontWeight: 600, marginBottom: 16 }}>Activity — last 14 days</div>
        {timeline.every(d => d.count === 0) ? (
          <div style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>No events in this period.</div>
        ) : (
          <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 80 }}>
            {timeline.map((d) => (
              <div key={d.day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-secondary)' }}>{d.count || ''}</div>
                <div style={{ width: '100%', height: `${Math.max((d.count / maxTimeline) * 60, d.count > 0 ? 4 : 0)}px`, background: 'var(--color-primary)', borderRadius: '3px 3px 0 0', opacity: 0.7 }} />
                <div style={{ fontSize: 9, color: 'var(--color-text-muted)', transform: 'rotate(-45deg)', transformOrigin: 'top left', marginTop: 4, whiteSpace: 'nowrap' }}>{d.day}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ----------------------------------------------------------------
// Tickets view
// ----------------------------------------------------------------
function TicketsView({
  tickets,
  loading,
  readOnly,
  onEscalate,
}: {
  tickets: ResidentTicket[]
  loading: boolean
  readOnly?: boolean
  onEscalate: (ticket: ResidentTicket) => void
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (loading) return <div style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>Loading tickets…</div>
  if (tickets.length === 0) return (
    <div style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>
      No tickets yet. {!readOnly && 'Use "Contact care team" to send a question or concern.'}
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {tickets.map(ticket => {
        const rule = PRIORITY_ROUTING[ticket.category]
        const expanded = expandedId === ticket.id
        return (
          <div key={ticket.id} className="kin-card" style={{ cursor: 'pointer' }} onClick={() => setExpandedId(expanded ? null : ticket.id)}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>{rule.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{ticket.title}</span>
                  <span className={`chip chip--${ticket.status}`}>{STATUS_LABELS[ticket.status]}</span>
                  <span className={`chip chip--${ticket.priority}`}>{ticket.priority}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <span>{rule.label}</span>
                  <span>·</span>
                  <span>{new Date(ticket.created_at).toLocaleDateString()}</span>
                  {ticket.assignee && <span>· Assigned to {ticket.assignee.full_name}</span>}
                  {ticket.messages && ticket.messages.length > 0 && <span>· {ticket.messages.length} message{ticket.messages.length !== 1 ? 's' : ''}</span>}
                </div>

                {expanded && (
                  <div style={{ marginTop: 12 }} onClick={e => e.stopPropagation()}>
                    {/* Original message */}
                    <div style={{ alignSelf: 'flex-start', marginBottom: 10 }}>
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 4 }}>
                        {ticket.creator?.full_name ?? 'You'} · {new Date(ticket.created_at).toLocaleString()}
                      </div>
                      <div style={{ padding: '10px 14px', borderRadius: '4px 12px 12px 12px', background: '#f3f4f6', fontSize: 13, lineHeight: 1.6 }}>
                        {ticket.body}
                      </div>
                    </div>

                    {/* Thread */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {(ticket.messages ?? [])
                        .filter(m => !m.is_internal)
                        .map(msg => {
                          const isStaff = msg.author?.role !== 'family'
                          return (
                            <div key={msg.id} style={{ alignSelf: isStaff ? 'flex-end' : 'flex-start', maxWidth: '80%', width: '100%' }}>
                              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 4, textAlign: isStaff ? 'right' : 'left' }}>
                                {msg.author?.full_name ?? (isStaff ? 'Care team' : 'You')} · {new Date(msg.created_at).toLocaleString()}
                              </div>
                              <div style={{
                                padding: '8px 12px',
                                borderRadius: isStaff ? '12px 4px 12px 12px' : '4px 12px 12px 12px',
                                background: isStaff ? '#2563eb' : '#f3f4f6',
                                color: isStaff ? '#fff' : 'inherit',
                                fontSize: 13, lineHeight: 1.6,
                              }}>
                                {msg.body}
                              </div>
                            </div>
                          )
                        })}
                    </div>

                    {ticket.resolution_note && (
                      <div style={{ marginTop: 12, padding: '10px 14px', background: '#dcfce7', borderRadius: 8, fontSize: 13, color: '#15803d' }}>
                        ✓ Resolution: {ticket.resolution_note}
                      </div>
                    )}

                    {!readOnly && !['resolved', 'closed'].includes(ticket.status) && (
                      <button
                        className="btn btn--secondary btn--sm"
                        style={{ marginTop: 12 }}
                        onClick={() => onEscalate(ticket)}
                      >
                        Follow up on this ticket
                      </button>
                    )}
                  </div>
                )}
              </div>
              <span style={{ fontSize: 12, color: 'var(--color-text-muted)', flexShrink: 0 }}>{expanded ? '▲' : '▼'}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ----------------------------------------------------------------
// Event card
// ----------------------------------------------------------------
function EventCard({
  event,
  onEscalate,
  readOnly,
  linkedTicket,
}: {
  event: CareEvent
  onEscalate: (event: CareEvent, type: 'question' | 'concern') => void
  readOnly?: boolean
  linkedTicket?: ResidentTicket
}) {
  const [expanded, setExpanded] = useState(false)
  const isIncident = event.severity === 'incident'
  const isWarning = event.severity === 'warning'
  const icon = EVENT_ICONS[event.event_type] ?? EVENT_ICONS.default

  return (
    <div
      className={`kin-card ${isIncident ? 'kin-card--incident' : ''}`}
      style={{ marginBottom: 8, cursor: 'pointer' }}
      onClick={() => setExpanded((v) => !v)}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <span style={{ fontSize: 20, flexShrink: 0, marginTop: 1 }}>{icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>{event.title}</span>
            {isIncident && <span className="chip chip--urgent">Incident</span>}
            {isWarning && !isIncident && <span className="chip chip--high">Attention</span>}
            {linkedTicket && (
              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: '#ede9fe', color: '#6d28d9', fontWeight: 600 }}>
                🎫 Ticket open
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
              {timeAgo(event.occurred_at)}
            </span>
            <span className="source-badge source-badge--auto">
              AUTO · {event.source === 'pointclickcare' ? 'PointClickCare' : event.source === 'tabulapro' ? 'Tabula Pro' : event.source}
            </span>
          </div>

          {expanded && (
            <div style={{ marginTop: 10 }}>
              {event.detail && (
                <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 12, lineHeight: 1.6 }}>
                  {event.detail}
                </p>
              )}
              {linkedTicket && (
                <div style={{ marginBottom: 10, padding: '8px 12px', background: '#ede9fe', borderRadius: 8, fontSize: 13 }}>
                  <span style={{ fontWeight: 600, color: '#6d28d9' }}>Related ticket: </span>
                  <span style={{ color: '#4c1d95' }}>{linkedTicket.title}</span>
                  <span style={{ marginLeft: 8 }}>
                    <span className={`chip chip--${linkedTicket.status}`}>{STATUS_LABELS[linkedTicket.status]}</span>
                  </span>
                  {linkedTicket.assignee && (
                    <span style={{ color: '#6b7280', fontSize: 12, marginLeft: 8 }}>→ {linkedTicket.assignee.full_name}</span>
                  )}
                </div>
              )}
              {!readOnly && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="btn btn--secondary btn--sm"
                    onClick={(e) => { e.stopPropagation(); onEscalate(event, 'question') }}
                  >
                    ❓ Ask a question
                  </button>
                  <button
                    className="btn btn--sm"
                    style={{ background: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa' }}
                    onClick={(e) => { e.stopPropagation(); onEscalate(event, 'concern') }}
                  >
                    ⚠️ Raise a concern
                  </button>
                </div>
              )}
              {readOnly && (
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                  Read-only view — family actions not available
                </div>
              )}
            </div>
          )}
        </div>
        <span style={{ fontSize: 12, color: 'var(--color-text-muted)', flexShrink: 0 }}>
          {expanded ? '▲' : '▼'}
        </span>
      </div>
    </div>
  )
}

// ----------------------------------------------------------------
// Main component
// ----------------------------------------------------------------
interface Props {
  residents: Resident[]
  initialEvents: CareEvent[]
  facilityId: string
  profileId: string
  isAdmin: boolean
  readOnly?: boolean
  returnTo?: string | null
}

export function FamilyDashboardClient({ residents, initialEvents, facilityId, profileId, isAdmin, readOnly, returnTo }: Props) {
  const [selectedResident, setSelectedResident] = useState<Resident | null>(residents[0] ?? null)
  const [currentEvents, setCurrentEvents] = useState<CareEvent[]>(initialEvents)
  const [loadingEvents, setLoadingEvents] = useState(false)
  const [residentTickets, setResidentTickets] = useState<ResidentTicket[]>([])
  const [loadingTickets, setLoadingTickets] = useState(false)
  const [mainView, setMainView] = useState<'feed' | 'tickets' | 'reports'>('feed')
  const [modalState, setModalState] = useState<{
    open: boolean
    event?: CareEvent
    defaultCategory?: 'question' | 'concern'
  }>({ open: false })
  const [toast, setToast] = useState('')

  const wellbeing = computeWellbeing(currentEvents)
  const wColor = wellbeingColor(wellbeing)

  // Build event → ticket map for incident linking
  const eventTicketMap = useMemo(() => {
    const map: Record<string, ResidentTicket> = {}
    for (const t of residentTickets) {
      if (t.linked_event_id) map[t.linked_event_id] = t
    }
    return map
  }, [residentTickets])

  const fetchResidentData = async (residentId: string) => {
    setLoadingEvents(true)
    setLoadingTickets(true)
    const [eventsRes, ticketsRes] = await Promise.all([
      fetch(`/api/care-events?resident_id=${residentId}`),
      fetch(`/api/tickets/resident?resident_id=${residentId}`),
    ])
    const events = eventsRes.ok ? await eventsRes.json() : []
    const tickets = ticketsRes.ok ? await ticketsRes.json() : []
    setCurrentEvents(events)
    setResidentTickets(tickets)
    setLoadingEvents(false)
    setLoadingTickets(false)
  }

  // Load tickets for the initial resident on mount
  useState(() => {
    if (selectedResident) {
      fetch(`/api/tickets/resident?resident_id=${selectedResident.id}`)
        .then(r => r.ok ? r.json() : [])
        .then(setResidentTickets)
    }
  })

  const switchResident = async (residentId: string) => {
    const next = residents.find((r) => r.id === residentId)
    if (!next || next.id === selectedResident?.id) return
    setSelectedResident(next)
    await fetchResidentData(residentId)
  }

  const grouped = groupByTime(currentEvents)
  const cutoff = Date.now() - 48 * 3600 * 1000
  const alerts = currentEvents.filter(
    (e) => (e.severity === 'incident' || e.severity === 'critical') && new Date(e.occurred_at).getTime() > cutoff
  )

  const openModal = (event?: CareEvent, type?: 'question' | 'concern') => {
    if (readOnly) return
    setModalState({ open: true, event, defaultCategory: type })
  }

  const handleSuccess = () => {
    setModalState({ open: false })
    setToast('Your message has been sent. We\'ll get back to you within the expected response time.')
    setTimeout(() => setToast(''), 5000)
    // Refresh tickets
    if (selectedResident) {
      fetch(`/api/tickets/resident?resident_id=${selectedResident.id}`)
        .then(r => r.ok ? r.json() : [])
        .then(setResidentTickets)
    }
  }

  if (residents.length === 0) {
    return (
      <div className="kin-page">
        <nav className="kin-nav">
          <span className="kin-nav__brand">Idene</span>
        </nav>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)' }}>
          No residents found.
        </div>
      </div>
    )
  }

  const viewTabs: { id: 'feed' | 'tickets' | 'reports'; label: string }[] = [
    { id: 'feed', label: 'Care Feed' },
    { id: 'tickets', label: `Tickets${residentTickets.length > 0 ? ` (${residentTickets.length})` : ''}` },
    { id: 'reports', label: 'Reports' },
  ]

  return (
    <div className="kin-page">
      <nav className="kin-nav">
        {returnTo && (
          <a
            href={returnTo}
            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--color-text-secondary)', textDecoration: 'none', marginRight: 8, padding: '4px 8px', borderRadius: 6, background: 'var(--color-bg)' }}
          >
            ← Back
          </a>
        )}
        <span className="kin-nav__brand">Idene</span>
        <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Family Portal</span>
        {readOnly && (
          <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 99, background: '#f3f4f6', color: '#6b7280', marginLeft: 8 }}>
            Read-only
          </span>
        )}
        <span className="kin-nav__spacer" />
        {selectedResident && !readOnly && (
          <button className="btn btn--primary btn--sm" onClick={() => openModal()}>
            + Contact care team
          </button>
        )}
        <button className="btn btn--secondary btn--sm" onClick={signOut}>Sign out</button>
      </nav>

      {/* Incident alert banner */}
      {alerts.length > 0 && (
        <div style={{ background: '#fef2f2', borderBottom: '1px solid #fecaca', padding: '12px 24px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {alerts.map((alert) => {
            const linked = eventTicketMap[alert.id]
            return (
              <div key={alert.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <span style={{ fontSize: 20, flexShrink: 0 }}>🚨</span>
                <div style={{ flex: 1 }}>
                  <span style={{ fontWeight: 700, color: '#991b1b', fontSize: 14 }}>
                    Incident reported — {selectedResident?.full_name}
                  </span>
                  <span style={{ color: '#b91c1c', fontSize: 13, marginLeft: 8 }}>{alert.title}</span>
                  <span style={{ color: '#dc2626', fontSize: 12, marginLeft: 8 }}>· {timeAgo(alert.occurred_at)}</span>
                  {alert.detail && <div style={{ fontSize: 13, color: '#7f1d1d', marginTop: 2 }}>{alert.detail}</div>}
                  {linked && (
                    <div style={{ marginTop: 4, fontSize: 12, color: '#991b1b' }}>
                      🎫 Ticket raised: <span style={{ fontWeight: 600 }}>{linked.title}</span>
                      <span style={{ marginLeft: 8 }}><span className={`chip chip--${linked.status}`}>{STATUS_LABELS[linked.status]}</span></span>
                      <button className="btn btn--sm" style={{ marginLeft: 8, background: 'transparent', border: '1px solid #fca5a5', color: '#991b1b', padding: '1px 8px', fontSize: 11 }} onClick={() => { setMainView('tickets') }}>View ticket</button>
                    </div>
                  )}
                </div>
                {!readOnly && (
                  <button
                    className="btn btn--sm"
                    style={{ background: '#dc2626', color: '#fff', border: 'none', flexShrink: 0 }}
                    onClick={() => openModal(alert, 'concern')}
                  >
                    Contact care team
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      <div className="kin-content">
        {/* Sidebar */}
        <aside style={{
          width: 280, flexShrink: 0,
          borderRight: '1px solid var(--color-border)',
          background: 'var(--color-surface)',
          padding: 20, overflowY: 'auto',
          display: 'flex', flexDirection: 'column',
        }}>
          {isAdmin && residents.length > 1 && (
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>
                Resident
              </label>
              <select
                className="form-input"
                style={{ fontSize: 13 }}
                value={selectedResident?.id ?? ''}
                onChange={(e) => switchResident(e.target.value)}
              >
                {residents.map((r) => (
                  <option key={r.id} value={r.id}>{r.full_name}</option>
                ))}
              </select>
            </div>
          )}

          {selectedResident && (
            <>
              <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, marginBottom: 12 }}>
                👤
              </div>
              <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 2 }}>{selectedResident.full_name}</h2>
              <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 16 }}>
                {selectedResident.room_number ? `Room ${selectedResident.room_number}` : 'Room TBD'}
              </p>

              <div className="kin-card" style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 6 }}>Wellbeing score (30 days)</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'var(--color-border)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${wellbeing}%`, background: wColor, borderRadius: 4, transition: 'width 0.5s ease' }} />
                  </div>
                  <span style={{ fontWeight: 700, color: wColor, fontSize: 14 }}>{wellbeing}%</span>
                </div>
                {wellbeing < 80 && (
                  <div style={{ fontSize: 11, color: wColor, marginTop: 4 }}>
                    {currentEvents.filter(e => e.severity === 'incident' && Date.now() - new Date(e.occurred_at).getTime() < 30 * 86400000).length > 0 &&
                      `${currentEvents.filter(e => e.severity === 'incident' && Date.now() - new Date(e.occurred_at).getTime() < 30 * 86400000).length} incident(s)`}
                    {currentEvents.filter(e => e.severity === 'warning' && Date.now() - new Date(e.occurred_at).getTime() < 30 * 86400000).length > 0 &&
                      `, ${currentEvents.filter(e => e.severity === 'warning' && Date.now() - new Date(e.occurred_at).getTime() < 30 * 86400000).length} warning(s)`}
                    {' '}in last 30 days
                  </div>
                )}
              </div>

              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Today
              </div>
              {[
                { label: '🍽️ Meals', value: `${currentEvents.filter(e => e.event_type === 'meal').length} logged` },
                { label: '💊 Meds', value: currentEvents.some(e => e.event_type === 'medication') ? 'Administered' : 'None logged' },
                { label: '🎯 Activities', value: `${currentEvents.filter(e => e.event_type === 'activity').length} session(s)` },
                { label: '🚨 Incidents', value: currentEvents.some(e => e.severity === 'incident') ? 'See feed' : 'None' },
              ].map((row) => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--color-border-light)', fontSize: 13 }}>
                  <span>{row.label}</span>
                  <span style={{ color: 'var(--color-text-secondary)' }}>{row.value}</span>
                </div>
              ))}
            </>
          )}
        </aside>

        {/* Main content */}
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {/* View tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)', padding: '0 24px' }}>
            {viewTabs.map(t => (
              <button key={t.id} onClick={() => setMainView(t.id)} style={{
                padding: '12px 16px', border: 'none', cursor: 'pointer', fontSize: 13,
                borderBottom: mainView === t.id ? '2px solid var(--color-primary)' : '2px solid transparent',
                background: 'transparent', marginBottom: -1,
                fontWeight: mainView === t.id ? 600 : 400,
                color: mainView === t.id ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              }}>
                {t.label}
              </button>
            ))}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>
            {selectedResident && (
              <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>
                {mainView === 'reports' ? `Reports — ${selectedResident.full_name}` :
                 mainView === 'tickets' ? `Tickets — ${selectedResident.full_name}` :
                 `Care updates for ${selectedResident.full_name}`}
              </h1>
            )}

            {mainView === 'reports' && <ReportsView events={currentEvents} />}

            {mainView === 'tickets' && (
              <TicketsView
                tickets={residentTickets}
                loading={loadingTickets}
                readOnly={readOnly}
                onEscalate={(ticket) => openModal(undefined, 'question')}
              />
            )}

            {mainView === 'feed' && (
              <>
                {loadingEvents && <div style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>Loading events…</div>}
                {!loadingEvents && grouped.length === 0 && <div style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>No care events yet.</div>}
                {!loadingEvents && grouped.map((group) => (
                  <div key={group.label} style={{ marginBottom: 28 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--color-text-muted)', marginBottom: 10 }}>
                      {group.label}
                    </div>
                    {group.events.map((event) => (
                      <EventCard
                        key={event.id}
                        event={event}
                        onEscalate={openModal}
                        readOnly={readOnly}
                        linkedTicket={eventTicketMap[event.id]}
                      />
                    ))}
                  </div>
                ))}
              </>
            )}
          </div>
        </main>
      </div>

      {!readOnly && modalState.open && selectedResident && (
        <EscalateModal
          residentId={selectedResident.id}
          residentName={selectedResident.full_name}
          facilityId={facilityId}
          createdBy={profileId}
          linkedEvent={modalState.event}
          onClose={() => setModalState({ open: false })}
          onSuccess={handleSuccess}
        />
      )}

      {toast && (
        <div className="toast toast--success" style={{ maxWidth: 420, textAlign: 'center' }}>
          ✓ {toast}
        </div>
      )}
    </div>
  )
}
