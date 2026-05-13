const { getSystemSettings, updateSystemSettings, restoreSystemSettings } = require('../services/settingsService');
const { logAction } = require('../services/auditService');

const getSettings = async (req, res, next) => {
  try {
    const settings = await getSystemSettings();
    res.json({ settings });
  } catch (error) {
    next(error);
  }
};

const updateSettings = async (req, res, next) => {
  try {
    const settings = await updateSystemSettings({ currentUser: req.user, updates: req.body });

    await logAction({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'SETTINGS_UPDATE',
      entityType: 'system_settings',
      entityId: 'global',
      description: `${req.user.fullName} updated HRMS settings.`,
      metadata: { keys: Object.keys(req.body || {}) },
      ipAddress: req.ip
    });

    res.json({ settings });
  } catch (error) {
    next(error);
  }
};

const restoreSettings = async (req, res, next) => {
  try {
    const settings = await restoreSystemSettings({ currentUser: req.user });

    await logAction({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'SETTINGS_RESTORE_DEFAULTS',
      entityType: 'system_settings',
      entityId: 'global',
      description: `${req.user.fullName} restored default HRMS settings.`,
      metadata: {},
      ipAddress: req.ip
    });

    res.json({ settings });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSettings,
  updateSettings,
  restoreSettings
};
