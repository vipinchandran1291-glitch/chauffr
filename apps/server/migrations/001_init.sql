CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  google_sub TEXT UNIQUE,
  name TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL CHECK (role IN ('customer', 'driver', 'admin')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);
CREATE INDEX sessions_user ON sessions(user_id);

CREATE TABLE driver_profiles (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  license_number TEXT NOT NULL,
  license_expiry TEXT NOT NULL,
  transmission TEXT NOT NULL CHECK (transmission IN ('manual', 'automatic', 'both')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'suspended')),
  is_online INTEGER NOT NULL DEFAULT 0,
  admin_note TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE cars (
  id INTEGER PRIMARY KEY,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  registration TEXT NOT NULL,
  transmission TEXT NOT NULL CHECK (transmission IN ('manual', 'automatic')),
  type TEXT NOT NULL CHECK (type IN ('hatchback', 'sedan', 'suv', 'luxury')),
  deleted_at TEXT
);
CREATE INDEX cars_owner ON cars(owner_id);

-- Single active rate card (id = 1). Amounts in paise.
CREATE TABLE rate_card (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  min_hours INTEGER NOT NULL,
  base_fare INTEGER NOT NULL,
  extra_hour_rate INTEGER NOT NULL,
  night_charge INTEGER NOT NULL,
  grace_minutes INTEGER NOT NULL,
  commission_pct REAL NOT NULL
);
INSERT INTO rate_card VALUES (1, 4, 49900, 12000, 20000, 15, 20);

CREATE TABLE bookings (
  id INTEGER PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES users(id),
  car_id INTEGER NOT NULL REFERENCES cars(id),
  driver_id INTEGER REFERENCES users(id),
  status TEXT NOT NULL CHECK (status IN ('requested', 'assigned', 'in_progress', 'completed', 'cancelled')),
  pickup_address TEXT NOT NULL,
  scheduled_at TEXT NOT NULL,
  booked_hours INTEGER NOT NULL,
  estimated_fare INTEGER NOT NULL,
  -- Rate card as it was when booked, so later rate changes don't alter this booking.
  rate_card_json TEXT NOT NULL,
  start_otp TEXT NOT NULL,
  started_at TEXT,
  ended_at TEXT,
  fare_json TEXT,
  cancel_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX bookings_customer ON bookings(customer_id);
CREATE INDEX bookings_driver ON bookings(driver_id);
CREATE INDEX bookings_status ON bookings(status);
