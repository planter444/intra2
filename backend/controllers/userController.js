const userModel = require('../models/userModel');
const settingsModel = require('../models/settingsModel');
const leaveModel = require('../models/leaveModel');
const defaultSettings = require('../config/defaultSettings');
const { comparePassword, hashPassword } = require('../services/authService');
const { logAction } = require('../services/auditService');
const { deleteEmployeeData } = require('../services/userDeletionService');

const allowedRoles = ['employee', 'supervisor', 'admin', 'ceo', 'finance'];
const allowedGenders = ['male', 'female', 'other'];
const fixedRoleTitles = {
  employee: 'Employee',
  supervisor: 'Supervisor',
  admin: 'IT Officer',
  ceo: 'CEO',
  finance: 'Finance Officer'
};

const getAllowedRoleTitles = async () => {
  const settings = await settingsModel.getGlobal();
  const configuredTitles = Array.isArray(settings?.payload?.roleTitles) && settings.payload.roleTitles.length
    ? settings.payload.roleTitles
    : defaultSettings.roleTitles;

  return [...new Set(configuredTitles
    .map((item) => String(item?.value || '').trim())
    .filter(Boolean)
    .concat(fixedRoleTitles.employee))];
};

const resolveRoleAssignment = async ({ role, roleTitle }) => {
  if (!allowedRoles.includes(role)) {
    return { error: 'Selected role is invalid.' };
  }

  if (role !== 'employee') {
    return {
      role,
      roleTitle: fixedRoleTitles[role]
    };
  }

  const normalizedRoleTitle = String(roleTitle || fixedRoleTitles.employee).trim();
  const allowedRoleTitles = await getAllowedRoleTitles();
  if (!allowedRoleTitles.includes(normalizedRoleTitle)) {
    return { error: 'Selected role title is invalid.' };
  }

  return {
    role: 'employee',
    roleTitle: normalizedRoleTitle
  };
};

const canManageUser = (currentUser, targetUserId) => {
  if (currentUser.role === 'admin' || currentUser.role === 'ceo') {
    return true;
  }

  return String(currentUser.id) === String(targetUserId);
};

const canViewUser = async (currentUser, targetUserId) => {
  if (canManageUser(currentUser, targetUserId)) {
    return true;
  }

  if (currentUser.role !== 'supervisor') {
    return false;
  }

  const targetUser = await userModel.findById(targetUserId);
  return Boolean(targetUser && String(targetUser.supervisorId) === String(currentUser.id));
};

const normalizeEmailInput = (email) => String(email || '').trim();

const normalizeJoinedAtInput = (value) => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === '') {
    return null;
  }

  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parsed = new Date(`${value}T00:00:00`);
    if (!Number.isNaN(parsed.getTime())) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (parsed.getTime() <= today.getTime()) {
        return value;
      }
    }
  }

  return 'invalid';
};

const ensureEmailAvailable = async ({ email, currentUserId }) => {
  const existingUser = await userModel.findByEmail(normalizeEmailInput(email));

  if (existingUser && String(existingUser.id) !== String(currentUserId)) {
    return 'A user with this email already exists.';
  }

  return null;
};

const listUsers = async (req, res, next) => {
  try {
    const users = await userModel.listAll({
      includeDeleted: req.user.role === 'admin' && req.query.includeDeleted === 'true',
      role: req.query.role,
      departmentId: req.query.departmentId,
      supervisorId: req.user.role === 'supervisor' ? req.user.id : req.query.supervisorId,
      search: req.query.search
    });

    res.json({ users });
  } catch (error) {
    next(error);
  }
};

const getProfile = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!(await canViewUser(req.user, id))) {
      return res.status(403).json({ message: 'You do not have permission to view this profile.' });
    }

    const user = await userModel.findById(id);
    if (!user || user.isDeleted) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const leaveBalances = await leaveModel.getBalancesForUser(id);
    res.json({ user, leaveBalances });
  } catch (error) {
    next(error);
  }
};

