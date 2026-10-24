import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { FastifyInstance } from 'fastify';

process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = ':memory:';
process.env.DEV_LOGIN = '1';
process.env.ADMIN_EMAILS = 'admin@chauffr.test';

const { buildApp } = await import('./app');
let app: FastifyInstance;

before(async () => {
  app = await buildApp();
});
after(() => app.close());

async function login(email: string, appName: string): Promise<string> {
  const res = await app.inject({ method: 'POST', url: '/api/auth/dev', payload: { email, app: appName } });
  assert.equal(res.statusCode, 200, res.body);
  const cookie = res.cookies.find((c) => c.name === 'chauffr_sid');
  assert.ok(cookie);
  return `chauffr_sid=${cookie.value}`;
}

const call = (cookie: string, method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', url: string, payload?: object) =>
  app.inject({ method, url, payload, headers: { cookie } });

test('signed-out /me returns null', async () => {
  const res = await app.inject({ method: 'GET', url: '/api/me' });
  assert.deepEqual(res.json(), { user: null });
});

test('customer adds phone and a car', async () => {
  const c = await login('asha@example.com', 'customer');
  const me = await call(c, 'PATCH', '/api/me', { name: 'Asha', phone: '98450 12345' });
  assert.equal(me.json().user.phone, '+919845012345');

  const bad = await call(c, 'POST', '/api/cars', {
    make: 'Maruti', model: 'Swift', regNumber: 'not a reg', transmission: 'manual', carType: 'hatchback',
  });
  assert.equal(bad.statusCode, 400);

  const car = await call(c, 'POST', '/api/cars', {
    make: 'Maruti', model: 'Swift', regNumber: 'ka 01 ab 1234', transmission: 'manual', carType: 'hatchback',
  });
  assert.equal(car.statusCode, 201);
  assert.equal(car.json().car.regNumber, 'KA01AB1234');

  const list = await call(c, 'GET', '/api/cars');
  assert.equal(list.json().cars.length, 1);

  const forbidden = await call(c, 'GET', '/api/driver/profile');
  assert.equal(forbidden.statusCode, 403);
});

test('a customer account cannot sign into the driver app', async () => {
  const res = await app.inject({
    method: 'POST', url: '/api/auth/dev', payload: { email: 'asha@example.com', app: 'driver' },
  });
  assert.equal(res.statusCode, 403);
});

test('driver submits details and admin approves', async () => {
  const d = await login('ravi@example.com', 'driver');
  assert.equal((await call(d, 'GET', '/api/driver/profile')).json().profile.status, 'incomplete');

  const details = {
    licenceNumber: 'KA01 20190001234', licenceExpiry: '2035-01-01', canManual: true, canAutomatic: true, carTypes: ['sedan', 'suv'],
  };
  assert.equal((await call(d, 'PUT', '/api/driver/profile', details)).statusCode, 400, 'phone required first');
  await call(d, 'PATCH', '/api/me', { phone: '9900011122' });
  const submitted = await call(d, 'PUT', '/api/driver/profile', details);
  assert.equal(submitted.json().profile.status, 'pending');

  assert.equal((await app.inject({ method: 'POST', url: '/api/auth/dev', payload: { email: 'ravi@example.com', app: 'admin' } })).statusCode, 403);

  const a = await login('admin@chauffr.test', 'admin');
  const pending = await call(a, 'GET', '/api/admin/drivers?status=pending');
  const driver = pending.json().drivers[0];
  assert.equal(driver.email, 'ravi@example.com');

  const approve = await call(a, 'POST', `/api/admin/drivers/${driver.userId}/status`, { status: 'approved' });
  assert.equal(approve.statusCode, 200);
  assert.equal((await call(d, 'GET', '/api/driver/profile')).json().profile.status, 'approved');
  assert.equal((await call(d, 'PUT', '/api/driver/profile', details)).statusCode, 409);

  const rateCard = await call(a, 'GET', '/api/admin/rate-card');
  assert.equal(rateCard.json().rateCard.baseFare, 44_900);
});

test('logout ends the session', async () => {
  const c = await login('asha@example.com', 'customer');
  await call(c, 'POST', '/api/auth/logout', {});
  assert.deepEqual((await call(c, 'GET', '/api/me')).json(), { user: null });
});
