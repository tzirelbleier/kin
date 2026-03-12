import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://bjoaeeeirjtyledzrhcm.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqb2FlZWVpcmp0eWxlZHpyaGNtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzE2NjYyOSwiZXhwIjoyMDg4NzQyNjI5fQ.aKjFBvl0T7PwbUBu1s9-yJUWWln_4Z_UsQxbzH-D9bQ'
)

const FACILITY_ID = 'a1b2c3d4-0001-0001-0001-000000000001'

const { data: residents, error: resErr } = await supabase
  .from('residents')
  .select('id, full_name')
  .eq('facility_id', FACILITY_ID)
  .eq('is_active', true)

if (resErr || !residents?.length) {
  console.error('No residents:', resErr?.message)
  process.exit(1)
}
console.log('Residents:', residents.map(r => r.full_name))

const r1 = residents[0].id
const r2 = residents[1]?.id ?? r1
const r3 = residents[2]?.id ?? r1
const r4 = residents[3]?.id ?? r1

// ── Schedule items ──────────────────────────────────────────────
const scheduleItems = [
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
  { facility_id: FACILITY_ID, resident_id: r1, day_of_week: 1, start_time: '11:00', end_time: '11:45', title: 'Physical Therapy (PT)', category: 'therapy', description: 'Lower limb strengthening' },
  { facility_id: FACILITY_ID, resident_id: r1, day_of_week: 4, start_time: '11:00', end_time: '11:45', title: 'Physical Therapy (PT)', category: 'therapy' },
  { facility_id: FACILITY_ID, resident_id: r2, day_of_week: 2, start_time: '13:00', end_time: '13:30', title: 'Speech Therapy', category: 'therapy', description: 'Swallowing evaluation follow-up' },
  { facility_id: FACILITY_ID, resident_id: r2, day_of_week: 5, start_time: '13:00', end_time: '13:30', title: 'Speech Therapy', category: 'therapy' },
  { facility_id: FACILITY_ID, resident_id: r3, day_of_week: 3, start_time: '11:00', end_time: '11:30', title: 'Occupational Therapy (OT)', category: 'therapy' },
  { facility_id: FACILITY_ID, resident_id: r4, day_of_week: 1, start_time: '16:00', end_time: '16:30', title: 'Medication Review w/ Nurse', category: 'medical' },
]

const { error: schedErr } = await supabase.from('schedule_items').insert(scheduleItems)
if (schedErr) { console.error('schedule error:', schedErr.message); process.exit(1) }
console.log('schedule_items: inserted', scheduleItems.length)

// ── Appointments ────────────────────────────────────────────────
const today = new Date()
function daysFromToday(n) {
  const d = new Date(today); d.setDate(today.getDate() + n); return d.toISOString()
}

const appointments = [
  { facility_id: FACILITY_ID, resident_id: r1, scheduled_at: daysFromToday(2),  title: 'Cardiology Follow-Up', appointment_type: 'specialist', location: 'Sunrise Medical Center, Suite 304', description: 'Annual heart check — bring medication list', status: 'scheduled' },
  { facility_id: FACILITY_ID, resident_id: r1, scheduled_at: daysFromToday(9),  title: 'Podiatry Appointment', appointment_type: 'specialist', location: 'On-site clinic, Room 2', status: 'scheduled' },
  { facility_id: FACILITY_ID, resident_id: r2, scheduled_at: daysFromToday(1),  title: 'Family Visit — Daughter & Grandchildren', appointment_type: 'family_visit', location: 'Garden Lounge', status: 'scheduled' },
  { facility_id: FACILITY_ID, resident_id: r2, scheduled_at: daysFromToday(5),  title: 'Routine Blood Draw', appointment_type: 'checkup', location: 'Nurses station', status: 'scheduled' },
  { facility_id: FACILITY_ID, resident_id: r2, scheduled_at: daysFromToday(14), title: 'Ophthalmology — Eye Exam', appointment_type: 'specialist', location: 'Vision Care Clinic', status: 'scheduled' },
  { facility_id: FACILITY_ID, resident_id: r3, scheduled_at: daysFromToday(-2), title: 'Primary Care Checkup', appointment_type: 'checkup', location: 'On-site clinic', status: 'completed' },
  { facility_id: FACILITY_ID, resident_id: r3, scheduled_at: daysFromToday(3),  title: 'Dermatology Consultation', appointment_type: 'specialist', location: 'Skin Health Clinic', status: 'scheduled' },
  { facility_id: FACILITY_ID, resident_id: r3, scheduled_at: daysFromToday(10), title: 'Dental Cleaning', appointment_type: 'checkup', location: 'Mobile dental unit — main hall', status: 'scheduled' },
  { facility_id: FACILITY_ID, resident_id: r4, scheduled_at: daysFromToday(0),  title: 'Neurologist Visit', appointment_type: 'specialist', location: 'Neurology Clinic, East Wing', description: 'Cognitive assessment — 90 min', status: 'scheduled' },
  { facility_id: FACILITY_ID, resident_id: r4, scheduled_at: daysFromToday(7),  title: 'Family Visit — Son', appointment_type: 'family_visit', location: 'Resident room', status: 'scheduled' },
  { facility_id: FACILITY_ID, resident_id: r4, scheduled_at: daysFromToday(21), title: 'Care Plan Review', appointment_type: 'appointment', location: 'Conference Room A', description: 'Quarterly meeting — family invited', status: 'scheduled' },
]

