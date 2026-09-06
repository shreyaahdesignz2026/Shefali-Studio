const test = require('node:test');
const assert = require('node:assert/strict');
const { canGrantRole, canChangeRole, canKick, canChangePassword } = require('../api/_lib/adminRoles');

test('superadmin can grant admin', () => {
  assert.equal(canGrantRole('superadmin', 'admin'), true);
});

test('superadmin can grant superadmin', () => {
  assert.equal(canGrantRole('superadmin', 'superadmin'), true);
});

test('admin can grant admin', () => {
  assert.equal(canGrantRole('admin', 'admin'), true);
});

test('admin cannot grant superadmin', () => {
  assert.equal(canGrantRole('admin', 'superadmin'), false);
});

test('canGrantRole rejects an unknown target role', () => {
  assert.equal(canGrantRole('superadmin', 'owner'), false);
});

test('canGrantRole rejects an unknown acting role', () => {
  assert.equal(canGrantRole('nobody', 'admin'), false);
});

test('only superadmin can change roles', () => {
  assert.equal(canChangeRole('superadmin'), true);
  assert.equal(canChangeRole('admin'), false);
});

test('only superadmin can kick', () => {
  assert.equal(canKick('superadmin'), true);
  assert.equal(canKick('admin'), false);
});

test('only superadmin can change another account\'s password', () => {
  assert.equal(canChangePassword('superadmin'), true);
  assert.equal(canChangePassword('admin'), false);
});
