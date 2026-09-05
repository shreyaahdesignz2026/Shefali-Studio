const test = require('node:test');
const assert = require('node:assert/strict');
const { validateSubmission, buildRow } = require('../api/_lib/formSubmissions');

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
