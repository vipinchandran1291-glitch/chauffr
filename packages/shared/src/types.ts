export const ROLES = ['customer', 'driver', 'admin'] as const;
export type Role = (typeof ROLES)[number];

/** Each frontend signs users in with the role of the same name. */
export type AppName = Role;

export const TRANSMISSIONS = ['manual', 'automatic'] as const;
export type Transmission = (typeof TRANSMISSIONS)[number];

export const CAR_TYPES = ['hatchback', 'sedan', 'suv', 'luxury'] as const;
export type CarType = (typeof CAR_TYPES)[number];

export const CAR_TYPE_LABELS: Record<CarType, string> = {
  hatchback: 'Hatchback',
  sedan: 'Sedan',
  suv: 'SUV / MUV',
  luxury: 'Luxury',
};

// incomplete: signed up, details not submitted. pending: submitted, waiting for admin review.
export const DRIVER_STATUSES = ['incomplete', 'pending', 'approved', 'rejected', 'suspended'] as const;
export type DriverStatus = (typeof DRIVER_STATUSES)[number];

export interface Me {
  id: number;
  email: string;
  name: string;
  avatarUrl: string | null;
  phone: string | null;
  phoneVerified: boolean;
  role: Role;
}

export interface PublicConfig {
  googleClientId: string;
  devLogin: boolean;
}

/** What customers see of the active rate card; the commission stays internal. */
export interface PublicRateCard {
  baseFare: number;
  baseMinutes: number;
  extraPer30Min: number;
  nightCharge: number;
  nightStartHour: number;
  nightEndHour: number;
}

export interface Car {
  id: number;
  make: string;
  model: string;
  regNumber: string;
  transmission: Transmission;
  carType: CarType;
  createdAt: string;
}

export interface DriverProfile {
  userId: number;
  status: DriverStatus;
  licenceNumber: string | null;
  licenceExpiry: string | null;
  canManual: boolean;
  canAutomatic: boolean;
  carTypes: CarType[];
  rejectionReason: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export interface AdminDriver extends DriverProfile {
  name: string;
  email: string;
  phone: string | null;
}
