'use client'

import { useState } from 'react'
import { PRIORITY_ROUTING } from '@/types'
import type { Ticket, TicketCategory } from '@/types'
import { ExcelImportTab } from '@/components/admin/ExcelImportTab'

type Tab = 'overview' | 'tickets' | 'routing' | 'audit' | 'import' | 'integrations'

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'tickets', label: 'Tickets' },
  { id: 'routing', label: 'Routing' },
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
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', marginBottom: 4 }}>
              1. Webhook endpoint URL
            </div>
            <code style={{ display: 'block', background: '#1e293b', color: '#e2e8f0', padding: '8px 12px', borderRadius: 6, fontSize: 12, wordBreak: 'break-all' }}>
              {webhookUrl}
            </code>
          </div>

          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', marginBottom: 4 }}>
              2. Required header
            </div>
            <code style={{ display: 'block', background: '#1e293b', color: '#e2e8f0', padding: '8px 12px', borderRadius: 6, fontSize: 12 }}>
              x-kin-webhook-secret: {'<your WEBHOOK_SECRET env var>'}
            </code>
          </div>

          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', marginBottom: 4 }}>
              3. Payload source field
            </div>
            <code style={{ display: 'block', background: '#1e293b', color: '#e2e8f0', padding: '8px 12px', borderRadius: 6, fontSize: 12 }}>
              {`{ "source": "${sourceSlug}", "facility_slug": "sunrise-gardens", "events": [...] }`}
            </code>
          </div>

          <div style={{ padding: '10px 12px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, color: '#92400e', fontSize: 12 }}>
            💡 Once events are received, this integration will show as <strong>Active</strong> automatically.
            No manual toggle required.
          </div>
        </div>
      )}
    </div>
  )
}

interface Props {
  tickets: Ticket[]
  events: { id: string; occurred_at: string; severity: string; source: string }[]
  auditLog: { id: string; action: string; actor_id: string | null; entity_type: string; entity_id: string | null; created_at: string; after_state: Record<string, unknown> | null }[]
  facilityId: string
}

