const test = require('node:test');
const assert = require('node:assert/strict');
const { validateSubmission, buildRow, computeHappensAt } = require('../api/_lib/formSubmissions');

test('rejects an unknown form type', () => {
  assert.throws(() => validateSubmission('carrier-pigeon', {}), /Unknown form type/);
});

test('service_booking requires name, phone, email, service', () => {
  assert.throws(
    () => validateSubmission('service_booking', { name: 'A' }),
    /Missing required field\(s\): phone, email, service/
  );
  assert.doesNotThrow(() =>
    validateSubmission('service_booking', { name: 'A', phone: '1', email: 'a@b.com', service: 'X' })
  );
});

test('contact_individual requires subject and message', () => {
  assert.throws(
    () => validateSubmission('contact_individual', { name: 'A', phone: '1', email: 'a@b.com' }),
    /Missing required field\(s\): subject, message/
  );
});

test('contact_corporate requires org, type, brief', () => {
  assert.throws(
    () => validateSubmission('contact_corporate', { name: 'A', phone: '1', email: 'a@b.com' }),
    /Missing required field\(s\): org, type, brief/
  );
});

test('event_registration requires event', () => {
  assert.throws(
    () => validateSubmission('event_registration', { name: 'A', phone: '1', email: 'a@b.com' }),
    /Missing required field\(s\): event/
  );
});

test('treats a blank/whitespace-only field as missing', () => {
  assert.throws(
    () => validateSubmission('event_registration', { name: 'A', phone: '1', email: 'a@b.com', event: '   ' }),
    /Missing required field\(s\): event/
  );
});

test('buildRow maps the message field and collects details per form type', () => {
  const row = buildRow('service_booking', {
    name: 'Priya',
    phone: '9999999999',
    email: 'priya@example.com',
    service: 'Oracle Card Reading',
    date: '2026-10-01',
    time: 'Morning',
    mode: 'online',
    notes: 'First time visitor',
  });
  assert.equal(row.name, 'Priya');
  assert.equal(row.message, 'First time visitor');
  assert.deepEqual(row.details, {
    service: 'Oracle Card Reading',
    date: '2026-10-01',
    time: 'Morning',
    mode: 'online',
  });
});

test('buildRow omits detail fields that were not supplied', () => {
  const row = buildRow('event_registration', {
    name: 'Rahul',
    phone: '8888888888',
    email: 'rahul@example.com',
    event: 'Alaap 01',
  });
  assert.deepEqual(row.details, { event: 'Alaap 01' });
  assert.equal(row.message, null);
});

test('buildRow falls back to null for optional contact fields', () => {
  const row = buildRow('contact_individual', {
    name: 'Meera',
    subject: 'General question',
    message: 'Hello there',
  });
  assert.equal(row.phone, null);
  assert.equal(row.email, null);
});

test('artisoul_tribe requires only name and email (no phone field on that form)', () => {
  assert.throws(
    () => validateSubmission('artisoul_tribe', { name: 'A' }),
    /Missing required field\(s\): email/
  );
  assert.doesNotThrow(() => validateSubmission('artisoul_tribe', { name: 'A', email: 'a@b.com' }));
});

test('artisoul_tribe buildRow maps worth to message and draw to details', () => {
  const row = buildRow('artisoul_tribe', {
    name: 'Ishani',
    email: 'ishani@example.com',
    draw: 'The book club and the events',
    worth: 'A real discount on products',
  });
  assert.equal(row.message, 'A real discount on products');
  assert.deepEqual(row.details, { draw: 'The book club and the events' });
  assert.equal(row.phone, null);
});

test('computeHappensAt combines a service_booking date with its time-of-day bucket', () => {
  assert.equal(
    computeHappensAt('service_booking', { date: '2026-10-01', time: 'Morning' }),
    new Date('2026-10-01T09:00:00').toISOString()
  );
  assert.equal(
    computeHappensAt('service_booking', { date: '2026-10-01', time: 'Afternoon' }),
    new Date('2026-10-01T14:00:00').toISOString()
  );
  assert.equal(
    computeHappensAt('service_booking', { date: '2026-10-01', time: 'Evening' }),
    new Date('2026-10-01T18:00:00').toISOString()
  );
});

test('computeHappensAt falls back to a nominal midday hour with no time bucket chosen', () => {
  assert.equal(
    computeHappensAt('service_booking', { date: '2026-10-01' }),
    new Date('2026-10-01T12:00:00').toISOString()
  );
});

test('computeHappensAt is null without a valid date', () => {
  assert.equal(computeHappensAt('service_booking', {}), null);
  assert.equal(computeHappensAt('service_booking', { date: 'not-a-date' }), null);
});

test('computeHappensAt is always null for form types other than service_booking', () => {
  assert.equal(computeHappensAt('event_registration', { date: '2026-10-01' }), null);
  assert.equal(computeHappensAt('artisoul_tribe', {}), null);
});

test('buildRow includes happens_at for service_booking and null for other types', () => {
  const booking = buildRow('service_booking', {
    name: 'Priya',
    phone: '9999999999',
    email: 'priya@example.com',
    service: 'Oracle Card Reading',
    date: '2026-10-01',
    time: 'Morning',
  });
  assert.equal(booking.happens_at, new Date('2026-10-01T09:00:00').toISOString());

  const event = buildRow('event_registration', {
    name: 'Rahul',
    phone: '8888888888',
    email: 'rahul@example.com',
    event: 'Alaap 01',
  });
  assert.equal(event.happens_at, null);
});
