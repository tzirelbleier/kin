'use client'

import { useState, useEffect, useRef } from 'react'
import type { Ticket, TicketMessage, TicketStatus } from '@/types'
import { PRIORITY_ROUTING, STATUS_LABELS, isOverdue, getRemainingHours } from '@/types'

// ----------------------------------------------------------------
// Demo data
// ----------------------------------------------------------------
const DEMO_TICKETS: (Ticket & { resident_name: string; creator_name: string })[] = [
  {
    id: 't1', facility_id: 'f1', resident_id: 'r1', created_by: 'p1', assigned_to: 'staff1',
    linked_event_id: null, title: 'Question about lunch portion', body: 'I noticed Eleanor only ate 60% of her lunch. Is this something to be concerned about?',
    category: 'question', priority: 'normal', status: 'assigned',
    due_by: new Date(Date.now() + 14 * 3600000).toISOString(),
    first_response_at: null, resolved_at: null, resolution_note: null,
    created_at: new Date(Date.now() - 2 * 3600000).toISOString(),
    updated_at: new Date(Date.now() - 2 * 3600000).toISOString(),
    resident_name: 'Eleanor Whitmore', creator_name: 'Sarah Whitmore',
    messages: [],
  },
  {
    id: 't2', facility_id: 'f1', resident_id: 'r1', created_by: 'p1', assigned_to: 'staff1',
    linked_event_id: null, title: 'Concern about evening routine',
    body: 'Mom mentioned she didn\'t sleep well last night. Can a nurse check on her?',
    category: 'concern', priority: 'high', status: 'in_progress',
    due_by: new Date(Date.now() - 1 * 3600000).toISOString(), // overdue
    first_response_at: new Date(Date.now() - 3 * 3600000).toISOString(),
    resolved_at: null, resolution_note: null,
    created_at: new Date(Date.now() - 14 * 3600000).toISOString(),
    updated_at: new Date(Date.now() - 1 * 3600000).toISOString(),
    resident_name: 'Eleanor Whitmore', creator_name: 'Sarah Whitmore',
    messages: [
      { id: 'm1', ticket_id: 't2', author_id: 'p1', body: 'Mom mentioned she didn\'t sleep well last night.', is_internal: false, created_at: new Date(Date.now() - 14 * 3600000).toISOString() },
      { id: 'm2', ticket_id: 't2', author_id: 'staff1', body: 'Thanks for reaching out. We\'ll have a nurse check on Eleanor this evening and update you.', is_internal: false, created_at: new Date(Date.now() - 11 * 3600000).toISOString() },
      { id: 'm3', ticket_id: 't2', author_id: 'staff1', body: 'Note: Dr. Patel reviewed charts — no new med changes. Monitoring overnight.', is_internal: true, created_at: new Date(Date.now() - 8 * 3600000).toISOString() },
    ],
  },
  {
    id: 't3', facility_id: 'f1', resident_id: 'r2', created_by: 'p2', assigned_to: null,
    linked_event_id: null, title: 'Request copy of care plan',
    body: 'Could we get an updated copy of Harold\'s care plan for our records?',
    category: 'care_plan', priority: 'high', status: 'open',
    due_by: new Date(Date.now() + 8 * 3600000).toISOString(),
    first_response_at: null, resolved_at: null, resolution_note: null,
    created_at: new Date(Date.now() - 30 * 60000).toISOString(),
    updated_at: new Date(Date.now() - 30 * 60000).toISOString(),
    resident_name: 'Harold Jennings', creator_name: 'Tom Jennings',
    messages: [],
  },
]

const DEMO_MESSAGES: Record<string, TicketMessage[]> = {
  t1: [],
  t2: DEMO_TICKETS[1].messages as TicketMessage[],
  t3: [],
}

const AUTHOR_NAMES: Record<string, { name: string; role: string }> = {
  p1: { name: 'Sarah Whitmore', role: 'family' },
  p2: { name: 'Tom Jennings', role: 'family' },
  staff1: { name: 'Jenna Reyes', role: 'nurse' },
}

const STATUS_TABS: (TicketStatus | 'all')[] = ['all', 'open', 'assigned', 'in_progress', 'pending_family', 'resolved']

function SlaChip({ due_by }: { due_by: string | null }) {
  if (!due_by) return null
  const hours = getRemainingHours(due_by)
  const overdue = isOverdue(due_by)
  if (hours === null) return null

  let cls = 'sla-chip'
  let label = ''

  if (overdue) {
    cls += ' sla-chip--overdue'
    label = `${Math.abs(hours)}h overdue`
  } else if (hours <= 4) {
    cls += ' sla-chip--warning'
    label = `${hours}h left`
  } else {
    label = `${hours}h left`
  }

  return <span className={cls}>{label}</span>
}

