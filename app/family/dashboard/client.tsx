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

function EventCard({
  event,
  onEscalate,
}: {
  event: CareEvent
  onEscalate: (event: CareEvent, type: 'question' | 'concern') => void
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
}

export function FamilyDashboardClient({ residents, initialEvents, facilityId, profileId, isAdmin }: Props) {
  const [selectedResident, setSelectedResident] = useState<Resident | null>(residents[0] ?? null)
  const [currentEvents, setCurrentEvents] = useState<CareEvent[]>(initialEvents)
  const [loadingEvents, setLoadingEvents] = useState(false)
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

  const openModal = (event?: CareEvent, type?: 'question' | 'concern') => {
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
          <span className="kin-nav__brand">Kin</span>
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
        <span className="kin-nav__brand">Kin</span>
        <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Family Portal</span>
        <span className="kin-nav__spacer" />
        {selectedResident && (
          <button className="btn btn--primary btn--sm" onClick={() => openModal()}>
            + Contact care team
          </button>
        )}
        <button className="btn btn--secondary btn--sm" onClick={signOut}>Sign out</button>
      </nav>

      <div className="kin-content">
        {/* Sidebar */}
        <aside style={{
          width: 280, flexShrink: 0,
          borderRight: '1px solid var(--color-border)',
          background: 'var(--color-surface)',
          padding: 20, overflowY: 'auto',
        }}>
          {/* Resident switcher for admin */}
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
            </>
          )}
        </aside>

        {/* Feed */}
        <main style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>
          {selectedResident && (
            <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>
              Care updates for {selectedResident.full_name}
            </h1>
          )}

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
                <EventCard key={event.id} event={event} onEscalate={openModal} />
              ))}
            </div>
          ))}
        </main>
      </div>

      {modalState.open && selectedResident && (
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
