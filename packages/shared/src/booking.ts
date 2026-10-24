export const BOOKING_STATUSES = [
  'requested',
  'assigned',
  'arrived',
  'in_progress',
  'completed',
  'paid',
  'cancelled',
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const BOOKING_KINDS = ['instant', 'scheduled'] as const;
export type BookingKind = (typeof BOOKING_KINDS)[number];

// assigned → requested covers a driver dropping out or an admin reassigning.
const TRANSITIONS: Record<BookingStatus, readonly BookingStatus[]> = {
  requested: ['assigned', 'cancelled'],
  assigned: ['requested', 'arrived', 'cancelled'],
  arrived: ['in_progress', 'cancelled'],
  in_progress: ['completed'],
  completed: ['paid'],
  paid: [],
  cancelled: [],
};

export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return TRANSITIONS[from].includes(to);
}
