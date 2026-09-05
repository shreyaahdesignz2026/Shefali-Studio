const ROLES = ['admin', 'superadmin'];

// Can `actingRole` create/grant an account with `targetRole`?
// Superadmins can grant either role; admins can only grant 'admin'.
function canGrantRole(actingRole, targetRole) {
  if (!ROLES.includes(targetRole)) return false;
  if (actingRole === 'superadmin') return true;
  if (actingRole === 'admin') return targetRole === 'admin';
  return false;
}

// Can `actingRole` change an existing account's role (promote/demote)?
// Only superadmins can — admins have no role-change ability at all, even
// over other admins.
function canChangeRole(actingRole) {
  return actingRole === 'superadmin';
}

// Can `actingRole` remove (kick) an existing account? Only superadmins —
// and a superadmin may remove another superadmin.
function canKick(actingRole) {
  return actingRole === 'superadmin';
}

module.exports = { ROLES, canGrantRole, canChangeRole, canKick };
