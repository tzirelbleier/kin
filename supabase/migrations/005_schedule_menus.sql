-- ================================================================
-- Migration 005 — Schedule items, appointments, menus
-- ================================================================

-- Weekly recurring schedule (facility-wide or per-resident)
CREATE TABLE IF NOT EXISTS schedule_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id uuid NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  resident_id uuid REFERENCES residents(id) ON DELETE CASCADE, -- null = facility-wide
  day_of_week int NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sun 1=Mon … 6=Sat
  start_time time NOT NULL,
  end_time time,
  title text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'activity', -- activity, therapy, social, medical, personal, meal
  created_at timestamptz DEFAULT now()
);

-- Specific upcoming appointments
CREATE TABLE IF NOT EXISTS appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id uuid NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  resident_id uuid NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  scheduled_at timestamptz NOT NULL,
  title text NOT NULL,
  description text,
  location text,
  appointment_type text NOT NULL DEFAULT 'appointment', -- medical, therapy, family_visit, outing, other
  status text NOT NULL DEFAULT 'scheduled', -- scheduled, completed, cancelled
  created_at timestamptz DEFAULT now()
);

-- Daily menus (facility-wide or per-resident)
CREATE TABLE IF NOT EXISTS menus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id uuid NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  resident_id uuid REFERENCES residents(id) ON DELETE CASCADE, -- null = facility-wide
  date date NOT NULL,
  meal_type text NOT NULL, -- breakfast, lunch, dinner, snack
  title text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS schedule_items_facility_day_idx ON schedule_items(facility_id, day_of_week);
CREATE INDEX IF NOT EXISTS appointments_resident_at_idx ON appointments(resident_id, scheduled_at);
CREATE INDEX IF NOT EXISTS menus_facility_date_idx ON menus(facility_id, date);
