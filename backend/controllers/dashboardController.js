const userModel = require('../models/userModel');
const leaveModel = require('../models/leaveModel');
const documentModel = require('../models/documentModel');

const getDashboardSummary = async (req, res, next) => {
  try {
    const roleCounts = await userModel.countByRole();
    const canViewOrgMetrics = !['employee', 'supervisor'].includes(req.user.role);
    const leaveSummary = canViewOrgMetrics
      ? await leaveModel.getSummaryStats()
      : await leaveModel.getSummaryStatsForUser(req.user.id);
    const leaveBalances = await leaveModel.getBalancesForUser(req.user.id);
    const myDocuments = await documentModel.listForUser(req.user.id);

    res.json({
      summary: {
        currentUserRole: req.user.role,
        headcount: canViewOrgMetrics ? Object.values(roleCounts).reduce((total, value) => total + value, 0) : null,
        roleCounts: canViewOrgMetrics ? roleCounts : null,
        pendingLeaves: leaveSummary.pendingLeaves,
        approvedLeaves: leaveSummary.approvedLeaves,
        myLeaveBalanceTypes: leaveBalances.length,
        myDocuments: myDocuments.length
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDashboardSummary
};
