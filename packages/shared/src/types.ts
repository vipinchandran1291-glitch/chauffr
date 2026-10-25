export type Role = 'customer' | 'driver' | 'admin';
export type AppName = 'customer' | 'driver' | 'admin';

export type Transmission = 'manual' | 'automatic';
export type DriverTransmission = Transmission | 'both';
export type CarType = 'hatchback' | 'sedan' | 'suv' | 'luxury';

export type DriverStatus = 'pending' | 'approved' | 'rejected' | 'suspended';
export type BookingStatus = 'requested' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';

/** All money values are integer paise. */
export type Paise = number;

export interface User {
  id: number;
  email: string;
  name: string;
  phone: string | null;
  role: Role;
}

export interface Car {
  id: number;
  make: string;
  model: string;
  registration: string;
  transmission: Transmission;
  type: CarType;
}

export interface DriverProfile {
  userId: number;
  licenseNumber: string;
  licenseExpiry: string;
  transmission: DriverTransmission;
  status: DriverStatus;
  isOnline: boolean;
  adminNote: string | null;
}

export interface RateCard {
  minHours: number;
  baseFare: Paise;
  extraHourRate: Paise;
  nightCharge: Paise;
  graceMinutes: number;
  commissionPct: number;
}

export interface FareBreakdown {
  minHours: number;
  billedHours: number;
  baseFare: Paise;
  extraHoursFare: Paise;
  nightCharge: Paise;
  total: Paise;
  platformFee: Paise;
  driverEarning: Paise;
}

export interface Booking {
  id: number;
  status: BookingStatus;
  pickupAddress: string;
  scheduledAt: string;
  bookedHours: number;
  estimatedFare: Paise;
  car: Car;
  customer: { id: number; name: string; phone: string | null };
  driver: { id: number; name: string; phone: string | null } | null;
  /** Only sent to the customer who owns the booking. */
  startOtp?: string;
  startedAt: string | null;
  endedAt: string | null;
  fare: FareBreakdown | null;
  cancelReason: string | null;
  createdAt: string;
}

export interface AdminDriver {
  user: User;
  profile: DriverProfile | null;
}
