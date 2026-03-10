'use client'

import { useState } from 'react'
import { PRIORITY_ROUTING, STATUS_LABELS } from '@/types'
import type { TicketCategory } from '@/types'

// ----------------------------------------------------------------
// Demo data
// ----------------------------------------------------------------
const METRICS = [
  { label: 'Inbound calls reduced', value: '−64%', sub: 'vs 6-month avg before Kin', color: '#16a34a' },
  { label: 'Avg response time', value: '3.2h', sub: 'across all categories', color: '#2563eb' },
  { label: 'Family satisfaction', value: '94%', sub: '47 responses this month', color: '#7c3aed' },
  { label: 'Auto-updates today', value: '38', sub: 'from PointClickCare', color: '#d97706' },
]

const SEVEN_DAY_DATA = [
  { day: 'Mon', count: 5 },
  { day: 'Tue', count: 8 },
  { day: 'Wed', count: 3 },
  { day: 'Thu', count: 11 },
  { day: 'Fri', count: 7 },
  { day: 'Sat', count: 2 },
  { day: 'Sun', count: 4 },
]

const INTEGRATIONS = [
  { name: 'PointClickCare', status: 'live', last: '2 minutes ago', events: 38 },
  { name: 'Tabula Pro', status: 'live', last: '14 minutes ago', events: 12 },
  { name: 'MatrixCare', status: 'inactive', last: 'Never', events: 0 },
]

const CATEGORY_STATS: { category: TicketCategory; count: number; avg_hours: number; sla_pct: number }[] = [
  { category: 'question', count: 24, avg_hours: 4.2, sla_pct: 98 },
  { category: 'concern', count: 11, avg_hours: 6.8, sla_pct: 91 },
  { category: 'complaint', count: 3, avg_hours: 5.1, sla_pct: 100 },
  { category: 'care_plan', count: 7, avg_hours: 8.3, sla_pct: 86 },
  { category: 'administrative', count: 9, avg_hours: 18.2, sla_pct: 100 },
  { category: 'compliment', count: 5, avg_hours: 24.0, sla_pct: 100 },
  { category: 'incident', count: 2, avg_hours: 1.8, sla_pct: 100 },
]

const FAMILY_SENTIMENT = [
  { family: 'Whitmore Family', resident: 'Eleanor W.', score: 92, tickets: 4 },
  { family: 'Jennings Family', resident: 'Harold J.', score: 78, tickets: 7 },
  { family: 'Osei Family', resident: 'Margaret O.', score: 88, tickets: 2 },
  { family: 'Kim Family', resident: 'Robert K.', score: 95, tickets: 1 },
]

const AUDIT_LOG = [
  { id: 'a1', icon: '🎫', action: 'ticket.created', actor: 'Sarah Whitmore', role: 'family', entity: 'Ticket #t1', time: '5 min ago' },
  { id: 'a2', icon: '📨', action: 'message.created', actor: 'Jenna Reyes', role: 'nurse', entity: 'Ticket #t2', time: '1h ago' },
  { id: 'a3', icon: '✅', action: 'ticket.updated → resolved', actor: 'Jenna Reyes', role: 'nurse', entity: 'Ticket #t0', time: '3h ago' },
  { id: 'a4', icon: '📡', action: 'care_event.ingested', actor: 'System (PCC)', role: 'system', entity: 'Care event #e4', time: '5h ago' },
  { id: 'a5', icon: '🚨', action: 'ticket.auto_created', actor: 'System', role: 'system', entity: 'Ticket #t5 (Incident)', time: 'Yesterday' },
]

type Tab = 'overview' | 'tickets' | 'routing' | 'audit'

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'tickets', label: 'Tickets' },
  { id: 'routing', label: 'Routing' },
  { id: 'audit', label: 'Audit Log' },
]

const maxCount = Math.max(...SEVEN_DAY_DATA.map((d) => d.count))

