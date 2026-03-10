'use client'

import { useState } from 'react'
import { PRIORITY_ROUTING } from '@/types'
import type { TicketCategory, CareEvent } from '@/types'

interface EscalateModalProps {
  residentId: string
  residentName: string
  facilityId: string
  createdBy: string
  linkedEvent?: CareEvent
  onClose: () => void
  onSuccess: () => void
}

const CATEGORIES: TicketCategory[] = [
  'question',
  'concern',
  'complaint',
  'care_plan',
  'administrative',
  'compliment',
]

export function EscalateModal({
  residentId,
  residentName,
  facilityId,
  createdBy,
  linkedEvent,
  onClose,
  onSuccess,
}: EscalateModalProps) {
  const [step, setStep] = useState<1 | 2>(1)
  const [category, setCategory] = useState<TicketCategory | null>(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const selectedRule = category ? PRIORITY_ROUTING[category] : null

  const handleSubmit = async () => {
    if (!category || !title.trim() || !body.trim()) return
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          facility_id:     facilityId,
          resident_id:     residentId,
          created_by:      createdBy,
          linked_event_id: linkedEvent?.id,
          title:           title.trim(),
          body:            body.trim(),
          category,
        }),
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error ?? 'Failed to submit')
      }
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal">
        {/* Header */}
        <div className="modal__header">
          <div>
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 2 }}>
              {residentName}
              {linkedEvent && (
                <span style={{ marginLeft: 8 }}>· re: {linkedEvent.title}</span>
              )}
            </div>
            <h2 className="modal__title">
              {step === 1 ? 'What would you like to do?' : 'Write your message'}
            </h2>
          </div>
          <button
            className="btn btn--ghost btn--sm"
            onClick={onClose}
            style={{ fontSize: 18, padding: '4px 8px' }}
          >
            ×
          </button>
        </div>

        {/* Step indicator */}
        <div style={{ padding: '8px 24px 0', display: 'flex', gap: 6 }}>
          {[1, 2].map((s) => (
            <div key={s} style={{
              height: 3,
              flex: 1,
              borderRadius: 2,
              background: s <= step ? 'var(--color-primary)' : 'var(--color-border)',
              transition: 'background 200ms',
            }} />
          ))}
        </div>

        {/* Body */}
        <div className="modal__body">
          {step === 1 ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {CATEGORIES.map((cat) => {
                const rule = PRIORITY_ROUTING[cat]
                const isSelected = category === cat
                return (
                  <button
                    key={cat}
                    onClick={() => setCategory(cat)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      gap: 4,
                      padding: '14px 16px',
                      borderRadius: 'var(--radius-md)',
                      border: `2px solid ${isSelected ? 'var(--color-primary)' : 'var(--color-border)'}`,
                      background: isSelected ? 'var(--color-primary-light)' : 'var(--color-surface)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'border-color 120ms, background 120ms',
                    }}
                  >
                    <span style={{ fontSize: 22 }}>{rule.icon}</span>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{rule.label}</span>
                    <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
                      {rule.description}
                    </span>
                  </button>
                )
              })}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Routing info */}
              {selectedRule && (
                <div style={{
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--color-primary-light)',
                  border: '1px solid #bfdbfe',
                  fontSize: 12,
                  color: 'var(--color-primary)',
                  display: 'flex',
                  gap: 12,
                }}>
                  <span>
                    <strong>Routes to:</strong>{' '}
                    {selectedRule.routes_to.charAt(0).toUpperCase() + selectedRule.routes_to.slice(1)}
                  </span>
                  <span>·</span>
                  <span>
                    <strong>Response within:</strong> {selectedRule.sla_hours}h
                  </span>
                  <span>·</span>
                  <span>
                    <strong>Priority:</strong> {selectedRule.priority}
                  </span>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Subject</label>
                <input
                  className="form-input"
                  placeholder="Brief description of your question or concern"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={120}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Message</label>
                <textarea
                  className="form-textarea"
                  placeholder="Please provide as much detail as possible…"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={5}
                />
              </div>

              {error && (
                <div style={{ color: 'var(--color-danger)', fontSize: 13 }}>{error}</div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal__footer">
          {step === 1 ? (
            <>
              <button className="btn btn--secondary" onClick={onClose}>Cancel</button>
              <button
                className="btn btn--primary"
                disabled={!category}
                onClick={() => setStep(2)}
              >
                Continue →
              </button>
            </>
          ) : (
            <>
              <button className="btn btn--secondary" onClick={() => setStep(1)}>← Back</button>
              <button
                className="btn btn--primary"
                disabled={submitting || !title.trim() || !body.trim()}
                onClick={handleSubmit}
              >
                {submitting ? <span className="spinner" /> : 'Send message'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
