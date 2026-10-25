-- Money paid out to a driver, covering one or more paid trips.
CREATE TABLE payouts (
  id INTEGER PRIMARY KEY,
  driver_id INTEGER NOT NULL REFERENCES users(id),
  amount INTEGER NOT NULL,
  booking_count INTEGER NOT NULL,
  -- UPI / bank transfer reference, so ops can match it to their bank statement.
  reference TEXT NOT NULL,
  note TEXT,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX payouts_driver ON payouts(driver_id);

ALTER TABLE bookings ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'unpaid'
  CHECK (payment_status IN ('unpaid', 'paid'));
ALTER TABLE bookings ADD COLUMN paid_at TEXT;
ALTER TABLE bookings ADD COLUMN payout_id INTEGER REFERENCES payouts(id);

-- One row per Razorpay order. A booking can have several if the customer retries.
CREATE TABLE payments (
  id INTEGER PRIMARY KEY,
  booking_id INTEGER NOT NULL REFERENCES bookings(id),
  razorpay_order_id TEXT NOT NULL UNIQUE,
  razorpay_payment_id TEXT,
  amount INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'paid', 'failed')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  paid_at TEXT
);
CREATE INDEX payments_booking ON payments(booking_id);
