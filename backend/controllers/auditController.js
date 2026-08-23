const auditModel = require('../models/auditModel');

const listLogs = async (req, res, next) => {
  try {
    const limit = Number(req.query.limit || 100);
    const logs = await auditModel.list({ limit });
    res.json({ logs });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listLogs
};
