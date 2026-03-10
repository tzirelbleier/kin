'use client'

import { useState } from 'react'
import { EscalateModal } from '@/components/family/EscalateModal'
import type { CareEvent } from '@/types'

// ----------------------------------------------------------------
// Demo data (Phase 2 will fetch from Supabase with real auth)
// ----------------------------------------------------------------
const DEMO_FACILITY_ID = 'a1b2c3d4-0001-0001-0001-000000000001'
const DEMO_PROFILE_ID  = 'demo-family-user'

const DEMO_RESIDENT = {
  id:          'b1b2c3d4-0001-0001-0001-000000000001',
  full_name:   'Eleanor Whitmore',
  room_number: '104A',
  photo_url:   null as string | null,
  wellbeing:   82,
}

const now = Date.now()
const DEMO_EVENTS: (CareEvent & { ago: string })[] = [
  {
    id: 'e1', facility_id: DEMO_FACILITY_ID, resident_id: DEMO_RESIDENT.id,
    source: 'pointclickcare', source_record_id: 'pcc-meal-8291',
    event_type: 'meal', title: 'Dinner — full portion eaten',
    detail: 'Roast chicken. ~90% consumed. Good appetite.',
    occurred_at: new Date(now - 5 * 3600000).toISOString(),
    severity: 'info', metadata: null, created_at: new Date().toISOString(),
    ago: '5h ago',
  },
  {
    id: 'e2', facility_id: DEMO_FACILITY_ID, resident_id: DEMO_RESIDENT.id,
    source: 'pointclickcare', source_record_id: 'pcc-med-5510',
    event_type: 'medication', title: 'Evening medications administered',
    detail: 'Lisinopril 10mg, Metformin 500mg. No adverse reactions.',
    occurred_at: new Date(now - 6 * 3600000).toISOString(),
    severity: 'info', metadata: null, created_at: new Date().toISOString(),
    ago: '6h ago',
  },
  {
    id: 'e3', facility_id: DEMO_FACILITY_ID, resident_id: DEMO_RESIDENT.id,
    source: 'pointclickcare', source_record_id: 'pcc-act-3301',
    event_type: 'activity', title: 'Afternoon bingo — participated',
    detail: 'Engaged for full 45-minute session. Won twice. High spirits.',
    occurred_at: new Date(now - 9 * 3600000).toISOString(),
    severity: 'info', metadata: null, created_at: new Date().toISOString(),
    ago: '9h ago',
  },
  {
    id: 'e4', facility_id: DEMO_FACILITY_ID, resident_id: DEMO_RESIDENT.id,
    source: 'pointclickcare', source_record_id: 'pcc-meal-8290',
    event_type: 'meal', title: 'Lunch — partial portion',
    detail: 'Soup and sandwich. ~60% consumed. Mentioned mild nausea.',
    occurred_at: new Date(now - 10 * 3600000).toISOString(),
    severity: 'warning', metadata: null, created_at: new Date().toISOString(),
    ago: '10h ago',
  },
  {
    id: 'e5', facility_id: DEMO_FACILITY_ID, resident_id: DEMO_RESIDENT.id,
    source: 'pointclickcare', source_record_id: 'pcc-med-5509',
    event_type: 'medication', title: 'Morning medications administered',
    detail: 'All scheduled medications given on time.',
    occurred_at: new Date(now - 13 * 3600000).toISOString(),
    severity: 'info', metadata: null, created_at: new Date().toISOString(),
    ago: '13h ago',
  },
]

const EVENT_ICONS: Record<string, string> = {
  meal: '🍽️',
  medication: '💊',
  activity: '🎯',
  incident: '🚨',
  vitals: '❤️',
  hygiene: '🛁',
  default: '📋',
}

function groupByTime(events: typeof DEMO_EVENTS) {
  const groups: { label: string; events: typeof DEMO_EVENTS }[] = [
    { label: 'This Evening', events: [] },
    { label: 'This Afternoon', events: [] },
    { label: 'This Morning', events: [] },
    { label: 'Yesterday', events: [] },
    { label: 'Earlier', events: [] },
  ]
  const h = new Date().getHours()
  events.forEach((e) => {
    const eHour = new Date(e.occurred_at).getHours()
    const eDate = new Date(e.occurred_at)
    const today = new Date(); today.setHours(0,0,0,0)
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1)

    if (eDate >= today) {
      if (eHour >= 17) groups[0].events.push(e)
      else if (eHour >= 12) groups[1].events.push(e)
      else groups[2].events.push(e)
    } else if (eDate >= yesterday) {
      groups[3].events.push(e)
    } else {
      groups[4].events.push(e)
    }
  })
  return groups.filter((g) => g.events.length > 0)
}

