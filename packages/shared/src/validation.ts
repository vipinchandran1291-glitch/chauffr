import { z } from 'zod';

const phone = z.string().regex(/^[6-9]\d{9}$/, 'Enter a 10-digit Indian mobile number');

export const profileInput = z.object({
  name: z.string().trim().min(2).max(80),
  phone,
});

export const carInput = z.object({
  make: z.string().trim().min(1).max(40),
  model: z.string().trim().min(1).max(40),
  registration: z
    .string()
    .transform((s) => s.toUpperCase().replace(/[\s-]/g, ''))
    .pipe(z.string().regex(/^[A-Z]{2}\d{1,2}[A-Z]{0,3}\d{1,4}$/, 'Enter a valid registration, e.g. KA01AB1234')),
  transmission: z.enum(['manual', 'automatic']),
  type: z.enum(['hatchback', 'sedan', 'suv', 'luxury']),
});

export const fareEstimateInput = z.object({
  bookedHours: z.number().int().min(1).max(12),
  scheduledAt: z.iso.datetime(),
});

export const bookingInput = fareEstimateInput.extend({
  carId: z.number().int().positive(),
  pickupAddress: z.string().trim().min(5).max(300),
});

export const driverProfileInput = z.object({
  licenseNumber: z.string().trim().toUpperCase().min(8).max(20),
  licenseExpiry: z.iso.date(),
  transmission: z.enum(['manual', 'automatic', 'both']),
});

export const rateCardInput = z.object({
  minHours: z.number().int().min(1).max(12),
  baseFare: z.number().int().min(0),
  extraHourRate: z.number().int().min(0),
  nightCharge: z.number().int().min(0),
  graceMinutes: z.number().int().min(0).max(60),
  commissionPct: z.number().min(0).max(100),
});

export type ProfileInput = z.infer<typeof profileInput>;
export type CarInput = z.input<typeof carInput>;
export type BookingInput = z.infer<typeof bookingInput>;
export type DriverProfileInput = z.infer<typeof driverProfileInput>;
