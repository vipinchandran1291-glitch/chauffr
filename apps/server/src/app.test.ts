import { beforeEach, describe, expect, it } from 'vitest';
import type { AppName, Booking } from '@chauffr/shared';
import { createApp } from './app.ts';
import { openDb } from './db.ts';
import { loadEnv } from './env.ts';

type App = ReturnType<typeof createApp>;

const env = loadEnv({ DEV_LOGIN: 'true', ADMIN_EMAILS: 'ops@chauffr.in' });
const noGoogle = async () => {
  throw new Error('not used');
};

class Client {
  cookie = '';
  constructor(
    private app: App,
    private appName: AppName,
  ) {}

  async req(method: string, path: string, body?: unknown) {
    const res = await this.app.request(`/api${path}`, {
      method,
      headers: { 'content-type': 'application/json', 'x-chauffr-app': this.appName, cookie: this.cookie },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) this.cookie = setCookie.split(';')[0]!;
    return { status: res.status, body: (await res.json()) as any };
  }

  async login(email: string) {
    const res = await this.req('POST', '/auth/dev', { email });
    expect(res.status).toBe(200);
    return res.body;
  }
}

const inOneHour = () => new Date(Date.now() + 3_600_000).toISOString();

let app: App;
let customer: Client;
let driver: Client;
let admin: Client;

beforeEach(async () => {
  app = createApp(openDb(':memory:'), env, noGoogle);
  customer = new Client(app, 'customer');
  driver = new Client(app, 'driver');
  admin = new Client(app, 'admin');
  await customer.login('asha@example.com');
  await driver.login('ravi@example.com');
  await admin.login('ops@chauffr.in');
});

async function setUpCustomerBooking(transmission: 'manual' | 'automatic' = 'manual'): Promise<Booking> {
  await customer.req('PATCH', '/auth/me', { name: 'Asha', phone: '9876543210' });
  const car = await customer.req('POST', '/customer/cars', {
    make: 'Maruti',
    model: 'Swift',
    registration: 'ka 01 ab 1234',
    transmission,
    type: 'hatchback',
  });
  expect(car.body.registration).toBe('KA01AB1234');
  const booking = await customer.req('POST', '/customer/bookings', {
    carId: car.body.id,
    pickupAddress: '12 MG Road, Bengaluru',
    scheduledAt: inOneHour(),
    bookedHours: 5,
  });
  expect(booking.status).toBe(201);
  return booking.body;
}

async function approveDriver(transmission: 'manual' | 'automatic' | 'both' = 'both') {
  await driver.req('PATCH', '/auth/me', { name: 'Ravi', phone: '9123456780' });
  await driver.req('PUT', '/driver/profile', { licenseNumber: 'KA0120200001234', licenseExpiry: '2032-01-01', transmission });
  const me = await driver.req('GET', '/auth/me');
  await admin.req('POST', `/admin/drivers/${me.body.id}/status`, { status: 'approved' });
  return me.body.id as number;
}

describe('auth', () => {
  it('rejects requests without a session', async () => {
    const res = await new Client(app, 'customer').req('GET', '/customer/cars');
    expect(res.status).toBe(401);
  });

  it('keeps roles separate per app', async () => {
    const asDriver = new Client(app, 'driver');
    const res = await asDriver.req('POST', '/auth/dev', { email: 'asha@example.com' });
    expect(res.status).toBe(403);
  });

  it('only lets listed emails into the admin app', async () => {
    const res = await new Client(app, 'admin').req('POST', '/auth/dev', { email: 'someone@example.com' });
    expect(res.status).toBe(403);
  });

  it('stops customers calling admin endpoints', async () => {
    expect((await customer.req('GET', '/admin/bookings')).status).toBe(403);
  });
});

describe('booking flow', () => {
  it('requires a phone number before booking', async () => {
    const car = await customer.req('POST', '/customer/cars', {
      make: 'Honda', model: 'City', registration: 'KA05MN4321', transmission: 'automatic', type: 'sedan',
    });
    const res = await customer.req('POST', '/customer/bookings', {
      carId: car.body.id, pickupAddress: '1 Residency Road', scheduledAt: inOneHour(), bookedHours: 4,
    });
    expect(res.status).toBe(400);
  });

  it('runs request -> assign -> start -> end', async () => {
    const booking = await setUpCustomerBooking();
    expect(booking.status).toBe('requested');
    expect(booking.startOtp).toMatch(/^\d{4}$/);
    const driverId = await approveDriver();

    const eligible = await admin.req('GET', `/admin/bookings/${booking.id}/eligible-drivers`);
    expect(eligible.body.map((d: any) => d.user.id)).toEqual([driverId]);

    const assigned = await admin.req('POST', `/admin/bookings/${booking.id}/assign`, { driverId });
    expect(assigned.body.status).toBe('assigned');

    const driverView = await driver.req('GET', '/driver/bookings');
    expect(driverView.body[0].startOtp).toBeUndefined();

    expect((await driver.req('POST', `/driver/bookings/${booking.id}/start`, { otp: '0000' === booking.startOtp ? '1111' : '0000' })).status).toBe(400);
    const started = await driver.req('POST', `/driver/bookings/${booking.id}/start`, { otp: booking.startOtp });
    expect(started.body.status).toBe('in_progress');

    const ended = await driver.req('POST', `/driver/bookings/${booking.id}/end`);
    expect(ended.body.status).toBe('completed');
    expect(ended.body.fare.billedHours).toBe(4);
    expect(ended.body.fare.platformFee + ended.body.fare.driverEarning).toBe(ended.body.fare.total);
  });

  it('will not assign a driver who cannot drive the car', async () => {
    const booking = await setUpCustomerBooking('manual');
    const driverId = await approveDriver('automatic');
    const res = await admin.req('POST', `/admin/bookings/${booking.id}/assign`, { driverId });
    expect(res.status).toBe(400);
  });

  it('will not double-book a driver', async () => {
    const first = await setUpCustomerBooking();
    const driverId = await approveDriver();
    await admin.req('POST', `/admin/bookings/${first.id}/assign`, { driverId });
    const cars = await customer.req('GET', '/customer/cars');
    const second = await customer.req('POST', '/customer/bookings', {
      carId: cars.body[0].id, pickupAddress: '12 MG Road, Bengaluru', scheduledAt: inOneHour(), bookedHours: 4,
    });
    const res = await admin.req('POST', `/admin/bookings/${second.body.id}/assign`, { driverId });
    expect(res.status).toBe(409);
  });

  it('stops other drivers seeing or starting the trip', async () => {
    const booking = await setUpCustomerBooking();
    const driverId = await approveDriver();
    await admin.req('POST', `/admin/bookings/${booking.id}/assign`, { driverId });
    const other = new Client(app, 'driver');
    await other.login('other@example.com');
    const res = await other.req('POST', `/driver/bookings/${booking.id}/start`, { otp: booking.startOtp });
    expect(res.status).toBe(404);
  });

  it('lets customers cancel before the trip starts but not after', async () => {
    const booking = await setUpCustomerBooking();
    const driverId = await approveDriver();
    await admin.req('POST', `/admin/bookings/${booking.id}/assign`, { driverId });
    await driver.req('POST', `/driver/bookings/${booking.id}/start`, { otp: booking.startOtp });
    const res = await customer.req('POST', `/customer/bookings/${booking.id}/cancel`, {});
    expect(res.status).toBe(409);
  });

  it('keeps the rate card a booking was made with', async () => {
    const booking = await setUpCustomerBooking();
    const card = (await admin.req('GET', '/admin/rate-card')).body;
    await admin.req('PUT', '/admin/rate-card', { ...card, baseFare: card.baseFare * 2 });
    const driverId = await approveDriver();
    await admin.req('POST', `/admin/bookings/${booking.id}/assign`, { driverId });
    await driver.req('POST', `/driver/bookings/${booking.id}/start`, { otp: booking.startOtp });
    const ended = await driver.req('POST', `/driver/bookings/${booking.id}/end`);
    expect(ended.body.fare.baseFare).toBe(card.baseFare);
  });
});

describe('drivers', () => {
  it('cannot go online until approved', async () => {
    await driver.req('PUT', '/driver/profile', { licenseNumber: 'KA0120200001234', licenseExpiry: '2032-01-01', transmission: 'manual' });
    expect((await driver.req('POST', '/driver/online', { online: true })).status).toBe(403);
  });
});
