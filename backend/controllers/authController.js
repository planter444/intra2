const userModel = require('../models/userModel');
const env = require('../config/env');
const { comparePassword, hashPassword, signPasswordResetToken, signToken, verifyPasswordResetToken } = require('../services/authService');
const { logAction } = require('../services/auditService');
const { sendPasswordResetEmail } = require('../services/mailService');
const { getSystemSettings } = require('../services/settingsService');

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const user = await userModel.findByEmail(email);

    if (!user || user.isDeleted) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const passwordMatches = await comparePassword(password, user.passwordHash);

    if (!passwordMatches) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const updatedUser = await userModel.update(user.id, { lastLoginAt: new Date() });
    const token = signToken(updatedUser);
    const settings = await getSystemSettings();

    await logAction({
      actorUserId: updatedUser.id,
      actorRole: updatedUser.role,
      action: 'LOGIN',
      entityType: 'auth',
      entityId: String(updatedUser.id),
      description: `${updatedUser.fullName} logged into the HRMS.`,
      metadata: { email: updatedUser.email },
      ipAddress: req.ip
    });

    return res.json({
      token,
      user: updatedUser,
      settings
    });
  } catch (error) {
    next(error);
  }
};

const me = async (req, res, next) => {
  try {
    const settings = await getSystemSettings();
    res.json({ user: req.user, settings });
  } catch (error) {
    next(error);
  }
};

const forgotPassword = async (req, res, next) => {
  try {
    const email = String(req.body?.email || '').trim();
    if (!email) {
      return res.status(400).json({ message: 'Email is required.' });
    }

    const user = await userModel.findByEmail(email);
    if (user && !user.isDeleted && user.isActive) {
      const token = signPasswordResetToken(user);
      const resetUrl = `${String(env.frontendUrl || '').replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(token)}`;

      await sendPasswordResetEmail({
        toEmail: user.email,
        toName: user.fullName,
        resetUrl
      });

      await logAction({
        actorUserId: user.id,
        actorRole: user.role,
        action: 'PASSWORD_RESET_REQUEST',
        entityType: 'auth',
        entityId: String(user.id),
        description: `${user.fullName} requested a password reset email.`,
        metadata: { email: user.email },
        ipAddress: req.ip
      });
    }

    return res.json({ message: 'If that email exists in the system, a password reset link has been sent.' });
  } catch (error) {
    next(error);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const token = String(req.body?.token || '').trim();
    const password = String(req.body?.password || '');

    if (!token || !password) {
      return res.status(400).json({ message: 'Reset token and new password are required.' });
    }

    const payload = verifyPasswordResetToken(token);
    if (payload?.purpose !== 'password_reset') {
      return res.status(400).json({ message: 'This password reset link is invalid.' });
    }

    const user = await userModel.findById(payload.sub);
    if (!user || user.isDeleted || !user.isActive || String(user.email).toLowerCase() !== String(payload.email || '').toLowerCase()) {
      return res.status(400).json({ message: 'This password reset link is no longer valid.' });
    }

    const passwordHash = await hashPassword(password);
    await userModel.update(user.id, { passwordHash });

    await logAction({
      actorUserId: user.id,
      actorRole: user.role,
      action: 'PASSWORD_RESET_COMPLETE',
      entityType: 'auth',
      entityId: String(user.id),
      description: `${user.fullName} completed a password reset.`,
      metadata: { email: user.email },
      ipAddress: req.ip
    });

    return res.json({ message: 'Password reset successfully.' });
  } catch (error) {
    if (error?.name === 'TokenExpiredError') {
      return res.status(400).json({ message: 'This password reset link has expired. Please request a new one.' });
    }

    if (error?.name === 'JsonWebTokenError') {
      return res.status(400).json({ message: 'This password reset link is invalid.' });
    }

    next(error);
  }
};

module.exports = {
  forgotPassword,
  login,
  me,
  resetPassword
};
