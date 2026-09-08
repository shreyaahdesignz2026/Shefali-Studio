const ROLES = ['admin', 'superadmin'];

function canGrantRole(actingRole, targetRole) {
  if (!ROLES.includes(targetRole)) return false;
  if (actingRole === 'superadmin') return true;
  if (actingRole === 'admin') return targetRole === 'admin';
  return false;
}

function canChangeRole(actingRole) {
  return actingRole === 'superadmin';
}

function canKick(actingRole) {
  return actingRole === 'superadmin';
}

function canChangePassword(actingRole) {
  return actingRole === 'superadmin';
}

module.exports = { ROLES, canGrantRole, canChangeRole, canKick, canChangePassword };
