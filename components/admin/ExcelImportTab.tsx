'use client'

import { useState, useRef } from 'react'
import { parseExcelFile, validateRows, downloadTemplate } from '@/lib/excel-import'
import type { ImportPreviewRow } from '@/lib/excel-import'

interface Props {
  facilityId: string
}

type Step = 'upload' | 'preview' | 'done'

export function ExcelImportTab({ facilityId }: Props) {
  const [step, setStep] = useState<Step>('upload')
  const [preview, setPreview] = useState<ImportPreviewRow[]>([])
  const [validCount, setValidCount] = useState(0)
  const [errorCount, setErrorCount] = useState(0)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ imported: number; skipped: number; errors: { row_index: number; resident_name: string; error: string }[] } | null>(null)
  const [parseError, setParseError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    setParseError('')
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!['xlsx', 'xls', 'csv'].includes(ext ?? '')) {
      setParseError('Please upload a .xlsx, .xls, or .csv file.')
      return
    }
    try {
      const rows = await parseExcelFile(file)
      if (rows.length === 0) { setParseError('No data rows found in the file.'); return }
      const { preview: p, validCount: v, errorCount: e } = validateRows(rows)
      setPreview(p)
      setValidCount(v)
      setErrorCount(e)
      setStep('preview')
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Failed to parse file.')
    }
  }

  const doImport = async () => {
    setImporting(true)
    try {
      const res = await fetch('/api/import-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: preview.filter((r) => r.status === 'valid') }),
      })
      const data = await res.json()
      setResult(data)
      setStep('done')
    } finally {
      setImporting(false)
    }
  }

  const reset = () => {
    setStep('upload')
    setPreview([])
    setValidCount(0)
    setErrorCount(0)
    setResult(null)
    setParseError('')
    if (fileRef.current) fileRef.current.value = ''
  }

  // ── Upload step ──────────────────────────────────────────────
  if (step === 'upload') return (
    <div style={{ maxWidth: 600 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Import Care Events</h2>
          <p style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
            Upload an Excel or CSV file to populate care events for family members.
            Re-uploading updates existing rows automatically.
          </p>
        </div>
        <button className="btn btn--secondary btn--sm" onClick={downloadTemplate} style={{ flexShrink: 0, marginLeft: 16 }}>
          ⬇ Download template
        </button>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
        onClick={() => fileRef.current?.click()}
        style={{
          border: `2px dashed ${dragOver ? 'var(--color-primary)' : 'var(--color-border)'}`,
          borderRadius: 10,
          padding: '40px 24px',
          textAlign: 'center',
          cursor: 'pointer',
          background: dragOver ? 'var(--color-primary-light)' : 'var(--color-surface)',
          transition: 'all 0.15s',
        }}
      >
        <div style={{ fontSize: 36, marginBottom: 12 }}>📊</div>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Drop your file here or click to browse</div>
        <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>.xlsx, .xls, .csv supported</div>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          style={{ display: 'none' }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
        />
      </div>

      {parseError && (
        <div style={{ marginTop: 12, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, color: '#dc2626', fontSize: 13 }}>
          {parseError}
        </div>
      )}

      <div className="kin-card" style={{ marginTop: 20, fontSize: 13 }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Required columns</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {['resident_name', 'event_type', 'title', 'occurred_at'].map((c) => (
            <code key={c} style={{ background: 'var(--color-bg)', padding: '2px 8px', borderRadius: 4, fontSize: 12 }}>{c}</code>
          ))}
        </div>
        <div style={{ fontWeight: 600, marginTop: 12, marginBottom: 8 }}>Optional columns</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {['detail', 'severity', 'metadata'].map((c) => (
            <code key={c} style={{ background: 'var(--color-bg)', padding: '2px 8px', borderRadius: 4, fontSize: 12 }}>{c}</code>
          ))}
        </div>
        <div style={{ marginTop: 12, color: 'var(--color-text-secondary)' }}>
          <strong>event_type:</strong> meal · medication · activity · vitals · hygiene · incident<br />
          <strong>severity:</strong> info · warning · critical · incident (defaults to info)<br />
          <strong>occurred_at:</strong> e.g. <code>2025-03-11 14:30</code> or <code>03/11/2025 2:30 PM</code>
        </div>
      </div>
    </div>
  )

  // ── Preview step ─────────────────────────────────────────────
  if (step === 'preview') return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Review before importing</h2>
          <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
            <span style={{ color: '#16a34a', fontWeight: 600 }}>✓ {validCount} rows ready</span>
            {errorCount > 0 && <span style={{ color: '#dc2626', fontWeight: 600 }}>✗ {errorCount} rows with errors (will be skipped)</span>}
          </div>
        </div>
        <button className="btn btn--secondary btn--sm" onClick={reset}>← Back</button>
        <button
          className="btn btn--primary"
          disabled={validCount === 0 || importing}
          onClick={doImport}
        >
          {importing ? <span className="spinner" /> : `Import ${validCount} event${validCount !== 1 ? 's' : ''}`}
        </button>
      </div>

      <div style={{ overflowX: 'auto', border: '1px solid var(--color-border)', borderRadius: 8 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}>
              {['Row', 'Resident', 'Type', 'Title', 'Date', 'Severity', 'Status'].map((h) => (
                <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {preview.map((row) => (
              <tr key={row.row_index} style={{
                borderBottom: '1px solid var(--color-border-light)',
                background: row.status === 'error' ? '#fef2f2' : 'transparent',
              }}>
                <td style={{ padding: '7px 12px', color: 'var(--color-text-muted)' }}>{row.row_index}</td>
                <td style={{ padding: '7px 12px', fontWeight: 500 }}>{row.resident_name}</td>
                <td style={{ padding: '7px 12px' }}>{row.event_type}</td>
                <td style={{ padding: '7px 12px', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.title}</td>
                <td style={{ padding: '7px 12px', whiteSpace: 'nowrap' }}>{row.occurred_at}</td>
                <td style={{ padding: '7px 12px' }}>{row.severity_coerced}</td>
                <td style={{ padding: '7px 12px' }}>
                  {row.status === 'valid'
                    ? <span style={{ color: '#16a34a', fontWeight: 600 }}>✓</span>
                    : <span style={{ color: '#dc2626', fontSize: 11 }}>{row.errors.join('; ')}</span>
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )

  // ── Done step ────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 480 }}>
      <div className="kin-card" style={{ textAlign: 'center', padding: 40 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>
          {result && result.imported > 0 ? '✅' : '⚠️'}
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
          {result?.imported} event{result?.imported !== 1 ? 's' : ''} imported
        </h2>
        {result && result.skipped > 0 && (
          <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 8 }}>
            {result.skipped} row{result.skipped !== 1 ? 's' : ''} skipped
          </p>
        )}
        {result && result.errors.length > 0 && (
          <div style={{ marginTop: 12, textAlign: 'left' }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Skipped rows:</div>
            {result.errors.map((e) => (
              <div key={e.row_index} style={{ fontSize: 12, color: '#dc2626', marginBottom: 3 }}>
                Row {e.row_index} — {e.resident_name}: {e.error}
              </div>
            ))}
          </div>
        )}
        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 16 }}>
          Family dashboards will show the new events immediately.
        </p>
        <button className="btn btn--primary" style={{ marginTop: 20 }} onClick={reset}>
          Import another file
        </button>
      </div>
    </div>
  )
}
