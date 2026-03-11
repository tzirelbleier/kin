// ============================================================
// Idene — Type definitions + routing rules
// Single source of truth. Import from here everywhere.
// ============================================================

export type UserRole = 'family' | 'staff' | 'nurse' | 'admin' | 'director'

export type TicketCategory =
  | 'question'
  | 'concern'
  | 'complaint'
  | 'care_plan'
  | 'administrative'
  | 'compliment'
  | 'incident'

export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent'

export type TicketStatus =
  | 'open'
  | 'assigned'
  | 'in_progress'
  | 'pending_family'
  | 'resolved'
  | 'closed'

export type EventSeverity = 'info' | 'warning' | 'critical' | 'incident'

export type EventSource = 'pointclickcare' | 'tabulapro' | 'matrixcare' | 'staff'

// ---------------------------------------------------------------
// Priority Routing Table — change here, updates everywhere
// ---------------------------------------------------------------
export interface RoutingRule {
  label: string
  icon: string
  description: string
  priority: TicketPriority
  routes_to: UserRole
  sla_hours: number
}

export const PRIORITY_ROUTING: Record<TicketCategory, RoutingRule> = {
  question: {
    label: 'Question',
    icon: '❓',
    description: 'General questions about care or daily activities',
    priority: 'normal',
    routes_to: 'staff',
    sla_hours: 24,
  },
  concern: {
    label: 'Concern',
    icon: '⚠️',
    description: 'Something that needs attention or follow-up',
    priority: 'high',
    routes_to: 'nurse',
    sla_hours: 12,
  },
  complaint: {
    label: 'Complaint',
    icon: '🚨',
    description: 'A formal complaint requiring director review',
    priority: 'high',
    routes_to: 'director',
    sla_hours: 8,
  },
  care_plan: {
    label: 'Care Plan',
    icon: '📋',
    description: 'Questions or changes related to the care plan',
    priority: 'high',
    routes_to: 'nurse',
    sla_hours: 12,
  },
  administrative: {
    label: 'Administrative',
    icon: '📄',
    description: 'Billing, forms, contracts, or admin tasks',
    priority: 'low',
    routes_to: 'admin',
    sla_hours: 48,
  },
  compliment: {
    label: 'Compliment',
    icon: '⭐',
    description: 'Positive feedback for the care team',
    priority: 'low',
    routes_to: 'staff',
    sla_hours: 72,
  },
  incident: {
    label: 'Incident',
    icon: '🚨',
    description: 'Auto-created from EHR incident event',
    priority: 'urgent',
    routes_to: 'nurse',
    sla_hours: 4,
  },
}

// ---------------------------------------------------------------
// Database row types
// ---------------------------------------------------------------
export interface Facility {
  id: string
  name: string
  slug: string
  address: string | null
  phone: string | null
  created_at: string
}

export interface Profile {
  id: string
  facility_id: string
  email: string
  full_name: string
  role: UserRole
  avatar_url: string | null
  created_at: string
  is_active?: boolean
}

export interface Resident {
  id: string
  facility_id: string
  full_name: string
  room_number: string | null
  photo_url: string | null
  date_of_birth: string | null
  admission_date: string | null
  pcc_resident_id: string | null
  tabula_resident_id: string | null
  is_active: boolean
  created_at: string
}

export interface FamilyResident {
  id: string
  profile_id: string
  resident_id: string
  relationship: string | null
  is_primary_contact: boolean
  created_at: string
}

export interface CareEvent {
  id: string
  facility_id: string
  resident_id: string
  source: EventSource
  source_record_id: string
  event_type: string
  title: string
  detail: string | null
  occurred_at: string
  severity: EventSeverity
  metadata: Record<string, unknown> | null
  created_at: string
}

export interface Ticket {
  id: string
  facility_id: string
  resident_id: string
  created_by: string
  assigned_to: string | null
  linked_event_id: string | null
  title: string
  body: string
  category: TicketCategory
  priority: TicketPriority
  status: TicketStatus
  due_by: string | null
  first_response_at: string | null
  resolved_at: string | null
  resolution_note: string | null
  created_at: string
  updated_at: string
  // Joined fields
  resident?: Resident
  creator?: Profile
  assignee?: Profile
  messages?: TicketMessage[]
}

export interface TicketMessage {
  id: string
  ticket_id: string
  author_id: string
  body: string
  is_internal: boolean
  created_at: string
  author?: Profile
}

export interface AuditLog {
  id: string
  facility_id: string
  actor_id: string | null
  action: string
  entity_type: string
  entity_id: string | null
  before_state: Record<string, unknown> | null
  after_state: Record<string, unknown> | null
  ip_address: string | null
  created_at: string
  actor?: Profile
}

export interface NotificationPreference {
  id: string
  profile_id: string
  event_type: string
  email_enabled: boolean
  sms_enabled: boolean
  push_enabled: boolean
}

// ---------------------------------------------------------------
// API request/response types
// ---------------------------------------------------------------
export interface WebhookEventPayload {
  source: EventSource
  facility_slug: string
  events: {
    external_id: string
    resident_external_id: string
    event_type: string
    title: string
    detail?: string
    occurred_at: string
    severity: EventSeverity
    metadata?: Record<string, unknown>
  }[]
}

export interface CreateTicketBody {
  resident_id: string
  linked_event_id?: string
  title: string
  body: string
  category: TicketCategory
}

export interface PatchTicketBody {
  status?: TicketStatus
  priority?: TicketPriority
  assigned_to?: string
  resolution_note?: string
}

export interface CreateMessageBody {
  ticket_id: string
  body: string
  is_internal?: boolean
}

// ---------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------
export function getSlaLabel(hours: number): string {
  if (hours < 24) return `${hours}h`
  return `${Math.round(hours / 24)}d`
}

export function isOverdue(due_by: string | null): boolean {
  if (!due_by) return false
  return new Date(due_by) < new Date()
}

export function getRemainingHours(due_by: string | null): number | null {
  if (!due_by) return null
  const diff = new Date(due_by).getTime() - Date.now()
  return Math.round(diff / (1000 * 60 * 60))
}

export const STATUS_LABELS: Record<TicketStatus, string> = {
  open: 'Open',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  pending_family: 'Pending Family',
  resolved: 'Resolved',
  closed: 'Closed',
}

export const PRIORITY_COLORS: Record<TicketPriority, string> = {
  urgent: '#ef4444',
  high: '#f97316',
  normal: '#3b82f6',
  low: '#6b7280',
}
