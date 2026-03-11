// ================================================================
// Seed planning data — schedule items, appointments, menus
// POST /api/seed-planning
// Requires header: x-webhook-secret: <WEBHOOK_SECRET>
// Safe to run multiple times (uses upsert-style inserts).
// ================================================================

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const FACILITY_ID = 'a1b2c3d4-0001-0001-0001-000000000001'

export async function POST(req: Request) {
  const secret = req.headers.get('x-webhook-secret')
  if (secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = createServiceClient()

  // Fetch real resident IDs
  const { data: residents, error: resErr } = await supabase
    .from('residents')
    .select('id, full_name')
    .eq('facility_id', FACILITY_ID)
    .eq('is_active', true)

  if (resErr || !residents?.length) {
    return NextResponse.json({ error: 'No residents found', detail: resErr?.message }, { status: 400 })
  }

  const r1 = residents[0].id
  const r2 = residents[1]?.id ?? r1
  const r3 = residents[2]?.id ?? r1
  const r4 = residents[3]?.id ?? r1

  // ----------------------------------------------------------------
  // Schedule items (recurring weekly)
  // ----------------------------------------------------------------
  const scheduleItems = [
    // Facility-wide
    { facility_id: FACILITY_ID, resident_id: null, day_of_week: 1, start_time: '09:00', end_time: '09:45', title: 'Morning Stretch & Chair Yoga', category: 'exercise' },
    { facility_id: FACILITY_ID, resident_id: null, day_of_week: 1, start_time: '14:00', end_time: '15:00', title: 'Group Bingo', category: 'social' },
    { facility_id: FACILITY_ID, resident_id: null, day_of_week: 2, start_time: '10:00', end_time: '11:00', title: 'Music & Memory Hour', category: 'activity' },
    { facility_id: FACILITY_ID, resident_id: null, day_of_week: 2, start_time: '15:00', end_time: '16:00', title: 'Arts & Crafts', category: 'activity' },
    { facility_id: FACILITY_ID, resident_id: null, day_of_week: 3, start_time: '09:30', end_time: '10:30', title: 'Walking Club (Garden)', category: 'exercise' },
    { facility_id: FACILITY_ID, resident_id: null, day_of_week: 3, start_time: '14:00', end_time: '15:00', title: 'Movie Afternoon', category: 'social' },
    { facility_id: FACILITY_ID, resident_id: null, day_of_week: 4, start_time: '10:00', end_time: '11:00', title: 'Bible Study / Meditation', category: 'social' },
    { facility_id: FACILITY_ID, resident_id: null, day_of_week: 4, start_time: '15:30', end_time: '16:30', title: 'Happy Hour & Live Music', category: 'social' },
    { facility_id: FACILITY_ID, resident_id: null, day_of_week: 5, start_time: '09:00', end_time: '10:00', title: 'Gentle Yoga', category: 'exercise' },
    { facility_id: FACILITY_ID, resident_id: null, day_of_week: 5, start_time: '14:00', end_time: '15:30', title: 'Family Visiting Hours (Open)', category: 'social' },
    { facility_id: FACILITY_ID, resident_id: null, day_of_week: 6, start_time: '10:00', end_time: '12:00', title: 'Weekend Brunch Social', category: 'social' },
    { facility_id: FACILITY_ID, resident_id: null, day_of_week: 0, start_time: '14:00', end_time: '15:30', title: 'Sunday Worship Service', category: 'social' },
    // Resident-specific therapy/medical
    { facility_id: FACILITY_ID, resident_id: r1, day_of_week: 1, start_time: '11:00', end_time: '11:45', title: 'Physical Therapy (PT)', category: 'therapy', description: 'Lower limb strengthening — post hip surgery recovery' },
    { facility_id: FACILITY_ID, resident_id: r1, day_of_week: 4, start_time: '11:00', end_time: '11:45', title: 'Physical Therapy (PT)', category: 'therapy' },
    { facility_id: FACILITY_ID, resident_id: r2, day_of_week: 2, start_time: '13:00', end_time: '13:30', title: 'Speech Therapy', category: 'therapy', description: 'Swallowing evaluation follow-up' },
    { facility_id: FACILITY_ID, resident_id: r2, day_of_week: 5, start_time: '13:00', end_time: '13:30', title: 'Speech Therapy', category: 'therapy' },
    { facility_id: FACILITY_ID, resident_id: r3, day_of_week: 3, start_time: '11:00', end_time: '11:30', title: 'Occupational Therapy (OT)', category: 'therapy' },
    { facility_id: FACILITY_ID, resident_id: r4, day_of_week: 1, start_time: '16:00', end_time: '16:30', title: 'Medication Review w/ Nurse', category: 'medical' },
  ]

  const { error: schedErr } = await supabase.from('schedule_items').insert(scheduleItems)
  if (schedErr) return NextResponse.json({ error: 'schedule_items insert failed', detail: schedErr.message }, { status: 500 })

  // ----------------------------------------------------------------
  // Appointments (specific dates — centered on current week)
  // ----------------------------------------------------------------
  const today = new Date()
  function daysFromToday(n: number) {
    const d = new Date(today)
    d.setDate(today.getDate() + n)
    return d.toISOString()
  }

  const appointments = [
    { facility_id: FACILITY_ID, resident_id: r1, scheduled_at: daysFromToday(2), title: 'Cardiology Follow-Up', appointment_type: 'specialist', location: 'Sunrise Medical Center, Suite 304', description: 'Annual heart check — bring medication list', status: 'scheduled' },
    { facility_id: FACILITY_ID, resident_id: r1, scheduled_at: daysFromToday(9), title: 'Podiatry Appointment', appointment_type: 'specialist', location: 'On-site clinic, Room 2', status: 'scheduled' },
    { facility_id: FACILITY_ID, resident_id: r2, scheduled_at: daysFromToday(1), title: 'Family Visit — Daughter & Grandchildren', appointment_type: 'family_visit', location: 'Garden Lounge', description: 'Preferred: quiet corner by the window', status: 'scheduled' },
    { facility_id: FACILITY_ID, resident_id: r2, scheduled_at: daysFromToday(5), title: 'Routine Blood Draw', appointment_type: 'checkup', location: 'Nurses station', status: 'scheduled' },
    { facility_id: FACILITY_ID, resident_id: r2, scheduled_at: daysFromToday(14), title: 'Ophthalmology — Eye Exam', appointment_type: 'specialist', location: 'Vision Care Clinic, 2nd Ave', status: 'scheduled' },
    { facility_id: FACILITY_ID, resident_id: r3, scheduled_at: daysFromToday(-2), title: 'Primary Care Checkup', appointment_type: 'checkup', location: 'On-site clinic', status: 'completed' },
    { facility_id: FACILITY_ID, resident_id: r3, scheduled_at: daysFromToday(3), title: 'Dermatology Consultation', appointment_type: 'specialist', location: 'Skin Health Clinic', status: 'scheduled' },
    { facility_id: FACILITY_ID, resident_id: r3, scheduled_at: daysFromToday(10), title: 'Dental Cleaning', appointment_type: 'checkup', location: 'Mobile dental unit — main hall', status: 'scheduled' },
    { facility_id: FACILITY_ID, resident_id: r4, scheduled_at: daysFromToday(0), title: 'Neurologist Visit', appointment_type: 'specialist', location: 'Neurology Clinic, East Wing', description: 'Cognitive assessment — 90 min session', status: 'scheduled' },
    { facility_id: FACILITY_ID, resident_id: r4, scheduled_at: daysFromToday(7), title: 'Family Visit — Son', appointment_type: 'family_visit', location: 'Resident room', status: 'scheduled' },
    { facility_id: FACILITY_ID, resident_id: r4, scheduled_at: daysFromToday(21), title: 'Care Plan Review', appointment_type: 'appointment', location: 'Conference Room A', description: 'Quarterly care plan meeting — family invited', status: 'scheduled' },
  ]

  const { error: apptErr } = await supabase.from('appointments').insert(appointments)
  if (apptErr) return NextResponse.json({ error: 'appointments insert failed', detail: apptErr.message }, { status: 500 })

  // ----------------------------------------------------------------
  // Menus (this week Mon-Sun, facility-wide)
  // ----------------------------------------------------------------
  const monday = new Date(today)
  const dayOfWeek = today.getDay()
  const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  monday.setDate(today.getDate() + diffToMon)
  monday.setHours(0, 0, 0, 0)

  function weekDate(offset: number) {
    const d = new Date(monday)
    d.setDate(monday.getDate() + offset)
    return d.toISOString().slice(0, 10)
  }

  const menus = [
    // Monday
    { facility_id: FACILITY_ID, resident_id: null, date: weekDate(0), meal_type: 'breakfast', title: 'Oatmeal with berries, orange juice, coffee or tea' },
    { facility_id: FACILITY_ID, resident_id: null, date: weekDate(0), meal_type: 'lunch', title: 'Turkey & avocado wrap, tomato soup, fruit cup' },
    { facility_id: FACILITY_ID, resident_id: null, date: weekDate(0), meal_type: 'dinner', title: 'Roast chicken with mashed potatoes & green beans', description: 'Soft diet option available' },
    { facility_id: FACILITY_ID, resident_id: null, date: weekDate(0), meal_type: 'snack', title: 'Yogurt parfait & graham crackers (3 PM)' },
    // Tuesday
    { facility_id: FACILITY_ID, resident_id: null, date: weekDate(1), meal_type: 'breakfast', title: 'Scrambled eggs, whole wheat toast, apple juice' },
    { facility_id: FACILITY_ID, resident_id: null, date: weekDate(1), meal_type: 'lunch', title: 'Grilled cheese & tomato, minestrone soup, pudding' },
    { facility_id: FACILITY_ID, resident_id: null, date: weekDate(1), meal_type: 'dinner', title: 'Baked salmon, brown rice, steamed broccoli', description: 'Heart-healthy option' },
    { facility_id: FACILITY_ID, resident_id: null, date: weekDate(1), meal_type: 'snack', title: 'Cheese & crackers, apple slices (3 PM)' },
    // Wednesday
    { facility_id: FACILITY_ID, resident_id: null, date: weekDate(2), meal_type: 'breakfast', title: 'Pancakes with maple syrup, sausage, cranberry juice' },
    { facility_id: FACILITY_ID, resident_id: null, date: weekDate(2), meal_type: 'lunch', title: 'Chicken Caesar salad, dinner roll, lemon sorbet' },
    { facility_id: FACILITY_ID, resident_id: null, date: weekDate(2), meal_type: 'dinner', title: 'Beef stew with root vegetables & crusty bread', description: 'Slow-cooked, soft texture' },
    { facility_id: FACILITY_ID, resident_id: null, date: weekDate(2), meal_type: 'snack', title: 'Warm cinnamon apples & vanilla ice cream (3 PM)' },
    // Thursday
    { facility_id: FACILITY_ID, resident_id: null, date: weekDate(3), meal_type: 'breakfast', title: 'Yogurt with granola, fresh fruit, coffee or tea' },
    { facility_id: FACILITY_ID, resident_id: null, date: weekDate(3), meal_type: 'lunch', title: 'BLT sandwich, clam chowder, cookie' },
    { facility_id: FACILITY_ID, resident_id: null, date: weekDate(3), meal_type: 'dinner', title: 'Pork tenderloin, roasted potatoes, asparagus' },
    { facility_id: FACILITY_ID, resident_id: null, date: weekDate(3), meal_type: 'snack', title: 'Chips, salsa & guacamole — Happy Hour snack (3:30 PM)' },
    // Friday
    { facility_id: FACILITY_ID, resident_id: null, date: weekDate(4), meal_type: 'breakfast', title: 'French toast, bacon, orange juice' },
    { facility_id: FACILITY_ID, resident_id: null, date: weekDate(4), meal_type: 'lunch', title: 'Fish tacos, coleslaw, lime rice' },
    { facility_id: FACILITY_ID, resident_id: null, date: weekDate(4), meal_type: 'dinner', title: 'Pasta primavera with garlic bread, garden salad', description: 'Vegetarian option' },
    { facility_id: FACILITY_ID, resident_id: null, date: weekDate(4), meal_type: 'snack', title: 'Popcorn & lemonade (2 PM)' },
    // Saturday
    { facility_id: FACILITY_ID, resident_id: null, date: weekDate(5), meal_type: 'breakfast', title: 'Weekend Brunch: eggs to order, pastries, fresh fruit' },
    { facility_id: FACILITY_ID, resident_id: null, date: weekDate(5), meal_type: 'lunch', title: 'Deli sandwich bar (choice of fillings), potato salad' },
    { facility_id: FACILITY_ID, resident_id: null, date: weekDate(5), meal_type: 'dinner', title: 'BBQ ribs with corn on the cob & baked beans' },
    { facility_id: FACILITY_ID, resident_id: null, date: weekDate(5), meal_type: 'snack', title: 'Ice cream sundae bar (2:30 PM)' },
    // Sunday
    { facility_id: FACILITY_ID, resident_id: null, date: weekDate(6), meal_type: 'breakfast', title: 'Bagels & lox, cream cheese, fruit salad, OJ' },
    { facility_id: FACILITY_ID, resident_id: null, date: weekDate(6), meal_type: 'lunch', title: 'Sunday Roast: beef, Yorkshire pudding, roasted veg' },
    { facility_id: FACILITY_ID, resident_id: null, date: weekDate(6), meal_type: 'dinner', title: 'Chicken noodle soup, grilled cheese, Jell-O' },
    { facility_id: FACILITY_ID, resident_id: null, date: weekDate(6), meal_type: 'snack', title: 'Cookies & hot cocoa (3 PM)' },
    // Resident-specific dietary items
    { facility_id: FACILITY_ID, resident_id: r1, date: weekDate(0), meal_type: 'lunch', title: 'Low-sodium turkey wrap (heart diet)', description: 'No added salt, reduced sodium broth' },
    { facility_id: FACILITY_ID, resident_id: r2, date: weekDate(1), meal_type: 'dinner', title: 'Pureed salmon with smooth mashed potato', description: 'IDDSI Level 4 — per speech therapy' },
    { facility_id: FACILITY_ID, resident_id: r3, date: weekDate(2), meal_type: 'breakfast', title: 'Diabetic breakfast: egg whites, whole grain toast, berries', description: 'Carb count: ~30g' },
  ]

  const { error: menuErr } = await supabase.from('menus').insert(menus)
  if (menuErr) return NextResponse.json({ error: 'menus insert failed', detail: menuErr.message }, { status: 500 })

  return NextResponse.json({
    ok: true,
    inserted: {
      schedule_items: scheduleItems.length,
      appointments: appointments.length,
      menus: menus.length,
    },
    residents: residents.map(r => ({ id: r.id, name: r.full_name })),
  })
}
