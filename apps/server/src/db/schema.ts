import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import {
  BOOKING_KINDS,
  BOOKING_STATUSES,
  CAR_TYPES,
  DRIVER_STATUSES,
  ROLES,
  TRANSMISSIONS,
  type CarType,
  type RateCard,
} from '@chauffr/shared';

// Timestamps are stored as epoch milliseconds; money as integer paise.
const timestamp = (name: string) => integer(name, { mode: 'timestamp_ms' });
const createdAt = () => timestamp('created_at').notNull().$defaultFn(() => new Date());

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  googleSub: text('google_sub').unique(),
  email: text('email').notNull().unique(),
  name: text('name').notNull().default(''),
  avatarUrl: text('avatar_url'),
  phone: text('phone'),
  phoneVerified: integer('phone_verified', { mode: 'boolean' }).notNull().default(false),
  role: text('role', { enum: ROLES }).notNull(),
  createdAt: createdAt(),
});

export const sessions = sqliteTable(
  'sessions',
  {
    tokenHash: text('token_hash').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
);

export const cars = sqliteTable(
  'cars',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    ownerId: integer('owner_id')
      .notNull()
      .references(() => users.id),
    make: text('make').notNull(),
    model: text('model').notNull(),
    regNumber: text('reg_number').notNull(),
    transmission: text('transmission', { enum: TRANSMISSIONS }).notNull(),
    carType: text('car_type', { enum: CAR_TYPES }).notNull(),
    createdAt: createdAt(),
    deletedAt: timestamp('deleted_at'),
  },
  (t) => [index('cars_owner_idx').on(t.ownerId)],
);

export const drivers = sqliteTable(
  'drivers',
  {
    userId: integer('user_id')
      .primaryKey()
      .references(() => users.id),
    status: text('status', { enum: DRIVER_STATUSES }).notNull().default('incomplete'),
    licenceNumber: text('licence_number'),
    licenceExpiry: text('licence_expiry'), // YYYY-MM-DD
    canManual: integer('can_manual', { mode: 'boolean' }).notNull().default(false),
    canAutomatic: integer('can_automatic', { mode: 'boolean' }).notNull().default(false),
    carTypes: text('car_types', { mode: 'json' })
      .$type<CarType[]>()
      .notNull()
      .$defaultFn(() => []),
    isOnline: integer('is_online', { mode: 'boolean' }).notNull().default(false),
    lastLat: real('last_lat'),
    lastLng: real('last_lng'),
    lastLocationAt: timestamp('last_location_at'),
    reviewedAt: timestamp('reviewed_at'),
    reviewedBy: integer('reviewed_by').references(() => users.id),
    rejectionReason: text('rejection_reason'),
    createdAt: createdAt(),
  },
  (t) => [index('drivers_status_idx').on(t.status)],
);

export const driverDocuments = sqliteTable('driver_documents', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  driverId: integer('driver_id')
    .notNull()
    .references(() => drivers.userId),
  kind: text('kind', { enum: ['licence', 'id_proof', 'police_verification', 'photo'] }).notNull(),
  filePath: text('file_path').notNull(),
  uploadedAt: createdAt(),
});

export const rateCards = sqliteTable('rate_cards', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  baseFare: integer('base_fare').notNull(),
  baseMinutes: integer('base_minutes').notNull(),
  extraPer30Min: integer('extra_per_30_min').notNull(),
  nightCharge: integer('night_charge').notNull(),
  nightStartHour: integer('night_start_hour').notNull(),
  nightEndHour: integer('night_end_hour').notNull(),
  commissionBps: integer('commission_bps').notNull(),
  active: integer('active', { mode: 'boolean' }).notNull().default(false),
  createdAt: createdAt(),
});

export const bookings = sqliteTable(
  'bookings',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    customerId: integer('customer_id')
      .notNull()
      .references(() => users.id),
    carId: integer('car_id')
      .notNull()
      .references(() => cars.id),
    driverId: integer('driver_id').references(() => users.id),
    status: text('status', { enum: BOOKING_STATUSES }).notNull().default('requested'),
    kind: text('kind', { enum: BOOKING_KINDS }).notNull(),
    pickupAddress: text('pickup_address').notNull(),
    pickupLat: real('pickup_lat'),
    pickupLng: real('pickup_lng'),
    scheduledAt: timestamp('scheduled_at'),
    expectedMinutes: integer('expected_minutes').notNull(),
    startOtp: text('start_otp').notNull(),
    rateCard: text('rate_card', { mode: 'json' }).$type<RateCard>().notNull(),
    startedAt: timestamp('started_at'),
    endedAt: timestamp('ended_at'),
    fare: integer('fare'),
    commission: integer('commission'),
    driverEarning: integer('driver_earning'),
    cancelledBy: integer('cancelled_by').references(() => users.id),
    cancelReason: text('cancel_reason'),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at')
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    index('bookings_status_idx').on(t.status),
    index('bookings_customer_idx').on(t.customerId),
    index('bookings_driver_idx').on(t.driverId),
  ],
);

/** Append-only audit log of everything that happens to a booking. */
export const bookingEvents = sqliteTable(
  'booking_events',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    bookingId: integer('booking_id')
      .notNull()
      .references(() => bookings.id),
    type: text('type').notNull(),
    fromStatus: text('from_status', { enum: BOOKING_STATUSES }),
    toStatus: text('to_status', { enum: BOOKING_STATUSES }),
    actorId: integer('actor_id').references(() => users.id),
    data: text('data', { mode: 'json' }),
    createdAt: createdAt(),
  },
  (t) => [index('booking_events_booking_idx').on(t.bookingId)],
);

export const payments = sqliteTable(
  'payments',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    bookingId: integer('booking_id')
      .notNull()
      .references(() => bookings.id),
    method: text('method', { enum: ['razorpay', 'cash'] }).notNull(),
    amount: integer('amount').notNull(),
    status: text('status', { enum: ['created', 'captured', 'failed', 'refunded'] }).notNull(),
    razorpayOrderId: text('razorpay_order_id').unique(),
    razorpayPaymentId: text('razorpay_payment_id'),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at')
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date()),
  },
  (t) => [index('payments_booking_idx').on(t.bookingId)],
);

export const payouts = sqliteTable('payouts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  driverId: integer('driver_id')
    .notNull()
    .references(() => users.id),
  amount: integer('amount').notNull(),
  reference: text('reference'), // bank/UPI transaction reference
  paidAt: timestamp('paid_at').notNull(),
  createdBy: integer('created_by')
    .notNull()
    .references(() => users.id),
});

/** Positive amounts are owed to the driver; a driver's balance is the sum of their entries. */
export const driverLedger = sqliteTable(
  'driver_ledger',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    driverId: integer('driver_id')
      .notNull()
      .references(() => users.id),
    bookingId: integer('booking_id').references(() => bookings.id),
    payoutId: integer('payout_id').references(() => payouts.id),
    type: text('type', { enum: ['earning', 'cash_collected', 'payout', 'adjustment'] }).notNull(),
    amount: integer('amount').notNull(),
    note: text('note'),
    createdAt: createdAt(),
  },
  (t) => [index('driver_ledger_driver_idx').on(t.driverId)],
);
