'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'

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
import { EscalateModal } from '@/components/family/EscalateModal'
import { createBrowserClient } from '@/lib/supabase'
import { PRIORITY_ROUTING, STATUS_LABELS } from '@/types'
import type { CareEvent, Resident, Ticket, TicketMessage, ScheduleItem, Appointment, FacilityMenu } from '@/types'

function signOut() {
  createBrowserClient().auth.signOut().then(() => { window.location.href = '/login' })
}

const EVENT_ICONS: Record<string, string> = {
  meal: 'Meal', medication: 'Med', activity: 'Activity', incident: 'Alert', vitals: 'Vitals', hygiene: 'Hygiene', default: 'Note',
}

const SCHEDULE_ICONS: Record<string, string> = {
  activity: '◆', therapy: '+', social: '●', medical: '+', meal: '▲', personal: '★', default: '●',
}

const APPT_ICONS: Record<string, string> = {
  medical: '+', therapy: '+', family_visit: '♥', outing: '→', appointment: '●', other: '●',
}

const MEAL_ICONS: Record<string, string> = {
  breakfast: '◑', lunch: '◕', dinner: '●', snack: '◔',
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

type ResidentTicket = Ticket & {
  creator?: { full_name: string; role: string }
  assignee?: { full_name: string; role: string } | null
  messages?: (TicketMessage & { author?: { full_name: string; role: string } })[]
}

// ----------------------------------------------------------------
// Date/time helpers
// ----------------------------------------------------------------
function formatEventTime(dateStr: string): string {
  const d = new Date(dateStr)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1)
  const eventDay = new Date(d); eventDay.setHours(0, 0, 0, 0)
  const time = d.toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit', hour12: true })
  if (eventDay.getTime() === today.getTime()) return `Today at ${time}`
  if (eventDay.getTime() === yesterday.getTime()) return `Yesterday at ${time}`
  return d.toLocaleDateString('en', { month: 'short', day: 'numeric' }) + ` at ${time}`
}

function formatTime(t: string): string {
  // "HH:MM:SS" → "H:MM AM/PM"
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hr = h % 12 || 12
  return `${hr}:${String(m).padStart(2, '0')} ${ampm}`
}

function getWeek(offset = 0): { days: Date[]; label: string } {
  const today = new Date()
  const dow = today.getDay()
  const monday = new Date(today)
  monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1) + offset * 7)
  monday.setHours(0, 0, 0, 0)
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(monday); d.setDate(monday.getDate() + i); return d })
  const fmt = (d: Date) => d.toLocaleDateString('en', { month: 'short', day: 'numeric' })
  return { days, label: `${fmt(days[0])} – ${fmt(days[6])}` }
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10)
}

// ----------------------------------------------------------------
// Wellbeing
// ----------------------------------------------------------------
function computeWellbeing(events: CareEvent[]): number {
  const cutoff = Date.now() - 30 * 86400000
  let score = 100
  for (const e of events) {
    if (new Date(e.occurred_at).getTime() < cutoff) continue
    if (e.severity === 'incident') score -= 20
    else if (e.severity === 'critical') score -= 10
    else if (e.severity === 'warning') score -= 5
  }
  return Math.max(0, Math.round(score))
}

function wellbeingColor(s: number) {
  if (s >= 80) return '#16a34a'
  if (s >= 60) return '#d97706'
  if (s >= 40) return '#f97316'
  return '#dc2626'
}

// ----------------------------------------------------------------
// Time grouping for feed
// ----------------------------------------------------------------
function groupByTime(events: CareEvent[]) {
  const groups: { label: string; events: CareEvent[] }[] = [
    { label: 'This Evening', events: [] }, { label: 'This Afternoon', events: [] },
    { label: 'This Morning', events: [] }, { label: 'Yesterday', events: [] }, { label: 'Earlier', events: [] },
  ]
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1)
  events.forEach((e) => {
    const d = new Date(e.occurred_at); const h = d.getHours()
    if (d >= today) { if (h >= 17) groups[0].events.push(e); else if (h >= 12) groups[1].events.push(e); else groups[2].events.push(e) }
    else if (d >= yesterday) { groups[3].events.push(e) }
    else { groups[4].events.push(e) }
  })
  return groups.filter((g) => g.events.length > 0)
}