export default function AdminDashboard() {
  const [tab, setTab] = useState<Tab>('overview')

  return (
    <div className="kin-page">
      {/* Dark nav */}
      <nav className="kin-nav kin-nav--dark">
        <span className="kin-nav__brand">Kin</span>
        <span style={{ fontSize: 13, color: '#9ca3af' }}>Admin · Sunrise Gardens</span>
        <span className="kin-nav__spacer" />
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
          AD
        </div>
      </nav>

      {/* Tab bar */}
      <div style={{
        display: 'flex',
        gap: 0,
        borderBottom: '1px solid var(--color-border)',
        background: 'var(--color-surface)',
        padding: '0 24px',
      }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '14px 20px',
              border: 'none',
              borderBottom: tab === t.id ? '2px solid var(--color-primary)' : '2px solid transparent',
              background: 'transparent',
              fontWeight: tab === t.id ? 600 : 400,
              color: tab === t.id ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              cursor: 'pointer',
              fontSize: 14,
              transition: 'color 120ms, border-color 120ms',
              marginBottom: -1,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        {/* ── OVERVIEW ── */}
        {tab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Metric cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
              {METRICS.map((m) => (
                <div key={m.label} className="kin-card">
                  <div style={{ fontSize: 32, fontWeight: 800, color: m.color, marginBottom: 4 }}>{m.value}</div>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{m.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{m.sub}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16 }}>
              {/* 7-day bar chart */}
              <div className="kin-card">
                <div style={{ fontWeight: 600, marginBottom: 16 }}>Tickets this week</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: 120 }}>
                  {SEVEN_DAY_DATA.map((d) => (
                    <div key={d.day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)' }}>{d.count}</div>
                      <div style={{
                        width: '100%',
                        height: `${(d.count / maxCount) * 80}px`,
                        background: 'var(--color-primary)',
                        borderRadius: '4px 4px 0 0',
                        opacity: 0.8,
                        minHeight: 4,
                      }} />
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{d.day}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Integration status */}
              <div className="kin-card">
                <div style={{ fontWeight: 600, marginBottom: 12 }}>Integrations</div>
                {INTEGRATIONS.map((int) => (
                  <div key={int.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--color-border-light)' }}>
                    <span style={{
                      display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
                      background: int.status === 'live' ? '#16a34a' : '#9ca3af',
                      animation: int.status === 'live' ? 'pulse 2s infinite' : 'none',
                    }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 500, fontSize: 13 }}>{int.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                        {int.status === 'live' ? `Last event ${int.last} · ${int.events} today` : 'Not connected'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Family sentiment */}
            <div className="kin-card">
              <div style={{ fontWeight: 600, marginBottom: 12 }}>Family sentiment scores</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                {FAMILY_SENTIMENT.map((f) => (
                  <div key={f.family} style={{ padding: '12px 14px', borderRadius: 'var(--radius-sm)', background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{f.family}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 8 }}>{f.resident}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--color-border)', overflow: 'hidden' }}>
                        <div style={{
                          height: '100%',
                          width: `${f.score}%`,
                          background: f.score >= 90 ? '#16a34a' : f.score >= 70 ? '#d97706' : '#dc2626',
                          borderRadius: 3,
                        }} />
                      </div>
                      <span style={{ fontWeight: 700, fontSize: 13 }}>{f.score}%</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>{f.tickets} tickets</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── TICKETS ── */}
        {tab === 'tickets' && (
          <div className="kin-card" style={{ maxWidth: 760 }}>
            <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 16 }}>Ticket breakdown by category</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                  {['Category', 'Tickets', 'Avg response', 'SLA compliance', ''].map((h) => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {CATEGORY_STATS.map((row) => {
                  const rule = PRIORITY_ROUTING[row.category]
                  const maxForBar = Math.max(...CATEGORY_STATS.map((r) => r.count))
                  return (
                    <tr key={row.category} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                      <td style={{ padding: '12px' }}>
                        <span style={{ fontWeight: 600 }}>{rule.icon} {rule.label}</span>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{
                            width: `${(row.count / maxForBar) * 80}px`,
                            height: 6,
                            background: 'var(--color-primary)',
                            borderRadius: 3,
                            opacity: 0.7,
                          }} />
                          <span style={{ fontWeight: 600 }}>{row.count}</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px', color: 'var(--color-text-secondary)' }}>{row.avg_hours}h</td>
                      <td style={{ padding: '12px' }}>
                        <span style={{
                          fontWeight: 700,
                          color: row.sla_pct >= 95 ? '#16a34a' : row.sla_pct >= 85 ? '#d97706' : '#dc2626',
                        }}>
                          {row.sla_pct}%
                        </span>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <span className={`chip chip--${rule.priority}`}>{rule.priority}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── ROUTING ── */}
        {tab === 'routing' && (
          <div className="kin-card" style={{ maxWidth: 720 }}>
            <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}>Escalation routing rules</div>
            <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 16 }}>
              These rules determine priority, assignment, and SLA for every incoming ticket. Managed in <code>types/index.ts → PRIORITY_ROUTING</code>.
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                  {['Category', 'Priority', 'Routes to', 'SLA'].map((h) => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(Object.entries(PRIORITY_ROUTING) as [TicketCategory, typeof PRIORITY_ROUTING[TicketCategory]][]).map(([cat, rule]) => (
                  <tr key={cat} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                    <td style={{ padding: '12px' }}>
                      <span style={{ fontWeight: 600 }}>{rule.icon} {rule.label}</span>
                      <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>{rule.description}</div>
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span className={`chip chip--${rule.priority}`}>{rule.priority}</span>
                    </td>
                    <td style={{ padding: '12px', textTransform: 'capitalize', fontWeight: 500 }}>
                      → {rule.routes_to}
                    </td>
                    <td style={{ padding: '12px', fontWeight: 600 }}>{rule.sla_hours}h</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── AUDIT ── */}
        {tab === 'audit' && (
          <div className="kin-card" style={{ maxWidth: 760 }}>
            <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}>Audit log</div>
            <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 16 }}>
              Append-only. Every action is timestamped and cannot be modified or deleted.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {AUDIT_LOG.map((entry) => (
                <div key={entry.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 0',
                  borderBottom: '1px solid var(--color-border-light)',
                }}>
                  <span style={{ fontSize: 18, flexShrink: 0 }}>{entry.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{entry.action}</div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                      {entry.actor} <span className="chip chip--low" style={{ marginLeft: 4 }}>{entry.role}</span> · {entry.entity}
                    </div>
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--color-text-muted)', flexShrink: 0 }}>{entry.time}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