const { error: apptErr } = await supabase.from('appointments').insert(appointments)
if (apptErr) { console.error('appointments error:', apptErr.message); process.exit(1) }
console.log('appointments: inserted', appointments.length)

// ── Menus ───────────────────────────────────────────────────────
const now = new Date()
const dow = now.getDay()
const mon = new Date(now)
mon.setHours(0, 0, 0, 0)
mon.setDate(now.getDate() + (dow === 0 ? -6 : 1 - dow))
function wd(n) { const d = new Date(mon); d.setDate(mon.getDate() + n); return d.toISOString().slice(0, 10) }

const menus = [
  // This week
  { facility_id: FACILITY_ID, resident_id: null, date: wd(0),  meal_type: 'breakfast', title: 'Oatmeal with berries, orange juice, coffee or tea' },
  { facility_id: FACILITY_ID, resident_id: null, date: wd(0),  meal_type: 'lunch',     title: 'Turkey & avocado wrap, tomato soup, fruit cup' },
  { facility_id: FACILITY_ID, resident_id: null, date: wd(0),  meal_type: 'dinner',    title: 'Roast chicken with mashed potatoes & green beans', description: 'Soft diet option available' },
  { facility_id: FACILITY_ID, resident_id: null, date: wd(0),  meal_type: 'snack',     title: 'Yogurt parfait & graham crackers (3 PM)' },
  { facility_id: FACILITY_ID, resident_id: null, date: wd(1),  meal_type: 'breakfast', title: 'Scrambled eggs, whole wheat toast, apple juice' },
  { facility_id: FACILITY_ID, resident_id: null, date: wd(1),  meal_type: 'lunch',     title: 'Grilled cheese & tomato, minestrone soup, pudding' },
  { facility_id: FACILITY_ID, resident_id: null, date: wd(1),  meal_type: 'dinner',    title: 'Baked salmon, brown rice, steamed broccoli', description: 'Heart-healthy option' },
  { facility_id: FACILITY_ID, resident_id: null, date: wd(1),  meal_type: 'snack',     title: 'Cheese & crackers, apple slices (3 PM)' },
  { facility_id: FACILITY_ID, resident_id: null, date: wd(2),  meal_type: 'breakfast', title: 'Pancakes with maple syrup, sausage, cranberry juice' },
  { facility_id: FACILITY_ID, resident_id: null, date: wd(2),  meal_type: 'lunch',     title: 'Chicken Caesar salad, dinner roll, lemon sorbet' },
  { facility_id: FACILITY_ID, resident_id: null, date: wd(2),  meal_type: 'dinner',    title: 'Beef stew with root vegetables & crusty bread', description: 'Slow-cooked, soft texture' },
  { facility_id: FACILITY_ID, resident_id: null, date: wd(2),  meal_type: 'snack',     title: 'Warm cinnamon apples & vanilla ice cream (3 PM)' },
  { facility_id: FACILITY_ID, resident_id: null, date: wd(3),  meal_type: 'breakfast', title: 'Yogurt with granola, fresh fruit, coffee or tea' },
  { facility_id: FACILITY_ID, resident_id: null, date: wd(3),  meal_type: 'lunch',     title: 'BLT sandwich, clam chowder, cookie' },
  { facility_id: FACILITY_ID, resident_id: null, date: wd(3),  meal_type: 'dinner',    title: 'Pork tenderloin, roasted potatoes, asparagus' },
  { facility_id: FACILITY_ID, resident_id: null, date: wd(3),  meal_type: 'snack',     title: 'Chips, salsa & guacamole — Happy Hour snack (3:30 PM)' },
  { facility_id: FACILITY_ID, resident_id: null, date: wd(4),  meal_type: 'breakfast', title: 'French toast, bacon, orange juice' },
  { facility_id: FACILITY_ID, resident_id: null, date: wd(4),  meal_type: 'lunch',     title: 'Fish tacos, coleslaw, lime rice' },
  { facility_id: FACILITY_ID, resident_id: null, date: wd(4),  meal_type: 'dinner',    title: 'Pasta primavera with garlic bread, garden salad', description: 'Vegetarian option' },
  { facility_id: FACILITY_ID, resident_id: null, date: wd(4),  meal_type: 'snack',     title: 'Popcorn & lemonade (2 PM)' },
  { facility_id: FACILITY_ID, resident_id: null, date: wd(5),  meal_type: 'breakfast', title: 'Weekend Brunch: eggs to order, pastries, fresh fruit' },
  { facility_id: FACILITY_ID, resident_id: null, date: wd(5),  meal_type: 'lunch',     title: 'Deli sandwich bar, potato salad' },
  { facility_id: FACILITY_ID, resident_id: null, date: wd(5),  meal_type: 'dinner',    title: 'BBQ ribs with corn on the cob & baked beans' },
  { facility_id: FACILITY_ID, resident_id: null, date: wd(5),  meal_type: 'snack',     title: 'Ice cream sundae bar (2:30 PM)' },
  { facility_id: FACILITY_ID, resident_id: null, date: wd(6),  meal_type: 'breakfast', title: 'Bagels & lox, cream cheese, fruit salad, OJ' },
  { facility_id: FACILITY_ID, resident_id: null, date: wd(6),  meal_type: 'lunch',     title: 'Sunday Roast: beef, Yorkshire pudding, roasted veg' },
  { facility_id: FACILITY_ID, resident_id: null, date: wd(6),  meal_type: 'dinner',    title: 'Chicken noodle soup, grilled cheese, Jell-O' },
  { facility_id: FACILITY_ID, resident_id: null, date: wd(6),  meal_type: 'snack',     title: 'Cookies & hot cocoa (3 PM)' },
  // Next week
  { facility_id: FACILITY_ID, resident_id: null, date: wd(7),  meal_type: 'breakfast', title: 'Avocado toast with poached egg, grapefruit juice' },
  { facility_id: FACILITY_ID, resident_id: null, date: wd(7),  meal_type: 'lunch',     title: 'Lentil soup, whole grain roll, mixed greens salad' },
  { facility_id: FACILITY_ID, resident_id: null, date: wd(7),  meal_type: 'dinner',    title: 'Herb-roasted pork loin, sweet potato mash, Brussels sprouts' },
  { facility_id: FACILITY_ID, resident_id: null, date: wd(7),  meal_type: 'snack',     title: 'Trail mix & orange slices (3 PM)' },
  { facility_id: FACILITY_ID, resident_id: null, date: wd(8),  meal_type: 'breakfast', title: 'Banana pancakes, turkey sausage, apple cider' },
  { facility_id: FACILITY_ID, resident_id: null, date: wd(8),  meal_type: 'lunch',     title: 'Caprese panini, tomato bisque, lemon panna cotta' },
  { facility_id: FACILITY_ID, resident_id: null, date: wd(8),  meal_type: 'dinner',    title: 'Shrimp stir-fry with jasmine rice & bok choy', description: 'Shellfish allergen — alternative: tofu' },
  { facility_id: FACILITY_ID, resident_id: null, date: wd(8),  meal_type: 'snack',     title: 'Hummus & veggie sticks (3 PM)' },
  { facility_id: FACILITY_ID, resident_id: null, date: wd(9),  meal_type: 'breakfast', title: 'Belgian waffle, fresh strawberries, whipped cream' },
  { facility_id: FACILITY_ID, resident_id: null, date: wd(9),  meal_type: 'lunch',     title: 'Pulled chicken sandwich, coleslaw, pickle chips' },
  { facility_id: FACILITY_ID, resident_id: null, date: wd(9),  meal_type: 'dinner',    title: 'Lamb chops with mint jelly, roasted carrots & couscous' },
  { facility_id: FACILITY_ID, resident_id: null, date: wd(9),  meal_type: 'snack',     title: 'Rice pudding with raisins (3 PM)' },
  { facility_id: FACILITY_ID, resident_id: null, date: wd(10), meal_type: 'breakfast', title: 'Smoked salmon bagel, cream cheese, capers' },
  { facility_id: FACILITY_ID, resident_id: null, date: wd(10), meal_type: 'lunch',     title: 'Greek salad with grilled chicken, pita & tzatziki' },
  { facility_id: FACILITY_ID, resident_id: null, date: wd(10), meal_type: 'dinner',    title: 'Beef meatballs, marinara, spaghetti, garlic bread' },
  { facility_id: FACILITY_ID, resident_id: null, date: wd(10), meal_type: 'snack',     title: 'Chips & salsa — Happy Hour (3:30 PM)' },
  { facility_id: FACILITY_ID, resident_id: null, date: wd(11), meal_type: 'breakfast', title: 'Veggie omelette, rye toast, tomato juice' },
  { facility_id: FACILITY_ID, resident_id: null, date: wd(11), meal_type: 'lunch',     title: 'Lobster bisque, sourdough, Caesar side salad' },
  { facility_id: FACILITY_ID, resident_id: null, date: wd(11), meal_type: 'dinner',    title: 'Roast turkey breast, stuffing, cranberry sauce, green beans' },
  { facility_id: FACILITY_ID, resident_id: null, date: wd(11), meal_type: 'snack',     title: 'Pumpkin pie slice & decaf coffee (2:30 PM)' },
  { facility_id: FACILITY_ID, resident_id: null, date: wd(12), meal_type: 'breakfast', title: 'Weekend Brunch: French omelette station, croissants' },
  { facility_id: FACILITY_ID, resident_id: null, date: wd(12), meal_type: 'lunch',     title: 'Build-your-own burger bar, sweet potato fries' },
  { facility_id: FACILITY_ID, resident_id: null, date: wd(12), meal_type: 'dinner',    title: 'Pan-seared tilapia, lemon butter, wild rice & asparagus' },
  { facility_id: FACILITY_ID, resident_id: null, date: wd(12), meal_type: 'snack',     title: 'Brownie sundae (2:30 PM)' },
  { facility_id: FACILITY_ID, resident_id: null, date: wd(13), meal_type: 'breakfast', title: 'Eggs Benedict, fruit cup, mimosa (non-alcoholic)' },
  { facility_id: FACILITY_ID, resident_id: null, date: wd(13), meal_type: 'lunch',     title: 'Sunday Roast: prime rib, roasted potatoes, Yorkshire pudding' },
  { facility_id: FACILITY_ID, resident_id: null, date: wd(13), meal_type: 'dinner',    title: 'Vegetable minestrone, crusty bread, tiramisu' },
  { facility_id: FACILITY_ID, resident_id: null, date: wd(13), meal_type: 'snack',     title: 'Cookies & herbal tea (3 PM)' },
  // Resident-specific
  { facility_id: FACILITY_ID, resident_id: r1, date: wd(0),  meal_type: 'lunch',  title: 'Low-sodium turkey wrap (heart diet)', description: 'No added salt' },
  { facility_id: FACILITY_ID, resident_id: r2, date: wd(1),  meal_type: 'dinner', title: 'Pureed salmon with smooth mashed potato', description: 'IDDSI Level 4 — per speech therapy' },
  { facility_id: FACILITY_ID, resident_id: r3, date: wd(2),  meal_type: 'breakfast', title: 'Diabetic breakfast: egg whites, whole grain toast, berries', description: 'Carb count: ~30g' },
  { facility_id: FACILITY_ID, resident_id: r1, date: wd(7),  meal_type: 'dinner', title: 'Low-sodium pork loin with steamed veg', description: 'Heart diet — no added salt' },
  { facility_id: FACILITY_ID, resident_id: r2, date: wd(8),  meal_type: 'dinner', title: 'Pureed shrimp with smooth rice porridge', description: 'IDDSI Level 4' },
  { facility_id: FACILITY_ID, resident_id: r3, date: wd(10), meal_type: 'lunch',  title: 'Diabetic Greek salad with grilled chicken (no croutons)', description: 'Carb count: ~20g' },
]

const { error: menuErr } = await supabase.from('menus').insert(menus)
if (menuErr) { console.error('menus error:', menuErr.message); process.exit(1) }
console.log('menus: inserted', menus.length)

console.log('All done!')