// ----------------------------------------------------------------
// Calendar view
// ----------------------------------------------------------------
function CalendarView({ scheduleItems, appointments, facilityId, residentId }: {
  scheduleItems: ScheduleItem[]
  appointments: Appointment[]
  facilityId: string
  residentId: string
}) {
  const isMobile = useIsMobile()
  const [weekOffset, setWeekOffset] = useState(0)
  const { days, label } = getWeek(weekOffset)
  const today = new Date(); today.setHours(0, 0, 0, 0)

  return (
    <div>
      {/* Week nav */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button className="btn btn--secondary btn--sm" onClick={() => setWeekOffset(o => o - 1)}>← Prev</button>
        <span style={{ fontWeight: 600, fontSize: 14, flex: 1, textAlign: 'center' }}>{label}</span>
        <button className="btn btn--secondary btn--sm" onClick={() => setWeekOffset(o => o + 1)}>Next →</button>
        {weekOffset !== 0 && <button className="btn btn--sm" style={{ fontSize: 12, padding: '3px 10px' }} onClick={() => setWeekOffset(0)}>This week</button>}
      </div>

      {/* Day columns — horizontal scroll on narrow screens */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(3, minmax(100px, 1fr))' : 'repeat(7, minmax(120px, 1fr))', gap: 8, overflowX: 'auto' }}>
        {days.map(day => {
          const dayIdx = day.getDay()
          const dateStr = toDateStr(day)
          const isToday = day.getTime() === today.getTime()

          const daySchedule = scheduleItems
            .filter(s => s.day_of_week === dayIdx)
            .sort((a, b) => a.start_time.localeCompare(b.start_time))

          const dayAppts = appointments
            .filter(a => a.scheduled_at.slice(0, 10) === dateStr && a.status !== 'cancelled')
            .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))

          return (
            <div key={dateStr} style={{ minHeight: 120 }}>
              <div style={{
                padding: '6px 8px', borderRadius: '8px 8px 0 0', marginBottom: 4, textAlign: 'center',
                background: isToday ? 'var(--color-primary)' : 'var(--color-surface)',
                color: isToday ? '#fff' : 'var(--color-text-secondary)',
                borderBottom: isToday ? 'none' : '1px solid var(--color-border)',
              }}>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{DAY_NAMES[dayIdx]}</div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{day.getDate()}</div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {dayAppts.map(appt => (
                  <div key={appt.id} style={{ padding: '6px 8px', borderRadius: 6, background: '#ede9fe', border: '1px solid #c4b5fd', fontSize: 12 }}>
                    <div style={{ fontWeight: 600, color: '#5b21b6', fontSize: 11 }}>
                      {APPT_ICONS[appt.appointment_type] ?? '📅'} {new Date(appt.scheduled_at).toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit', hour12: true })}
                    </div>
                    <div style={{ color: '#4c1d95', lineHeight: 1.3, marginTop: 1 }}>{appt.title}</div>
                    {appt.location && <div style={{ color: '#6d28d9', fontSize: 10, marginTop: 1 }}>📍 {appt.location}</div>}
                  </div>
                ))}

                {daySchedule.map(item => (
                  <div key={item.id} style={{ padding: '6px 8px', borderRadius: 6, background: '#f0fdf4', border: '1px solid #86efac', fontSize: 12 }}>
                    <div style={{ fontWeight: 600, color: '#15803d', fontSize: 11 }}>
                      {SCHEDULE_ICONS[item.category] ?? '📅'} {formatTime(item.start_time)}
                      {item.end_time && ` – ${formatTime(item.end_time)}`}
                    </div>
                    <div style={{ color: '#166534', lineHeight: 1.3, marginTop: 1 }}>{item.title}</div>
                  </div>
                ))}

                {dayAppts.length === 0 && daySchedule.length === 0 && (
                  <div style={{ padding: '8px', fontSize: 11, color: 'var(--color-text-muted)', textAlign: 'center' }}>—</div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ marginTop: 16, display: 'flex', gap: 16, fontSize: 12 }}>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#ede9fe', border: '1px solid #c4b5fd', borderRadius: 2, marginRight: 4 }} />Appointments</span>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 2, marginRight: 4 }} />Scheduled activities</span>
      </div>
    </div>
  )
}

// ----------------------------------------------------------------
// Menu view
// ----------------------------------------------------------------
function MenuView({ menus, facilityId, residentId }: { menus: FacilityMenu[]; facilityId: string; residentId: string }) {
  const [weekOffset, setWeekOffset] = useState(0)
  const { days, label } = getWeek(weekOffset)
  const mealOrder = ['breakfast', 'lunch', 'dinner', 'snack']

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button className="btn btn--secondary btn--sm" onClick={() => setWeekOffset(o => o - 1)}>← Prev</button>
        <span style={{ fontWeight: 600, fontSize: 14, flex: 1, textAlign: 'center' }}>{label}</span>
        <button className="btn btn--secondary btn--sm" onClick={() => setWeekOffset(o => o + 1)}>Next →</button>
        {weekOffset !== 0 && <button className="btn btn--sm" style={{ fontSize: 12, padding: '3px 10px' }} onClick={() => setWeekOffset(0)}>This week</button>}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {days.map(day => {
          const dateStr = toDateStr(day)
          const today = new Date(); today.setHours(0, 0, 0, 0)
          const isToday = day.getTime() === today.getTime()
          const dayMenus = menus.filter(m => m.date === dateStr)
          const byMeal: Record<string, FacilityMenu[]> = {}
          for (const m of dayMenus) { if (!byMeal[m.meal_type]) byMeal[m.meal_type] = []; byMeal[m.meal_type].push(m) }

          return (
            <div key={dateStr} className="kin-card" style={{ borderLeft: isToday ? '3px solid var(--color-primary)' : '3px solid transparent' }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, color: isToday ? 'var(--color-primary)' : 'inherit' }}>
                {DAY_FULL[day.getDay()]} · {day.toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                {isToday && <span style={{ fontSize: 11, marginLeft: 8, background: 'var(--color-primary)', color: '#fff', padding: '1px 6px', borderRadius: 99 }}>Today</span>}
              </div>

              {mealOrder.some(m => byMeal[m]) ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
                  {mealOrder.filter(m => byMeal[m]).map(mealType => (
                    <div key={mealType}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                        {MEAL_ICONS[mealType] ?? '🍽️'} {mealType.charAt(0).toUpperCase() + mealType.slice(1)}
                      </div>
                      {byMeal[mealType].map(item => (
                        <div key={item.id} style={{ marginBottom: 4 }}>
                          <div style={{ fontWeight: 500, fontSize: 13 }}>{item.title}</div>
                          {item.description && <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{item.description}</div>}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Menu not available for this day.</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
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
  const isMobile = useIsMobile()
  const now = Date.now()
  const last7 = events.filter(e => now - new Date(e.occurred_at).getTime() < 7 * 86400000)
  const last30 = events.filter(e => now - new Date(e.occurred_at).getTime() < 30 * 86400000)
  const byType = ['meal', 'medication', 'activity', 'vitals', 'hygiene', 'incident'].map(type => ({
    type, icon: EVENT_ICONS[type], count: last30.filter(e => e.event_type === type).length,
  })).filter(t => t.count > 0)
  const maxByType = Math.max(...byType.map(t => t.count), 1)
  const bySeverity = [
    { label: 'Incident', key: 'incident', color: '#ef4444' }, { label: 'Critical', key: 'critical', color: '#f97316' },
    { label: 'Warning', key: 'warning', color: '#eab308' }, { label: 'Info', key: 'info', color: '#22c55e' },
  ].map(s => ({ ...s, count: last30.filter(e => e.severity === s.key).length })).filter(s => s.count > 0)
  const timeline = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (13 - i))
    const next = new Date(d); next.setDate(next.getDate() + 1)
    return { day: d.toLocaleDateString('en', { weekday: 'short', month: 'numeric', day: 'numeric' }), count: events.filter(e => { const ed = new Date(e.occurred_at); return ed >= d && ed < next }).length }
  })
  const maxTimeline = Math.max(...timeline.map(d => d.count), 1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 12 }}>
        <StatCard label="Events (last 7d)" value={last7.length} color="#0d9488" />
        <StatCard label="Events (last 30d)" value={last30.length} color="#7c3aed" />
        <StatCard label="Incidents (30d)" value={last30.filter(e => e.severity === 'incident').length} color="#dc2626" />
        <StatCard label="Medication events" value={last30.filter(e => e.event_type === 'medication').length} sub="last 30 days" color="#16a34a" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="kin-card">
          <div style={{ fontWeight: 600, marginBottom: 16 }}>Events by type — last 30 days</div>
          {byType.length === 0 ? <div style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>No events yet.</div> : (
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
          {bySeverity.length === 0 ? <div style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>No events yet.</div> : (
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
        {timeline.every(d => d.count === 0) ? <div style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>No events in this period.</div> : (
          <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 80 }}>
            {timeline.map(d => (
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
function TicketsView({ tickets, loading, readOnly }: { tickets: ResidentTicket[]; loading: boolean; readOnly?: boolean }) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  if (loading) return <div style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>Loading tickets…</div>
  if (tickets.length === 0) return <div style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>No tickets yet. {!readOnly && 'Use "Contact care team" to send a question or concern.'}</div>

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
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 4 }}>{ticket.creator?.full_name ?? 'You'} · {new Date(ticket.created_at).toLocaleString()}</div>
                      <div style={{ padding: '10px 14px', borderRadius: '4px 12px 12px 12px', background: '#f3f4f6', fontSize: 13, lineHeight: 1.6 }}>{ticket.body}</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {(ticket.messages ?? []).filter(m => !m.is_internal).map(msg => {
                        const isStaff = msg.author?.role !== 'family'
                        return (
                          <div key={msg.id} style={{ alignSelf: isStaff ? 'flex-end' : 'flex-start', maxWidth: '80%', width: '100%' }}>
                            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 4, textAlign: isStaff ? 'right' : 'left' }}>
                              {msg.author?.full_name ?? (isStaff ? 'Care team' : 'You')} · {new Date(msg.created_at).toLocaleString()}
                            </div>
                            <div style={{ padding: '8px 12px', borderRadius: isStaff ? '12px 4px 12px 12px' : '4px 12px 12px 12px', background: isStaff ? '#0d9488' : '#f3f4f6', color: isStaff ? '#fff' : 'inherit', fontSize: 13, lineHeight: 1.6 }}>
                              {msg.body}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    {ticket.resolution_note && (
                      <div style={{ marginTop: 12, padding: '10px 14px', background: '#dcfce7', borderRadius: 8, fontSize: 13, color: '#15803d' }}>✓ Resolution: {ticket.resolution_note}</div>
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
function EventCard({ event, onEscalate, readOnly, linkedTicket }: {
  event: CareEvent
  onEscalate: (event: CareEvent) => void
  readOnly?: boolean
  linkedTicket?: ResidentTicket
}) {
  const [expanded, setExpanded] = useState(false)
  const isIncident = event.severity === 'incident'
  const isWarning = event.severity === 'warning'
  const icon = EVENT_ICONS[event.event_type] ?? EVENT_ICONS.default

  return (
    <div className={`kin-card ${isIncident ? 'kin-card--incident' : ''}`} style={{ marginBottom: 8, cursor: 'pointer' }} onClick={() => setExpanded(v => !v)}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <span style={{ fontSize: 20, flexShrink: 0, marginTop: 1 }}>{icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>{event.title}</span>
            {isIncident && <span className="chip chip--urgent">Incident</span>}
            {isWarning && !isIncident && <span className="chip chip--high">Attention</span>}
            {linkedTicket && <span className={`chip chip--${linkedTicket.status}`} style={{ fontSize: 11 }}>{STATUS_LABELS[linkedTicket.status]}</span>}
          </div>
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 4 }}>{formatEventTime(event.occurred_at)}</div>
          {expanded && (
            <div style={{ marginTop: 10 }}>
              {event.detail && <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 12, lineHeight: 1.6 }}>{event.detail}</p>}
              {linkedTicket && (
                <div style={{ marginBottom: 10, padding: '8px 12px', background: '#ede9fe', borderRadius: 8, fontSize: 13 }}>
                  <span style={{ fontWeight: 600, color: '#6d28d9' }}>Related ticket: </span>
                  <span style={{ color: '#4c1d95' }}>{linkedTicket.title}</span>
                  <span style={{ marginLeft: 8 }}><span className={`chip chip--${linkedTicket.status}`}>{STATUS_LABELS[linkedTicket.status]}</span></span>
                  {linkedTicket.assignee && <span style={{ color: '#6b7280', fontSize: 12, marginLeft: 8 }}>→ {linkedTicket.assignee.full_name}</span>}
                </div>
              )}
              {!readOnly && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn--primary btn--sm" onClick={e => { e.stopPropagation(); onEscalate(event) }}>Contact care team</button>
                </div>
              )}
              {readOnly && <div style={{ fontSize: 12, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>Read-only view</div>}
            </div>
          )}
        </div>
        <span style={{ fontSize: 12, color: 'var(--color-text-muted)', flexShrink: 0 }}>{expanded ? '▲' : '▼'}</span>
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
}

type MainView = 'feed' | 'calendar' | 'menu' | 'tickets' | 'reports'

export function FamilyDashboardClient({ residents, initialEvents, facilityId, profileId, isAdmin, readOnly }: Props) {
  const isMobile = useIsMobile()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [selectedResident, setSelectedResident] = useState<Resident | null>(residents[0] ?? null)
  const [currentEvents, setCurrentEvents] = useState<CareEvent[]>(initialEvents)
  const [loadingEvents, setLoadingEvents] = useState(false)
  const [residentTickets, setResidentTickets] = useState<ResidentTicket[]>([])
  const [loadingTickets, setLoadingTickets] = useState(false)
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [menus, setMenus] = useState<FacilityMenu[]>([])
  const [mainView, setMainView] = useState<MainView>('feed')
  const [modalState, setModalState] = useState<{ open: boolean; event?: CareEvent; defaultCategory?: 'question' | 'concern' }>({ open: false })
  const [toast, setToast] = useState('')

  const wellbeing = computeWellbeing(currentEvents)
  const wColor = wellbeingColor(wellbeing)

  const eventTicketMap = useMemo(() => {
    const map: Record<string, ResidentTicket> = {}
    for (const t of residentTickets) { if (t.linked_event_id) map[t.linked_event_id] = t }
    return map
  }, [residentTickets])

  const loadResidentData = async (residentId: string) => {
    // Events
    setLoadingEvents(true)
    const evRes = await fetch(`/api/care-events?resident_id=${residentId}`)
    setCurrentEvents(evRes.ok ? await evRes.json() : [])
    setLoadingEvents(false)

    // Tickets
    setLoadingTickets(true)
    const tkRes = await fetch(`/api/tickets/resident?resident_id=${residentId}`)
    setResidentTickets(tkRes.ok ? await tkRes.json() : [])
    setLoadingTickets(false)

    // Schedule (facility-wide + resident-specific)
    const scRes = await fetch(`/api/schedule?facility_id=${facilityId}&resident_id=${residentId}`)
    setScheduleItems(scRes.ok ? await scRes.json() : [])

    // Appointments (next 90 days)
    const from = new Date().toISOString().slice(0, 10)
    const to = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10)
    const apRes = await fetch(`/api/appointments?resident_id=${residentId}&from=${from}&to=${to}`)
    setAppointments(apRes.ok ? await apRes.json() : [])

    // Menus (current + next 2 weeks)
    const mFrom = new Date().toISOString().slice(0, 10)
    const mTo = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)
    const mnRes = await fetch(`/api/menus?facility_id=${facilityId}&resident_id=${residentId}&from=${mFrom}&to=${mTo}`)
    setMenus(mnRes.ok ? await mnRes.json() : [])
  }

  // Load on mount for initial resident
  useEffect(() => {
    if (selectedResident) { loadResidentData(selectedResident.id) }
  }, [])

  const switchResident = async (residentId: string) => {
    const next = residents.find(r => r.id === residentId)
    if (!next || next.id === selectedResident?.id) return
    setSelectedResident(next)
    await loadResidentData(residentId)
  }

  const grouped = groupByTime(currentEvents)
  const cutoff = Date.now() - 48 * 3600 * 1000
  const alerts = currentEvents.filter(e => (e.severity === 'incident' || e.severity === 'critical') && new Date(e.occurred_at).getTime() > cutoff)

  const openModal = (event?: CareEvent, type?: 'question' | 'concern') => {
    if (readOnly) return
    setModalState({ open: true, event, defaultCategory: type })
  }

  const handleSuccess = () => {
    setModalState({ open: false })
    setToast('Your message has been sent. We\'ll get back to you within the expected response time.')
    setTimeout(() => setToast(''), 5000)
    if (selectedResident) {
      fetch(`/api/tickets/resident?resident_id=${selectedResident.id}`).then(r => r.ok ? r.json() : []).then(setResidentTickets)
    }
  }

  if (residents.length === 0) {
    return (
      <div className="kin-page">
        {!isAdmin && <nav className="kin-nav kin-nav--dark"><span className="kin-nav__brand">Idene</span></nav>}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)' }}>No residents found.</div>
      </div>
    )
  }

  const viewTabs: { id: MainView; label: string }[] = [
    { id: 'feed', label: 'Care Feed' },
    { id: 'calendar', label: 'Calendar' },
    { id: 'menu', label: 'Menu' },
    { id: 'tickets', label: `Tickets${residentTickets.length > 0 ? ` (${residentTickets.length})` : ''}` },
    { id: 'reports', label: 'Reports' },
  ]

  return (
    <div className="kin-page">
      {!isAdmin ? (
        <nav className="kin-nav kin-nav--dark">
          <span className="kin-nav__brand">Idene</span>
          <span style={{ fontSize: 13, color: 'var(--color-nav-dark-muted)' }}>Family Portal</span>
          <span className="kin-nav__spacer" />
          {selectedResident && !readOnly && (
            <button className="btn btn--primary btn--sm" onClick={() => openModal()}>+ Contact care team</button>
          )}
          <button className="btn btn--sm" style={{ background: 'transparent', border: '1px solid var(--color-nav-dark-border)', color: 'var(--color-nav-dark-muted)' }} onClick={signOut}>Sign out</button>
        </nav>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}>
          {readOnly && <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 99, background: '#f3f4f6', color: '#6b7280' }}>Read-only</span>}
          <span className="kin-nav__spacer" />
        </div>
      )}

      {/* Incident alert banner */}
      {alerts.length > 0 && (
        <div style={{ background: '#fef2f2', borderBottom: '1px solid #fecaca', padding: '12px 24px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {alerts.map(alert => {
            const linked = eventTicketMap[alert.id]
            return (
              <div key={alert.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <span style={{ fontSize: 16, flexShrink: 0, color: '#dc2626', fontWeight: 700 }}>!</span>
                <div style={{ flex: 1 }}>
                  <span style={{ fontWeight: 700, color: '#991b1b', fontSize: 14 }}>Incident reported — {selectedResident?.full_name}</span>
                  <span style={{ color: '#b91c1c', fontSize: 13, marginLeft: 8 }}>{alert.title}</span>
                  <span style={{ color: '#dc2626', fontSize: 12, marginLeft: 8 }}>· {formatEventTime(alert.occurred_at)}</span>
                  {alert.detail && <div style={{ fontSize: 13, color: '#7f1d1d', marginTop: 2 }}>{alert.detail}</div>}
                  {linked && (
                    <div style={{ marginTop: 4, fontSize: 12, color: '#991b1b' }}>
                      Ticket: <span style={{ fontWeight: 600 }}>{linked.title}</span>
                      <span style={{ marginLeft: 8 }}><span className={`chip chip--${linked.status}`}>{STATUS_LABELS[linked.status]}</span></span>
                      <button className="btn btn--sm" style={{ marginLeft: 8, background: 'transparent', border: '1px solid #fca5a5', color: '#991b1b', padding: '1px 8px', fontSize: 11 }} onClick={() => setMainView('tickets')}>View</button>
                    </div>
                  )}
                </div>
                {!readOnly && (
                  <button className="btn btn--danger btn--sm" style={{ flexShrink: 0 }} onClick={() => openModal(alert, 'concern')}>Contact care team</button>
                )}
              </div>
            )
          })}
        </div>
      )}

      <div className="kin-content" style={{ flexDirection: isMobile ? 'column' : 'row' }}>
        {/* Mobile: sidebar toggle button */}
        {isMobile && (
          <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={() => setSidebarOpen(v => !v)} style={{ background: 'none', border: '1px solid var(--color-border)', borderRadius: 6, padding: '5px 12px', fontSize: 13, cursor: 'pointer' }}>
              {sidebarOpen ? '▲ Hide info' : '▼ Resident info'}
            </button>
            {selectedResident && <span style={{ fontWeight: 600, fontSize: 14 }}>{selectedResident.full_name}</span>}
          </div>
        )}

        {/* Sidebar */}
        <aside style={{ width: isMobile ? '100%' : 260, flexShrink: 0, borderRight: isMobile ? 'none' : '1px solid var(--color-border)', borderBottom: isMobile ? '1px solid var(--color-border)' : 'none', background: 'var(--color-surface)', padding: 20, overflowY: 'auto', display: isMobile && !sidebarOpen ? 'none' : 'flex', flexDirection: 'column' }}>
          {isAdmin && residents.length > 1 && (
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>Resident</label>
              <select className="form-input" style={{ fontSize: 13 }} value={selectedResident?.id ?? ''} onChange={e => switchResident(e.target.value)}>
                {residents.map(r => <option key={r.id} value={r.id}>{r.full_name}</option>)}
              </select>
            </div>
          )}

          {selectedResident && (
            <>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--color-primary-mid)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, color: '#134e4a', marginBottom: 10 }}>{selectedResident.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}</div>
              <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 2 }}>{selectedResident.full_name}</h2>
              <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 14 }}>{selectedResident.room_number ? `Room ${selectedResident.room_number}` : 'Room TBD'}</p>

              <div className="kin-card" style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 6 }}>Wellbeing (30 days)</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'var(--color-border)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${wellbeing}%`, background: wColor, borderRadius: 4, transition: 'width 0.5s' }} />
                  </div>
                  <span style={{ fontWeight: 700, color: wColor, fontSize: 14 }}>{wellbeing}%</span>
                </div>
                {wellbeing < 100 && (
                  <div style={{ fontSize: 11, color: wColor, marginTop: 4 }}>
                    Based on {currentEvents.filter(e => (e.severity === 'incident' || e.severity === 'warning' || e.severity === 'critical') && Date.now() - new Date(e.occurred_at).getTime() < 30 * 86400000).length} flagged events
                  </div>
                )}
              </div>

              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Today</div>
              {[
                { label: 'Meals', value: `${currentEvents.filter(e => e.event_type === 'meal').length} logged` },
                { label: 'Meds', value: currentEvents.some(e => e.event_type === 'medication') ? 'Administered' : 'None logged' },
                { label: 'Activities', value: `${currentEvents.filter(e => e.event_type === 'activity').length} session(s)` },
                { label: 'Incidents', value: currentEvents.some(e => e.severity === 'incident') ? 'See feed' : 'None' },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--color-border-light)', fontSize: 12 }}>
                  <span>{row.label}</span>
                  <span style={{ color: 'var(--color-text-secondary)' }}>{row.value}</span>
                </div>
              ))}

              {/* Upcoming appointments quick list */}
              {appointments.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Upcoming</div>
                  {appointments.slice(0, 3).map(a => (
                    <div key={a.id} style={{ display: 'flex', gap: 8, padding: '4px 0', borderBottom: '1px solid var(--color-border-light)', fontSize: 12, cursor: 'pointer' }} onClick={() => setMainView('calendar')}>
                      <span>{APPT_ICONS[a.appointment_type] ?? '📅'}</span>
                      <div>
                        <div style={{ fontWeight: 500 }}>{a.title}</div>
                        <div style={{ color: 'var(--color-text-muted)', fontSize: 11 }}>{new Date(a.scheduled_at).toLocaleDateString('en', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</div>
                      </div>
                    </div>
                  ))}
                  {appointments.length > 3 && (
                    <button className="btn btn--sm" style={{ marginTop: 6, fontSize: 11, padding: '2px 8px', background: 'transparent', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }} onClick={() => setMainView('calendar')}>
                      View all {appointments.length} →
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </aside>

        {/* Main */}
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)', padding: '0 24px', overflowX: 'auto' }}>
            {viewTabs.map(t => (
              <button key={t.id} onClick={() => setMainView(t.id)} style={{
                padding: '12px 16px', border: 'none', cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap',
                borderBottom: mainView === t.id ? '2px solid var(--color-primary)' : '2px solid transparent',
                background: 'transparent', marginBottom: -1,
                fontWeight: mainView === t.id ? 600 : 400,
                color: mainView === t.id ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              }}>{t.label}</button>
            ))}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '16px' : '24px 32px' }}>
            {selectedResident && (
              <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>
                {mainView === 'feed' && `Care updates — ${selectedResident.full_name}`}
                {mainView === 'calendar' && `Calendar — ${selectedResident.full_name}`}
                {mainView === 'menu' && `Menu — ${selectedResident.full_name}`}
                {mainView === 'tickets' && `Tickets — ${selectedResident.full_name}`}
                {mainView === 'reports' && `Reports — ${selectedResident.full_name}`}
              </h1>
            )}

            {mainView === 'feed' && (
              <>
                {loadingEvents && <div style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>Loading…</div>}
                {!loadingEvents && grouped.length === 0 && <div style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>No care events yet.</div>}
                {!loadingEvents && grouped.map(group => (
                  <div key={group.label} style={{ marginBottom: 28 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--color-text-muted)', marginBottom: 10 }}>{group.label}</div>
                    {group.events.map(event => (
                      <EventCard key={event.id} event={event} onEscalate={openModal} readOnly={readOnly} linkedTicket={eventTicketMap[event.id]} />
                    ))}
                  </div>
                ))}
              </>
            )}

            {mainView === 'calendar' && selectedResident && (
              <CalendarView scheduleItems={scheduleItems} appointments={appointments} facilityId={facilityId} residentId={selectedResident.id} />
            )}

            {mainView === 'menu' && selectedResident && (
              <MenuView menus={menus} facilityId={facilityId} residentId={selectedResident.id} />
            )}

            {mainView === 'tickets' && (
              <TicketsView tickets={residentTickets} loading={loadingTickets} readOnly={readOnly} />
            )}

            {mainView === 'reports' && <ReportsView events={currentEvents} />}
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
        <div className="toast toast--success" style={{ maxWidth: 420, textAlign: 'center' }}>✓ {toast}</div>
      )}
    </div>
  )
}