interface EventCardProps {
  event: typeof DEMO_EVENTS[0]
  onEscalate: (event: typeof DEMO_EVENTS[0], type: 'question' | 'concern') => void
}

function EventCard({ event, onEscalate }: EventCardProps) {
  const [expanded, setExpanded] = useState(false)
  const isIncident = event.severity === 'incident'
  const isWarning  = event.severity === 'warning'
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
            <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{event.ago}</span>
            <span className="source-badge source-badge--auto">AUTO · PointClickCare</span>
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

export default function FamilyDashboard() {
  const [modalState, setModalState] = useState<{
    open: boolean
    event?: typeof DEMO_EVENTS[0]
    defaultCategory?: 'question' | 'concern'
  }>({ open: false })
  const [toast, setToast] = useState('')

  const grouped = groupByTime(DEMO_EVENTS)

  const openModal = (event?: typeof DEMO_EVENTS[0], type?: 'question' | 'concern') => {
    setModalState({ open: true, event, defaultCategory: type })
  }

  const handleSuccess = () => {
    setModalState({ open: false })
    setToast('Your message has been sent. We\'ll get back to you within the expected response time.')
    setTimeout(() => setToast(''), 5000)
  }

  return (
    <div className="kin-page">
      {/* Nav */}
      <nav className="kin-nav">
        <span className="kin-nav__brand">Kin</span>
        <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Family Portal</span>
        <span className="kin-nav__spacer" />
        <button className="btn btn--primary btn--sm" onClick={() => openModal()}>
          + Contact care team
        </button>
      </nav>

      <div className="kin-content">
        {/* Sidebar — resident card */}
        <aside style={{
          width: 280,
          flexShrink: 0,
          borderRight: '1px solid var(--color-border)',
          background: 'var(--color-surface)',
          padding: 20,
          overflowY: 'auto',
        }}>
          {/* Avatar */}
          <div style={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            background: '#dbeafe',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 28,
            marginBottom: 12,
          }}>
            👤
          </div>

          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 2 }}>{DEMO_RESIDENT.full_name}</h2>
          <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 16 }}>
            Room {DEMO_RESIDENT.room_number}
          </p>

          {/* Wellbeing score */}
          <div className="kin-card" style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 6 }}>
              Today's wellbeing
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                flex: 1,
                height: 8,
                borderRadius: 4,
                background: 'var(--color-border)',
                overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%',
                  width: `${DEMO_RESIDENT.wellbeing}%`,
                  background: '#16a34a',
                  borderRadius: 4,
                  transition: 'width 600ms ease',
                }} />
              </div>
              <span style={{ fontWeight: 700, color: '#16a34a', fontSize: 14 }}>
                {DEMO_RESIDENT.wellbeing}%
              </span>
            </div>
          </div>

          {/* Today's snapshot */}
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Today
          </div>
          {[
            { label: '🍽️ Meals', value: '2 of 3 logged' },
            { label: '💊 Meds', value: 'All administered' },
            { label: '🎯 Activities', value: '1 session' },
            { label: '🚨 Incidents', value: 'None' },
          ].map((row) => (
            <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--color-border-light)', fontSize: 13 }}>
              <span>{row.label}</span>
              <span style={{ color: 'var(--color-text-secondary)' }}>{row.value}</span>
            </div>
          ))}
        </aside>

        {/* Main feed */}
        <main style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>
            Care updates for {DEMO_RESIDENT.full_name}
          </h1>

          {grouped.map((group) => (
            <div key={group.label} style={{ marginBottom: 28 }}>
              <div style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: 0.8,
                color: 'var(--color-text-muted)',
                marginBottom: 10,
              }}>
                {group.label}
              </div>
              {group.events.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  onEscalate={openModal}
                />
              ))}
            </div>
          ))}
        </main>
      </div>

      {/* Escalate Modal */}
      {modalState.open && (
        <EscalateModal
          residentId={DEMO_RESIDENT.id}
          residentName={DEMO_RESIDENT.full_name}
          facilityId={DEMO_FACILITY_ID}
          createdBy={DEMO_PROFILE_ID}
          linkedEvent={modalState.event}
          onClose={() => setModalState({ open: false })}
          onSuccess={handleSuccess}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="toast toast--success" style={{ maxWidth: 420, textAlign: 'center' }}>
          ✓ {toast}
        </div>
      )}
    </div>
  )
}
