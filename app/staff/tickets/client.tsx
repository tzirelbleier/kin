'use client'

import { useState, useRef, useEffect } from 'react'
import { PRIORITY_ROUTING, STATUS_LABELS, isOverdue, getRemainingHours } from '@/types'
import type { Ticket, TicketMessage, TicketStatus } from '@/types'
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

  const overdueCount = tickets.filter((t) => isOverdue(t.due_by)).length
  const selected = tickets.find((t) => t.id === selectedId) ?? null
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

  if (tickets.length === 0) {
    return (
      <div className="kin-page">
        <nav className="kin-nav kin-nav--dark">
          <span className="kin-nav__brand">Kin</span>
          <span style={{ fontSize: 13, color: '#9ca3af' }}>Staff Portal</span>
          <span className="kin-nav__spacer" />
          <button className="btn btn--sm" style={{ background: 'transparent', border: '1px solid #374151', color: '#9ca3af' }} onClick={signOut}>Sign out</button>
        </nav>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 32 }}>✅</div>
          <div>No tickets yet. Family escalations will appear here.</div>
        </div>
      </div>
    )
  }

  return (
    <div className="kin-page">
      <nav className="kin-nav kin-nav--dark">
        <span className="kin-nav__brand">Kin</span>
        <span style={{ fontSize: 13, color: '#9ca3af' }}>Staff Portal</span>
        <span className="kin-nav__spacer" />
        {overdueCount > 0 && <span className="chip chip--urgent">{overdueCount} overdue</span>}
        <button className="btn btn--sm" style={{ background: 'transparent', border: '1px solid #374151', color: '#9ca3af' }} onClick={signOut}>Sign out</button>
      </nav>

      <div className="kin-content" style={{ height: 'calc(100vh - 56px)' }}>
        {/* Queue */}
        <aside style={{ width: 340, flexShrink: 0, borderRight: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', background: 'var(--color-surface)' }}>
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
              <div key={ticket.id} onClick={() => setSelectedId(ticket.id)} style={{
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
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
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
