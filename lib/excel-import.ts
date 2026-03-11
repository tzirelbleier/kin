// ================================================================
// Idene — Excel import parsing + validation (pure, browser-safe)
// ================================================================

import * as XLSX from 'xlsx'

export type EventType = 'meal' | 'medication' | 'activity' | 'vitals' | 'hygiene' | 'incident'
export type Severity = 'info' | 'warning' | 'critical' | 'incident'

export interface ExcelImportRow {
  resident_name: string
  event_type: string
  title: string
  detail: string
  occurred_at: string
  severity: string
  metadata: string
}

export interface ImportPreviewRow extends ExcelImportRow {
  row_index: number
  status: 'valid' | 'error'
  errors: string[]
  occurred_at_iso: string // normalised ISO string
  severity_coerced: Severity
}

const VALID_EVENT_TYPES: EventType[] = ['meal', 'medication', 'activity', 'vitals', 'hygiene', 'incident']
const VALID_SEVERITIES: Severity[] = ['info', 'warning', 'critical', 'incident']
const REQUIRED_HEADERS = ['resident_name', 'event_type', 'title', 'occurred_at']

// ----------------------------------------------------------------
// parseExcelFile — workbook → raw rows
// ----------------------------------------------------------------
export function parseExcelFile(file: File): Promise<ExcelImportRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array', cellDates: true })
        const sheet = wb.Sheets[wb.SheetNames[0]]
        const raw: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, {
          raw: false,
          defval: '',
        })
        const rows = raw.map((r) => {
          const norm: Record<string, string> = {}
          Object.entries(r).forEach(([k, v]) => {
            norm[k.toLowerCase().trim()] = String(v ?? '').trim()
          })
          return {
            resident_name: norm['resident_name'] ?? '',
            event_type:    norm['event_type'] ?? '',
            title:         norm['title'] ?? '',
            detail:        norm['detail'] ?? '',
            occurred_at:   norm['occurred_at'] ?? '',
            severity:      norm['severity'] ?? '',
            metadata:      norm['metadata'] ?? '',
          } as ExcelImportRow
        }).filter((r) => r.resident_name || r.title) // skip fully empty rows
        resolve(rows)
      } catch (err) {
        reject(new Error('Could not parse file. Make sure it is a valid .xlsx or .csv file.'))
      }
    }
    reader.onerror = () => reject(new Error('Failed to read file.'))
    reader.readAsArrayBuffer(file)
  })
}

// ----------------------------------------------------------------
// checkHeaders — validate required columns exist
// ----------------------------------------------------------------
export function checkHeaders(rows: ExcelImportRow[]): string[] {
  if (rows.length === 0) return []
  const first = rows[0]
  const keys = Object.keys(first).map((k) => k.toLowerCase().trim())
  return REQUIRED_HEADERS.filter((h) => !keys.includes(h))
}

// ----------------------------------------------------------------
// validateRows — validate + normalise each row
// ----------------------------------------------------------------
export function validateRows(rows: ExcelImportRow[]): {
  preview: ImportPreviewRow[]
  validCount: number
  errorCount: number
} {
  const preview: ImportPreviewRow[] = rows.map((row, i) => {
    const errors: string[] = []

    if (!row.resident_name.trim()) errors.push('resident_name is required')
    if (!row.title.trim()) errors.push('title is required')

    // event_type
    const et = row.event_type.toLowerCase().trim() as EventType
    if (!VALID_EVENT_TYPES.includes(et)) {
      errors.push(`event_type "${row.event_type}" must be one of: ${VALID_EVENT_TYPES.join(', ')}`)
    }

    // occurred_at → ISO string
    let occurred_at_iso = ''
    if (!row.occurred_at.trim()) {
      errors.push('occurred_at is required')
    } else {
      const d = new Date(row.occurred_at)
      if (isNaN(d.getTime())) {
        errors.push(`occurred_at "${row.occurred_at}" is not a valid date. Use YYYY-MM-DD HH:MM`)
      } else {
        occurred_at_iso = d.toISOString()
      }
    }

    // severity — soft coerce invalid values to 'info'
    const sev = row.severity.toLowerCase().trim() as Severity
    const severity_coerced: Severity = VALID_SEVERITIES.includes(sev) ? sev : 'info'

    return {
      ...row,
      row_index: i + 2, // 1-based + header row
      status: errors.length === 0 ? 'valid' : 'error',
      errors,
      occurred_at_iso,
      severity_coerced,
    }
  })

  return {
    preview,
    validCount: preview.filter((r) => r.status === 'valid').length,
    errorCount: preview.filter((r) => r.status === 'error').length,
  }
}

// ----------------------------------------------------------------
// downloadTemplate — generate and save a template .xlsx
// ----------------------------------------------------------------
export function downloadTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([
    ['resident_name', 'event_type', 'title', 'detail', 'occurred_at', 'severity'],
    ['Eleanor Whitmore', 'meal', 'Lunch — ate well', 'Finished 90% of her lunch, good appetite.', '2025-03-11 12:30', 'info'],
    ['Eleanor Whitmore', 'medication', 'Morning meds administered', 'All medications taken without issue.', '2025-03-11 08:00', 'info'],
    ['Harold Jennings', 'activity', 'Group exercise session', 'Participated actively for 20 minutes.', '2025-03-11 10:00', 'info'],
    ['Harold Jennings', 'vitals', 'Vitals check', 'BP 128/82, HR 74, Temp 98.6°F', '2025-03-11 09:00', 'info'],
    ['Eleanor Whitmore', 'incident', 'Minor fall in hallway', 'Resident slipped near room 104A. No injury. Nurse notified.', '2025-03-11 15:45', 'incident'],
  ])
  // Set column widths
  ws['!cols'] = [{ wch: 20 }, { wch: 14 }, { wch: 30 }, { wch: 45 }, { wch: 22 }, { wch: 12 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Care Events')
  XLSX.writeFile(wb, 'idene-care-events-template.xlsx')
}
