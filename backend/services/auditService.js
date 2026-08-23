const auditModel = require('../models/auditModel');

const logAction = async ({ actorUserId, actorRole, action, entityType, entityId, description, metadata, ipAddress }) => {
  try {
    await auditModel.create({
      actorUserId: actorUserId || null,
      actorRole: actorRole || null,
      action,
      entityType,
      entityId,
      description,
      metadata: metadata || {},
      ipAddress: ipAddress || null
    });
  } catch (error) {
    console.error('Failed to write audit log', error);
  }
};

module.exports = {
  logAction
};
