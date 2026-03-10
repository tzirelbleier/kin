'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@/lib/supabase'

interface TicketBadgeProps {
  residentId: string
  familyProfileId: string
}

export function TicketBadge({ residentId, familyProfileId }: TicketBadgeProps) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    const supabase = createBrowserClient()

    const fetchCount = async () => {
      const { count: openCount } = await supabase
        .from('tickets')
        .select('id', { count: 'exact', head: true })
        .eq('resident_id', residentId)
        .eq('created_by', familyProfileId)
        .in('status', ['open', 'assigned', 'in_progress', 'pending_family'])
      setCount(openCount ?? 0)
    }

    fetchCount()

    const channel = supabase
      .channel(`ticket-badge-${residentId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tickets',
        filter: `resident_id=eq.${residentId}`,
      }, fetchCount)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [residentId, familyProfileId])

  if (count === 0) return null

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 18,
      height: 18,
      padding: '0 5px',
      borderRadius: 9,
      background: '#2563eb',
      color: '#fff',
      fontSize: 11,
      fontWeight: 700,
      lineHeight: 1,
    }}>
      {count > 99 ? '99+' : count}
    </span>
  )
}
