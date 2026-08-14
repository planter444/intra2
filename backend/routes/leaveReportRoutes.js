const express = require('express');
const { authenticate } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const { getLeaveReportData, getLeaveReportFilters } = require('../controllers/leaveReportController');

const router = express.Router();

router.use(authenticate);

// Leave report routes - restricted to CEO and IT Officer
router.get('/data', authorize('admin', 'ceo'), getLeaveReportData);
router.get('/filters', authorize('admin', 'ceo'), getLeaveReportFilters);

module.exports = router;