export default function StaffTickets() {
  const [statusFilter, setStatusFilter] = useState<TicketStatus | 'all'>('all')
  const [mineOnly, setMineOnly] = useState(false)
  const [urgentOnly, setUrgentOnly] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(DEMO_TICKETS[0].id)
  const [messages, setMessages] = useState<Record<string, TicketMessage[]>>(DEMO_MESSAGES)
  const [replyBody, setReplyBody] = useState('')
  const [replyMode, setReplyMode] = useState<'family' | 'internal'>('family')
  const [sending, setSending] = useState(false)
  const [resolveModal, setResolveModal] = useState(false)
  const [resolveNote, setResolveNote] = useState('')
  const threadRef = useRef<HTMLDivElement>(null)

  const CURRENT_STAFF_ID = 'staff1'

  const filtered = DEMO_TICKETS.filter((t) => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false
    if (mineOnly && t.assigned_to !== CURRENT_STAFF_ID) return false
    if (urgentOnly && t.priority !== 'urgent' && t.priority !== 'high') return false
    return true
  })

  const overdueCount = DEMO_TICKETS.filter((t) => isOverdue(t.due_by)).length
  const selected = DEMO_TICKETS.find((t) => t.id === selectedId) ?? null
  const threadMessages = selectedId ? (messages[selectedId] ?? []) : []

  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight
    }
  }, [selectedId, threadMessages.length])

  const sendReply = async () => {
    if (!selected || !replyBody.trim()) return
    setSending(true)
    // Demo: just append locally
    const msg: TicketMessage = {
      id: `m-${Date.now()}`,
      ticket_id: selected.id,
      author_id: CURRENT_STAFF_ID,
      body: replyBody.trim(),
      is_internal: replyMode === 'internal',
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => ({
      ...prev,
      [selected.id]: [...(prev[selected.id] ?? []), msg],
    }))
    setReplyBody('')
    setSending(false)
  }

  return (
    <div className="kin-page">
      {/* Dark nav */}
      <nav className="kin-nav kin-nav--dark">
        <span className="kin-nav__brand">Kin</span>
        <span style={{ fontSize: 13, color: '#9ca3af' }}>Staff Portal</span>
        <span className="kin-nav__spacer" />
        {overdueCount > 0 && (
          <span className="chip chip--urgent">{overdueCount} overdue</span>
        )}
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
          JR
        </div>
      </nav>

      <div className="kin-content" style={{ height: 'calc(100vh - 56px)' }}>
        {/* Left: Ticket queue */}
        <aside style={{
          width: 340,
          flexShrink: 0,
          borderRight: '1px solid var(--color-border)',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--color-surface)',
        }}>
          {/* Filter bar */}
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)' }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
                <input type="checkbox" checked={mineOnly} onChange={(e) => setMineOnly(e.target.checked)} />
                Mine only
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
                <input type="checkbox" checked={urgentOnly} onChange={(e) => setUrgentOnly(e.target.checked)} />
                Urgent only
              </label>
            </div>
            {/* Status tabs */}
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {STATUS_TABS.map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  style={{
                    padding: '3px 10px',
                    borderRadius: 99,
                    border: 'none',
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                    background: statusFilter === s ? 'var(--color-primary)' : 'var(--color-bg)',
                    color: statusFilter === s ? '#fff' : 'var(--color-text-secondary)',
                    transition: 'background 120ms',
                  }}
                >
                  {s === 'all' ? 'All' : STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          {/* Ticket list */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {filtered.length === 0 && (
              <div style={{ padding: 24, color: 'var(--color-text-muted)', textAlign: 'center', fontSize: 13 }}>
                No tickets match this filter
              </div>
            )}
            {filtered.map((ticket) => (
              <div
                key={ticket.id}
                onClick={() => setSelectedId(ticket.id)}
                style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid var(--color-border-light)',
                  cursor: 'pointer',
                  background: selectedId === ticket.id ? 'var(--color-primary-light)' : 'transparent',
                  borderLeft: selectedId === ticket.id ? '3px solid var(--color-primary)' : '3px solid transparent',
                  transition: 'background 100ms',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span className={`priority-dot priority-dot--${ticket.priority}`} />
                  <span style={{ fontWeight: 600, fontSize: 13, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {ticket.title}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 6 }}>
                  {(ticket as any).resident_name} · {PRIORITY_ROUTING[ticket.category].icon} {PRIORITY_ROUTING[ticket.category].label}
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span className={`chip chip--${ticket.status}`}>{STATUS_LABELS[ticket.status]}</span>
                  <SlaChip due_by={ticket.due_by} />
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* Right: Thread */}
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {!selected ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)' }}>
              Select a ticket to view the thread
            </div>
          ) : (
            <>
              {/* Thread header */}
              <div style={{
                padding: '16px 24px',
                borderBottom: '1px solid var(--color-border)',
                background: 'var(--color-surface)',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                  <div style={{ flex: 1 }}>
                    <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{selected.title}</h2>
                    <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      <span>📍 {(selected as any).resident_name}</span>
                      <span>{PRIORITY_ROUTING[selected.category].icon} {PRIORITY_ROUTING[selected.category].label}</span>
                      <span>Created by {(selected as any).creator_name}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span className={`chip chip--${selected.status}`}>{STATUS_LABELS[selected.status]}</span>
                    <SlaChip due_by={selected.due_by} />
                    {selected.assigned_to !== CURRENT_STAFF_ID && (
                      <button className="btn btn--secondary btn--sm">Assign to me</button>
                    )}
                    {!['resolved','closed'].includes(selected.status) && (
                      <button className="btn btn--success btn--sm" onClick={() => setResolveModal(true)}>
                        ✓ Resolve
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div ref={threadRef} style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Original body */}
                <div style={{ alignSelf: 'flex-start', maxWidth: '70%' }}>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 4 }}>
                    {(selected as any).creator_name} · {new Date(selected.created_at).toLocaleString()}
                  </div>
                  <div style={{
                    padding: '10px 14px',
                    borderRadius: '4px 12px 12px 12px',
                    background: '#f3f4f6',
                    fontSize: 13,
                    lineHeight: 1.6,
                  }}>
                    {selected.body}
                  </div>
                </div>

                {threadMessages.map((msg) => {
                  const isStaff = msg.author_id === CURRENT_STAFF_ID || msg.author_id === 'staff1'
                  const author = AUTHOR_NAMES[msg.author_id] ?? { name: 'Unknown', role: 'staff' }
                  return (
                    <div key={msg.id} style={{ alignSelf: isStaff ? 'flex-end' : 'flex-start', maxWidth: '70%' }}>
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 4, textAlign: isStaff ? 'right' : 'left' }}>
                        {author.name} · {new Date(msg.created_at).toLocaleString()}
                        {msg.is_internal && <span style={{ marginLeft: 6, color: '#6b21a8', fontWeight: 600 }}>🔒 Internal</span>}
                      </div>
                      <div style={{
                        padding: '10px 14px',
                        borderRadius: isStaff ? '12px 4px 12px 12px' : '4px 12px 12px 12px',
                        background: msg.is_internal ? 'transparent' : (isStaff ? '#2563eb' : '#f3f4f6'),
                        border: msg.is_internal ? '1px dashed #a78bfa' : 'none',
                        color: (!msg.is_internal && isStaff) ? '#fff' : 'inherit',
                        fontSize: 13,
                        lineHeight: 1.6,
                        fontStyle: msg.is_internal ? 'italic' : 'normal',
                      }}>
                        {msg.body}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Reply area */}
              <div style={{ padding: '12px 24px', borderTop: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
                {/* Toggle buttons */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                  <button
                    className={`btn btn--sm ${replyMode === 'family' ? 'btn--success' : 'btn--secondary'}`}
                    onClick={() => setReplyMode('family')}
                  >
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
                    style={{
                      minHeight: 60,
                      flex: 1,
                      borderStyle: replyMode === 'internal' ? 'dashed' : 'solid',
                      borderColor: replyMode === 'internal' ? '#a78bfa' : undefined,
                    }}
                    placeholder={replyMode === 'family' ? 'Write a reply to the family…' : 'Internal note — not visible to family…'}
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) sendReply() }}
                  />
                  <button
                    className="btn btn--primary"
                    disabled={sending || !replyBody.trim()}
                    onClick={sendReply}
                    style={{ flexShrink: 0 }}
                  >
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

      {/* Resolve modal */}
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
                <textarea
                  className="form-textarea"
                  placeholder="Describe what was done or any follow-up…"
                  value={resolveNote}
                  onChange={(e) => setResolveNote(e.target.value)}
                />
              </div>
            </div>
            <div className="modal__footer">
              <button className="btn btn--secondary" onClick={() => setResolveModal(false)}>Cancel</button>
              <button className="btn btn--success" onClick={() => setResolveModal(false)}>
                ✓ Mark resolved
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