export function AdminDashboardClient({ tickets, events, auditLog, facilityId }: Props) {
  const [tab, setTab] = useState<Tab>('overview')

  // Compute metrics
  const total = tickets.length
  const resolved = tickets.filter(t => ['resolved', 'closed'].includes(t.status)).length
  const avgResponseMs = tickets
    .filter(t => t.first_response_at)
    .reduce((sum, t) => {
      const diff = new Date(t.first_response_at!).getTime() - new Date(t.created_at).getTime()
      return sum + diff
    }, 0)
  const avgResponseH = tickets.filter(t => t.first_response_at).length > 0
    ? (avgResponseMs / tickets.filter(t => t.first_response_at).length / 3600000).toFixed(1)
    : '—'

  const todayEvents = events.filter(e => {
    const d = new Date(e.occurred_at)
    const today = new Date(); today.setHours(0,0,0,0)
    return d >= today
  }).length

  // 7-day chart
  const sevenDayData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() - (6 - i))
    const next = new Date(d); next.setDate(next.getDate() + 1)
    const count = tickets.filter(t => {
      const cd = new Date(t.created_at)
      return cd >= d && cd < next
    }).length
    return { day: d.toLocaleDateString('en', { weekday: 'short' }), count }
  })
  const maxCount = Math.max(...sevenDayData.map(d => d.count), 1)

  // Category breakdown
  const categories = Object.keys(PRIORITY_ROUTING) as TicketCategory[]
  const categoryStats = categories.map(cat => {
    const catTickets = tickets.filter(t => t.category === cat)
    const responded = catTickets.filter(t => t.first_response_at)
    const avgH = responded.length > 0
      ? (responded.reduce((s, t) => s + (new Date(t.first_response_at!).getTime() - new Date(t.created_at).getTime()), 0) / responded.length / 3600000).toFixed(1)
      : '—'
    const sla = catTickets.length > 0
      ? Math.round(catTickets.filter(t => !t.due_by || new Date(t.resolved_at ?? new Date()).getTime() <= new Date(t.due_by).getTime()).length / catTickets.length * 100)
      : 100
    return { category: cat, count: catTickets.length, avg_hours: avgH, sla_pct: sla }
  }).filter(s => s.count > 0)

  const maxCatCount = Math.max(...categoryStats.map(s => s.count), 1)

  return (
    <div className="kin-page">
      <nav className="kin-nav kin-nav--dark">
        <span className="kin-nav__brand">Idene</span>
        <span style={{ fontSize: 13, color: '#9ca3af' }}>Admin · Sunrise Gardens</span>
        <span className="kin-nav__spacer" />
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>AD</div>
      </nav>

      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)', padding: '0 24px' }}>
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '14px 20px', border: 'none', cursor: 'pointer', fontSize: 14,
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

        {/* OVERVIEW */}
        {tab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
              {[
                { label: 'Total tickets', value: String(total), sub: 'all time', color: '#2563eb' },
                { label: 'Resolved', value: String(resolved), sub: `of ${total} tickets`, color: '#16a34a' },
                { label: 'Avg response time', value: `${avgResponseH}h`, sub: 'across all tickets', color: '#7c3aed' },
                { label: 'Auto-updates today', value: String(todayEvents), sub: 'from all data sources', color: '#d97706' },
              ].map((m) => (
                <div key={m.label} className="kin-card">
                  <div style={{ fontSize: 32, fontWeight: 800, color: m.color, marginBottom: 4 }}>{m.value}</div>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{m.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{m.sub}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16 }}>
              <div className="kin-card">
                <div style={{ fontWeight: 600, marginBottom: 16 }}>Tickets this week</div>
                {sevenDayData.every(d => d.count === 0) ? (
                  <div style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>No tickets this week yet.</div>
                ) : (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: 120 }}>
                    {sevenDayData.map((d) => (
                      <div key={d.day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)' }}>{d.count}</div>
                        <div style={{ width: '100%', height: `${Math.max((d.count / maxCount) * 80, 4)}px`, background: 'var(--color-primary)', borderRadius: '4px 4px 0 0', opacity: 0.8 }} />
                        <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{d.day}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="kin-card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ fontWeight: 600 }}>Data sources</div>
                  <button className="btn btn--secondary btn--sm" onClick={() => setTab('integrations')}>Configure</button>
                </div>
                {([
                  { name: 'Excel Upload', source: 'staff', icon: '📊' },
                  { name: 'PointClickCare', source: 'pointclickcare', icon: '🏥' },
                  { name: 'Tabula Pro', source: 'tabulapro', icon: '📋' },
                  { name: 'MatrixCare', source: 'matrixcare', icon: '🔗' },
                ] as { name: string; source: string; icon: string }[]).map((int) => {
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
                    {['Category', 'Tickets', 'Avg response', 'SLA compliance', ''].map((h) => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {categoryStats.map((row) => {
                    const rule = PRIORITY_ROUTING[row.category]
                    return (
                      <tr key={row.category} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                        <td style={{ padding: '12px' }}><span style={{ fontWeight: 600 }}>{rule.icon} {rule.label}</span></td>
                        <td style={{ padding: '12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: `${(row.count / maxCatCount) * 80}px`, height: 6, background: 'var(--color-primary)', borderRadius: 3, opacity: 0.7, minWidth: 4 }} />
                            <span style={{ fontWeight: 600 }}>{row.count}</span>
                          </div>
                        </td>
                        <td style={{ padding: '12px', color: 'var(--color-text-secondary)' }}>{row.avg_hours}h</td>
                        <td style={{ padding: '12px' }}>
                          <span style={{ fontWeight: 700, color: row.sla_pct >= 95 ? '#16a34a' : row.sla_pct >= 85 ? '#d97706' : '#dc2626' }}>{row.sla_pct}%</span>
                        </td>
                        <td style={{ padding: '12px' }}><span className={`chip chip--${rule.priority}`}>{rule.priority}</span></td>
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
          <div className="kin-card" style={{ maxWidth: 720 }}>
            <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}>Escalation routing rules</div>
            <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 16 }}>
              Managed in <code>types/index.ts → PRIORITY_ROUTING</code>. Changes here update all routing logic automatically.
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
                    <td style={{ padding: '12px' }}><span className={`chip chip--${rule.priority}`}>{rule.priority}</span></td>
                    <td style={{ padding: '12px', textTransform: 'capitalize', fontWeight: 500 }}>→ {rule.routes_to}</td>
                    <td style={{ padding: '12px', fontWeight: 600 }}>{rule.sla_hours}h</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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

            {/* Excel Upload */}
            <IntegrationCard
              icon="📊"
              name="Excel / CSV Upload"
              status="active"
              description="Manually upload care event data from a spreadsheet. Ideal for demos and facilities without an EHR API."
              statusLabel="Active"
              action={<button className="btn btn--primary btn--sm" onClick={() => setTab('import')}>Open import tool →</button>}
            />

            {/* PointClickCare */}
            <IntegrationCard
              icon="🏥"
              name="PointClickCare"
              status="inactive"
              description="Connect to PointClickCare via webhook. Care events are pushed to Idene in real time when charted."
              statusLabel="Not connected"
              action={<WebhookConfig name="PointClickCare" webhookPath="/api/webhooks/events" sourceSlug="pointclickcare" />}
            />

            {/* Tabula Pro */}
            <IntegrationCard
              icon="📋"
              name="Tabula Pro"
              status="inactive"
              description="Receive care events from Tabula Pro via webhook integration."
              statusLabel="Not connected"
              action={<WebhookConfig name="Tabula Pro" webhookPath="/api/webhooks/events" sourceSlug="tabulapro" />}
            />

            {/* MatrixCare */}
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