const createUser = async (req, res, next) => {
  try {
    const { employeeNo, firstName, lastName, email, phone, role, roleTitle, gender, departmentId, supervisorId, joinedAt, positionTitle, password } = req.body;
    const normalizedEmail = normalizeEmailInput(email);
    const normalizedJoinedAt = normalizeJoinedAtInput(joinedAt);

    if (!firstName || !lastName || !normalizedEmail || !role || !password) {
      return res.status(400).json({ message: 'Names, email, role, and password are required.' });
    }

    const resolvedRoleAssignment = await resolveRoleAssignment({ role, roleTitle });
    if (resolvedRoleAssignment.error) {
      return res.status(400).json({ message: resolvedRoleAssignment.error });
    }

    if (gender && !allowedGenders.includes(gender)) {
      return res.status(400).json({ message: 'Selected gender is invalid.' });
    }

    if (phone && !/^\d+$/.test(String(phone))) {
      return res.status(400).json({ message: 'Phone number must contain digits only.' });
    }

    if (normalizedJoinedAt === 'invalid') {
      return res.status(400).json({ message: 'Joined date must be a valid past or current date.' });
    }

    const emailConflictMessage = await ensureEmailAvailable({ email: normalizedEmail });
    if (emailConflictMessage) {
      return res.status(400).json({ message: emailConflictMessage });
    }

    if (supervisorId) {
      const supervisor = await userModel.findById(supervisorId);
      if (!supervisor || supervisor.isDeleted) {
        return res.status(400).json({ message: 'Selected supervisor was not found.' });
      }
    }

    const passwordHash = await hashPassword(password);
    const user = await userModel.create({
      employeeNo: employeeNo || null,
      firstName,
      lastName,
      email: normalizedEmail,
      phone,
      role: resolvedRoleAssignment.role,
      roleTitle: resolvedRoleAssignment.roleTitle,
      gender: gender || null,
      departmentId: departmentId || null,
      supervisorId: supervisorId || null,
      joinedAt: normalizedJoinedAt,
      positionTitle,
      passwordHash
    });

    await leaveModel.ensureLeaveBalancesForAllUsers();

    await logAction({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'USER_CREATE',
      entityType: 'user',
      entityId: String(user.id),
      description: `${req.user.fullName} created user ${user.fullName}.`,
      metadata: { createdRole: user.role, email: user.email },
      ipAddress: req.ip
    });

    res.status(201).json({ user });
  } catch (error) {
    next(error);
  }
};

const updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const normalizedEmail = Object.prototype.hasOwnProperty.call(req.body, 'email') ? normalizeEmailInput(req.body.email) : undefined;
    const normalizedJoinedAt = normalizeJoinedAtInput(req.body.joinedAt);

    if (!canManageUser(req.user, id)) {
      return res.status(403).json({ message: 'You do not have permission to update this profile.' });
    }

    if (normalizedJoinedAt === 'invalid') {
      return res.status(400).json({ message: 'Joined date must be a valid past or current date.' });
    }

    const target = await userModel.findById(id);
    if (!target || target.isDeleted) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const isManager = req.user.role === 'admin' || req.user.role === 'ceo';
    const payload = isManager
      ? {
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        email: normalizedEmail,
        phone: req.body.phone,
        positionTitle: req.body.positionTitle,
        gender: req.body.gender
      }
      : {
        phone: req.body.phone
      };

    if (isManager) {
      if (req.body.supervisorId && String(req.body.supervisorId) === String(id)) {
        return res.status(400).json({ message: 'A user cannot be assigned as their own supervisor.' });
      }

      if (req.body.phone && !/^\d+$/.test(String(req.body.phone))) {
        return res.status(400).json({ message: 'Phone number must contain digits only.' });
      }

      if (req.body.supervisorId) {
        const supervisor = await userModel.findById(req.body.supervisorId);
        if (!supervisor || supervisor.isDeleted) {
          return res.status(400).json({ message: 'Selected supervisor was not found.' });
        }
      }

      if (normalizedEmail !== undefined) {
        const emailConflictMessage = await ensureEmailAvailable({ email: normalizedEmail, currentUserId: id });
        if (emailConflictMessage) {
          return res.status(400).json({ message: emailConflictMessage });
        }
      }

      if (Object.prototype.hasOwnProperty.call(req.body, 'role') || Object.prototype.hasOwnProperty.call(req.body, 'roleTitle')) {
        const resolvedRoleAssignment = await resolveRoleAssignment({
          role: req.body.role || target.role,
          roleTitle: req.body.roleTitle || target.roleTitle
        });
        if (resolvedRoleAssignment.error) {
          return res.status(400).json({ message: resolvedRoleAssignment.error });
        }
        payload.role = resolvedRoleAssignment.role;
        payload.roleTitle = resolvedRoleAssignment.roleTitle;
      }

      if (Object.prototype.hasOwnProperty.call(req.body, 'gender') && req.body.gender && !allowedGenders.includes(req.body.gender)) {
        return res.status(400).json({ message: 'Selected gender is invalid.' });
      }

      if (Object.prototype.hasOwnProperty.call(req.body, 'employeeNo')) {
        payload.employeeNo = req.body.employeeNo || null;
      }

      if (Object.prototype.hasOwnProperty.call(req.body, 'departmentId')) {
        payload.departmentId = req.body.departmentId || null;
      }

      if (Object.prototype.hasOwnProperty.call(req.body, 'joinedAt')) {
        payload.joinedAt = normalizedJoinedAt;
      }

      if (Object.prototype.hasOwnProperty.call(req.body, 'supervisorId')) {
        payload.supervisorId = req.body.supervisorId || null;
      }

      payload.isActive = typeof req.body.isActive === 'boolean' ? req.body.isActive : undefined;
    } else if (req.body.phone && !/^\d+$/.test(String(req.body.phone))) {
      return res.status(400).json({ message: 'Phone number must contain digits only.' });
    }

    const user = await userModel.update(id, payload);

    await logAction({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'USER_UPDATE',
      entityType: 'user',
      entityId: String(user.id),
      description: `${req.user.fullName} updated user ${user.fullName}.`,
      metadata: { updatedFields: Object.keys(payload).filter((key) => payload[key] !== undefined) },
      ipAddress: req.ip
    });

    res.json({ user });
  } catch (error) {
    next(error);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ message: 'A new password is required.' });
    }

    const target = await userModel.findById(id);
    if (!target || target.isDeleted) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const passwordHash = await hashPassword(password);
    await userModel.update(id, { passwordHash });

    await logAction({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'PASSWORD_RESET',
      entityType: 'user',
      entityId: String(id),
      description: `${req.user.fullName} reset credentials for ${target.fullName}.`,
      metadata: {},
      ipAddress: req.ip
    });

    res.json({ message: 'Password reset successfully.' });
  } catch (error) {
    next(error);
  }
};

const changePassword = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { currentPassword, newPassword } = req.body;

    if (String(req.user.id) !== String(id)) {
      return res.status(403).json({ message: 'You can only change your own password from this page.' });
    }

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current password and new password are required.' });
    }

    const authUser = await userModel.findByEmail(req.user.email);
    if (!authUser || authUser.isDeleted) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const passwordMatches = await comparePassword(currentPassword, authUser.passwordHash);
    if (!passwordMatches) {
      return res.status(400).json({ message: 'Current password is incorrect.' });
    }

    const passwordHash = await hashPassword(newPassword);
    await userModel.update(id, { passwordHash });

    await logAction({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'PASSWORD_CHANGE',
      entityType: 'user',
      entityId: String(id),
      description: `${req.user.fullName} changed their password.`,
      metadata: {},
      ipAddress: req.ip
    });

    res.json({ message: 'Password changed successfully.' });
  } catch (error) {
    next(error);
  }
};

const softDeleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (String(req.user.id) === String(id)) {
      return res.status(400).json({ message: 'You cannot soft delete your own account.' });
    }

    if (!['admin', 'ceo'].includes(req.user.role)) {
      return res.status(403).json({ message: 'You do not have permission to delete users.' });
    }

    const target = await userModel.findById(id);
    if (!target || target.isDeleted) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const { user, cleanup } = await deleteEmployeeData(id);

    await logAction({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'USER_SOFT_DELETE',
      entityType: 'admin_action',
      entityId: String(req.user.id),
      description: `${req.user.fullName} soft deleted ${target.fullName}.`,
      metadata: { targetUserId: String(id), cleanup },
      ipAddress: req.ip
    });

    res.json({ user, cleanup });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listUsers,
  getProfile,
  createUser,
  updateUser,
  changePassword,
  resetPassword,
  softDeleteUser
};
