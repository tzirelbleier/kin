'use client'

import { useState } from 'react'
import { EscalateModal } from '@/components/family/EscalateModal'
import { createBrowserClient } from '@/lib/supabase'
import type { CareEvent, Resident } from '@/types'

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

  // Last 14 days timeline
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
      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <StatCard label="Events (last 7 days)" value={last7.length} color="#2563eb" />
        <StatCard label="Events (last 30 days)" value={last30.length} color="#7c3aed" />
        <StatCard label="Incidents (30 days)" value={last30.filter(e => e.severity === 'incident').length} color="#dc2626" />
        <StatCard label="Medication events" value={last30.filter(e => e.event_type === 'medication').length} sub="last 30 days" color="#16a34a" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Events by type */}
        <div className="kin-card">
          <div style={{ fontWeight: 600, marginBottom: 16 }}>Events by type — last 30 days</div>
          {byType.length === 0 ? (
            <div style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>No events yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {byType.map(t => (
                <div key={t.type} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 24, flexShrink: 0, textAlign: 'center' }}>{t.icon}</span>
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

        {/* By severity */}
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

      {/* 14-day timeline */}
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

function EventCard({
  event,
  onEscalate,
  readOnly,
}: {
  event: CareEvent
  onEscalate: (event: CareEvent, type: 'question' | 'concern') => void
  readOnly?: boolean
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

interface Props {
  residents: Resident[]
  initialEvents: CareEvent[]
  facilityId: string
  profileId: string
  isAdmin: boolean
  readOnly?: boolean
}

export function FamilyDashboardClient({ residents, initialEvents, facilityId, profileId, isAdmin, readOnly }: Props) {
  const [selectedResident, setSelectedResident] = useState<Resident | null>(residents[0] ?? null)
  const [currentEvents, setCurrentEvents] = useState<CareEvent[]>(initialEvents)
  const [loadingEvents, setLoadingEvents] = useState(false)
  const [mainView, setMainView] = useState<'feed' | 'reports'>('feed')
  const [modalState, setModalState] = useState<{
    open: boolean
    event?: CareEvent
    defaultCategory?: 'question' | 'concern'
  }>({ open: false })
  const [toast, setToast] = useState('')

  const switchResident = async (residentId: string) => {
    const next = residents.find((r) => r.id === residentId)
    if (!next || next.id === selectedResident?.id) return
    setSelectedResident(next)
    setLoadingEvents(true)
    const res = await fetch(`/api/care-events?resident_id=${residentId}`)
    const data = res.ok ? await res.json() : []
    setCurrentEvents(data)
    setLoadingEvents(false)
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

  return (
    <div className="kin-page">
      <nav className="kin-nav">
        <span className="kin-nav__brand">Idene</span>
        <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Family Portal</span>
        {readOnly && (
          <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 99, background: '#f3f4f6', color: '#6b7280', marginLeft: 8 }}>
            Read-only view
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
        <div style={{
          background: '#fef2f2',
          borderBottom: '1px solid #fecaca',
          padding: '12px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}>
          {alerts.map((alert) => (
            <div key={alert.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <span style={{ fontSize: 20, flexShrink: 0 }}>🚨</span>
              <div style={{ flex: 1 }}>
                <span style={{ fontWeight: 700, color: '#991b1b', fontSize: 14 }}>
                  Incident reported — {selectedResident?.full_name}
                </span>
                <span style={{ color: '#b91c1c', fontSize: 13, marginLeft: 8 }}>
                  {alert.title}
                </span>
                <span style={{ color: '#dc2626', fontSize: 12, marginLeft: 8 }}>
                  · {timeAgo(alert.occurred_at)}
                </span>
                {alert.detail && (
                  <div style={{ fontSize: 13, color: '#7f1d1d', marginTop: 2 }}>{alert.detail}</div>
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
          ))}
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
          {/* Resident switcher for admin/staff */}
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
              <div style={{
                width: 72, height: 72, borderRadius: '50%',
                background: '#dbeafe', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                fontSize: 28, marginBottom: 12,
              }}>
                👤
              </div>
              <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 2 }}>{selectedResident.full_name}</h2>
              <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 16 }}>
                {selectedResident.room_number ? `Room ${selectedResident.room_number}` : 'Room TBD'}
              </p>

              <div className="kin-card" style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 6 }}>Today's wellbeing</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'var(--color-border)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: '82%', background: '#16a34a', borderRadius: 4 }} />
                  </div>
                  <span style={{ fontWeight: 700, color: '#16a34a', fontSize: 14 }}>82%</span>
                </div>
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

              {/* View toggle */}
              <div style={{ display: 'flex', gap: 6, marginTop: 20 }}>
                <button
                  className={`btn btn--sm ${mainView === 'feed' ? 'btn--primary' : 'btn--secondary'}`}
                  style={{ flex: 1 }}
                  onClick={() => setMainView('feed')}
                >
                  Feed
                </button>
                <button
                  className={`btn btn--sm ${mainView === 'reports' ? 'btn--primary' : 'btn--secondary'}`}
                  style={{ flex: 1 }}
                  onClick={() => setMainView('reports')}
                >
                  Reports
                </button>
              </div>
            </>
          )}
        </aside>

        {/* Main content */}
        <main style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>
          {selectedResident && (
            <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>
              {mainView === 'reports' ? `Reports — ${selectedResident.full_name}` : `Care updates for ${selectedResident.full_name}`}
            </h1>
          )}

          {mainView === 'reports' && (
            <ReportsView events={currentEvents} />
          )}

          {mainView === 'feed' && (
            <>
              {loadingEvents && (
                <div style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>Loading events…</div>
              )}

              {!loadingEvents && grouped.length === 0 && (
                <div style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>No care events yet.</div>
              )}

              {!loadingEvents && grouped.map((group) => (
                <div key={group.label} style={{ marginBottom: 28 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--color-text-muted)', marginBottom: 10 }}>
                    {group.label}
                  </div>
                  {group.events.map((event) => (
                    <EventCard key={event.id} event={event} onEscalate={openModal} readOnly={readOnly} />
                  ))}
                </div>
              ))}
            </>
          )}
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
